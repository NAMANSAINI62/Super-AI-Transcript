import sqlite3
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Database file path - will be created automatically in the same directory
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'super_ai_transcript.db')

def get_connection():
    try:
        connection = sqlite3.connect(DATABASE_PATH)
        # Enable dictionary-like access to rows
        connection.row_factory = sqlite3.Row
        return connection
    except Exception as e:
        print(f"Error connecting to SQLite: {e}")
        raise e


def init_db():
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # Create recordings table
        create_recordings_table = """
        CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            audio_data BLOB,
            audio_mime_type TEXT DEFAULT 'audio/webm',
            original_transcript TEXT,
            cleaned_transcript TEXT,
            cleaning_engine TEXT,
            summary TEXT,
            key_points TEXT,
            action_items TEXT,
            duration_seconds INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
        cursor.execute(create_recordings_table)
        
        # Create QA table
        create_qa_table = """
        CREATE TABLE IF NOT EXISTS qa_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id INTEGER,
            question TEXT NOT NULL,
            answer TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
        )
        """
        cursor.execute(create_qa_table)
        
        connection.commit()
        print(f"✅ SQLite Database initialized at {DATABASE_PATH}")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def save_recording(filename, audio_data, audio_mime_type, original_transcript,
                   cleaned_transcript=None, cleaning_engine=None):
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        sql = """
        INSERT INTO recordings 
        (filename, audio_data, audio_mime_type, original_transcript, 
         cleaned_transcript, cleaning_engine)
        VALUES (?, ?, ?, ?, ?, ?)
        """
        
        cursor.execute(sql, (filename, audio_data, audio_mime_type,
                            original_transcript, cleaned_transcript, cleaning_engine))
        
        connection.commit()
        return cursor.lastrowid
        
    except Exception as e:
        print(f"Error saving recording: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def update_recording(recording_id, **updates):
    if not updates:
        return
        
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        # Update updated_at timestamp automatically
        updates['updated_at'] = datetime.now()
        
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        values.append(recording_id)
        
        sql = f"UPDATE recordings SET {set_clause} WHERE id = ?"
        cursor.execute(sql, values)
        connection.commit()
        
    except Exception as e:
        print(f"Error updating recording: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def get_all_recordings(limit=50):
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        sql = """
        SELECT id, filename, audio_mime_type, original_transcript, 
               cleaned_transcript, cleaning_engine, summary, key_points,
               action_items, duration_seconds, created_at, updated_at
        FROM recordings
        ORDER BY created_at DESC
        LIMIT ?
        """
        cursor.execute(sql, (limit,))
        rows = cursor.fetchall()
        
        # Convert sqlite3.Row objects to dictionaries
        recordings = []
        for row in rows:
            rec = dict(row)
            # Ensure timestamps are strings
            if rec['created_at'] and not isinstance(rec['created_at'], str):
                 rec['created_at'] = str(rec['created_at'])
            if rec['updated_at'] and not isinstance(rec['updated_at'], str):
                 rec['updated_at'] = str(rec['updated_at'])
            recordings.append(rec)
            
        return recordings
        
    except Exception as e:
        print(f"Error fetching recordings: {e}")
        return []
    finally:
        if connection:
            connection.close()


def get_recording_by_id(recording_id, include_audio=False):
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        if include_audio:
            sql = "SELECT * FROM recordings WHERE id = ?"
        else:
            sql = """
            SELECT id, filename, audio_mime_type, original_transcript, 
                   cleaned_transcript, cleaning_engine, summary, key_points,
                   action_items, duration_seconds, created_at, updated_at
            FROM recordings WHERE id = ?
            """
            
        cursor.execute(sql, (recording_id,))
        row = cursor.fetchone()
        
        if row:
            recording = dict(row)
            # Ensure timestamps are strings
            if recording.get('created_at') and not isinstance(recording['created_at'], str):
                recording['created_at'] = str(recording['created_at'])
            if recording.get('updated_at') and not isinstance(recording['updated_at'], str):
                recording['updated_at'] = str(recording['updated_at'])
            return recording
        return None
        
    except Exception as e:
        print(f"Error fetching recording {recording_id}: {e}")
        return None
    finally:
        if connection:
            connection.close()


def get_audio_data(recording_id):
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        sql = "SELECT audio_data, audio_mime_type FROM recordings WHERE id = ?"
        cursor.execute(sql, (recording_id,))
        result = cursor.fetchone()
        
        if result:
            return result['audio_data'], result['audio_mime_type']
        return None, None
        
    except Exception as e:
        print(f"Error fetching audio for recording {recording_id}: {e}")
        return None, None
    finally:
        if connection:
            connection.close()


def delete_recording(recording_id):
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        sql = "DELETE FROM recordings WHERE id = ?"
        cursor.execute(sql, (recording_id,))
        connection.commit()
        
        return cursor.rowcount > 0
        
    except Exception as e:
        print(f"Error deleting recording {recording_id}: {e}")
        return False
    finally:
        if connection:
            connection.close()


def save_qa(recording_id, question, answer):
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        sql = """
        INSERT INTO qa_history (recording_id, question, answer)
        VALUES (?, ?, ?)
        """
        cursor.execute(sql, (recording_id, question, answer))
        connection.commit()
        
        return cursor.lastrowid
        
    except Exception as e:
        print(f"Error saving Q&A: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def get_qa_history(recording_id):
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        sql = """
        SELECT id, question, answer, created_at
        FROM qa_history
        WHERE recording_id = ?
        ORDER BY created_at DESC
        """
        cursor.execute(sql, (recording_id,))
        rows = cursor.fetchall()
        
        qa_list = []
        for row in rows:
            qa = dict(row)
            if qa['created_at'] and not isinstance(qa['created_at'], str):
                 qa['created_at'] = str(qa['created_at'])
            qa_list.append(qa)
            
        return qa_list
        
    except Exception as e:
        print(f"Error fetching Q&A history: {e}")
        return []
    finally:
        if connection:
            connection.close()

if __name__ == "__main__":
    print("Testing SQLite database module...")
    init_db()
    print("Database initialized.")
