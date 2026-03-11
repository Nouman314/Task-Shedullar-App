import { initTimer } from './timer.js';

const STORAGE_KEY = 'taskSchedulerTasks';
const SETTINGS_KEY = 'taskSchedulerSettings';

let tasks = [];
let settings = {
  notifications: true,
  reminderMinutes: 5,
  theme: 'light'
};
let currentDate = new Date();
let currentFilter = 'all';
let searchQuery = '';
let currentSnoozeTaskId = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  setupEventListeners();
  renderTasks();
  renderDashboard();
  renderCalendar();
  applyTheme();
  updateBadge();
  initTimer();
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

function setupEventListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  document.getElementById('taskForm').addEventListener('submit', handleAddTask);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderTasks();
  });

  document.querySelectorAll('.snooze-menu button').forEach(btn => {
    btn.addEventListener('click', () => handleSnooze(btn.dataset.snooze));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.snooze-btn') && !e.target.closest('.snooze-menu')) {
      document.getElementById('snoozeMenu').classList.remove('show');
      currentSnoozeTaskId = null;
    }
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}Tab`).classList.add('active');

  if (tabName === 'calendar') renderCalendar();
  if (tabName === 'dashboard') renderDashboard();
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderTasks();
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
    priority: document.getElementById('taskPriority').value,
    completed: false,
    enabled: true,
    order: tasks.length
  };

  tasks.push(task);
  await saveTasks();
  renderTasks();
  renderCalendar();
  renderDashboard();
  updateBadge();

  e.target.reset();
  document.getElementById('taskPriority').value = 'medium';

  scheduleTask(task);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getFilteredTasks() {
  let filtered = [...tasks];

  if (currentFilter === 'active') {
    filtered = filtered.filter(t => !t.completed);
  } else if (currentFilter === 'completed') {
    filtered = filtered.filter(t => t.completed);
  }

  if (searchQuery) {
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(searchQuery) ||
      t.description.toLowerCase().includes(searchQuery)
    );
  }

  return filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
}

function renderTasks() {
  const list = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  const filtered = getFilteredTasks();

  list.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  const dragHandleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;
  const snoozeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"></path><path d="m16.2 7.8 2.9-2.9"></path><path d="M18 12h4"></path><path d="m16.2 16.2 2.9 2.9"></path><path d="M12 18v4"></path><path d="m4.9 19.1 2.9-2.9"></path><path d="M2 12h4"></path><path d="m4.9 4.9 2.9 2.9"></path></svg>`;
  const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
  const linkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

  filtered.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item ${task.completed ? 'completed' : ''}`;
    item.draggable = true;
    item.dataset.id = task.id;

    const priorityBadge = task.priority === 'high' || task.priority === 'low'
      ? `<span class="priority-badge ${task.priority}">${task.priority}</span>`
      : '';

    let urlHtml = '';
    if (task.url) {
      let hostname = task.url;
      try { hostname = new URL(task.url).hostname; } catch(e) {}
      urlHtml = `<a href="#" class="task-url" data-url="${task.url}">${linkIcon} ${hostname}</a>`;
    }

    item.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">${dragHandleIcon}</span>
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
      <div class="task-info">
        <div class="task-header">
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${priorityBadge}
        </div>
        <div class="task-meta">${formatDate(task.date)} at ${task.time} ${getRepeatLabel(task.repeat)}</div>
        ${urlHtml}
      </div>
      <div class="task-actions">
        <button class="snooze-btn" data-id="${task.id}" title="Snooze">${snoozeIcon}</button>
        <button class="delete-btn" data-id="${task.id}" title="Delete">${trashIcon}</button>
      </div>
    `;

    item.querySelector('.task-checkbox').addEventListener('change', () => toggleComplete(task.id));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    const snoozeBtn = item.querySelector('.snooze-btn');
    snoozeBtn.addEventListener('click', (e) => showSnoozeMenu(e, task.id));

    if (task.url) {
      item.querySelector('.task-url').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: task.url });
      });
    }

    setupDragAndDrop(item);

    list.appendChild(item);
  });
}

function setupDragAndDrop(item) {
  item.addEventListener('dragstart', (e) => {
    item.classList.add('dragging');
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
  });

  item.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  item.addEventListener('drop', async (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    const targetId = item.dataset.id;

    if (draggedId === targetId) return;

    const draggedIndex = tasks.findIndex(t => t.id === draggedId);
    const targetIndex = tasks.findIndex(t => t.id === targetId);

    const [removed] = tasks.splice(draggedIndex, 1);
    tasks.splice(targetIndex, 0, removed);

    tasks.forEach((t, i) => t.order = i);
    await saveTasks();
    renderTasks();
  });
}

function showSnoozeMenu(e, taskId) {
  e.stopPropagation();
  const menu = document.getElementById('snoozeMenu');
  const rect = e.target.getBoundingClientRect();

  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.left = `${rect.left - 80}px`;
  menu.classList.add('show');
  currentSnoozeTaskId = taskId;
}

async function handleSnooze(snoozeType) {
  if (!currentSnoozeTaskId) return;

  const task = tasks.find(t => t.id === currentSnoozeTaskId);
  if (!task) return;

  const now = new Date();
  let newDate, newTime;

  switch (snoozeType) {
    case '15':
      newDate = now.toISOString().split('T')[0];
      newTime = new Date(now.getTime() + 15 * 60000).toTimeString().slice(0, 5);
      break;
    case '30':
      newDate = now.toISOString().split('T')[0];
      newTime = new Date(now.getTime() + 30 * 60000).toTimeString().slice(0, 5);
      break;
    case '60':
      newDate = now.toISOString().split('T')[0];
      newTime = new Date(now.getTime() + 60 * 60000).toTimeString().slice(0, 5);
      break;
    case 'tomorrow':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      newDate = tomorrow.toISOString().split('T')[0];
      newTime = task.time;
      break;
    case 'nextweek':
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      newDate = nextWeek.toISOString().split('T')[0];
      newTime = task.time;
      break;
  }

  task.date = newDate;
  task.time = newTime;

  await saveTasks();
  chrome.alarms.clear(`task_${task.id}`);
  chrome.alarms.clear(`reminder_${task.id}`);
  scheduleTask(task);
  renderTasks();
  renderCalendar();
  renderDashboard();
  updateBadge();

  document.getElementById('snoozeMenu').classList.remove('show');
  currentSnoozeTaskId = null;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Today';
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getRepeatLabel(repeat) {
  const labels = { none: '', daily: '↻ Daily', weekly: '↻ Weekly', monthly: '↻ Monthly' };
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
    if (task.completed) {
      chrome.alarms.clear(`task_${id}`);
      chrome.alarms.clear(`reminder_${id}`);
      
      if (task.repeat !== 'none') {
        const next = new Date(task.date + 'T' + task.time);
        if (task.repeat === 'daily') next.setDate(next.getDate() + 1);
        if (task.repeat === 'weekly') next.setDate(next.getDate() + 7);
        if (task.repeat === 'monthly') next.setMonth(next.getMonth() + 1);
        
        task.date = next.toISOString().split('T')[0];
        task.completed = false;
        await saveTasks();
        scheduleTask(task);
      }
    } else {
      scheduleTask(task);
    }
    renderTasks();
    renderDashboard();
    updateBadge();
  }
}

async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  await saveTasks();
  chrome.alarms.clear(`task_${id}`);
  chrome.alarms.clear(`reminder_${id}`);
  renderTasks();
  renderCalendar();
  renderDashboard();
  updateBadge();
}

function renderDashboard() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.date === today && !t.completed);

  document.getElementById('totalTasks').textContent = total;
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('pendingTasks').textContent = pending;
  document.getElementById('todayTasks').textContent = todayTasks.length;

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('progressPercent').textContent = `${percent}%`;
  document.getElementById('progressFill').style.width = `${percent}%`;

  const todayList = document.getElementById('todayList');
  todayList.innerHTML = '';

  if (todayTasks.length === 0) {
    todayList.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">No tasks due today. Enjoy!</p>';
  } else {
    todayTasks.sort((a, b) => a.time.localeCompare(b.time)).forEach(task => {
      const item = document.createElement('div');
      item.className = 'today-task';
      item.innerHTML = `
        <span class="time">${task.time}</span>
        <span class="title">${escapeHtml(task.title)}</span>
      `;
      todayList.appendChild(item);
    });
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
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    grid.appendChild(empty);
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
  const emptyState = document.getElementById('emptyState');

  list.innerHTML = '';

  const dateTitle = document.createElement('h3');
  dateTitle.style.cssText = 'margin-bottom: 12px; font-size: 16px; font-weight: 600;';
  dateTitle.textContent = `Tasks for ${formatDate(dateStr)}`;
  list.appendChild(dateTitle);

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color: var(--text-secondary); font-size: 14px;';
    empty.textContent = 'No tasks for this date';
    list.appendChild(empty);
    emptyState.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
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

  const taskDate = new Date(task.date + 'T' + task.time);
  const now = new Date();

  if (taskDate > now) {
    const alarmName = `task_${task.id}`;
    const delayMs = taskDate.getTime() - now.getTime();

    chrome.alarms.create(alarmName, { delayInMinutes: delayMs / 60000 });

    if (settings.reminderMinutes > 0) {
      const reminderTime = new Date(taskDate.getTime() - settings.reminderMinutes * 60000);
      if (reminderTime > now) {
        const reminderDelay = (reminderTime.getTime() - now.getTime()) / 60000;
        chrome.alarms.create(`reminder_${task.id}`, { delayInMinutes: reminderDelay });
      }
    }
  }
}

async function updateBadge() {
  const pending = tasks.filter(t => !t.completed).length;
  document.getElementById('badgeCount').textContent = pending;
}
