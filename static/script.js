let mediaRecorder = null;      // Holds the MediaRecorder instance for browser audio capture
let audioChunks = [];          // Array to store recorded audio data chunks
let recordingStartTime = null; // When recording started (for timer)
let timerInterval = null;      // Interval ID for updating timer display
let currentRecordingId = null; // ID of the currently loaded recording from database
let audioContext = null;       // For audio visualization
let analyser = null;          // Audio analyser for visualization
const recordButton = document.getElementById('recordButton');
const recordingTimer = document.getElementById('recordingTimer');
const timerDisplay = document.getElementById('timerDisplay');
const audioVisualizer = document.getElementById('audioVisualizer');
const uploadArea = document.getElementById('uploadArea');
const audioFileInput = document.getElementById('audioFileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFile');
const transcribeButton = document.getElementById('transcribeButton');
const originalTranscript = document.getElementById('originalTranscript');
const cleanedTranscript = document.getElementById('cleanedTranscript');
const originalWordCount = document.getElementById('originalWordCount');
const cleanedWordCount = document.getElementById('cleanedWordCount');
const copyCleanedBtn = document.getElementById('copyCleanedBtn');
const cleanButton = document.getElementById('cleanButton');
const generateSummaryBtn = document.getElementById('generateSummaryBtn');
const summaryResults = document.getElementById('summaryResults');
const questionInput = document.getElementById('questionInput');
const askButton = document.getElementById('askButton');
const answerDisplay = document.getElementById('answerDisplay');
const answerText = document.getElementById('answerText');
const getLearningTipsBtn = document.getElementById('getLearningTipsBtn');
const learningResults = document.getElementById('learningResults');
const historyList = document.getElementById('historyList');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const toastContainer = document.getElementById('toastContainer');
const saveModal = document.getElementById('saveModal');

let currentAudio = null; // Track currently playing audio

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Super AI Transcript initialized');

    // Set up all event listeners
    setupEventListeners();

    // Load recording history from database
    loadRecordingHistory();

    // Enable/disable buttons based on transcript content
    updateButtonStates();
});
function setupEventListeners() {
    recordButton.addEventListener('click', toggleRecording);
    uploadArea.addEventListener('click', () => audioFileInput.click());
    audioFileInput.addEventListener('change', handleFileSelect);

    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    removeFileBtn.addEventListener('click', clearSelectedFile);
    transcribeButton.addEventListener('click', transcribeAudio);
    cleanButton.addEventListener('click', cleanTranscript);
    originalTranscript.addEventListener('input', () => {
        updateWordCount(originalTranscript, originalWordCount);
        updateButtonStates();
    });
    copyCleanedBtn.addEventListener('click', copyCleanedTranscript);
    generateSummaryBtn.addEventListener('click', generateSummary);
    askButton.addEventListener('click', askQuestion);

    // Press Enter to ask question
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') askQuestion();
    });

    // Quick question buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            questionInput.value = btn.dataset.question;
            askQuestion();
        });
    });

    getLearningTipsBtn.addEventListener('click', getLearningTips);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    refreshHistoryBtn.addEventListener('click', loadRecordingHistory);
    document.getElementById('confirmSaveBtn').addEventListener('click', confirmSaveRecording);
    document.getElementById('cancelSaveBtn').addEventListener('click', () => {
        saveModal.classList.add('hidden');
    });
}
async function toggleRecording() {
    const isRecording = recordButton.dataset.recording === 'true';

    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}
async function startRecording() {
    try {
        // Request microphone access
        // WHY await? getUserMedia is async, we wait for user permission
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                // Audio constraints for better quality
                echoCancellation: true,  // Reduce echo
                noiseSuppression: true,  // Reduce background noise
                sampleRate: 44100        // CD quality sample rate
            }
        });

        // Create MediaRecorder to capture the stream
        // WHY webm? It's widely supported and efficient
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm'
        });

        // Reset audio chunks array
        audioChunks = [];

        // When data is available, push to chunks array
        // WHY ondataavailable? Audio is captured in chunks, not all at once
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        // When recording stops, process the audio
        mediaRecorder.onstop = handleRecordingComplete;

        // Start recording
        // timeslice: collect chunks every second
        mediaRecorder.start(1000);

        // Update UI
        recordButton.dataset.recording = 'true';
        recordButton.querySelector('.btn-text').textContent = 'Stop Recording';
        recordButton.querySelector('.btn-icon').textContent = '⏹️';
        recordButton.classList.remove('btn-primary');
        recordButton.classList.add('btn-accent');

        // Show timer
        recordingStartTime = Date.now();
        recordingTimer.classList.remove('hidden');
        timerInterval = setInterval(updateRecordingTimer, 1000);

        // Set up audio visualization
        setupAudioVisualization(stream);

        // Disable file upload while recording
        uploadArea.style.pointerEvents = 'none';
        uploadArea.style.opacity = '0.5';

        showToast('Recording started...', 'info');

    } catch (error) {
        // Handle errors (permission denied, no microphone, etc.)
        console.error('Error starting recording:', error);

        if (error.name === 'NotAllowedError') {
            showToast('Microphone access denied. Please allow microphone access.', 'error');
        } else if (error.name === 'NotFoundError') {
            showToast('No microphone found. Please connect a microphone.', 'error');
        } else {
            showToast('Error starting recording: ' + error.message, 'error');
        }
    }
}
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    recordButton.dataset.recording = 'false';
    recordButton.querySelector('.btn-text').textContent = 'Start Recording';
    recordButton.querySelector('.btn-icon').textContent = '⏺️';
    recordButton.classList.remove('btn-accent');
    recordButton.classList.add('btn-primary');
    clearInterval(timerInterval);
    audioVisualizer.classList.add('hidden');
    uploadArea.style.pointerEvents = 'auto';
    uploadArea.style.opacity = '1';
}
function handleRecordingComplete() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

    // Create a File object (needed for FormData)
    const recordingFile = new File(
        [audioBlob],
        `recording_${Date.now()}.webm`,
        { type: 'audio/webm' }
    );

    // Store the file for later upload
    audioFileInput.recordedFile = recordingFile;

    // Update UI to show recording is ready
    fileInfo.classList.remove('hidden');
    fileName.textContent = `Recording (${timerDisplay.textContent})`;
    recordingTimer.classList.add('hidden');

    // Enable transcribe button
    transcribeButton.disabled = false;

    showToast('Recording complete! Click Transcribe to process.', 'success');
}
function updateRecordingTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${seconds}`;
}
function setupAudioVisualization(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioVisualizer.classList.remove('hidden');
    drawVisualization();
}

function drawVisualization() {
    if (!analyser) return;

    const canvas = audioVisualizer;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (recordButton.dataset.recording !== 'true') return;

        requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        // Clear canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw bars
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;

            // Gradient from blue to purple
            const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }
    draw();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        displaySelectedFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    uploadArea.classList.remove('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    uploadArea.classList.remove('dragover');

    // Get dropped files
    const files = event.dataTransfer.files;

    if (files.length > 0) {
        const file = files[0];

        // Validate file type
        const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a',
            'audio/x-m4a', 'audio/webm', 'audio/ogg'];
        const validExtensions = ['.mp3', '.wav', '.m4a', '.webm', '.ogg'];

        const isValidType = validTypes.includes(file.type) ||
            validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (isValidType) {
            // Store file in input for later access
            audioFileInput.files = event.dataTransfer.files;
            displaySelectedFile(file);
        } else {
            showToast('Invalid file type. Please upload MP3, WAV, M4A, WebM, or OGG.', 'error');
        }
    }
}

function displaySelectedFile(file) {
    fileInfo.classList.remove('hidden');
    fileName.textContent = file.name;
    transcribeButton.disabled = false;

    // Clear any recorded file
    audioFileInput.recordedFile = null;

    showToast('File selected. Click Transcribe to process.', 'info');
}

function clearSelectedFile(event) {
    event.stopPropagation();  // Prevent triggering upload area click

    fileInfo.classList.add('hidden');
    audioFileInput.value = '';
    audioFileInput.recordedFile = null;
    transcribeButton.disabled = true;
}

async function transcribeAudio() {

    const file = audioFileInput.recordedFile || audioFileInput.files[0];

    if (!file) {
        showToast('No audio file selected', 'error');
        return;
    }

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('audio', file);

    // Show loading
    showLoading('Transcribing audio...');

    try {
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
            // Note: Don't set Content-Type header, browser sets it automatically for FormData
        });

        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error("Server returned non-JSON response:", text);
            throw new Error(`Server returned error (${response.status}): ${text.substring(0, 100)}...`);
        }

        if (response.ok) {
            // Success - update UI
            originalTranscript.value = data.original_transcript;
            currentRecordingId = data.recording_id;

            // Update word count
            updateWordCount(originalTranscript, originalWordCount);

            // Enable buttons
            updateButtonStates();

            // Refresh history
            loadRecordingHistory();

            showToast('Transcription complete!', 'success');
        } else {
            // Error from server
            throw new Error(data.error || 'Transcription failed');
        }

    } catch (error) {
        console.error('Transcription error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function cleanTranscript() {
    const text = originalTranscript.value.trim();

    if (!text) {
        showToast('No text to clean', 'error');
        return;
    }

    // Default to Gemini (Perplexity option removed)
    const engine = 'gemini';

    showLoading('Cleaning transcript...');

    try {
        const response = await fetch('/api/clean', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                engine: engine,
                recording_id: currentRecordingId
            })
        });

        const data = await response.json();

        if (response.ok) {
            cleanedTranscript.value = data.cleaned_transcript;
            updateWordCount(cleanedTranscript, cleanedWordCount);
            updateButtonStates();
            showToast(`Cleaned with ${data.engine_used}!`, 'success');
        } else {
            throw new Error(data.error || 'Cleaning failed');
        }

    } catch (error) {
        console.error('Cleaning error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function copyCleanedTranscript() {
    const text = cleanedTranscript.value;

    if (!text) {
        showToast('No text to copy', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Failed to copy', 'error');
    }
}

async function generateSummary() {
    const transcript = cleanedTranscript.value || originalTranscript.value;

    if (!transcript.trim()) {
        showToast('No transcript to summarize', 'error');
        return;
    }
    showLoading('Generating summary...');
    try {
        const response = await fetch('/api/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcript: transcript,
                recording_id: currentRecordingId
            })
        });

        const data = await response.json();

        if (response.ok) {
            displaySummary(data);
            showToast('Summary generated!', 'success');
        } else {
            throw new Error(data.error || 'Summary failed');
        }

    } catch (error) {
        console.error('Summary error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displaySummary(data) {
    // Show results container
    summaryResults.classList.remove('hidden');

    // Set title
    document.getElementById('summaryTitle').textContent = data.title || 'Summary';

    // Set key points
    const keyPointsList = document.getElementById('keyPointsList');
    keyPointsList.innerHTML = '';
    (data.key_points || []).forEach(point => {
        const li = document.createElement('li');
        li.textContent = point;
        keyPointsList.appendChild(li);
    });

    // Set action items
    const actionItemsList = document.getElementById('actionItemsList');
    actionItemsList.innerHTML = '';
    (data.action_items || []).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        actionItemsList.appendChild(li);
    });

    // Set summary text
    document.getElementById('summaryText').textContent = data.summary || '';
}

async function askQuestion() {
    const question = questionInput.value.trim();
    const transcript = cleanedTranscript.value || originalTranscript.value;

    if (!question) {
        showToast('Please enter a question', 'error');
        return;
    }

    if (!transcript.trim()) {
        showToast('No transcript to analyze', 'error');
        return;
    }

    showLoading('Analyzing...');

    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                transcript: transcript,
                recording_id: currentRecordingId
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Display answer
            answerDisplay.classList.remove('hidden');
            answerText.textContent = data.answer;

            // Add to history display
            addToQAHistory(question, data.answer);

            // Clear input
            questionInput.value = '';

            showToast('Answer received!', 'success');
        } else {
            throw new Error(data.error || 'Q&A failed');
        }

    } catch (error) {
        console.error('Q&A error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function addToQAHistory(question, answer) {
    const qaHistory = document.getElementById('qaHistory');
    const qaHistoryList = document.getElementById('qaHistoryList');

    qaHistory.classList.remove('hidden');

    const item = document.createElement('div');
    item.className = 'qa-history-item';
    item.innerHTML = `
        <div class="question">Q: ${escapeHtml(question)}</div>
        <div class="answer">${escapeHtml(answer.substring(0, 150))}...</div>
    `;

    qaHistoryList.prepend(item);
}

async function getLearningTips() {
    const transcript = cleanedTranscript.value || originalTranscript.value;
    const topic = document.getElementById('topicInput').value.trim();

    if (!transcript.trim()) {
        showToast('No transcript to analyze', 'error');
        return;
    }

    showLoading('Getting learning suggestions...');

    try {
        const response = await fetch('/api/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcript: transcript,
                topic: topic
            })
        });

        const data = await response.json();

        if (response.ok) {
            displayLearningResults(data);
            showToast('Learning suggestions ready!', 'success');
        } else {
            throw new Error(data.error || 'Learning tips failed');
        }

    } catch (error) {
        console.error('Learning tips error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displayLearningResults(data) {
    learningResults.classList.remove('hidden');

    const betterPhrasesList = document.getElementById('betterPhrasesList');
    betterPhrasesList.innerHTML = '';
    (data.better_phrases || []).forEach(phrase => {
        const li = document.createElement('li');
        li.textContent = phrase;
        betterPhrasesList.appendChild(li);
    });

    const missingPointsList = document.getElementById('missingPointsList');
    missingPointsList.innerHTML = '';
    (data.missing_points || []).forEach(point => {
        const li = document.createElement('li');
        li.textContent = point;
        missingPointsList.appendChild(li);
    });

    const resourcesList = document.getElementById('resourcesList');
    resourcesList.innerHTML = '';
    (data.resources || []).forEach(resource => {
        const li = document.createElement('li');
        li.textContent = resource;
        resourcesList.appendChild(li);
    });

    const roadmapList = document.getElementById('roadmapList');
    roadmapList.innerHTML = '';
    (data.roadmap || []).forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        roadmapList.appendChild(li);
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabName}Tab`);
    });
}

async function loadRecordingHistory() {
    try {
        const response = await fetch('/api/recordings');
        const data = await response.json();

        if (response.ok) {
            displayRecordingHistory(data.recordings || []);
        }

    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function displayRecordingHistory(recordings) {
    historyList.innerHTML = '';

    if (recordings.length === 0) {
        historyList.innerHTML = '<p class="history-empty">No recordings yet. Start by recording or uploading audio!</p>';
        return;
    }

    recordings.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.id = rec.id;

        const date = new Date(rec.created_at.replace(' ', 'T') + 'Z');
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        item.innerHTML = `
            <span class="history-item-icon">🎙️</span>
            <div class="history-item-info">
                <div class="history-item-name">${escapeHtml(rec.filename)}</div>
                <div class="history-item-date">${dateStr}</div>
            </div>
            <div class="history-item-actions">
                <button class="btn-small play-btn" title="Play">▶️</button>
                <button class="btn-small stop-btn" title="Stop">⏹️</button>

                <button class="btn-small delete-btn" title="Delete">🗑️</button>
            </div>
        `;

        // Event listeners for action buttons
        item.querySelector('.play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            playRecording(rec.id);
        });

        item.querySelector('.stop-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            stopRecordingPlayback();
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRecording(rec.id);
        });

        historyList.appendChild(item);
    });
}

async function playRecording(recordingId) {
    // Stop any currently playing audio
    stopRecordingPlayback();

    // Create audio element and play
    currentAudio = new Audio(`/api/recordings/${recordingId}/audio`);

    // Reset when finished
    currentAudio.addEventListener('ended', () => {
        currentAudio = null;
    });

    try {
        await currentAudio.play();
        showToast('Playing recording...', 'info');
    } catch (error) {
        console.error('Playback error:', error);
        showToast('Error playing recording', 'error');
    }
}

function stopRecordingPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        showToast('Playback stopped', 'info');
    }
}

let recordingToDeleteId = null;

document.addEventListener('DOMContentLoaded', () => {
    const deleteModal = document.getElementById('deleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (recordingToDeleteId) {
                await performDelete(recordingToDeleteId);
                recordingToDeleteId = null;
            }
            deleteModal.classList.add('hidden');
        });
    }
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteModal.classList.add('hidden');
            recordingToDeleteId = null;
        });
    }
});

function deleteRecording(recordingId) {
    // Show custom modal instead of native confirm
    recordingToDeleteId = recordingId;
    document.getElementById('deleteModal').classList.remove('hidden');
}

async function performDelete(recordingId) {
    // OPTIMISTIC UI UPDATE: Remove immediately
    const item = document.querySelector(`.history-item[data-id="${recordingId}"]`);
    if (item) {
        item.style.transition = 'opacity 0.3s, transform 0.3s';
        item.style.opacity = '0';
        item.style.transform = 'scale(0.9)';
        setTimeout(() => item.remove(), 300); // Wait for animation
    }

    try {
        const response = await fetch(`/api/recordings/${recordingId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Recording deleted!', 'success');
            // If it was the current one, unload it
            if (currentRecordingId === recordingId) {
                currentRecordingId = null;
                originalTranscript.value = '';
                cleanedTranscript.value = '';
                // Optional: Reset other UI elements
            }
        } else {
            // Revert changes if failed (simple reload for now)
            const data = await response.json();
            throw new Error(data.error || 'Delete failed');
        }

    } catch (error) {
        console.error('Delete error:', error);
        showToast('Error: ' + error.message, 'error');
        // If failed, reload list to restore item
        loadRecordingHistory();
    }
}

function confirmSaveRecording() {
    const name = document.getElementById('recordingName').value.trim();
    if (!name) {
        showToast('Please enter a name', 'error');
        return;
    }
    saveModal.classList.add('hidden');
    showToast('Recording saved!', 'success');
}

function updateWordCount(textarea, countElement) {
    const text = textarea.value.trim();
    const wordCount = text ? text.split(/\s+/).length : 0;
    countElement.textContent = `${wordCount} words`;
}

function updateButtonStates() {
    const hasOriginal = originalTranscript.value.trim().length > 0;
    const hasCleaned = cleanedTranscript.value.trim().length > 0;

    cleanButton.disabled = !hasOriginal;
    generateSummaryBtn.disabled = !hasOriginal && !hasCleaned;
    questionInput.disabled = !hasOriginal && !hasCleaned;
    askButton.disabled = !hasOriginal && !hasCleaned;
    getLearningTipsBtn.disabled = !hasOriginal && !hasCleaned;
}

function showLoading(message = 'Processing...') {
    loadingText.textContent = message;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
