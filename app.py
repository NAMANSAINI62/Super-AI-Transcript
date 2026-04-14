import os
import json
import tempfile
import requests
from flask import Flask, request, jsonify, render_template, send_file, abort
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import io
import time
from dotenv import load_dotenv
import google.generativeai as genai
from database import init_db, save_recording, update_recording, get_all_recordings, get_recording_by_id, save_qa, get_audio_data, delete_recording


# Configuration
load_dotenv()
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
CORS(app)
app.secret_key = os.getenv('SECRET_KEY', 'super_secret_key')

# Bare minimum Rate Limiter setup (using in-memory storage)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Advanced Security: Temporary Ban / Jail System
BANNED_IPS = {}
VIOLATION_COUNTS = {}

@app.before_request
def check_ban():
    ip = get_remote_address()
    if ip in BANNED_IPS:
        if time.time() < BANNED_IPS[ip]:
            abort(403, description="Temporarily banned for spamming. Please wait 5 minutes.")
        else:
            del BANNED_IPS[ip]
            if ip in VIOLATION_COUNTS:
                del VIOLATION_COUNTS[ip]

def get_dynamic_limit():
    """Returns limits based on User Tier (Free vs Premium mock)"""
    tier = request.headers.get('X-User-Tier', 'Standard')
    if tier == 'Explorer':
        return "30 per minute" # Premium tier
    return "5 per minute"      # Free tier

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY: genai.configure(api_key=GEMINI_API_KEY)

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_OLLAMA_MODEL = "phi3"
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Add local bin folder to PATH for FFmpeg (Easy Install)
bin_dir = os.path.join(os.path.dirname(__file__), 'bin')
if os.path.exists(bin_dir):
    os.environ["PATH"] += os.pathsep + bin_dir
    
def call_llm(system, user):
    """Try Local Ollama, fallback to Gemini."""
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": DEFAULT_OLLAMA_MODEL, 
            "prompt": f"{system}\n\nTask: {user}", 
            "stream": False
        }, timeout=120)
        if resp.status_code == 200: 
            print("✅ Using Ollama")
            return resp.json().get('response', '').strip()
    except: pass

    if not GEMINI_API_KEY: raise Exception("AI unavailable")
    for m in ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash']:
        try:
            print(f"🔄 Fallback to Gemini: {m}")
            return genai.GenerativeModel(m).generate_content(f"{system}\n\nTask: {user}").text
        except: continue
    raise Exception("All AI failed")

@app.route('/')
def index(): 
    return render_template('index.html')

@app.route('/api/transcribe', methods=['POST'])
@limiter.limit(get_dynamic_limit) 
def transcribe_audio():
    try:
        if 'audio' not in request.files: 
            return jsonify({'error': 'No audio'}), 400
        
        f = request.files['audio']
        path = os.path.join(UPLOAD_FOLDER, f.filename or 'temp.webm')
        f.save(path)
        
        # SAVE TO DB FIRST (So we never lose the audio)
        f.seek(0)
        file_data = f.read()
        f.seek(0) # Reset for potential future use if needed
        
        # Save initially with empty transcript
        rec_id = save_recording(f.filename, file_data, f.content_type, "")
        print(f"✅ Saved recording {rec_id} to DB")

        # UNLIMITED LOCAL TRANSCRIPTION (WHISPER)
        try:
            import whisper
            import shutil
            
            # Check FFmpeg
            if not shutil.which('ffmpeg'):
                # Still return success for the SAVE, but warn about transcript
                return jsonify({'warning': 'FFmpeg missing, audio saved but not transcribed', 'recording_id': rec_id}), 200
            
            # Load model
            model = whisper.load_model("base") 
            result = model.transcribe(path)
            transcript = result['text'].strip()
            
            # UPDATE DB with transcript
            from database import update_recording
            update_recording(rec_id, original_transcript=transcript)
            
        except Exception as e:
            print(f"Whisper Error: {e}")
            # Return success for the SAVE, but error for transcript
            return jsonify({'warning': f"Audio saved, but transcription failed: {str(e)}", 'recording_id': rec_id}), 200
        
        # if os.path.exists(path): os.unlink(path) # Keep file as per user request
        
        return jsonify({'original_transcript': transcript, 'recording_id': rec_id})
    except Exception as e: 
        return jsonify({'error': str(e)}), 500

@app.route('/api/clean', methods=['POST'])
def clean_text():
    try:
        d = request.get_json() or {}
        if not d.get('text'): return jsonify({'error': 'No text'}), 400
        res = call_llm("Fix grammar, remove fillers. Return ONLY cleaned text.", f"{d.get('text')}")
        if d.get('recording_id'): update_recording(d['recording_id'], cleaned_transcript=res, cleaning_engine='ollama')
        return jsonify({'cleaned_transcript': res})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/summary', methods=['POST'])
def summary():
    try:
        d = request.get_json() or {}
        if not d.get('transcript'): return jsonify({'error': 'No transcript'}), 400
        prompt = "Summarize as JSON with keys: title, key_points (list), summary, action_items (list)."
        res = call_llm(prompt, f"Transcript: {d.get('transcript')}")
        parsed = parse_summary_response(res)
        if d.get('recording_id'): update_recording(d['recording_id'], summary=parsed['summary'], key_points=json.dumps(parsed['key_points']))
        return jsonify(parsed)
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/ask', methods=['POST'])
def ask():
    try:
        d = request.get_json() or {}
        if not d.get('question'): return jsonify({'error': 'No question'}), 400
        res = call_llm("Answer questions based on transcript.", f"Transcript: {d.get('transcript')}\n\nQ: {d.get('question')}")
        if d.get('recording_id'): save_qa(d['recording_id'], d.get('question'), res)
        return jsonify({'answer': res})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/learn', methods=['POST'])
def learn():
    try:
        d = request.get_json() or {}
        if not d.get('transcript'): return jsonify({'error': 'No transcript'}), 400
        prompt = "Provide learning tips. Format: BETTER_PHRASES, MISSING_POINTS, RESOURCES, ROADMAP."
        res = call_llm(prompt, f"Transcript: {d.get('transcript')}")
        return jsonify(parse_learning_response(res))
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/recordings', methods=['GET'])
def list_recordings(): return jsonify({'recordings': get_all_recordings()})

@app.route('/api/recordings/<id>', methods=['DELETE'])
def delete_rec(id):
    try:
        if delete_recording(id): return jsonify({'success': True})
        return jsonify({'error': 'Not found'}), 404
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/recordings/<id>/audio')
def play_recording(id):
    try:
        audio_data, mime_type = get_audio_data(id)
        if not audio_data: return jsonify({'error': 'Not found'}), 404
        
        return send_file(
            io.BytesIO(audio_data),
            mimetype=mime_type,
            as_attachment=False,
            download_name=f"recording_{id}.webm"
        )
    except Exception as e: return jsonify({'error': str(e)}), 500

# Helpers
@app.errorhandler(429)
def ratelimit_handler(e):
    ip = get_remote_address()
    VIOLATION_COUNTS[ip] = VIOLATION_COUNTS.get(ip, 0) + 1
    
    # Strike 5: Jail for 5 minutes
    if VIOLATION_COUNTS[ip] >= 5:
        BANNED_IPS[ip] = time.time() + 300 
        return jsonify(error="Security Violation: You have been temporarily banned for 5 minutes due to API abuse.", banned=True), 403
        
    return jsonify(error=f"Too many requests. Please wait a moment. (Violation {VIOLATION_COUNTS[ip]}/5 before ban)"), 429

@app.errorhandler(403)
def forbidden_handler(e):
    return jsonify(error=e.description, banned=True), 403

def parse_summary_response(text):
    try: 
        if '{' in text: return json.loads(text[text.find('{'):text.rfind('}')+1]) 
    except: pass
    return {'title': 'Summary', 'summary': text, 'key_points': [], 'action_items': []}

def parse_learning_response(text):
    return {'suggestions': {'roadmap': [], 'resources': [], 'missing_points': [], 'better_phrases': [{'original': 'See text', 'improved': text}]}} 

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
