import { initTimer } from './timer.js';
import { loadData, tasks, settings, saveTasks, updateBadge } from './storage.js';
import { getLocalDateString } from './utils.js';
import { renderTasks, handleAddTask, scheduleTask, exportTasks, importTasks } from './tasks.js';
import { renderDashboard } from './dashboard.js';
import { renderCalendar, changeMonth } from './calendar.js';
import { addPendingSubtask } from './subtasks.js';
import { initCustomDropdowns } from './ui-dropdowns.js';
import { initCustomPickers } from './ui-pickers.js';
import { handleSnooze, dismissSnoozeMenu } from './snooze.js';

let currentFilter = 'all';
let searchQuery   = '';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  checkRecurringRollover();
  setupEventListeners();
  renderTasks(currentFilter, searchQuery);
  renderDashboard();
  renderCalendar();
  applyTheme();
  updateThemeIcon();
  updateBadge();
  initTimer();
  initCustomDropdowns();
  initCustomPickers();
}

function checkRecurringRollover() {
  const today   = getLocalDateString(new Date());
  let changed   = false;

  tasks.forEach(task => {
    if (task.completed && task.repeat !== 'none' && task.date < today) {
      const taskDate = new Date(task.date + 'T' + task.time);

      if (task.repeat === 'daily')   taskDate.setDate(taskDate.getDate() + 1);
      if (task.repeat === 'weekly')  taskDate.setDate(taskDate.getDate() + 7);
      if (task.repeat === 'monthly') taskDate.setMonth(taskDate.getMonth() + 1);

      while (getLocalDateString(taskDate) < today) {
        if (task.repeat === 'daily')   taskDate.setDate(taskDate.getDate() + 1);
        if (task.repeat === 'weekly')  taskDate.setDate(taskDate.getDate() + 7);
        if (task.repeat === 'monthly') taskDate.setMonth(taskDate.getMonth() + 1);
      }

      task.date      = getLocalDateString(taskDate);
      task.completed = false;
      changed        = true;
    }
  });

  if (changed) saveTasks();
}

function setupEventListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  document.getElementById('taskForm').addEventListener('submit', (e) =>
    handleAddTask(e, currentFilter, searchQuery)
  );
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
  document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
  document.getElementById('exportBtn').addEventListener('click', exportTasks);
  document.getElementById('importFile').addEventListener('change', importTasks);

  document.getElementById('subtaskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addPendingSubtask(); }
  });
  document.getElementById('addSubtaskBtn').addEventListener('click', addPendingSubtask);

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderTasks(currentFilter, searchQuery);
  });

  document.querySelectorAll('.snooze-menu button').forEach(btn => {
    btn.addEventListener('click', () => handleSnooze(btn.dataset.snooze));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.snooze-btn') && !e.target.closest('.snooze-menu')) {
      dismissSnoozeMenu();
    }
  });

  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Fired by calendar.js filterByDate when user clicks "Back to all tasks"
  document.addEventListener('resetTaskView', () => {
    searchQuery   = '';
    currentFilter = 'all';
    renderTasks(currentFilter, searchQuery);
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}Tab`).classList.add('active');

  if (tabName === 'calendar')  renderCalendar();
  if (tabName === 'dashboard') renderDashboard();
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderTasks(currentFilter, searchQuery);
}

function handleKeyboardShortcuts(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

  switch (e.key) {
    case 'n': case 'N': switchTab('tasks'); document.getElementById('taskTitle').focus(); break;
    case 't': case 'T': switchTab('timer'); break;
    case 'd': case 'D': switchTab('dashboard'); break;
    case 'c': case 'C': switchTab('calendar'); break;
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

function applyTheme() {
  document.body.classList.toggle('dark', settings.theme === 'dark');
}

function updateThemeIcon() {
  const isDark = settings.theme === 'dark';
  document.getElementById('moonIcon').style.display = isDark ? 'none'  : 'block';
  document.getElementById('sunIcon').style.display  = isDark ? 'block' : 'none';
}

async function toggleTheme() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  await chrome.storage.local.set({ taskSchedulerSettings: settings });
  applyTheme();
  updateThemeIcon();
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}
