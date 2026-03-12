import { tasks } from './storage.js';
import { getLocalDateString, formatDate, escapeHtml, to12h } from './utils.js';
import { toggleComplete, deleteTask } from './tasks.js';

export let currentDate = new Date();

export function renderCalendar() {
  const grid       = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('currentMonth');

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthLabel.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  grid.innerHTML = '';

  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(h => {
    const el = document.createElement('div');
    el.className = 'calendar-day header';
    el.textContent = h;
    grid.appendChild(el);
  });

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr    = getLocalDateString(new Date());

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.textContent = day;

    if (dateStr === todayStr) el.classList.add('today');
    if (tasks.some(t => t.date === dateStr)) el.classList.add('has-task');

    el.addEventListener('click', () => filterByDate(dateStr));
    grid.appendChild(el);
  }
}

export function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderCalendar();
}

export function filterByDate(dateStr) {
  // Switch to tasks tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="tasks"]').classList.add('active');
  document.getElementById('tasksTab').classList.add('active');

  const list       = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');

  list.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.textContent = '< Back to all tasks';
  backBtn.style.cssText = `
    background: none; border: none; color: var(--primary);
    font-size: 13px; font-weight: 600; cursor: pointer;
    margin-bottom: 12px; padding: 0; font-family: var(--font-sans);
  `;
  backBtn.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    // Dispatch a custom event so popup.js can reset state and re-render
    document.dispatchEvent(new CustomEvent('resetTaskView'));
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
    return;
  }

  emptyState.style.display = 'none';
  const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

  filtered.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item ${task.completed ? 'completed' : ''}`;
    const isOverdue = !task.completed && new Date(task.date + 'T' + task.time) < new Date();
    if (isOverdue) item.classList.add('overdue');

    item.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
      <div class="task-info">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">${to12h(task.time)}</div>
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
