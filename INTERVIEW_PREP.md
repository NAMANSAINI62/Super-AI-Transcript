# 🎙️ Super AI Transcript - Interview Preparation

## ❓ Main Question: "Can you explain the architecture and workflow of your project?"

### **3. System Architecture (Detailed Explanation)**

This project is designed using a **Client–Server Architecture** with a persistent database layer. In this architecture, the system is divided into multiple components, and each component has a clearly defined role. All components work together to record audio, convert it into text, enhance the text using AI, and store everything safely for future use.

The main components of the system are the **Client (Frontend)**, **Server (Backend – Flask)**, **Database (SQLite)**, and **AI Models** (Whisper, Google Gemini, and Ollama).

#### **Client / Frontend**
The frontend is built using **HTML, CSS, and JavaScript** and runs inside the user’s web browser. It acts as the interaction layer between the user and the system.

The frontend is responsible for:
- Capturing audio using the **MediaRecorder API**.
- Sending audio files and text-based requests to the backend.
- Displaying the results received from the server (transcribed text, AI-generated summaries, cleaned transcripts).
- Managing the complete recording history.

Users can record audio, view past recordings, play stored audio files, and delete saved data directly from the interface. The frontend **does not** perform any audio processing or AI-related tasks; its role is limited to sending requests and presenting responses, keeping it lightweight and efficient.

#### **Server / Backend (Flask – app.py)**
The backend, developed using **Flask**, acts as the central controller of the entire system. It manages communication between the frontend, database, and AI models.

The backend:
- Receives audio and text requests from the frontend.
- **Immediately saves** incoming data to prevent loss.
- Processes audio using AI models.
- Interacts with the database.
- Sends structured JSON responses back to the frontend.

**Key API endpoints include:**
- `POST /api/transcribe`: For converting audio to text.
- `POST /api/summary`: For generating smart summaries.
- `POST /api/clean`: For cleaning transcripts.
- `GET /api/recordings`: For retrieving saved history.

#### **Database Layer (SQLite)**
The system uses **SQLite** as a lightweight and persistent database. SQLite is chosen because it is fast, simple to use, does not require a separate server, and is ideal for small to medium-scale applications.

The database stores:
- **Raw audio files** (stored as binary blobs).
- Transcribed text.
- AI-generated summaries.
- Creation timestamps for each record.

> **Critical Design Decision**: The backend **immediately saves the raw audio** as soon as it is received. This ensures there is **no data loss**, and the audio remains available even if transcription or AI processing fails.

#### **AI & Processing Layer**
The AI layer is responsible for speech-to-text conversion and intelligent text enhancement.

- **Whisper (Local Model)**: Used for speech-to-text transcription. It runs locally on the server, converts audio files into readable text, and does not require an internet connection once installed.
- **Google Gemini API**: Used for advanced AI tasks such as generating smart summaries and cleaning transcripts. It provides high-quality language understanding and accurate text processing.
- **Ollama (Local AI)**: Acts as a **fallback system**. If Google Gemini fails due to network issues or API key problems, the backend automatically switches to Ollama. This fallback mechanism ensures the system remains functional even offline, increasing reliability and robustness.

---

### **4. How It Works (Request Flow – Detailed)**

#### **A. Recording & Transcription Flow**
1.  **Capture**: When the user clicks the "Record" button, the browser accesses the microphone using the **MediaRecorder API** and records audio in small chunks.
2.  **Submission**: Once the user stops recording, JavaScript combines these chunks into a single audio blob, converts it into a `FormData` object, and sends it to the backend using a `POST` request to `/api/transcribe`.
3.  **Processing**:
    - The Flask backend receives the audio file and **immediately saves the raw audio bytes** into the SQLite database.
    - The backend checks for `ffmpeg`.
    - It loads the **Whisper model** and executes `model.transcribe()`.
4.  **Response**: The generated transcript is saved in the same database record, and a JSON response containing the transcript is sent back to the frontend to update the UI.

#### **B. AI Enhancement Flow (Summary & Cleaning)**
1.  **Request**: When the user selects "Smart Summary" or "Clean Transcript", the frontend sends the request to the backend.
2.  **AI Call**: The backend creates a structured prompt and sends the text to the **Google Gemini API**.
3.  **Fallback**: If Gemini fails, the backend automatically switches to **Ollama**.
4.  **Result**: The AI-generated result is returned to the frontend as JSON and displayed.

#### **C. History & Data Persistence Flow**
1.  **Load**: When the page loads, the frontend sends a `GET /api/recordings` request.
2.  **Query**: The backend queries the database: `SELECT * FROM recordings ORDER BY created_at DESC;`.
3.  **Render**: All stored data (audio, transcripts, summaries) is returned. If the user deletes a record, the backend removes it from SQLite permanently.
