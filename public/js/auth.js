function showAlert(msg, type) {
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  return el;
}

function renderLogin() {
  const main = document.getElementById('app-main');
  main.innerHTML = `
    <div class="auth-page">
      <h1>Dog Minding</h1>
      <form id="login-form">
        <div class="form-group"><label for="email">Email</label><input type="email" id="email" required autofocus></div>
        <div class="form-group"><label for="password">Password</label><input type="password" id="password" required></div>
        <button type="submit" class="btn btn-block">Log In</button>
      </form>
      <div class="auth-link">Don't have an account? <a href="#/signup">Sign up</a></div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
      const data = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      updateHeader();
      navigateTo('/');
    } catch (err) {
      const el = document.querySelector('.alert-error');
      if (el) el.remove();
      main.querySelector('.auth-page').insertBefore(showAlert(err.message, 'error'), main.querySelector('form'));
    }
  });
}

function renderSignup() {
  const main = document.getElementById('app-main');
  main.innerHTML = `
    <div class="auth-page">
      <h1>Create Account</h1>
      <form id="signup-form">
        <div class="form-group"><label for="name">Name</label><input type="text" id="name" required autofocus></div>
        <div class="form-group"><label for="email">Email</label><input type="email" id="email" required></div>
        <div class="form-group"><label for="password">Password</label><input type="password" id="password" required minlength="6"></div>
        <button type="submit" class="btn btn-block">Sign Up</button>
      </form>
      <div class="auth-link">Already have an account? <a href="#/login">Log in</a></div>
    </div>
  `;

  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      const data = await api.post('/api/auth/signup', { email, password, name });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      updateHeader();
      navigateTo('/');
    } catch (err) {
      const el = document.querySelector('.alert-error');
      if (el) el.remove();
      main.querySelector('.auth-page').insertBefore(showAlert(err.message, 'error'), main.querySelector('form'));
    }
  });
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateHeader();
  navigateTo('/login');
}
