const STORAGE_KEY = 'taskSchedulerTasks';
const SETTINGS_KEY = 'taskSchedulerSettings';

let settings = {
  notifications: true,
  reminderMinutes: 5,
  theme: 'light'
};
const ICON_URL = chrome.runtime.getURL('icons/icon128.png');
const MIN_ALARM_MINUTES = 0.5; // Chrome alarms require at least 30s delay in packed extensions

async function safeCreateNotification(options) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: ICON_URL,
      ...options
    });
  } catch (err) {
    console.error('Notification failed', err);
  }
}

// Prevent overlapping context menu creation runs
let contextMenuSetupPromise = null;

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
    safeCreateNotification({
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
    safeCreateNotification({
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

  const delayMinutes = Math.max((nextDate.getTime() - now.getTime()) / 60000, MIN_ALARM_MINUTES);
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
        chrome.alarms.create(reminderAlarm, { delayInMinutes: Math.max(diffMinutes, MIN_ALARM_MINUTES) });
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

function createMenuItemSafe(options) {
  return new Promise((resolve) => {
    chrome.contextMenus.create(options, () => {
      const err = chrome.runtime.lastError;
      // Ignore duplicate id noise; surface anything else for debugging
      if (err && !err.message.includes('duplicate id')) {
        console.error('Context menu creation failed', err);
      }
      resolve();
    });
  });
}

async function createContextMenu() {
  // Serialize creation to avoid duplicate-id races when init runs twice
  if (contextMenuSetupPromise) {
    return contextMenuSetupPromise;
  }

  contextMenuSetupPromise = (async () => {
    try {
      await chrome.contextMenus.removeAll();
    } catch (err) {
      console.error('Failed clearing context menus', err);
    }

    await createMenuItemSafe({
      id: 'addTaskFromPage',
      title: 'Add to Task Scheduler',
      contexts: ['page', 'link']
    });

    await createMenuItemSafe({
      id: 'addCurrentPage',
      title: 'Add Current Page as Task',
      contexts: ['page']
    });
  })();

  try {
    await contextMenuSetupPromise;
  } finally {
    contextMenuSetupPromise = null;
  }
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

    safeCreateNotification({
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
      chrome.alarms.create(`task_${task.id}`, { delayInMinutes: Math.max(delayMinutes, MIN_ALARM_MINUTES) });
    }

    if (settings.reminderMinutes > 0) {
      const reminderTime = new Date(taskDate.getTime() - settings.reminderMinutes * 60000);
      if (reminderTime > now) {
        const reminderDelay = (reminderTime.getTime() - now.getTime()) / 60000;
        chrome.alarms.create(`reminder_${task.id}`, { delayInMinutes: Math.max(reminderDelay, MIN_ALARM_MINUTES) });
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

// --- Timer Background Logic ---
const TIMER_STATE_KEY = 'taskSchedulerTimerState';

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timer_finished') {
    handleTimerFinished();
  }
});

async function handleTimerFinished() {
  const storedSettings = await chrome.storage.local.get(SETTINGS_KEY);
  const currentSettings = storedSettings[SETTINGS_KEY] || settings;

  const storedTimer = await chrome.storage.local.get(TIMER_STATE_KEY);
  const timerState = storedTimer[TIMER_STATE_KEY];

  if (timerState) {
    // Save to history only if timer was actually running
    if (timerState.isRunning && timerState.total > 0) {
      const TIMER_HISTORY_KEY = 'taskSchedulerTimerHistory';
      const historyStored = await chrome.storage.local.get(TIMER_HISTORY_KEY);
      const history = historyStored[TIMER_HISTORY_KEY] || [];

      history.unshift({
        id: Date.now(),
        durationSeconds: Math.floor(timerState.total),
        completedAt: new Date().toISOString()
      });
      if (history.length > 20) history.pop();

      await chrome.storage.local.set({ [TIMER_HISTORY_KEY]: history });
    }

    timerState.isRunning = false;
    timerState.timeLeft = 0;
    await chrome.storage.local.set({ [TIMER_STATE_KEY]: timerState });
  }

  if (currentSettings.notifications) {
    safeCreateNotification({
      title: 'Timer Finished!',
      message: 'Your timer has finished!',
      priority: 2
    });
  }
}
