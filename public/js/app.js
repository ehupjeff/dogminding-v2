let modalCallback = null;

function confirmDialog(message, callback) {
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-overlay').classList.remove('hidden');
  modalCallback = callback;
}

function updateHeader() {
  document.getElementById('app-header').style.display = localStorage.getItem('token') ? 'flex' : 'none';
}

function navigateTo(path) {
  const current = window.location.hash.replace('#', '') || '/';
  if (path.includes('/bookings/') && path.includes('/edit')) {
    sessionStorage.setItem('returnTo', '#' + current);
  }
  window.location.hash = '#' + path;
}

function getReturnTo(fallback) {
  return sessionStorage.getItem('returnTo') || ('#/' + fallback);
}

function consumeReturnTo(fallback) {
  const stored = sessionStorage.getItem('returnTo');
  sessionStorage.removeItem('returnTo');
  return stored || ('#/' + fallback);
}

async function router() {
  const hash = window.location.hash.replace('#', '') || '/';
  const main = document.getElementById('app-main');
  const token = localStorage.getItem('token');

  if (hash === '/login' || hash === '/signup') {
    updateHeader();
    if (hash === '/login') renderLogin();
    else renderSignup();
    return;
  }

  if (!token) { navigateTo('/login'); return; }

  updateHeader();

  if (hash === '/') { renderDashboard(); return; }
  if (hash === '/dogs/new') { renderDogForm(); return; }
  if (hash === '/bookings/search') { renderBookingSearch(); return; }
  if (hash === '/bookings/calendar') { renderBookingCalendar(); return; }

  const bookingNew = hash.match(/^\/dogs\/(\d+)\/bookings\/new$/);
  if (bookingNew) { renderBookingForm(bookingNew[1]); return; }

  const bookingEdit = hash.match(/^\/dogs\/(\d+)\/bookings\/(\d+)\/edit$/);
  if (bookingEdit) {
    try {
      const booking = await api.get('/api/bookings/' + bookingEdit[2]);
      renderBookingForm(bookingEdit[1], booking);
    } catch (err) { main.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
    return;
  }

  const dogEdit = hash.match(/^\/dogs\/(\d+)\/edit$/);
  if (dogEdit) {
    try { const dog = await api.get('/api/dogs/' + dogEdit[1]); renderDogForm(dog); }
    catch (err) { main.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
    return;
  }

  const dogDetail = hash.match(/^\/dogs\/(\d+)$/);
  if (dogDetail) { renderDogDetail(dogDetail[1]); return; }

  navigateTo('/');
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-logout').addEventListener('click', logout);

  document.getElementById('modal-cancel').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    modalCallback = null;
  });

  document.getElementById('modal-confirm').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    if (modalCallback) modalCallback();
    modalCallback = null;
  });

  document.getElementById('lightbox').addEventListener('click', () => {
    document.getElementById('lightbox').classList.add('hidden');
  });

  router();
});
