import { initTimer } from './timer.js';

const STORAGE_KEY = 'taskSchedulerTasks';
const SETTINGS_KEY = 'taskSchedulerSettings';
const MIN_ALARM_MINUTES = 0.5; // Chrome alarms minimum is 30s in packed extensions

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
let pendingSubtasks = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  setupEventListeners();
  renderTasks();
  renderDashboard();
  renderCalendar();
  applyTheme();
  updateThemeIcon();
  updateBadge();
  initTimer();
  initCustomDropdowns();
}

function initCustomDropdowns() {
  ['taskRepeat', 'taskPriority', 'taskTagColor'].forEach(id => {
    createCustomDropdown(document.getElementById(id));
  });
}

function createCustomDropdown(select) {
  if (!select) return;
  
  // Hide original select
  select.style.display = 'none';
  
  const customSelect = document.createElement('div');
  customSelect.className = 'custom-select';
  customSelect.id = `custom-${select.id}`;
  
  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  trigger.tabIndex = 0;
  
  const triggerText = document.createElement('span');
  triggerText.textContent = select.options[select.selectedIndex].textContent;
  trigger.appendChild(triggerText);
  
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-options';
  
  function updateOptions() {
    optionsContainer.innerHTML = '';
    Array.from(select.options).forEach((opt, index) => {
      const customOpt = document.createElement('div');
      customOpt.className = `custom-option ${index === select.selectedIndex ? 'selected' : ''}`;
      customOpt.textContent = opt.textContent;
      customOpt.addEventListener('click', () => {
        select.selectedIndex = index;
        triggerText.textContent = opt.textContent;
        select.dispatchEvent(new Event('change'));
        customSelect.classList.remove('open');
        updateOptions();
      });
      optionsContainer.appendChild(customOpt);
    });
  }
  
  updateOptions();
  
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close others
    document.querySelectorAll('.custom-select').forEach(s => {
      if (s !== customSelect) s.classList.remove('open');
    });
    customSelect.classList.toggle('open');
  });
  
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      trigger.click();
    }
  });
  
  document.addEventListener('click', () => {
    customSelect.classList.remove('open');
  });
  
  customSelect.appendChild(trigger);
  customSelect.appendChild(optionsContainer);
  select.parentNode.insertBefore(customSelect, select.nextSibling);

  // Sync back if native select changes (e.g. form reset)
  select.addEventListener('change', () => {
    triggerText.textContent = select.options[select.selectedIndex].textContent;
    updateOptions();
  });
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
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
  document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
  document.getElementById('exportBtn').addEventListener('click', exportTasks);
  document.getElementById('importFile').addEventListener('change', importTasks);
  document.getElementById('subtaskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPendingSubtask();
    }
  });
  document.getElementById('addSubtaskBtn').addEventListener('click', addPendingSubtask);

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

  document.addEventListener('keydown', handleKeyboardShortcuts);
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
  const btn = document.getElementById('addTaskBtn');
  const editId = btn.dataset.editId;

  const urlInput = document.getElementById('taskUrl');
  const url = urlInput.value.trim();

  // Save trimmed URL and guard against invalid protocols
  urlInput.value = url;
  if (!isValidUrl(url)) {
    urlInput.style.borderColor = 'var(--danger)';
    urlInput.style.boxShadow = '0 0 0 4px var(--danger-light)';
    urlInput.placeholder = 'Invalid URL - must start with http:// or https://';
    urlInput.value = '';
    setTimeout(() => {
      urlInput.style.borderColor = '';
      urlInput.style.boxShadow = '';
      urlInput.placeholder = 'URL to open (optional)';
    }, 3000);
    return;
  }

  if (editId) {
    const task = tasks.find(t => t.id === editId);
    if (task) {
      task.title = document.getElementById('taskTitle').value;
      task.description = document.getElementById('taskDesc').value;
      task.date = document.getElementById('taskDate').value;
      task.time = document.getElementById('taskTime').value;
      task.url = document.getElementById('taskUrl').value;
      task.repeat = document.getElementById('taskRepeat').value;
      task.priority = document.getElementById('taskPriority').value;
      task.tags = document.getElementById('taskTags').value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      task.tagColor = document.getElementById('taskTagColor').value;
      task.subtasks = [...pendingSubtasks];

      await saveTasks();
      chrome.alarms.clear(`task_${task.id}`);
      scheduleTask(task);
    }
    delete btn.dataset.editId;
    btn.innerHTML = '+ Add Task';
  } else {
    const task = {
      id: generateId(),
      title: document.getElementById('taskTitle').value,
      description: document.getElementById('taskDesc').value,
      date: document.getElementById('taskDate').value,
      time: document.getElementById('taskTime').value,
      url: document.getElementById('taskUrl').value,
      repeat: document.getElementById('taskRepeat').value,
      priority: document.getElementById('taskPriority').value,
      tags: document.getElementById('taskTags').value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0),
      tagColor: document.getElementById('taskTagColor').value,
      subtasks: [...pendingSubtasks],
      completed: false,
      enabled: true,
      order: tasks.length
    };

    pendingSubtasks = [];
    renderSubtaskPreview();
    tasks.push(task);
    await saveTasks();
    scheduleTask(task);
  }

  renderTasks();
  renderDashboard();
  renderCalendar();
  updateBadge();
  e.target.reset();
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskTagColor').value = '#4F46E5';
  pendingSubtasks = [];
  renderSubtaskPreview();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function isValidUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function handleKeyboardShortcuts(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  switch (e.key) {
    case 'n':
    case 'N':
      switchTab('tasks');
      document.getElementById('taskTitle').focus();
      break;
    case 't':
    case 'T':
      switchTab('timer');
      break;
    case 'd':
    case 'D':
      switchTab('dashboard');
      break;
    case 'c':
    case 'C':
      switchTab('calendar');
      break;
    case '/':
      e.preventDefault();
      switchTab('tasks');
      document.getElementById('searchInput').focus();
      break;
    case 'Escape':
      searchQuery = '';
      document.getElementById('searchInput').value = '';
      setFilter('all');
      document.getElementById('searchInput').blur();
      break;
  }
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
  const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

  filtered.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item ${task.completed ? 'completed' : ''}`;
    item.draggable = true;
    item.dataset.id = task.id;

    const taskDateTime = new Date(task.date + 'T' + task.time);
    const isOverdue = !task.completed && taskDateTime < new Date();
    if (isOverdue) item.classList.add('overdue');

    const priorityBadge = task.priority === 'high' || task.priority === 'low'
      ? `<span class="priority-badge ${task.priority}">${task.priority}</span>`
      : '';

    const tagColor = task.tagColor || '#4F46E5';
    const tags = Array.isArray(task.tags) ? task.tags : [];
    const tagsHtml = tags.length > 0
      ? tags.map(tag =>
        `<span class="tag-badge" style="background:${tagColor}22; color:${tagColor}; border:1px solid ${tagColor}55">${escapeHtml(tag)}</span>`
      ).join('')
      : '';

    let urlHtml = '';
    if (task.url) {
      let hostname = task.url;
      try { hostname = new URL(task.url).hostname; } catch (e) { }
      urlHtml = `<a href="#" class="task-url" data-url="${task.url}">${linkIcon} ${hostname}</a>`;
    }

    const subtasksHtml = task.subtasks && task.subtasks.length > 0
      ? `<div class="subtask-list">
          ${task.subtasks.map(s => `
            <div class="subtask-item ${s.completed ? 'completed' : ''}" data-task-id="${task.id}" data-subtask-id="${s.id}">
              <input type="checkbox" class="subtask-checkbox" ${s.completed ? 'checked' : ''}>
              <span>${escapeHtml(s.title)}</span>
            </div>
          `).join('')}
        </div>`
      : '';

    item.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">${dragHandleIcon}</span>
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
      <div class="task-info">
        <div class="task-header">
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${priorityBadge}
          ${tagsHtml}
        </div>
        <div class="task-meta">${formatDate(task.date)} at ${task.time} ${getRepeatLabel(task.repeat)}</div>
        ${urlHtml}
        ${subtasksHtml}
      </div>
      <div class="task-actions">
        <button class="snooze-btn" data-id="${task.id}" title="Snooze">${snoozeIcon}</button>
        <button class="edit-btn" data-id="${task.id}" title="Edit">${editIcon}</button>
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

    item.querySelectorAll('.subtask-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const taskId = checkbox.closest('.subtask-item').dataset.taskId;
        const subtaskId = checkbox.closest('.subtask-item').dataset.subtaskId;
        toggleSubtask(taskId, subtaskId);
      });
    });

    const editBtn = item.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => editTask(task.id));

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
  const menuWidth = 160;
  const menuHeight = 200;

  let left = rect.left - 80;
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 8;
  }
  if (left < 8) left = 8;

  let top = rect.bottom + 8;
  if (top + menuHeight > window.innerHeight) {
    top = rect.top - menuHeight - 8;
  }

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
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
  const labels = { none: '', daily: '- Daily', weekly: '- Weekly', monthly: '- Monthly' };
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

async function toggleSubtask(taskId, subtaskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const subtask = subtasks.find(s => s.id === subtaskId);
  if (!subtask) return;
  subtask.completed = !subtask.completed;
  await saveTasks();
  renderTasks();
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

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.description;
  document.getElementById('taskDate').value = task.date;
  document.getElementById('taskTime').value = task.time;
  document.getElementById('taskUrl').value = task.url;
  document.getElementById('taskRepeat').value = task.repeat;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';
  document.getElementById('taskTagColor').value = task.tagColor || '#4F46E5';

  pendingSubtasks = task.subtasks ? [...task.subtasks] : [];
  renderSubtaskPreview();

  const btn = document.getElementById('addTaskBtn');
  btn.innerHTML = 'Update Task';
  btn.dataset.editId = id;

  document.getElementById('taskForm').scrollIntoView({ behavior: 'smooth' });
}

function addPendingSubtask() {
  const input = document.getElementById('subtaskInput');
  const value = input.value.trim();
  if (!value) return;

  pendingSubtasks.push({ id: generateId(), title: value, completed: false });
  input.value = '';
  renderSubtaskPreview();
}

function renderSubtaskPreview() {
  const list = document.getElementById('subtaskPreviewList');
  list.innerHTML = pendingSubtasks.map((s, i) => `
    <div class="subtask-preview-item">
      <span>${escapeHtml(s.title)}</span>
      <button type="button" class="remove-subtask" data-index="${i}">x</button>
    </div>
  `).join('');

  list.querySelectorAll('.remove-subtask').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingSubtasks.splice(parseInt(btn.dataset.index), 1);
      renderSubtaskPreview();
    });
  });
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
  switchTab('tasks');
  const list = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');

  list.innerHTML = '';

  // Add back button
  const backBtn = document.createElement('button');
  backBtn.textContent = '< Back to all tasks';
  backBtn.style.cssText = `
    background: none;
    border: none;
    color: var(--primary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 12px;
    padding: 0;
    font-family: var(--font-sans);
  `;
  backBtn.addEventListener('click', () => {
    searchQuery = '';
    currentFilter = 'all';
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    renderTasks();
  });
  list.appendChild(backBtn);

  const filtered = tasks.filter(t => t.date === dateStr);

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
      const taskDateTime = new Date(task.date + 'T' + task.time);
      const isOverdue = !task.completed && taskDateTime < new Date();
      if (isOverdue) item.classList.add('overdue');
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
}

function applyTheme() {
  if (settings.theme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}

function updateThemeIcon() {
  const isDark = settings.theme === 'dark';
  document.getElementById('moonIcon').style.display = isDark ? 'none' : 'block';
  document.getElementById('sunIcon').style.display = isDark ? 'block' : 'none';
}

async function toggleTheme() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  applyTheme();
  updateThemeIcon();
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function exportTasks() {
  const data = JSON.stringify(tasks, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importTasks(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      const existingIds = new Set(tasks.map(t => t.id));
      const newTasks = imported.filter(t => !existingIds.has(t.id));
      const normalizedNewTasks = newTasks.map(t => ({
        enabled: true,
        completed: false,
        priority: 'medium',
        repeat: 'none',
        tags: [],
        tagColor: '#4F46E5',
        subtasks: [],
        ...t,
        tags: Array.isArray(t.tags)
          ? t.tags
          : (typeof t.tags === 'string'
            ? t.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
            : []),
        subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
        tagColor: typeof t.tagColor === 'string' && t.tagColor ? t.tagColor : '#4F46E5'
      }));

      tasks = [...tasks, ...normalizedNewTasks];
      normalizedNewTasks.forEach(scheduleTask);

      await saveTasks();
      renderTasks();
      renderCalendar();
      renderDashboard();
      updateBadge();

      alert(`Successfully imported ${newTasks.length} tasks!`);
    } catch {
      alert('Invalid file. Please use a valid tasks JSON backup.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function scheduleTask(task) {
  if (!task.enabled || task.completed) return;

  const taskDate = new Date(task.date + 'T' + task.time);
  const now = new Date();

  if (taskDate > now) {
    const alarmName = `task_${task.id}`;
    const delayMs = taskDate.getTime() - now.getTime();

    const delayMinutes = Math.max(delayMs / 60000, MIN_ALARM_MINUTES);
    chrome.alarms.create(alarmName, { delayInMinutes: delayMinutes });

    if (settings.reminderMinutes > 0) {
      const reminderTime = new Date(taskDate.getTime() - settings.reminderMinutes * 60000);
      if (reminderTime > now) {
        const reminderDelay = Math.max((reminderTime.getTime() - now.getTime()) / 60000, MIN_ALARM_MINUTES);
        chrome.alarms.create(`reminder_${task.id}`, { delayInMinutes: reminderDelay });
      }
    }
  }
}

async function updateBadge() {
  const pending = tasks.filter(t => !t.completed).length;
  document.getElementById('badgeCount').textContent = pending;
}


