import { tasks } from './storage.js';
import { getLocalDateString, to12h, escapeHtml } from './utils.js';
import { toggleComplete } from './tasks.js';

export function renderDashboard() {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const today     = getLocalDateString(new Date());

  const dashboardTasks = tasks.filter(t => {
    const isToday   = t.date === today;
    const isOverdue = t.date < today && !t.completed;
    return isToday || isOverdue;
  });

  const dueTodayCount = tasks.filter(t => t.date === today && !t.completed).length;

  document.getElementById('totalTasks').textContent     = total;
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('pendingTasks').textContent   = pending;
  document.getElementById('todayTasks').textContent     = dueTodayCount;

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('progressPercent').textContent = `${percent}%`;
  document.getElementById('progressFill').style.width    = `${percent}%`;

  const todayList = document.getElementById('todayList');
  todayList.innerHTML = '';

  if (dashboardTasks.length === 0) {
    todayList.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">No tasks for today. Enjoy!</p>';
    return;
  }

  dashboardTasks
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    })
    .forEach(task => {
      const isOverdue = task.date < today && !task.completed;
      const item = document.createElement('div');
      item.className = `today-task ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`;
      item.innerHTML = `
        <input type="checkbox" class="dashboard-checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
        <div class="today-task-info">
          <div class="today-task-top">
            <span class="time">${to12h(task.time)}</span>
            ${isOverdue ? '<span class="overdue-label">OVERDUE</span>' : ''}
          </div>
          <span class="title">${escapeHtml(task.title)}</span>
        </div>
      `;

      item.querySelector('.dashboard-checkbox').addEventListener('change', () => toggleComplete(task.id));
      todayList.appendChild(item);
    });
}
