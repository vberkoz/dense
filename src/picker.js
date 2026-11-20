/**
 * DENSE//DS — Custom Date / Time / Datetime Picker Module
 * Zero-dependency, lightweight (<5KB), accessible Popover-based picker.
 */

const pad = (n) => String(n).padStart(2, '0');

export function initPicker(input) {
  if (input._densePicker) return;
  const origType = input.getAttribute('type') || input.dataset.picker || 'date';
  const mode = input.dataset.picker || (origType === 'datetime-local' ? 'datetime' : origType);
  if (!['date', 'time', 'datetime', 'datetime-local'].includes(mode)) return;

  const isDate = mode === 'date' || mode.startsWith('datetime');
  const isTime = mode === 'time' || mode.startsWith('datetime');
  const id = `pk-${Math.random().toString(36).slice(2, 9)}`;

  // Convert input to text to eliminate browser native picker popup & indicators
  input.type = 'text';
  input.setAttribute('data-picker', mode);
  input.setAttribute('data-orig-type', origType);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');

  // Wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'dense-picker-trigger';
  wrapper.style.anchorName = `--${id}`;
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  // Trigger button
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'dense-picker-btn';
  toggleBtn.setAttribute('tabindex', '-1');
  toggleBtn.setAttribute('aria-label', `Toggle ${mode} picker`);
  toggleBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  wrapper.appendChild(toggleBtn);

  // Popover container
  const popover = document.createElement('div');
  popover.popover = 'auto';
  popover.className = 'dense-picker-popover';
  popover.id = id;
  popover.style.positionAnchor = `--${id}`;
  document.body.appendChild(popover);

  let viewDate = new Date();
  let selectedDate = null;
  let selectedHour = '12';
  let selectedMin = '00';

  const parseVal = () => {
    const v = (input.value || '').trim();
    if (!v) {
      viewDate = new Date();
      return;
    }
    if (isDate) {
      const d = new Date(v.includes('T') ? v : `${v}T00:00:00`);
      if (!isNaN(d.getTime())) {
        selectedDate = new Date(d);
        viewDate = new Date(d);
        if (isTime) {
          selectedHour = pad(d.getHours());
          selectedMin = pad(d.getMinutes());
        }
      }
    } else if (isTime) {
      const [h, m] = v.split(':');
      if (h != null && m != null) {
        selectedHour = pad(parseInt(h, 10) || 0);
        selectedMin = pad(parseInt(m, 10) || 0);
      }
    }
  };

  const commitValue = () => {
    let out = '';
    if (isDate && selectedDate) {
      const y = selectedDate.getFullYear();
      const m = pad(selectedDate.getMonth() + 1);
      const d = pad(selectedDate.getDate());
      out = `${y}-${m}-${d}`;
    }
    if (isTime) {
      const t = `${selectedHour}:${selectedMin}`;
      out = isDate ? (out ? `${out}T${t}` : '') : t;
    }
    if (input.value !== out) {
      input.value = out;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const render = () => {
    popover.innerHTML = '';
    const body = document.createElement('div');
    body.className = 'dense-picker-body';

    if (isDate) {
      const cal = document.createElement('div');
      cal.className = 'dense-picker-cal';

      // Header
      const header = document.createElement('div');
      header.className = 'dense-picker-header';
      header.innerHTML = `
        <button type="button" class="dense-nav-btn" data-act="prev" aria-label="Previous month">&lt;</button>
        <div class="dense-picker-title">
          <select class="dense-select-month">
            ${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${viewDate.getMonth() === i ? 'selected' : ''}>${new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>`).join('')}
          </select>
          <input type="number" class="dense-select-year" value="${viewDate.getFullYear()}" style="width:48px;" />
        </div>
        <button type="button" class="dense-nav-btn" data-act="next" aria-label="Next month">&gt;</button>
      `;

      header.querySelector('[data-act="prev"]').onclick = (e) => { e.stopPropagation(); viewDate.setMonth(viewDate.getMonth() - 1); render(); };
      header.querySelector('[data-act="next"]').onclick = (e) => { e.stopPropagation(); viewDate.setMonth(viewDate.getMonth() + 1); render(); };
      header.querySelector('.dense-select-month').onchange = (e) => { viewDate.setMonth(Number(e.target.value)); render(); };
      header.querySelector('.dense-select-year').onchange = (e) => { viewDate.setFullYear(Number(e.target.value)); render(); };

      // Weekdays
      const weekdays = document.createElement('div');
      weekdays.className = 'dense-picker-weekdays';
      ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(w => {
        weekdays.insertAdjacentHTML('beforeend', `<span>${w}</span>`);
      });

      // Days Grid
      const grid = document.createElement('div');
      grid.className = 'dense-picker-grid';
      grid.setAttribute('role', 'grid');

      const y = viewDate.getFullYear();
      const m = viewDate.getMonth();
      const firstDay = new Date(y, m, 1).getDay();
      const lastDate = new Date(y, m + 1, 0).getDate();
      const prevLastDate = new Date(y, m, 0).getDate();
      const todayStr = new Date().toDateString();

      const min = input.min ? new Date(input.min) : null;
      const max = input.max ? new Date(input.max) : null;

      const addCell = (dayNum, isOut, targetDate) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dense-picker-day ${isOut ? 'is-outside' : ''}`;
        btn.setAttribute('role', 'gridcell');
        btn.textContent = dayNum;

        if (!isOut && todayStr === targetDate.toDateString()) {
          btn.classList.add('is-today');
        }

        const isSelected = selectedDate && selectedDate.toDateString() === targetDate.toDateString();
        if (isSelected) {
          btn.setAttribute('aria-selected', 'true');
        }

        if ((min && targetDate < min) || (max && targetDate > max)) {
          btn.disabled = true;
        }

        btn.onclick = (e) => {
          e.stopPropagation();
          selectedDate = new Date(targetDate);
          commitValue();
          if (!isTime) popover.hidePopover();
          else render();
        };

        grid.appendChild(btn);
      };

      for (let i = firstDay - 1; i >= 0; i--) {
        addCell(prevLastDate - i, true, new Date(y, m - 1, prevLastDate - i));
      }
      for (let i = 1; i <= lastDate; i++) {
        addCell(i, false, new Date(y, m, i));
      }
      const remain = (7 - (grid.children.length % 7)) % 7;
      for (let i = 1; i <= remain; i++) {
        addCell(i, true, new Date(y, m + 1, i));
      }

      cal.appendChild(header);
      cal.appendChild(weekdays);
      cal.appendChild(grid);
      body.appendChild(cal);
    }

    if (isTime) {
      const timeWrap = document.createElement('div');
      timeWrap.className = 'dense-picker-time';
      timeWrap.innerHTML = `<span class="dense-picker-time-title">Time</span>`;

      const cols = document.createElement('div');
      cols.className = 'dense-picker-time-cols';

      const createCol = (items, current, onSelect) => {
        const col = document.createElement('div');
        col.className = 'dense-time-col';
        items.forEach(val => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dense-time-opt';
          btn.textContent = val;
          if (val === current) btn.setAttribute('aria-selected', 'true');
          btn.onclick = (e) => {
            e.stopPropagation();
            onSelect(val);
            if (isDate && !selectedDate) selectedDate = new Date();
            commitValue();
            render();
          };
          col.appendChild(btn);
        });
        return col;
      };

      const hours = Array.from({ length: 24 }, (_, i) => pad(i));
      const mins = Array.from({ length: 12 }, (_, i) => pad(i * 5));

      cols.appendChild(createCol(hours, selectedHour, (h) => { selectedHour = h; }));
      cols.appendChild(createCol(mins, selectedMin, (m) => { selectedMin = m; }));
      timeWrap.appendChild(cols);
      body.appendChild(timeWrap);
    }

    popover.appendChild(body);

    // Footer actions
    const footer = document.createElement('div');
    footer.className = 'dense-picker-footer';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'dense-picker-btn-action';
    clearBtn.textContent = 'Clear';
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      selectedDate = null;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      popover.hidePopover();
    };

    const nowBtn = document.createElement('button');
    nowBtn.type = 'button';
    nowBtn.className = 'dense-picker-btn-action';
    nowBtn.textContent = 'Now';
    nowBtn.onclick = (e) => {
      e.stopPropagation();
      const now = new Date();
      selectedDate = now;
      viewDate = new Date(now);
      selectedHour = pad(now.getHours());
      selectedMin = pad(now.getMinutes());
      commitValue();
      popover.hidePopover();
    };

    footer.appendChild(clearBtn);
    footer.appendChild(nowBtn);
    popover.appendChild(footer);
  };

  const updatePos = () => {
    popover.style.left = '';
    popover.style.top = '';
    popover.style.marginTop = '';
    const rect = input.getBoundingClientRect();
    const pr = popover.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!CSS.supports('position-anchor: --a') || pr.right > vw - 8 || pr.left < 8 || pr.bottom > vh - 8 || pr.top < 8) {
      popover.style.position = 'fixed';
      popover.style.marginTop = '0';
      const left = Math.max(8, Math.min(rect.left, vw - pr.width - 8));
      const top = (rect.bottom + 2 + pr.height > vh - 8 && rect.top - pr.height - 2 >= 8)
        ? rect.top - pr.height - 2
        : Math.max(8, Math.min(rect.bottom + 2, vh - pr.height - 8));
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    }
  };

  const open = () => {
    parseVal();
    render();
    if (!popover.matches(':popover-open')) {
      popover.showPopover();
    }
    updatePos();
  };

  input.addEventListener('click', () => open());
  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    if (popover.matches(':popover-open')) popover.hidePopover();
    else open();
  };

  input.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !popover.matches(':popover-open')) {
      e.preventDefault();
      open();
    }
  });

  popover.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      popover.hidePopover();
      input.focus();
    }
  });

  input._densePicker = { open, close: () => popover.hidePopover() };
}

export function initPickers(root = document) {
  root.querySelectorAll('input[type="date"], input[type="time"], input[type="datetime-local"], input[data-picker]').forEach(initPicker);
}

if (typeof window !== 'undefined') {
  window.initDensePickers = initPickers;
}
