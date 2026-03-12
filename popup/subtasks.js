import { generateId, escapeHtml } from './utils.js';
import { tasks, saveTasks } from './storage.js';
import { renderTasks } from './tasks.js';

export let pendingSubtasks = [];

export function addPendingSubtask() {
  const input = document.getElementById('subtaskInput');
  const value = input.value.trim();
  if (!value) return;

  pendingSubtasks.push({ id: generateId(), title: value, completed: false });
  input.value = '';
  renderSubtaskPreview();
}

export function clearPendingSubtasks() {
  pendingSubtasks = [];
  renderSubtaskPreview();
}

export function setPendingSubtasks(subtasks) {
  pendingSubtasks = [...subtasks];
  renderSubtaskPreview();
}

export function renderSubtaskPreview() {
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

export async function toggleSubtask(taskId, subtaskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  const subtaskList = Array.isArray(task.subtasks) ? task.subtasks : [];
  const subtask = subtaskList.find(s => s.id === subtaskId);
  if (!subtask) return;
  subtask.completed = !subtask.completed;
  await saveTasks();
  renderTasks();
}
