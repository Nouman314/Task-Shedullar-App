export function setupDragAndDrop(item, tasks, saveTasks, renderTasks) {
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
    const draggedId  = e.dataTransfer.getData('text/plain');
    const targetId   = item.dataset.id;
    if (draggedId === targetId) return;

    const draggedIndex = tasks.findIndex(t => t.id === draggedId);
    const targetIndex  = tasks.findIndex(t => t.id === targetId);

    const [removed] = tasks.splice(draggedIndex, 1);
    tasks.splice(targetIndex, 0, removed);
    tasks.forEach((t, i) => t.order = i);

    await saveTasks();
    renderTasks();
  });
}
