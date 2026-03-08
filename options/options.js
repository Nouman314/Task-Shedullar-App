const STORAGE_KEY = 'taskSchedulerTasks';
const SETTINGS_KEY = 'taskSchedulerSettings';

let settings = {
  notifications: true,
  reminderMinutes: 5,
  theme: 'light'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  setupEventListeners();
  applyTheme();
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  settings = stored[SETTINGS_KEY] || settings;

  document.getElementById('notificationsEnabled').checked = settings.notifications;
  document.getElementById('reminderMinutes').value = settings.reminderMinutes;
  document.getElementById('theme').value = settings.theme;
}

async function saveSettings() {
  settings.notifications = document.getElementById('notificationsEnabled').checked;
  settings.reminderMinutes = parseInt(document.getElementById('reminderMinutes').value);
  settings.theme = document.getElementById('theme').value;

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  showStatus('Settings saved!', 'success');
  applyTheme();
}

function setupEventListeners() {
  document.getElementById('notificationsEnabled').addEventListener('change', saveSettings);
  document.getElementById('reminderMinutes').addEventListener('change', saveSettings);
  document.getElementById('theme').addEventListener('change', saveSettings);

  document.getElementById('exportBtn').addEventListener('click', exportTasks);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importTasks);
  document.getElementById('clearBtn').addEventListener('click', clearAllTasks);
}

function applyTheme() {
  if (settings.theme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;

  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}

async function exportTasks() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const tasks = stored[STORAGE_KEY] || [];

  const dataStr = JSON.stringify(tasks, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'tasks-backup.json';
  a.click();

  URL.revokeObjectURL(url);
  showStatus('Tasks exported successfully!', 'success');
}

async function importTasks(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const tasks = JSON.parse(text);

    if (!Array.isArray(tasks)) {
      throw new Error('Invalid format');
    }

    const existing = await chrome.storage.local.get(STORAGE_KEY);
    const existingTasks = existing[STORAGE_KEY] || [];
    const merged = [...existingTasks, ...tasks];

    await chrome.storage.local.set({ [STORAGE_KEY]: merged });
    showStatus(`Imported ${tasks.length} tasks!`, 'success');
  } catch (err) {
    showStatus('Failed to import: Invalid file format', 'error');
  }

  e.target.value = '';
}

async function clearAllTasks() {
  if (!confirm('Are you sure you want to delete all tasks? This cannot be undone.')) {
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  showStatus('All tasks cleared!', 'success');
}
