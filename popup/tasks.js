import { generateId, isValidUrl, escapeHtml, formatDate, getRepeatLabel, getLocalDateString, to12h, to24h } from './utils.js';
import { tasks, settings, saveTasks, updateBadge, setTasks } from './storage.js';
import { pendingSubtasks, clearPendingSubtasks, setPendingSubtasks, renderSubtaskPreview, toggleSubtask } from './subtasks.js';
import { renderDashboard } from './dashboard.js';
import { renderCalendar } from './calendar.js';
import { setupDragAndDrop } from './dragdrop.js';
import { showSnoozeMenu } from './snooze.js';

const MIN_ALARM_MINUTES = 0.5;

export function getFilteredTasks(currentFilter, searchQuery) {
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

export function renderTasks(currentFilter = 'all', searchQuery = '') {
  const list = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  const filtered = getFilteredTasks(currentFilter, searchQuery);

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
      try { hostname = new URL(task.url).hostname; } catch (e) {}
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
        <div class="task-meta">${formatDate(task.date)} at ${to12h(task.time)} ${getRepeatLabel(task.repeat)}</div>
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
    item.querySelector('.snooze-btn').addEventListener('click', (e) => showSnoozeMenu(e, task.id));
    item.querySelector('.edit-btn').addEventListener('click', () => editTask(task.id));

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

    setupDragAndDrop(item, tasks, saveTasks, renderTasks);
    list.appendChild(item);
  });
}

export async function handleAddTask(e, currentFilter, searchQuery) {
  e.preventDefault();
  const btn = document.getElementById('addTaskBtn');
  const editId = btn.dataset.editId;

  const urlInput = document.getElementById('taskUrl');
  const url = urlInput.value.trim();

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
      task.title       = document.getElementById('taskTitle').value;
      task.description = document.getElementById('taskDesc').value;
      task.date        = document.getElementById('taskDate').value;
      task.time        = to24h(document.getElementById('taskTime').value);
      task.url         = document.getElementById('taskUrl').value;
      task.repeat      = document.getElementById('taskRepeat').value;
      task.priority    = document.getElementById('taskPriority').value;
      task.tags        = document.getElementById('taskTags').value.split(',').map(t => t.trim()).filter(t => t.length > 0);
      task.tagColor    = document.getElementById('taskTagColor').value;
      task.subtasks    = [...pendingSubtasks];

      await saveTasks();
      chrome.alarms.clear(`task_${task.id}`);
      scheduleTask(task);
    }
    delete btn.dataset.editId;
    btn.innerHTML = '+ Add Task';
  } else {
    const task = {
      id:          generateId(),
      title:       document.getElementById('taskTitle').value,
      description: document.getElementById('taskDesc').value,
      date:        document.getElementById('taskDate').value,
      time:        to24h(document.getElementById('taskTime').value),
      url:         document.getElementById('taskUrl').value,
      repeat:      document.getElementById('taskRepeat').value,
      priority:    document.getElementById('taskPriority').value,
      tags:        document.getElementById('taskTags').value.split(',').map(t => t.trim()).filter(t => t.length > 0),
      tagColor:    document.getElementById('taskTagColor').value,
      subtasks:    [...pendingSubtasks],
      completed:   false,
      enabled:     true,
      order:       tasks.length
    };

    tasks.push(task);
    await saveTasks();
    scheduleTask(task);
  }

  clearPendingSubtasks();
  renderTasks(currentFilter, searchQuery);
  renderDashboard();
  renderCalendar();
  updateBadge();

  e.target.reset();
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskTagColor').value = '#4F46E5';
}

export async function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  await saveTasks();

  document.querySelectorAll(`[data-id="${id}"]`).forEach(item => {
    item.classList.toggle('completed', task.completed);
    const checkbox = item.querySelector('.task-checkbox');
    if (checkbox) checkbox.checked = task.completed;
  });

  document.querySelectorAll(`.dashboard-checkbox[data-id="${id}"]`).forEach(cb => {
    cb.checked = task.completed;
    cb.closest('.today-task').classList.toggle('completed', task.completed);
  });

  if (task.completed) {
    chrome.alarms.clear(`task_${id}`);
    chrome.alarms.clear(`reminder_${id}`);
  } else {
    scheduleTask(task);
  }

  renderDashboard();
  updateBadge();
}

export async function deleteTask(id) {
  setTasks(tasks.filter(t => t.id !== id));
  await saveTasks();
  chrome.alarms.clear(`task_${id}`);
  chrome.alarms.clear(`reminder_${id}`);
  renderTasks();
  renderCalendar();
  renderDashboard();
  updateBadge();
}

export function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('taskTitle').value   = task.title;
  document.getElementById('taskDesc').value    = task.description;
  document.getElementById('taskDate').value    = task.date;
  document.getElementById('taskTime').value    = to12h(task.time);
  document.getElementById('taskUrl').value     = task.url;
  document.getElementById('taskRepeat').value  = task.repeat;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskTags').value    = task.tags ? task.tags.join(', ') : '';
  document.getElementById('taskTagColor').value = task.tagColor || '#4F46E5';

  setPendingSubtasks(task.subtasks || []);

  const btn = document.getElementById('addTaskBtn');
  btn.innerHTML = 'Update Task';
  btn.dataset.editId = id;

  document.getElementById('taskForm').scrollIntoView({ behavior: 'smooth' });
}

export function scheduleTask(task) {
  if (!task.enabled || task.completed) return;

  const taskDate = new Date(task.date + 'T' + task.time);
  const now = new Date();

  if (taskDate > now) {
    const delayMs = taskDate.getTime() - now.getTime();
    const delayMinutes = Math.max(delayMs / 60000, MIN_ALARM_MINUTES);
    chrome.alarms.create(`task_${task.id}`, { delayInMinutes: delayMinutes });

    if (settings.reminderMinutes > 0) {
      const reminderTime = new Date(taskDate.getTime() - settings.reminderMinutes * 60000);
      if (reminderTime > now) {
        const reminderDelay = Math.max((reminderTime.getTime() - now.getTime()) / 60000, MIN_ALARM_MINUTES);
        chrome.alarms.create(`reminder_${task.id}`, { delayInMinutes: reminderDelay });
      }
    }
  }
}

export async function exportTasks() {
  const data = JSON.stringify(tasks, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importTasks(e) {
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
        enabled: true, completed: false, priority: 'medium',
        repeat: 'none', tags: [], tagColor: '#4F46E5', subtasks: [],
        ...t,
        tags: Array.isArray(t.tags)
          ? t.tags
          : (typeof t.tags === 'string'
              ? t.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
              : []),
        subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
        tagColor: typeof t.tagColor === 'string' && t.tagColor ? t.tagColor : '#4F46E5'
      }));

      setTasks([...tasks, ...normalizedNewTasks]);
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
