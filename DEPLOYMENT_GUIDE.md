# 🚀 How to Deploy to Hugging Face Spaces

Since your project uses **FFmpeg** (for audio processing), we will use **Docker** to deploy it.

## 1. Prepare Your Files
Ensure you have all these files in your folder (I have already created the `Dockerfile` for you):
*   `app.py` (Updated to handle ports)
*   `Dockerfile` (New!)
*   `requirements.txt`
*   `database.py`
*   `static/` folder
*   `templates/` folder

## 2. Create the Space
1.  Go to [huggingface.co/spaces](https://huggingface.co/spaces).
2.  Click **"Create new Space"**.
3.  **Space Name**: `super-ai-transcript` (or any name you like).
4.  **License**: `MIT`.
5.  **SDK**: Select **Docker** (Critical!).
6.  Click **"Create Space"**.

## 3. Upload Code
You can upload files directly via the browser or use Git.
**Browser Method (Easiest)**:
1.  In your new Space, go to **"Files"**.
2.  Click **"Add file"** -> **"Upload files"**.
3.  Drag and drop **ALL** your project files (`app.py`, `Dockerfile`, `requirements.txt`, `static`, `templates`, `database.py`).
4.  **Important**: Do NOT upload `super_ai_transcript.db` (it will be created automatically) or `.env` (it contains secrets).
5.  Click **"Commit changes to main"**.

## 4. Configure Secrets (API Key)
Your app needs the `GEMINI_API_KEY` to work.
1.  Go to **"Settings"** tab in your Space.
2.  Scroll to **"Variables and secrets"**.
3.  Click **"New secret"**.
4.  **Name**: `GEMINI_API_KEY`.
5.  **Value**: (Paste your actual Gemini API key from your `.env` file).
6.  Click **"Save"**.

## 5. Verify
The Space will start building (you'll see "Building" status).
*   It takes ~2-3 minutes to build the Docker image.
*   Once done, you will see **"Running"**.
*   Open the App tab, and your Super AI Transcript is live! 🌍
