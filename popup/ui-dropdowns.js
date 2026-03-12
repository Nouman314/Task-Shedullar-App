export function initCustomDropdowns() {
  ['taskRepeat', 'taskPriority', 'taskTagColor'].forEach(id => {
    createCustomDropdown(document.getElementById(id));
  });
}

export function createCustomDropdown(select) {
  if (!select) return;

  select.style.display = 'none';

  const customSelect = document.createElement('div');
  customSelect.className = 'custom-select';
  customSelect.id = `custom-${select.id}`;

  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  trigger.tabIndex = 0;

  const triggerText = document.createElement('span');
  triggerText.textContent = select.options[select.selectedIndex].textContent;
  trigger.appendChild(triggerText);

  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-options';

  function updateOptions() {
    optionsContainer.innerHTML = '';
    Array.from(select.options).forEach((opt, index) => {
      const customOpt = document.createElement('div');
      customOpt.className = `custom-option ${index === select.selectedIndex ? 'selected' : ''}`;
      customOpt.textContent = opt.textContent;
      customOpt.addEventListener('click', () => {
        select.selectedIndex = index;
        triggerText.textContent = opt.textContent;
        select.dispatchEvent(new Event('change'));
        customSelect.classList.remove('open');
        updateOptions();
      });
      optionsContainer.appendChild(customOpt);
    });
  }

  updateOptions();

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-select').forEach(s => {
      if (s !== customSelect) s.classList.remove('open');
    });
    customSelect.classList.toggle('open');
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      trigger.click();
    }
  });

  document.addEventListener('click', () => customSelect.classList.remove('open'));

  customSelect.appendChild(trigger);
  customSelect.appendChild(optionsContainer);
  select.parentNode.insertBefore(customSelect, select.nextSibling);

  select.addEventListener('change', () => {
    triggerText.textContent = select.options[select.selectedIndex].textContent;
    updateOptions();
  });
}
