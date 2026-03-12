import { getLocalDateString } from './utils.js';

let pickerDate    = new Date();
let selectedTime  = { hour: '12', minute: '00', ampm: 'AM' };

export function initCustomPickers() {
  const dateInput      = document.getElementById('taskDate');
  const timeInput      = document.getElementById('taskTime');
  const dateContainer  = document.getElementById('datePickerContainer');
  const timeContainer  = document.getElementById('timePickerContainer');

  dateInput.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllPickers();
    dateContainer.classList.add('open');
    renderDatePicker();
  });

  timeInput.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllPickers();
    timeContainer.classList.add('open');
    renderTimePicker();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.picker-container')) closeAllPickers();
  });

  const today = new Date();
  dateInput.value = getLocalDateString(today);
  timeInput.value = '12:00 PM';
}

export function closeAllPickers() {
  document.querySelectorAll('.picker-container').forEach(c => c.classList.remove('open'));
}

function renderDatePicker() {
  const container  = document.getElementById('customDatePicker');
  const year       = pickerDate.getFullYear();
  const month      = pickerDate.getMonth();
  const monthName  = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  container.innerHTML = `
    <div class="dp-header">
      <button class="dp-nav-btn" id="dpPrevMonth">&lt;</button>
      <div class="dp-month-label">${monthName}</div>
      <button class="dp-nav-btn" id="dpNextMonth">&gt;</button>
    </div>
    <div class="dp-grid">
      <div class="dp-day-header">Su</div><div class="dp-day-header">Mo</div>
      <div class="dp-day-header">Tu</div><div class="dp-day-header">We</div>
      <div class="dp-day-header">Th</div><div class="dp-day-header">Fr</div>
      <div class="dp-day-header">Sa</div>
    </div>
    <div class="dp-grid" id="dpDays"></div>
  `;

  document.getElementById('dpPrevMonth').onclick = (e) => {
    e.stopPropagation();
    pickerDate.setMonth(pickerDate.getMonth() - 1);
    renderDatePicker();
  };
  document.getElementById('dpNextMonth').onclick = (e) => {
    e.stopPropagation();
    pickerDate.setMonth(pickerDate.getMonth() + 1);
    renderDatePicker();
  };

  const daysGrid    = document.getElementById('dpDays');
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr    = getLocalDateString(new Date());

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'dp-day empty';
    daysGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const el = document.createElement('div');
    el.className = 'dp-day';
    el.textContent = day;

    if (dateStr === todayStr) el.classList.add('today');
    if (document.getElementById('taskDate').value === dateStr) el.classList.add('selected');

    el.onclick = (e) => {
      e.stopPropagation();
      document.getElementById('taskDate').value = dateStr;
      closeAllPickers();
    };
    daysGrid.appendChild(el);
  }
}

function renderTimePicker() {
  const container = document.getElementById('customTimePicker');
  const hours     = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes   = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  const ampm      = ['AM', 'PM'];

  const currentTime = document.getElementById('taskTime').value || '12:00 PM';
  const [curH, curM_AMP] = currentTime.split(':');
  const [curM, curAMP]   = curM_AMP.split(' ');

  container.innerHTML = `
    <div class="tp-scroll-container">
      <div class="tp-column" id="tp-hours"></div>
      <div class="tp-column" id="tp-minutes"></div>
      <div class="tp-column" id="tp-ampm"></div>
    </div>
  `;

  function createColumn(id, items, current, onSelect) {
    const col = document.getElementById(id);
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = `tp-item ${item === current ? 'selected' : ''}`;
      el.textContent = item;
      el.onclick = (e) => {
        e.stopPropagation();
        onSelect(item);
        updateTimeValue();
        renderTimePicker();
      };
      col.appendChild(el);
    });
  }

  createColumn('tp-hours',   hours,   curH,   (h) => selectedTime.hour   = h);
  createColumn('tp-minutes', minutes, curM,   (m) => selectedTime.minute = m);
  createColumn('tp-ampm',    ampm,    curAMP, (a) => selectedTime.ampm   = a);
}

function updateTimeValue() {
  document.getElementById('taskTime').value = `${selectedTime.hour}:${selectedTime.minute} ${selectedTime.ampm}`;
}
