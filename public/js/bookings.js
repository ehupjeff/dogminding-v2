function renderBookingSearch() {
  const main = document.getElementById('app-main');
  main.innerHTML = `
    <a href="#/" class="back-link">&larr; Dashboard</a>
    <div class="card">
      <h1>Search Bookings</h1>
      <div class="form-group"><label for="search-dog">Dog</label><select id="search-dog"><option value="">All Dogs</option></select></div>
      <div class="filter-row">
        <div class="form-group"><label for="search-start">Start Date</label><input type="date" id="search-start"></div>
        <div class="form-group"><label for="search-end">End Date</label><input type="date" id="search-end"></div>
      </div>
      <div class="filter-row">
        <div class="form-group"><label for="search-cost-min">Min Cost ($)</label><input type="number" id="search-cost-min" min="0"></div>
        <div class="form-group"><label for="search-cost-max">Max Cost ($)</label><input type="number" id="search-cost-max" min="0"></div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <div class="status-checkboxes">
          ${['pending','confirmed','completed','cancelled'].map(s => `<label><input type="checkbox" name="search-status" value="${s}"> ${s.charAt(0).toUpperCase() + s.slice(1)}</label>`).join('')}
        </div>
      </div>
      <button id="btn-search" class="btn btn-block">Search</button>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button id="btn-export-csv" class="btn btn-outline btn-small" style="flex:1;">Export CSV</button>
        <button id="btn-export-pdf" class="btn btn-outline btn-small" style="flex:1;">Export PDF</button>
      </div>
    </div>
    <div class="card" id="search-results"><div class="empty-state"><p>Use the filters above to search</p></div></div>
  `;

  (async () => {
    try {
      const dogs = await api.get('/api/dogs');
      const sel = document.getElementById('search-dog');
      dogs.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.name} ${d.breed ? '· ' + d.breed : ''}${d.owner1_name ? ' · ' + d.owner1_name : ''}`;
        sel.appendChild(opt);
      });
    } catch (err) { console.error(err); }
  })();

  document.getElementById('btn-search').addEventListener('click', () => doSearch());

  document.getElementById('btn-export-csv').addEventListener('click', () => doExport('csv'));
  document.getElementById('btn-export-pdf').addEventListener('click', () => doExport('pdf'));
}

async function doSearch() {
  const params = getSearchParams();
  const results = document.getElementById('search-results');
  results.innerHTML = '<div class="loading">Searching...</div>';

  try {
    const bookings = await api.get('/api/bookings/search?' + params.toString());
    if (bookings.length === 0) { results.innerHTML = '<div class="empty-state"><p>No bookings found</p></div>'; return; }

    results.innerHTML = bookings.map(b => {
      const dogNames = (b.dogs || []).map(d => escHtml(d.name)).join(', ');
      const times = [b.drop_off_time ? 'Drop: ' + formatTime(b.drop_off_time) : '', b.pick_up_time ? 'Pick: ' + formatTime(b.pick_up_time) : ''].filter(Boolean).join(' | ');
      const firstDogId = b.dog_ids && b.dog_ids.length > 0 ? b.dog_ids[0] : '';
      return `<div class="booking-row">
        <div>
          <div class="booking-dates">${formatDate(b.start_date)} &ndash; ${formatDate(b.end_date)} ${statusBadge(b.status)}</div>
          <div class="booking-times">${dogNames}</div>
          ${times ? `<div class="booking-times">${times}</div>` : ''}
          ${b.total_cost > 0 ? `<div class="booking-cost">$${b.total_cost}</div>` : ''}
          ${b.notes ? `<div style="font-size:13px;color:var(--text-muted);">${escHtml(b.notes)}</div>` : ''}
        </div>
        <div class="booking-actions">
          <button class="btn btn-outline btn-small" data-edit="${b.id}" data-dog="${firstDogId}">Edit</button>
        </div>
      </div>`;
    }).join('');

    results.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo('/dogs/' + btn.dataset.dog + '/bookings/' + btn.dataset.edit + '/edit'));
    });
  } catch (err) {
    results.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function doExport(format) {
  const params = getSearchParams();
  params.set('format', format);

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/bookings/export?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'pdf' ? 'bookings.pdf' : 'bookings.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
}

function getSearchParams() {
  const params = new URLSearchParams();
  const dogId = document.getElementById('search-dog').value;
  const startDate = document.getElementById('search-start').value;
  const endDate = document.getElementById('search-end').value;
  const costMin = document.getElementById('search-cost-min').value;
  const costMax = document.getElementById('search-cost-max').value;
  const statuses = Array.from(document.querySelectorAll('input[name="search-status"]:checked')).map(c => c.value);

  if (dogId) params.set('dog_id', dogId);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (costMin) params.set('cost_min', costMin);
  if (costMax) params.set('cost_max', costMax);
  if (statuses.length > 0) params.set('status', statuses.join(','));
  return params;
}

function renderBookingCalendar() {
  const main = document.getElementById('app-main');
  const today = new Date();
  let currentYear = today.getFullYear();
  let currentMonth = today.getMonth() + 1;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function monthKey() { return `${currentYear}-${String(currentMonth).padStart(2,'0')}`; }

  function render() {
    main.innerHTML = `
      <a href="#/" class="back-link">&larr; Dashboard</a>
      <div class="page-header">
        <h1>Booking Calendar</h1>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="cal-prev" class="btn btn-outline btn-small">&lt;</button>
          <span id="cal-month-label" style="font-weight:600;min-width:140px;text-align:center;"></span>
          <button id="cal-next" class="btn btn-outline btn-small">&gt;</button>
        </div>
      </div>
      <div class="card" id="calendar-grid"><div class="loading">Loading...</div></div>
      <div class="card hidden" id="cal-day-detail">
        <h3 id="cal-day-title"></h3>
        <div id="cal-day-bookings"></div>
      </div>
    `;

    document.getElementById('cal-prev').addEventListener('click', () => {
      if (currentMonth === 1) { currentMonth = 12; currentYear--; } else currentMonth--; loadMonth();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      if (currentMonth === 12) { currentMonth = 1; currentYear++; } else currentMonth++; loadMonth();
    });
    loadMonth();
  }

  async function loadMonth() {
    document.getElementById('cal-month-label').textContent = `${monthNames[currentMonth-1]} ${currentYear}`;
    const container = document.getElementById('calendar-grid');
    document.getElementById('cal-day-detail').classList.add('hidden');
    container.innerHTML = '<div class="loading">Loading...</div>';

    let data;
    try { data = await api.get(`/api/bookings/calendar?month=${monthKey()}`); }
    catch (err) { container.innerHTML = `<div class="alert alert-error">${err.message}</div>`; return; }

    const dateMap = {};
    data.bookings.forEach(b => {
      const start = new Date(b.start_date + 'T00:00:00');
      const end = new Date(b.end_date + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().substring(0, 10);
        if (!dateMap[key]) dateMap[key] = { bookings: [], dogIds: new Set() };
        dateMap[key].bookings.push(b);
        (b.dog_ids || []).forEach(id => dateMap[key].dogIds.add(id));
      }
    });

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    let firstDow = new Date(currentYear, currentMonth - 1, 1).getDay();
    firstDow = firstDow === 0 ? 6 : firstDow - 1;

    let html = '<div class="calendar-grid">';
    html += ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<div class="cal-header">${d}</div>`).join('');

    for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell cal-empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const info = dateMap[dateStr];
      const isToday = dateStr === today.toISOString().substring(0, 10);
      let cls = 'cal-cell';
      if (isToday) cls += ' cal-today';
      if (info) cls += ' cal-has-bookings';

      html += `<div class="${cls}" data-date="${dateStr}">
        <span class="cal-day-num">${day}</span>
        ${info ? `<span class="cal-badge">${info.bookings.length} bookings<br>${info.dogIds.size} dogs</span>` : ''}
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.cal-has-bookings').forEach(cell => {
      cell.addEventListener('click', () => showDayDetail(cell.dataset.date, dateMap));
    });
  }

  function showDayDetail(dateStr, dateMap) {
    const info = dateMap[dateStr];
    const detailCard = document.getElementById('cal-day-detail');
    document.getElementById('cal-day-title').textContent = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    if (!info || info.bookings.length === 0) {
      document.getElementById('cal-day-bookings').innerHTML = '<div class="empty-state"><p>No bookings</p></div>';
    } else {
      document.getElementById('cal-day-bookings').innerHTML = info.bookings.map(b => {
        const dogNames = (b.dogs || []).map(d => escHtml(d.name)).join(', ');
        const times = [b.drop_off_time ? 'Drop: ' + formatTime(b.drop_off_time) : '', b.pick_up_time ? 'Pick: ' + formatTime(b.pick_up_time) : ''].filter(Boolean).join(' | ');
        const firstDogId = b.dog_ids && b.dog_ids.length > 0 ? b.dog_ids[0] : '';
        return `<div class="booking-row">
          <div>
            <div class="booking-dates">${formatDate(b.start_date)} &ndash; ${formatDate(b.end_date)} ${statusBadge(b.status)}</div>
            <div class="booking-times">${dogNames}</div>
            ${times ? `<div class="booking-times">${times}</div>` : ''}
            ${b.total_cost > 0 ? `<div class="booking-cost">$${b.total_cost}</div>` : ''}
            ${b.notes ? `<div style="font-size:13px;color:var(--text-muted);">${escHtml(b.notes)}</div>` : ''}
          </div>
          <div class="booking-actions">
            <button class="btn btn-outline btn-small" data-edit="${b.id}" data-dog="${firstDogId}">Edit</button>
          </div>
        </div>`;
      }).join('');

      detailCard.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo('/dogs/' + btn.dataset.dog + '/bookings/' + btn.dataset.edit + '/edit'));
      });
    }
    detailCard.classList.remove('hidden');
  }

  render();
}

async function renderBookingForm(dogId, booking) {
  const isEdit = !!booking;
  const main = document.getElementById('app-main');

  let allDogs = [];
  let selectedDogIds = [];
  try {
    allDogs = await api.get('/api/dogs');
    if (isEdit) {
      selectedDogIds = Array.isArray(booking.dog_ids) ? booking.dog_ids : [];
    } else {
      selectedDogIds = [parseInt(dogId)];
    }
  } catch (err) {
    main.innerHTML = `<a href="#/dogs/${dogId}" class="back-link">&larr; Back</a><div class="alert alert-error">${err.message}</div>`;
    return;
  }

  const startDate = isEdit ? (booking.start_date || '').substring(0, 10) : '';
  const endDate = isEdit ? (booking.end_date || '').substring(0, 10) : '';
  const backLink = isEdit ? getReturnTo(`dogs/${dogId}`) : `#/dogs/${dogId}`;

  function renderDogCheckboxes(filter) {
    const container = document.getElementById('dog-checkboxes');
    if (!container) return;
    const q = (filter || '').toLowerCase().trim();
    const filtered = allDogs.filter(d => {
      if (!q) return true;
      return [d.name, d.breed, d.owner1_name].filter(Boolean).join(' ').toLowerCase().includes(q);
    }).sort((a, b) => {
      const aSel = selectedDogIds.includes(a.id) ? 0 : 1;
      const bSel = selectedDogIds.includes(b.id) ? 0 : 1;
      return aSel - bSel || a.name.localeCompare(b.name);
    });

    container.innerHTML = filtered.length === 0
      ? '<p style="padding:8px;color:var(--text-muted);font-size:13px;">No dogs match</p>'
      : filtered.map(d => `
        <label class="dog-checkbox-row" data-id="${d.id}">
          <input type="checkbox" name="dog_ids" value="${d.id}" ${selectedDogIds.includes(d.id) ? 'checked' : ''}>
          <div class="dog-checkbox-info">
            <span class="dog-checkbox-name">${escHtml(d.name)}</span>
            <span class="dog-checkbox-detail">${[d.breed, d.owner1_name].filter(Boolean).join(' · ') || ''}</span>
          </div>
        </label>
      `).join('');

    container.querySelectorAll('input[name="dog_ids"]').forEach(cb => {
      cb.addEventListener('change', function() {
        const id = parseInt(this.value);
        if (this.checked) { if (!selectedDogIds.includes(id)) selectedDogIds.push(id); }
        else { selectedDogIds = selectedDogIds.filter(i => i !== id); }
      });
    });
  }

  main.innerHTML = `
    <a href="${backLink}" class="back-link">&larr; Back</a>
    <div class="card">
      <h1>${isEdit ? 'Edit Booking' : 'Add Booking'}</h1>
      <form id="booking-form">
        <div class="form-group">
          <label>Dogs *</label>
          <input type="text" id="checkbox-dog-search" class="search-input" placeholder="Filter dogs...">
          <div id="dog-checkboxes" class="checkbox-group"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label for="start_date">Start Date *</label><input type="date" id="start_date" value="${startDate}" required></div>
          <div class="form-group"><label for="end_date">End Date *</label><input type="date" id="end_date" value="${endDate}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label for="drop_off_time">Drop-off Time</label><input type="time" id="drop_off_time" value="${isEdit && booking.drop_off_time ? booking.drop_off_time : ''}"></div>
          <div class="form-group"><label for="pick_up_time">Pick-up Time</label><input type="time" id="pick_up_time" value="${isEdit && booking.pick_up_time ? booking.pick_up_time : ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label for="rate">Rate ($)</label><input type="number" id="rate" value="${isEdit ? booking.rate : '0'}" min="0"></div>
          <div class="form-group"><label for="total_cost">Total Cost ($)</label><input type="number" id="total_cost" value="${isEdit ? booking.total_cost : '0'}" min="0"></div>
        </div>
        <div class="form-group">
          <label for="status">Status</label>
          <select id="status">${['pending','confirmed','completed','cancelled'].map(s => `<option value="${s}" ${isEdit && booking.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label for="notes">Notes</label><textarea id="notes">${isEdit && booking.notes ? escHtml(booking.notes) : ''}</textarea></div>
        <button type="submit" class="btn btn-block">${isEdit ? 'Save Changes' : 'Add Booking'}</button>
      </form>
    </div>
  `;

  renderDogCheckboxes();

  document.getElementById('checkbox-dog-search').addEventListener('input', function() { renderDogCheckboxes(this.value); });

  document.getElementById('start_date').addEventListener('change', function() {
    const end = document.getElementById('end_date');
    if (end.value && end.value < this.value) end.value = '';
  });

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sDate = document.getElementById('start_date').value;
    const eDate = document.getElementById('end_date').value;

    if (eDate < sDate) {
      const el = document.querySelector('.alert-error'); if (el) el.remove();
      main.querySelector('.card').insertBefore(showAlert('End date must be on or after start date', 'error'), main.querySelector('form'));
      return;
    }

    if (selectedDogIds.length === 0) {
      const el = document.querySelector('.alert-error'); if (el) el.remove();
      main.querySelector('.card').insertBefore(showAlert('Select at least one dog', 'error'), main.querySelector('form'));
      return;
    }

    const data = {
      dog_ids: selectedDogIds,
      start_date: sDate,
      end_date: eDate,
      drop_off_time: document.getElementById('drop_off_time').value || null,
      pick_up_time: document.getElementById('pick_up_time').value || null,
      rate: parseInt(document.getElementById('rate').value) || 0,
      total_cost: parseInt(document.getElementById('total_cost').value) || 0,
      status: document.getElementById('status').value,
      notes: document.getElementById('notes').value,
    };

    try {
      if (isEdit) {
        await api.put('/api/bookings/' + booking.id, data);
        window.location.hash = consumeReturnTo(`dogs/${dogId}`);
      } else {
        await api.post('/api/bookings', data);
        navigateTo('/dogs/' + dogId);
      }
    } catch (err) {
      const el = document.querySelector('.alert-error'); if (el) el.remove();
      main.querySelector('.card').insertBefore(showAlert(err.message, 'error'), main.querySelector('form'));
    }
  });
}
