const STORAGE_KEY = 'taskSchedulerTasks';
const SETTINGS_KEY = 'taskSchedulerSettings';

let tasks = [];
let settings = {
  notifications: true,
  reminderMinutes: 5,
  theme: 'light'
};
let currentDate = new Date();

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  setupEventListeners();
  renderTasks();
  renderCalendar();
  applyTheme();
}

async function loadData() {
  const storedTasks = await chrome.storage.local.get(STORAGE_KEY);
  tasks = storedTasks[STORAGE_KEY] || [];

  const storedSettings = await chrome.storage.local.get(SETTINGS_KEY);
  settings = storedSettings[SETTINGS_KEY] || settings;
}

async function saveTasks() {
  await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

async function saveSettings() {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

function setupEventListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('taskForm').addEventListener('submit', handleAddTask);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}Tab`).classList.add('active');

  if (tabName === 'calendar') renderCalendar();
}

async function handleAddTask(e) {
  e.preventDefault();

  const task = {
    id: generateId(),
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDesc').value,
    date: document.getElementById('taskDate').value,
    time: document.getElementById('taskTime').value,
    url: document.getElementById('taskUrl').value,
    repeat: document.getElementById('taskRepeat').value,
    completed: false,
    enabled: true
  };

  tasks.push(task);
  await saveTasks();
  renderTasks();
  renderCalendar();

  e.target.reset();

  const today = new Date().toISOString().split('T')[0];
  if (task.date === today) {
    scheduleTask(task);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function renderTasks() {
  const list = document.getElementById('taskList');
  list.innerHTML = '';

  const sortedTasks = [...tasks].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  sortedTasks.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item ${task.completed ? 'completed' : ''}`;

    let urlHtml = task.url ? `<a href="#" class="task-url" data-url="${task.url}">${task.url.substring(0, 30)}...</a>` : '';

    const pauseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    const playIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    item.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
      <div class="task-info">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">${formatDate(task.date)} at ${task.time} ${getRepeatLabel(task.repeat)}</div>
        ${urlHtml}
      </div>
      <div class="task-actions">
        <button class="toggle-btn" data-id="${task.id}" title="${task.enabled ? 'Pause' : 'Resume'}">${task.enabled ? pauseIcon : playIcon}</button>
        <button class="delete-btn" data-id="${task.id}" title="Delete">${trashIcon}</button>
      </div>
    `;

    item.querySelector('.task-checkbox').addEventListener('change', () => toggleComplete(task.id));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));
    item.querySelector('.toggle-btn').addEventListener('click', () => toggleEnabled(task.id));

    if (task.url) {
      item.querySelector('.task-url').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: task.url });
      });
    }

    list.appendChild(item);
  });
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRepeatLabel(repeat) {
  const labels = { none: '', daily: '(Daily)', weekly: '(Weekly)', monthly: '(Monthly)' };
  return labels[repeat] || '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    await saveTasks();
    renderTasks();
  }
}

async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  await saveTasks();
  renderTasks();
  renderCalendar();
}

async function toggleEnabled(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.enabled = !task.enabled;
    await saveTasks();
    renderTasks();
  }
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('currentMonth');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthLabel.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  grid.innerHTML = '';

  const headers = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  headers.forEach(h => {
    const el = document.createElement('div');
    el.className = 'calendar-day header';
    el.textContent = h;
    grid.appendChild(el);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement('div'));
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.textContent = day;

    if (dateStr === todayStr) el.classList.add('today');

    const hasTask = tasks.some(t => t.date === dateStr);
    if (hasTask) el.classList.add('has-task');

    el.addEventListener('click', () => filterByDate(dateStr));
    grid.appendChild(el);
  }
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderCalendar();
}

function filterByDate(dateStr) {
  const filtered = tasks.filter(t => t.date === dateStr);
  const list = document.getElementById('taskList');
  list.innerHTML = `<h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Tasks for ${formatDate(dateStr)}</h3>`;

  if (filtered.length === 0) {
    list.innerHTML += '<p style="color: var(--text-secondary); font-size: 14px;">No tasks for this date</p>';
  } else {
    const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    filtered.forEach(task => {
      const item = document.createElement('div');
      item.className = `task-item ${task.completed ? 'completed' : ''}`;
      item.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <div class="task-info">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">${task.time}</div>
        </div>
        <div class="task-actions">
          <button class="delete-btn" data-id="${task.id}" title="Delete">${trashIcon}</button>
        </div>
      `;
      item.querySelector('.task-checkbox').addEventListener('change', () => toggleComplete(task.id));
      item.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));
      list.appendChild(item);
    });
  }

  switchTab('tasks');
}

function applyTheme() {
  if (settings.theme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function scheduleTask(task) {
  if (!task.enabled || task.completed) return;

  const [hours, minutes] = task.time.split(':').map(Number);
  const taskDate = new Date(task.date + 'T' + task.time);
  const now = new Date();

  if (taskDate > now) {
    const alarmName = `task_${task.id}`;
    const delayMs = taskDate.getTime() - now.getTime();

    chrome.alarms.create(alarmName, { delayInMinutes: delayMs / 60000 });
  }
}
