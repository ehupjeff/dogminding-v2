function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(t) {
  return t ? t.substring(0, 5) : '';
}

function statusBadge(s) {
  return `<span class="badge badge-${s}">${s}</span>`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderDashboard() {
  const main = document.getElementById('app-main');
  main.innerHTML = `
    <div class="page-header">
      <h1>My Dogs</h1>
      <div>
        <a href="#/bookings/calendar" class="btn btn-outline btn-small">Booking Calendar</a>
        <a href="#/bookings/search" class="btn btn-outline btn-small">Search Bookings</a>
        <button id="btn-add-dog" class="btn btn-small">+ Add Dog</button>
      </div>
    </div>
    <input type="text" id="dog-search" class="search-input" placeholder="Search by dog or owner name..." autofocus>
    <div id="dogs-list"></div>
  `;

  document.getElementById('btn-add-dog').addEventListener('click', () => navigateTo('/dogs/new'));

  try {
    const dogs = await api.get('/api/dogs');
    const list = document.getElementById('dogs-list');

    function renderList(filtered) {
      if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No dogs found.</p></div>';
        return;
      }
      list.innerHTML = filtered.map(d => `
        <div class="card dog-card" data-id="${d.id}">
          ${d.thumbnail ? `<img class="dog-thumb" src="${d.thumbnail}" alt="${escAttr(d.name)}">` : `<div class="dog-avatar">${d.name[0].toUpperCase()}</div>`}
          <div class="dog-info"><h3>${escHtml(d.name)}</h3><p>${[d.breed, d.owner1_name].filter(Boolean).join(' · ') || 'No details'}</p></div>
        </div>
      `).join('');

      list.querySelectorAll('.dog-card').forEach(card => {
        card.addEventListener('click', () => navigateTo('/dogs/' + card.dataset.id));
      });
    }

    renderList(dogs);

    document.getElementById('dog-search').addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      if (!q) { renderList(dogs); return; }
      renderList(dogs.filter(d => [d.name, d.owner1_name, d.owner2_name].filter(Boolean).join(' ').toLowerCase().includes(q)));
    });
  } catch (err) {
    main.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function renderDogDetail(id) {
  const main = document.getElementById('app-main');
  main.innerHTML = '<div class="loading">Loading...</div>';

  let dog;
  try {
    dog = await api.get('/api/dogs/' + id);
  } catch (err) {
    main.innerHTML = `<a href="#/" class="back-link">&larr; Back</a><div class="alert alert-error">${err.message}</div>`;
    return;
  }

  renderDogDetailView(dog);
  refreshBookingList(id);
  refreshImages(id);
}

function renderDogDetailView(dog) {
  const main = document.getElementById('app-main');
  main.innerHTML = `
    <a href="#/" class="back-link">&larr; Back</a>
    <div class="page-header">
      <h1>${escHtml(dog.name)}</h1>
      <div>
        <button id="btn-edit-dog" class="btn btn-outline btn-small">Edit</button>
        <button id="btn-delete-dog" class="btn btn-danger btn-small">Delete</button>
      </div>
    </div>
    <div class="card">
      <div class="meta-list">
        ${dog.breed ? `<div class="meta-item"><span class="meta-label">Breed</span><span class="meta-value">${escHtml(dog.breed)}</span></div>` : ''}
        ${dog.age ? `<div class="meta-item"><span class="meta-label">Age</span><span class="meta-value">${dog.age} years</span></div>` : ''}
        ${dog.size ? `<div class="meta-item"><span class="meta-label">Size</span><span class="meta-value">${escHtml(dog.size)}</span></div>` : ''}
      </div>
      ${dog.owner1_name ? `<div class="owner-section"><h4>Primary Owner</h4><p>${escHtml(dog.owner1_name)}${dog.owner1_phone ? ' &mdash; ' + escHtml(dog.owner1_phone) : ''}</p></div>` : ''}
      ${dog.owner2_name ? `<div class="owner-section"><h4>Secondary Owner</h4><p>${escHtml(dog.owner2_name)}${dog.owner2_phone ? ' &mdash; ' + escHtml(dog.owner2_phone) : ''}</p></div>` : ''}
      ${dog.notes ? `<p style="white-space:pre-wrap;margin-top:8px;font-size:14px;">${escHtml(dog.notes)}</p>` : ''}
      <div id="image-gallery-section">
        <div class="image-gallery" id="image-gallery"></div>
        <div class="image-upload-area" id="image-upload-area">
          <p>Click to upload photos</p>
          <input type="file" id="image-file-input" accept="image/*" multiple style="display:none">
        </div>
      </div>
    </div>

    <div class="page-header" style="margin-top:16px;">
      <h2>Bookings</h2>
      <button id="btn-add-booking" class="btn btn-small">+ Add Booking</button>
    </div>
    <div class="card" id="bookings-list"><div class="loading">Loading...</div></div>
  `;

  document.getElementById('btn-edit-dog').addEventListener('click', () => navigateTo('/dogs/' + dog.id + '/edit'));
  document.getElementById('btn-delete-dog').addEventListener('click', () => confirmDialog(`Delete ${dog.name} and all bookings?`, () => handleDeleteDog(dog.id)));
  document.getElementById('btn-add-booking').addEventListener('click', () => navigateTo('/dogs/' + dog.id + '/bookings/new'));

  const uploadArea = document.getElementById('image-upload-area');
  const fileInput = document.getElementById('image-file-input');
  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    for (const file of fileInput.files) {
      try {
        const b64 = await readFileAsBase64(file);
        await api.post('/api/dog/' + dog.id + '/images', { image_data: b64, original_name: file.name });
      } catch (err) { alert('Upload failed: ' + err.message); }
    }
    fileInput.value = '';
    refreshImages(dog.id);
  });
}

async function handleDeleteDog(id) {
  try { await api.del('/api/dogs/' + id); navigateTo('/'); }
  catch (err) { alert(err.message); }
}

async function refreshBookingList(dogId) {
  const container = document.getElementById('bookings-list');
  if (!container) return;
  try {
    const [bookings, dogs] = await Promise.all([api.get('/api/bookings/dog/' + dogId), api.get('/api/dogs')]);
    const dogNames = {};
    dogs.forEach(d => { dogNames[d.id] = d.name; });

    if (bookings.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No bookings yet.</p></div>';
      return;
    }

    container.innerHTML = bookings.map(b => {
      const times = [b.drop_off_time ? 'Drop: ' + formatTime(b.drop_off_time) : '', b.pick_up_time ? 'Pick: ' + formatTime(b.pick_up_time) : ''].filter(Boolean).join(' | ');
      const otherDogs = (b.dog_ids || []).filter(id => id != dogId).map(id => dogNames[id] || 'Dog #' + id);
      return `<div class="booking-row">
        <div>
          <div class="booking-dates">${formatDate(b.start_date)} &ndash; ${formatDate(b.end_date)} ${statusBadge(b.status)}</div>
          ${times ? `<div class="booking-times">${times}</div>` : ''}
          ${otherDogs.length > 0 ? `<div class="booking-times">Also: ${otherDogs.join(', ')}</div>` : ''}
          ${b.total_cost > 0 ? `<div class="booking-cost">$${b.total_cost}</div>` : ''}
          ${b.notes ? `<div style="font-size:13px;color:var(--text-muted);">${escHtml(b.notes)}</div>` : ''}
        </div>
        <div class="booking-actions">
          <button class="btn btn-outline btn-small" data-edit="${b.id}">Edit</button>
          <button class="btn btn-danger btn-small" data-delete="${b.id}">Del</button>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo('/dogs/' + dogId + '/bookings/' + btn.dataset.edit + '/edit'));
    });
    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => confirmDialog('Delete this booking?', async () => {
        try { await api.del('/api/bookings/' + btn.dataset.delete); refreshBookingList(dogId); }
        catch (err) { alert(err.message); }
      }));
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderDogForm(dog) {
  const isEdit = !!dog;
  const main = document.getElementById('app-main');
  main.innerHTML = `
    <a href="${isEdit ? '#/dogs/' + dog.id : '#/'}" class="back-link">&larr; Back</a>
    <div class="card">
      <h1>${isEdit ? 'Edit Dog' : 'Add Dog'}</h1>
      <form id="dog-form">
        <div class="form-group"><label for="name">Name *</label><input type="text" id="name" value="${isEdit ? escAttr(dog.name) : ''}" required autofocus></div>
        <div class="form-row">
          <div class="form-group"><label for="breed">Breed</label><input type="text" id="breed" value="${isEdit && dog.breed ? escAttr(dog.breed) : ''}"></div>
          <div class="form-group"><label for="age">Age (years)</label><input type="number" id="age" value="${isEdit && dog.age ? dog.age : ''}" min="0"></div>
        </div>
        <div class="form-group">
          <label for="size">Size</label>
          <select id="size"><option value="">--</option>${['Small','Medium','Large'].map(s => `<option value="${s}" ${isEdit && dog.size === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
        <div class="owner-section"><h4>Primary Owner</h4>
          <div class="form-row">
            <div class="form-group"><label for="owner1_name">Name</label><input type="text" id="owner1_name" value="${isEdit && dog.owner1_name ? escAttr(dog.owner1_name) : ''}"></div>
            <div class="form-group"><label for="owner1_phone">Phone</label><input type="text" id="owner1_phone" value="${isEdit && dog.owner1_phone ? escAttr(dog.owner1_phone) : ''}"></div>
          </div>
        </div>
        <div class="owner-section"><h4>Secondary Owner</h4>
          <div class="form-row">
            <div class="form-group"><label for="owner2_name">Name</label><input type="text" id="owner2_name" value="${isEdit && dog.owner2_name ? escAttr(dog.owner2_name) : ''}"></div>
            <div class="form-group"><label for="owner2_phone">Phone</label><input type="text" id="owner2_phone" value="${isEdit && dog.owner2_phone ? escAttr(dog.owner2_phone) : ''}"></div>
          </div>
        </div>
        <div class="form-group"><label for="notes">Notes</label><textarea id="notes">${isEdit && dog.notes ? escHtml(dog.notes) : ''}</textarea></div>
        <button type="submit" class="btn btn-block">${isEdit ? 'Save Changes' : 'Add Dog'}</button>
      </form>
    </div>
  `;

  document.getElementById('dog-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('name').value,
      breed: document.getElementById('breed').value,
      age: document.getElementById('age').value ? parseInt(document.getElementById('age').value) : null,
      size: document.getElementById('size').value,
      owner1_name: document.getElementById('owner1_name').value,
      owner1_phone: document.getElementById('owner1_phone').value,
      owner2_name: document.getElementById('owner2_name').value,
      owner2_phone: document.getElementById('owner2_phone').value,
      notes: document.getElementById('notes').value,
    };
    try {
      if (isEdit) { await api.put('/api/dogs/' + dog.id, data); navigateTo('/dogs/' + dog.id); }
      else { const d = await api.post('/api/dogs', data); navigateTo('/dogs/' + d.id); }
    } catch (err) {
      const el = document.querySelector('.alert-error');
      if (el) el.remove();
      main.querySelector('.card').insertBefore(showAlert(err.message, 'error'), main.querySelector('form'));
    }
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function refreshImages(dogId) {
  const gallery = document.getElementById('image-gallery');
  if (!gallery) return;
  try {
    const images = await api.get('/api/dog/' + dogId + '/images');
    if (images.length === 0) { gallery.innerHTML = ''; return; }
    const data = await Promise.all(images.map(img => api.get('/api/dog/' + dogId + '/images/' + img.id)));
    gallery.innerHTML = data.map(img => `
      <div class="image-thumb">
        <img src="${img.image_data}" alt="${escAttr(img.original_name || '')}" data-full="${escAttr(img.image_data)}">
        <button class="image-delete" data-image-id="${img.id}">&times;</button>
      </div>
    `).join('');

    gallery.querySelectorAll('.image-thumb img').forEach(img => {
      img.addEventListener('click', () => {
        document.getElementById('lightbox-img').src = img.dataset.full;
        document.getElementById('lightbox').classList.remove('hidden');
      });
    });
    gallery.querySelectorAll('.image-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        confirmDialog('Delete this photo?', async () => {
          try { await api.del('/api/dog/' + dogId + '/images/' + btn.dataset.imageId); refreshImages(dogId); }
          catch (err) { alert(err.message); }
        });
      });
    });
  } catch (err) { console.error('Images error:', err); }
}
