const BASE = '/api';

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path, body) => request('DELETE', path, body),
};

// Helpers
export const setupApi = {
  status: () => api.get('/setup/status'),
  validateToken: (token) => api.post('/setup/validate-token', { token }),
  complete: (token, site) => api.post('/setup/complete', { token, site }),
};

export const meApi = {
  get: () => api.get('/me'),
  patch: (body) => api.patch('/me', body),
};

export const reposApi = {
  list: () => api.get('/repos'),
  detect: (owner, repo) => api.get(`/repos/detect?owner=${owner}&repo=${repo}`),
  enhancePolicies: (owner, repo) => api.get(`/repos/enhance-policies?owner=${owner}&repo=${repo}`),
};

export const sitesApi = {
  list: () => api.get('/sites'),
  get: (id) => api.get(`/sites/${id}`),
  create: (body) => api.post('/sites', body),
  update: (id, body) => api.put(`/sites/${id}`, body),
  delete: (id) => api.delete(`/sites/${id}`),
};

export const contentApi = {
  list: (siteId, sectionSlug, status) =>
    api.get(`/sites/${siteId}/content/${sectionSlug}?status=${status || 'all'}`),
  get: (siteId, sectionSlug, filePath) =>
    api.get(`/sites/${siteId}/content/${sectionSlug}/${btoa(filePath).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`),
  create: (siteId, sectionSlug, body) =>
    api.post(`/sites/${siteId}/content/${sectionSlug}`, body),
  update: (siteId, sectionSlug, filePath, body) =>
    api.put(`/sites/${siteId}/content/${sectionSlug}/${btoa(filePath).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`, body),
  publish: (siteId, sectionSlug, filePath, body) =>
    api.post(`/sites/${siteId}/content/${sectionSlug}/${btoa(filePath).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}/publish`, body),
  delete: (siteId, sectionSlug, filePath, sha) =>
    api.delete(`/sites/${siteId}/content/${sectionSlug}/${btoa(filePath).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`, { sha }),
};

export const aiApi = {
  providers: () => api.get('/ai/providers'),
  createProvider: (body) => api.post('/ai/providers', body),
  updateProvider: (id, body) => api.put(`/ai/providers/${id}`, body),
  deleteProvider: (id) => api.delete(`/ai/providers/${id}`),
  models: (id) => api.get(`/ai/providers/${id}/models`),
  test: (id) => api.post(`/ai/providers/${id}/test`),
  enhance: (content, instruction, providerId) => api.post('/ai/enhance', { content, instruction, providerId }),
  instructions: () => api.get('/ai/instructions'),
  createInstruction: (body) => api.post('/ai/instructions', body),
  updateInstruction: (id, body) => api.put(`/ai/instructions/${id}`, body),
  deleteInstruction: (id) => api.delete(`/ai/instructions/${id}`),
};

export const notebookApi = {
  convert: (ipynbJson) => fetch('/api/notebook/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: ipynbJson,
  }).then(r => r.json()),
};
