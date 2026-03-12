const STORAGE_KEY = 'taskSchedulerTasks';
const SETTINGS_KEY = 'taskSchedulerSettings';

export let tasks = [];
export let settings = {
  notifications: true,
  reminderMinutes: 5,
  theme: 'light'
};

export async function loadData() {
  const storedTasks = await chrome.storage.local.get(STORAGE_KEY);
  tasks = storedTasks[STORAGE_KEY] || [];

  const storedSettings = await chrome.storage.local.get(SETTINGS_KEY);
  settings = { ...settings, ...(storedSettings[SETTINGS_KEY] || {}) };
}

export async function saveTasks() {
  await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

export async function saveSettings() {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function updateBadge() {
  const pending = tasks.filter(t => !t.completed).length;
  document.getElementById('badgeCount').textContent = pending;
}

export function setTasks(newTasks) {
  tasks = newTasks;
}
