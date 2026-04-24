const AUTH  = '/api/auth';
const DIARY = '/api/diary';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function register(username, email, password) {
  const res = await fetch(`${AUTH}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  return parseResponse(res);
}

export async function login(username, password) {
  const res = await fetch(`${AUTH}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return parseResponse(res);
}

export async function getEntries() {
  const res = await fetch(`${DIARY}/entries`, { headers: authHeaders() });
  return parseResponse(res);
}

export async function createEntry(formData) {
  const res = await fetch(`${DIARY}/entries`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return parseResponse(res);
}

export async function deleteEntry(id) {
  const res = await fetch(`${DIARY}/entries/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseResponse(res);
}
