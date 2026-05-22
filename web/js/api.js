const API_BASE = 'http://31.76.225.94:3000/api';
const SOCKET_URL = 'http://31.76.225.94:3000';

function getToken() {
  return localStorage.getItem('flickzap_token');
}

function setToken(token) {
  localStorage.setItem('flickzap_token', token);
}

function clearToken() {
  localStorage.removeItem('flickzap_token');
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
