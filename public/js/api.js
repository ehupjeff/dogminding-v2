const api = {
  async request(method, url, data) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { method, headers };
    if (data) config.body = JSON.stringify(data);
    const res = await fetch(url, config);
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.hash = '#/login';
      throw new Error('Session expired');
    }
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Request failed');
    return body;
  },
  get(url)        { return this.request('GET', url); },
  post(url, data) { return this.request('POST', url, data); },
  put(url, data)  { return this.request('PUT', url, data); },
  del(url)        { return this.request('DELETE', url); }
};
