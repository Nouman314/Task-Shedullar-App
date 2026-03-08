const STORAGE_KEY = 'taskSchedulerTasks';
const SETTINGS_KEY = 'taskSchedulerSettings';

let settings = {
  notifications: true,
  reminderMinutes: 5,
  theme: 'light'
};

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('task_')) {
    const taskId = alarm.name.replace('task_', '');
    handleTaskTrigger(taskId);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('reminder_')) {
    const taskId = alarm.name.replace('reminder_', '');
    handleReminder(taskId);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check_tasks') {
    checkUpcomingTasks();
  }
});

async function handleTaskTrigger(taskId) {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const tasks = stored[STORAGE_KEY] || [];
  const task = tasks.find(t => t.id === taskId);

  if (!task || !task.enabled || task.completed) return;

  if (task.url) {
    chrome.tabs.create({ url: task.url, active: false });
  }

  if (settings.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Task Scheduled',
      message: task.title + (task.url ? ' - URL opened' : '')
    });
  }

  if (task.repeat !== 'none') {
    scheduleNextRepeat(task);
  }

  updateBadgeCount();
}

async function handleReminder(taskId) {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const tasks = stored[STORAGE_KEY] || [];
  const task = tasks.find(t => t.id === taskId);

  if (!task || task.completed) return;

  if (settings.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🔔 Task Reminder',
      message: task.title + (task.description ? '\n' + task.description : ''),
      priority: 1
    });
  }
}

function scheduleNextRepeat(task) {
  const [year, month, day] = task.date.split('-').map(Number);
  const [hours, minutes] = task.time.split(':').map(Number);
  let nextDate = new Date(year, month - 1, day, hours, minutes);

  const now = new Date();

  switch (task.repeat) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }

  while (nextDate <= now) {
    switch (task.repeat) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
  }

  const delayMinutes = (nextDate.getTime() - now.getTime()) / 60000;
  chrome.alarms.create(`task_${task.id}`, { delayInMinutes: delayMinutes });
}

async function checkUpcomingTasks() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const tasks = stored[STORAGE_KEY] || [];
  const now = new Date();

  for (const task of tasks) {
    if (!task.enabled || task.completed) continue;

    const [year, month, day] = task.date.split('-').map(Number);
    const [hours, minutes] = task.time.split(':').map(Number);
    const taskDate = new Date(year, month - 1, day, hours, minutes);

    const diffMinutes = (taskDate.getTime() - now.getTime()) / 60000;

    if (diffMinutes <= settings.reminderMinutes && diffMinutes > 0) {
      const reminderAlarm = `reminder_${task.id}`;
      const alarms = await chrome.alarms.get(reminderAlarm);
      if (!alarms) {
        chrome.alarms.create(reminderAlarm, { delayInMinutes: diffMinutes });
      }
    }
  }
}

async function updateBadgeCount() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const tasks = stored[STORAGE_KEY] || [];
  const pending = tasks.filter(t => !t.completed).length;
  
  if (pending > 0) {
    chrome.action.setBadgeText({ text: pending.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function createContextMenu() {
  await chrome.contextMenus.removeAll();
  
  chrome.contextMenus.create({
    id: 'addTaskFromPage',
    title: 'Add to Task Scheduler',
    contexts: ['page', 'link']
  });

  chrome.contextMenus.create({
    id: 'addCurrentPage',
    title: 'Add Current Page as Task',
    contexts: ['page']
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addCurrentPage' || info.menuItemId === 'addTaskFromPage') {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const tasks = stored[STORAGE_KEY] || [];

    const url = info.linkUrl || info.pageUrl;
    const title = info.selectionText || (tab ? tab.title : 'New Task');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const time = new Date(now.getTime() + 60 * 60000).toTimeString().slice(0, 5);

    const newTask = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      title: title.substring(0, 100),
      description: '',
      date: today,
      time: time,
      url: url,
      repeat: 'none',
      priority: 'medium',
      completed: false,
      enabled: true,
      order: tasks.length
    };

    tasks.push(newTask);
    await chrome.storage.local.set({ [STORAGE_KEY]: tasks });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Task Added',
      message: `"${title}" has been scheduled for ${time}`
    });

    updateBadgeCount();
  }
});

async function initScheduler() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  settings = stored[SETTINGS_KEY] || settings;

  const storedTasks = await chrome.storage.local.get(STORAGE_KEY);
  const tasks = storedTasks[STORAGE_KEY] || [];

  const now = new Date();

  for (const task of tasks) {
    if (!task.enabled || task.completed) continue;

    const [year, month, day] = task.date.split('-').map(Number);
    const [hours, minutes] = task.time.split(':').map(Number);
    const taskDate = new Date(year, month - 1, day, hours, minutes);

    if (taskDate > now) {
      const delayMinutes = (taskDate.getTime() - now.getTime()) / 60000;
      chrome.alarms.create(`task_${task.id}`, { delayInMinutes: delayMinutes });
    }

    if (settings.reminderMinutes > 0) {
      const reminderTime = new Date(taskDate.getTime() - settings.reminderMinutes * 60000);
      if (reminderTime > now) {
        const reminderDelay = (reminderTime.getTime() - now.getTime()) / 60000;
        chrome.alarms.create(`reminder_${task.id}`, { delayInMinutes: reminderDelay });
      }
    }
  }

  chrome.alarms.create('check_tasks', { periodInMinutes: 1 });
  
  await createContextMenu();
  await updateBadgeCount();
}

chrome.runtime.onStartup.addListener(async () => {
  await initScheduler();
});

chrome.runtime.onInstalled.addListener(async () => {
  await initScheduler();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    updateBadgeCount();
  }
});

initScheduler();
