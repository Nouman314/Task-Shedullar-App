import { tasks, saveTasks, updateBadge } from './storage.js';
import { scheduleTask } from './tasks.js';
import { renderTasks } from './tasks.js';
import { renderCalendar } from './calendar.js';
import { renderDashboard } from './dashboard.js';

let currentSnoozeTaskId = null;

export function showSnoozeMenu(e, taskId) {
  e.stopPropagation();
  const menu    = document.getElementById('snoozeMenu');
  const rect    = e.target.getBoundingClientRect();
  const menuWidth  = 160;
  const menuHeight = 200;

  let left = rect.left - 80;
  if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8;
  if (left < 8) left = 8;

  let top = rect.bottom + 8;
  if (top + menuHeight > window.innerHeight) top = rect.top - menuHeight - 8;

  menu.style.top  = `${top}px`;
  menu.style.left = `${left}px`;
  menu.classList.add('show');
  currentSnoozeTaskId = taskId;
}

export async function handleSnooze(snoozeType) {
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
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      newDate = tomorrow.toISOString().split('T')[0];
      newTime = task.time;
      break;
    }
    case 'nextweek': {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      newDate = nextWeek.toISOString().split('T')[0];
      newTime = task.time;
      break;
    }
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

export function dismissSnoozeMenu() {
  document.getElementById('snoozeMenu').classList.remove('show');
  currentSnoozeTaskId = null;
}
