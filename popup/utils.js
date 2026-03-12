export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function isValidUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === getLocalDateString(today)) return 'Today';
  if (dateStr === getLocalDateString(tomorrow)) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getRepeatLabel(repeat) {
  const labels = { none: '', daily: '- Daily', weekly: '- Weekly', monthly: '- Monthly' };
  return labels[repeat] || '';
}

export function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function to24h(time12h) {
  if (!time12h || !time12h.includes(' ')) return time12h;
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

export function to12h(time24h) {
  if (!time24h || time24h.includes(' ')) return time24h;
  let [hours, minutes] = time24h.split(':');
  const hr = parseInt(hours, 10);
  const modifier = hr >= 12 ? 'PM' : 'AM';
  let h = hr % 12 || 12;
  return `${String(h).padStart(2, '0')}:${minutes} ${modifier}`;
}
