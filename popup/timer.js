// timer.js
const TIMER_STATE_KEY = 'taskSchedulerTimerState';

let timerInterval = null;
let timerTimeLeft = 25 * 60; // in seconds
let timerTotalTime = 25 * 60;
let isTimerRunning = false;
let currentTimerMode = 25; // 25, 5, or 180 (3 hours)

export async function initTimer() {
    // Load state from storage
    const stored = await chrome.storage.local.get(TIMER_STATE_KEY);
    const state = stored[TIMER_STATE_KEY];

    if (state) {
        currentTimerMode = state.mode;
        timerTotalTime = state.total;
        isTimerRunning = state.isRunning;

        if (isTimerRunning) {
            // Calculate how much time passed since last save
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - state.lastUpdated) / 1000);
            timerTimeLeft = Math.max(0, state.timeLeft - elapsedSeconds);

            if (timerTimeLeft > 0) {
                startTimerInterval();
                document.getElementById('startTimerBtn').style.display = 'none';
                document.getElementById('pauseTimerBtn').style.display = 'flex';
            } else {
                // Timer actually finished while popup was closed
                isTimerRunning = false;
                timerTimeLeft = 0;
                document.getElementById('startTimerBtn').style.display = 'flex';
                document.getElementById('pauseTimerBtn').style.display = 'none';
            }
        } else {
            timerTimeLeft = state.timeLeft;
            document.getElementById('startTimerBtn').style.display = 'flex';
            document.getElementById('pauseTimerBtn').style.display = 'none';
        }
    }

    // Set active mode button
    document.querySelectorAll('.timer-mode').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.minutes) === currentTimerMode) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.timer-mode').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const minutes = parseInt(e.target.dataset.minutes);
            setTimerMode(minutes);
        });
    });

    document.getElementById('startTimerBtn').addEventListener('click', startTimer);
    document.getElementById('pauseTimerBtn').addEventListener('click', pauseTimer);
    document.getElementById('resetTimerBtn').addEventListener('click', resetTimer);

    updateTimerDisplay();
}

async function saveTimerState() {
    const state = {
        mode: currentTimerMode,
        timeLeft: timerTimeLeft,
        total: timerTotalTime,
        isRunning: isTimerRunning,
        lastUpdated: Date.now()
    };
    await chrome.storage.local.set({ [TIMER_STATE_KEY]: state });
}

function setTimerMode(minutes) {
    currentTimerMode = minutes;
    timerTotalTime = minutes * 60;
    timerTimeLeft = timerTotalTime;
    pauseTimer();
    updateTimerDisplay();
}

function startTimer() {
    if (isTimerRunning) return;

    isTimerRunning = true;
    document.getElementById('startTimerBtn').style.display = 'none';
    document.getElementById('pauseTimerBtn').style.display = 'flex';
    saveTimerState();

    // Create background alarm for notification if popup closes
    const delayMinutes = Math.max(timerTimeLeft / 60, 0.5); // Chrome enforces a 30s minimum
    chrome.alarms.create('timer_finished', { delayInMinutes: delayMinutes });

    startTimerInterval();
}

function startTimerInterval() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timerTimeLeft--;
        updateTimerDisplay();

        if (timerTimeLeft <= 0) {
            pauseTimer();
            timerTimeLeft = 0;
            updateTimerDisplay();
            // Notification is handled by background.js alarm 'timer_finished'
        }
    }, 1000);
}

function pauseTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
    chrome.alarms.clear('timer_finished');
    saveTimerState();

    document.getElementById('startTimerBtn').style.display = 'flex';
    document.getElementById('pauseTimerBtn').style.display = 'none';
}

function resetTimer() {
    setTimerMode(currentTimerMode);
}

function updateTimerDisplay() {
    const hours = Math.floor(timerTimeLeft / 3600);
    const minutes = Math.floor((timerTimeLeft % 3600) / 60);
    const seconds = timerTimeLeft % 60;

    let timeString = '';
    if (hours > 0) {
        timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    document.getElementById('timeLeft').textContent = timeString;

    // Update SVG Circle
    const circle = document.getElementById('timerProgress');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;

    const progress = timerTimeLeft / timerTotalTime;
    const offset = circumference - progress * circumference;
    circle.style.strokeDashoffset = offset;
}
