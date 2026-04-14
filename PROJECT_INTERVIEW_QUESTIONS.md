# Super AI Transcript - Project Interview Questions

### **1. High-Level / Architectural Questions**
*   **"Can you give me a 2-minute overview of this project?"**
    *   *Focus*: Explain the problem (messy audio) and your solution (Full-stack AI transcription with offline reliability).
*   **"Why did you choose Flask for the backend instead of other frameworks like Django or FastAPI?"**
    *   *Focus*: Mention Flask's lightweight nature and ease of routing for a micro-service-style project.
*   **"Walk me through the lifecycle of an audio file in your system from the moment the user hits 'Record'."**
    *   *Focus*: Recording (Browser) -> API Transfer -> DB Save -> Whisper Transcription -> AI Enhancement -> UI Update.

### **2. AI & Machine Learning Questions**
*   **"How does OpenAI Whisper work, and why did you use it over a cloud-based API like Google Speech-to-Text?"**
    *   *Focus*: Mention it's an open-source model that provides high-quality results locally, which saves cost and increases privacy.
*   **"Explain your AI fallback mechanism. Why is it important?"**
    *   *Focus*: If the cloud (Gemini) fails, Ollama takes over. It ensures the app is "Production-Ready" and resilient to network failures.
*   **"What is the difference between the 'Clean' and 'Summary' features in your code?"**
    *   *Focus*: 'Clean' removes fillers/stuttering (Text-to-Text), while 'Summary' extracts meaning and action items (NLP analysis).

### **3. Backend & Data Management Questions**
*   **"Why did you use SQLite to store raw audio? Isn't it better to store them in a folder?"**
    *   *Focus*: Storing in DB ensures the audio and its transcript are always linked. SQLite is easy to move and backup as a single file. (Mention the "Blob" type).
*   **"How do you handle large audio files to prevent the server from crashing?"**
    *   *Focus*: Mention the use of temporary files and the `MediaRecorder API` which sends data in manageable chunks.
*   **"What does your database schema look like?"**
    *   *Focus*: Talk about the `recordings` table containing ID, raw_audio, original_transcript, summary, and timestamps.

### **4. Problem-Solving & Challenges**
*   **"What was the most difficult part of this project?"**
    *   *Focus*: Likely synchronizing the front-end recording with the backend processing or handling the asynchronous nature of transcription.
*   **"If you had to scale this app for 10,000 users, what would you change?"**
    *   *Focus*: Move audio storage to AWS S3, upgrade the DB to PostgreSQL, and use a task queue like Celery to handle long-running transcriptions.

### **5. Tools & Deployment**
*   **"What is the role of Docker in your project?"**
    *   *Focus*: It packages the code, Whisper models, and FFmpeg dependencies into one container so it runs the same on any computer.
*   **"How do you secure your Gemini API Key?"**
    *   *Focus*: Using `.env` files and `python-dotenv` so the key is never hardcoded in the script or pushed to GitHub.
