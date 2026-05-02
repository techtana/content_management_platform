import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { aiApi } from '../api.js';

const PROVIDER_TYPES = [
  { value: 'ollama', label: 'Ollama (local)', defaultUrl: 'http://localhost:11434/v1' },
  { value: 'lmstudio', label: 'LM Studio (local)', defaultUrl: 'http://localhost:1234/v1' },
  { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic', defaultUrl: 'https://api.anthropic.com' },
  { value: 'openrouter', label: 'OpenRouter', defaultUrl: 'https://openrouter.ai/api/v1' },
  { value: 'custom', label: 'Custom', defaultUrl: '' },
];

const BLANK = { display_name: '', provider_type: 'ollama', base_url: 'http://localhost:11434/v1', api_key: '', default_model: '', is_default: false };

export default function AISettings() {
  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [models, setModels] = useState([]);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  function load() { aiApi.providers().then(setProviders).catch(e => setError(e.message)); }

  function selectType(type) {
    const def = PROVIDER_TYPES.find(p => p.value === type);
    setForm(f => ({ ...f, provider_type: type, base_url: def?.defaultUrl || '' }));
  }

  async function loadModels(id) {
    try {
      const m = await aiApi.models(id);
      setModels(m);
    } catch { setModels([]); }
  }

  async function testProvider(id) {
    setTesting(id); setTestResult(null);
    try {
      const r = await aiApi.test(id);
      setTestResult({ id, ok: r.ok, latencyMs: r.latencyMs });
    } catch (e) {
      setTestResult({ id, ok: false, error: e.message });
    } finally {
      setTesting(null);
    }
  }

  function startEdit(p) {
    setEditId(p.id);
    setForm({ display_name: p.display_name, provider_type: p.provider_type, base_url: p.base_url, api_key: '', default_model: p.default_model || '', is_default: !!p.is_default });
    loadModels(p.id);
  }

  function cancelEdit() { setEditId(null); setForm(BLANK); setModels([]); }

  async function handleSave() {
    setError(''); setSaving(true);
    try {
      if (editId) {
        await aiApi.updateProvider(editId, form);
      } else {
        await aiApi.createProvider(form);
      }
      load();
      cancelEdit();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this AI provider?')) return;
    try { await aiApi.deleteProvider(id); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">📄 Pages CMS</div>
        <nav>
          <Link className="sidebar-link" to="/dashboard">Dashboard</Link>
          <div className="sidebar-section">Settings</div>
          <Link className="sidebar-link active" to="/ai-settings">AI Providers</Link>
        </nav>
      </aside>
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">AI Providers</span>
        </header>
        <main className="page">
          {error && <div className="error-msg mb-4">{error}</div>}

          <div className="card mb-4">
            <div style={{ fontWeight: 600, marginBottom: '1rem' }}>{editId ? 'Edit Provider' : 'Add Provider'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-input" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="My Ollama" />
              </div>
              <div className="form-group">
                <label className="form-label">Provider Type</label>
                <select className="form-select" value={form.provider_type} onChange={e => selectType(e.target.value)}>
                  {PROVIDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Base URL</label>
                <input className="form-input" value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} />
              </div>
              {form.provider_type !== 'ollama' && form.provider_type !== 'lmstudio' && (
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input className="form-input" type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder="Leave blank to keep existing" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Default Model</label>
                {models.length > 0 ? (
                  <select className="form-select" value={form.default_model} onChange={e => setForm(f => ({ ...f, default_model: e.target.value }))}>
                    <option value="">— select —</option>
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input className="form-input" value={form.default_model} onChange={e => setForm(f => ({ ...f, default_model: e.target.value }))} placeholder="e.g. llama3.2 or gpt-4o" />
                )}
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                <input type="checkbox" id="is_default" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
                <label htmlFor="is_default" className="form-label" style={{ marginBottom: 0 }}>Set as default provider</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Add Provider'}</button>
              {editId && <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>}
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Base URL</th>
                  <th>Model</th>
                  <th>Default</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No providers configured.</td></tr>
                )}
                {providers.map(p => (
                  <tr key={p.id}>
                    <td>{p.display_name}</td>
                    <td>{p.provider_type}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.base_url}</td>
                    <td>{p.default_model || '—'}</td>
                    <td>{p.is_default ? '✓' : ''}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => testProvider(p.id)} disabled={testing === p.id}>
                          {testing === p.id ? 'Testing…' : 'Test'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
                      </div>
                      {testResult?.id === p.id && (
                        <div className={testResult.ok ? 'success-msg' : 'error-msg'} style={{ marginTop: '0.25rem' }}>
                          {testResult.ok ? `OK — ${testResult.latencyMs}ms` : `Failed: ${testResult.error}`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
