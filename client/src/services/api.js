const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: (endpoint) => request(endpoint),

  post: (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  delete: (endpoint, body) => request(endpoint, {
    method: 'DELETE',
    body: body ? JSON.stringify(body) : undefined,
  }),
};
