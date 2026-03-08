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
      title: 'Task Reminder',
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
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check_tasks') {
    checkUpcomingTasks();
  }
});

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

chrome.runtime.onStartup.addListener(initScheduler);
chrome.runtime.onInstalled.addListener(initScheduler);

initScheduler();
