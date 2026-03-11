// timer.js
const TIMER_STATE_KEY = 'taskSchedulerTimerState';
const TIMER_HISTORY_KEY = 'taskSchedulerTimerHistory';

let timerInterval = null;
let timerTimeLeft = 25 * 60; // in seconds
let timerTotalTime = 25 * 60;
let isTimerRunning = false;
let currentTimerMode = 25; // preset minutes (number) or "custom"

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

    const setCustomBtn = document.getElementById('setCustomTimerBtn');
    const customMinutesInput = document.getElementById('customMinutes');
    const customSecondsInput = document.getElementById('customSeconds');

    if (setCustomBtn && customMinutesInput && customSecondsInput) {
        syncCustomInputsFromTotal();
        setCustomRowActive(currentTimerMode === 'custom');

        const apply = () => applyCustomTimeFromInputs();
        // Use direct assignment so repeated initTimer() calls don't stack handlers.
        setCustomBtn.onclick = apply;

        [customMinutesInput, customSecondsInput].forEach(input => {
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    apply();
                }
            };

            // Apply on blur as well (helps if "Set" isn't clicked).
            input.onchange = () => apply();
        });
    }

    document.getElementById('startTimerBtn').addEventListener('click', startTimer);
    document.getElementById('pauseTimerBtn').addEventListener('click', pauseTimer);
    document.getElementById('resetTimerBtn').addEventListener('click', resetTimer);

    updateTimerDisplay();
    renderSessionHistory();
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

async function saveSession(durationSeconds) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;

    const stored = await chrome.storage.local.get(TIMER_HISTORY_KEY);
    const history = stored[TIMER_HISTORY_KEY] || [];

    history.unshift({
        id: Date.now(),
        durationSeconds: Math.floor(durationSeconds),
        completedAt: new Date().toISOString()
    });

    if (history.length > 20) history.pop();

    await chrome.storage.local.set({ [TIMER_HISTORY_KEY]: history });
}

export async function renderSessionHistory() {
    const stored = await chrome.storage.local.get(TIMER_HISTORY_KEY);
    const history = stored[TIMER_HISTORY_KEY] || [];
    const list = document.getElementById('sessionList');

    if (!list) return;

    if (history.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">No sessions yet. Complete a timer to see history.</p>';
        return;
    }

    list.innerHTML = history.map(session => {
        const date = new Date(session.completedAt);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const seconds = Number.isFinite(session.durationSeconds)
            ? session.durationSeconds
            : (Number.isFinite(session.duration) ? session.duration * 60 : 0);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const durationLabel = seconds < 60
            ? `${seconds}s`
            : (remainingSeconds === 0 ? `${minutes} min` : `${minutes}m ${remainingSeconds}s`);
        return `
            <div class="session-item">
                <span class="session-duration">${durationLabel}</span>
                <span class="session-date">${label} at ${time}</span>
            </div>
        `;
    }).join('');
}

function setTimerMode(minutes) {
    currentTimerMode = minutes;
    timerTotalTime = minutes * 60;
    timerTimeLeft = timerTotalTime;
    pauseTimer();
    updateTimerDisplay();
    syncCustomInputsFromTotal();
    setCustomRowActive(false);
}

function clampInt(value, min, max) {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return min;
    return Math.min(max, Math.max(min, num));
}

function syncCustomInputsFromTotal() {
    const customMinutesInput = document.getElementById('customMinutes');
    const customSecondsInput = document.getElementById('customSeconds');
    if (!customMinutesInput || !customSecondsInput) return;

    const minutes = Math.floor(timerTotalTime / 60);
    const seconds = timerTotalTime % 60;
    customMinutesInput.value = String(minutes);
    customSecondsInput.value = String(seconds).padStart(2, '0');
}

function setCustomRowActive(isActive) {
    const row = document.getElementById('timerCustomRow');
    if (!row) return;
    row.classList.toggle('active', !!isActive);
}

function applyCustomTimeFromInputs() {
    const customMinutesInput = document.getElementById('customMinutes');
    const customSecondsInput = document.getElementById('customSeconds');
    if (!customMinutesInput || !customSecondsInput) return;

    const minutes = clampInt(customMinutesInput.value, 0, 180);
    const seconds = clampInt(customSecondsInput.value, 0, 59);
    const totalSeconds = minutes * 60 + seconds;
    // If the timer was running, restart from the new custom duration.
    setCustomDuration(totalSeconds, { restartIfRunning: isTimerRunning });
}

function setCustomDuration(totalSeconds, { restartIfRunning } = {}) {
    const shouldRestart = !!restartIfRunning;
    const nextTotal = Math.max(0, totalSeconds);

    // Stop existing interval/alarm before swapping durations.
    pauseTimer({ skipSave: true });

    currentTimerMode = 'custom';
    timerTotalTime = nextTotal;
    timerTimeLeft = nextTotal;

    updateTimerDisplay();
    syncCustomInputsFromTotal();
    document.querySelectorAll('.timer-mode').forEach(b => b.classList.remove('active'));
    setCustomRowActive(true);

    // Persist the new custom duration immediately.
    saveTimerState();

    if (shouldRestart && timerTimeLeft > 0) {
        startTimer();
    }
}

function startTimer() {
    if (isTimerRunning) return;
    if (timerTimeLeft <= 0) return;

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
    timerInterval = setInterval(async () => {
        timerTimeLeft--;
        updateTimerDisplay();

        if (timerTimeLeft <= 0) {
            await saveSession(timerTotalTime);
            pauseTimer();
            timerTimeLeft = 0;
            updateTimerDisplay();
            renderSessionHistory();
            // Notification is handled by background.js alarm 'timer_finished'
        }
    }, 1000);
}

function pauseTimer({ skipSave } = {}) {
    isTimerRunning = false;
    clearInterval(timerInterval);
    chrome.alarms.clear('timer_finished');
    if (!skipSave) saveTimerState();

    document.getElementById('startTimerBtn').style.display = 'flex';
    document.getElementById('pauseTimerBtn').style.display = 'none';
}

function resetTimer() {
    if (currentTimerMode === 'custom') {
        timerTimeLeft = timerTotalTime;
        pauseTimer();
        updateTimerDisplay();
        syncCustomInputsFromTotal();
        return;
    }

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

    const progress = timerTotalTime > 0 ? (timerTimeLeft / timerTotalTime) : 0;
    const offset = circumference - progress * circumference;
    circle.style.strokeDashoffset = offset;
}
