import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { aiApi } from '../api.js';

const PROVIDER_TYPES = [
  { value: 'ollama',     label: 'Ollama (local)',  defaultUrl: 'http://localhost:11434/v1' },
  { value: 'lmstudio',  label: 'LM Studio (local)',defaultUrl: 'http://localhost:1234/v1' },
  { value: 'openai',    label: 'OpenAI',           defaultUrl: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic',        defaultUrl: 'https://api.anthropic.com' },
  { value: 'openrouter',label: 'OpenRouter',       defaultUrl: 'https://openrouter.ai/api/v1' },
  { value: 'custom',    label: 'Custom',           defaultUrl: '' },
];

const BLANK_PROVIDER = { display_name: '', provider_type: 'ollama', base_url: 'http://localhost:11434/v1', api_key: '', default_model: '', is_default: false };

const INSTRUCTION_TEMPLATES = [
  {
    name: 'Blog Polish (general)',
    instruction: `Improve the clarity, flow, and readability of this blog post. Fix grammar and spelling. Keep the author's voice and all key facts intact. Do not add new sections or change the topic.`,
  },
  {
    name: 'Technical Clarity',
    instruction: `Rewrite this technical post for clarity. Use precise language, define jargon on first use, and ensure code examples are well explained. Preserve all technical details and accuracy.`,
  },
  {
    name: 'Casual & Conversational',
    instruction: `Rewrite this post in a warm, casual, conversational tone. Use contractions, short sentences, and friendly language. Make it feel like the author is talking directly to the reader.`,
  },
  {
    name: 'Concise — cut the fat',
    instruction: `Tighten this content. Remove filler phrases, redundant sentences, and unnecessary preamble. Keep every sentence purposeful. Target 20-30% shorter while preserving all key points.`,
  },
  {
    name: 'SEO-Friendly Structure',
    instruction: `Restructure this post for readability and SEO. Use descriptive H2/H3 headings, short paragraphs, and add a brief intro paragraph and clear conclusion. Do not change the factual content.`,
  },
  {
    name: 'Local Model — simple prompt',
    instruction: `You are an editor. Improve this text: fix grammar, improve sentence flow, and make it clearer. Return only the improved text with no commentary.`,
  },
  {
    name: 'Journal / Personal Writing',
    instruction: `Polish this personal journal entry. Improve sentence rhythm and word choice while preserving the personal, reflective tone. Keep all emotions and personal details exactly as written.`,
  },
];

const BLANK_INSTRUCTION = { name: '', instruction: '' };

export default function AISettings() {
  const [tab, setTab] = useState('providers');

  // Providers state
  const [providers, setProviders] = useState([]);
  const [providerForm, setProviderForm] = useState(BLANK_PROVIDER);
  const [editProviderId, setEditProviderId] = useState(null);
  const [models, setModels] = useState([]);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState('');

  // Instructions state
  const [instructions, setInstructions] = useState([]);
  const [instrForm, setInstrForm] = useState(BLANK_INSTRUCTION);
  const [editInstrId, setEditInstrId] = useState(null);
  const [instrSaving, setInstrSaving] = useState(false);
  const [instrError, setInstrError] = useState('');

  useEffect(() => { loadProviders(); loadInstructions(); }, []);

  function loadProviders() { aiApi.providers().then(setProviders).catch(e => setProviderError(e.message)); }
  function loadInstructions() { aiApi.instructions().then(setInstructions).catch(() => {}); }

  // ── Provider helpers ──
  function selectType(type) {
    const def = PROVIDER_TYPES.find(p => p.value === type);
    setProviderForm(f => ({ ...f, provider_type: type, base_url: def?.defaultUrl || '' }));
  }

  async function loadModels(id) {
    try { setModels(await aiApi.models(id)); } catch { setModels([]); }
  }

  async function testProvider(id) {
    setTesting(id); setTestResult(null);
    try {
      const r = await aiApi.test(id);
      setTestResult({ id, ok: r.ok, latencyMs: r.latencyMs });
    } catch (e) {
      setTestResult({ id, ok: false, error: e.message });
    } finally { setTesting(null); }
  }

  function startEditProvider(p) {
    setEditProviderId(p.id);
    setProviderForm({ display_name: p.display_name, provider_type: p.provider_type, base_url: p.base_url, api_key: '', default_model: p.default_model || '', is_default: !!p.is_default });
    loadModels(p.id);
  }

  function cancelEditProvider() { setEditProviderId(null); setProviderForm(BLANK_PROVIDER); setModels([]); }

  async function saveProvider() {
    setProviderError(''); setProviderSaving(true);
    try {
      editProviderId ? await aiApi.updateProvider(editProviderId, providerForm) : await aiApi.createProvider(providerForm);
      loadProviders();
      cancelEditProvider();
    } catch (e) { setProviderError(e.message); }
    finally { setProviderSaving(false); }
  }

  async function deleteProvider(id) {
    if (!confirm('Delete this AI provider?')) return;
    try { await aiApi.deleteProvider(id); loadProviders(); } catch (e) { alert(e.message); }
  }

  // ── Instruction helpers ──
  function startEditInstruction(instr) {
    setEditInstrId(instr.id);
    setInstrForm({ name: instr.name, instruction: instr.instruction });
  }

  function cancelEditInstruction() { setEditInstrId(null); setInstrForm(BLANK_INSTRUCTION); }

  function applyTemplate(tpl) {
    setInstrForm({ name: tpl.name, instruction: tpl.instruction });
    setEditInstrId(null);
  }

  async function saveInstruction() {
    if (!instrForm.name.trim() || !instrForm.instruction.trim()) {
      setInstrError('Name and instruction text are required.'); return;
    }
    setInstrError(''); setInstrSaving(true);
    try {
      editInstrId ? await aiApi.updateInstruction(editInstrId, instrForm) : await aiApi.createInstruction(instrForm);
      loadInstructions();
      cancelEditInstruction();
    } catch (e) { setInstrError(e.message); }
    finally { setInstrSaving(false); }
  }

  async function deleteInstruction(id) {
    if (!confirm('Delete this instruction?')) return;
    try { await aiApi.deleteInstruction(id); loadInstructions(); } catch (e) { alert(e.message); }
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
          <span className="topbar-title">AI Settings</span>
        </header>
        <main className="page">
          <div className="tabs">
            <button className={`tab${tab === 'providers' ? ' active' : ''}`} onClick={() => setTab('providers')}>Providers</button>
            <button className={`tab${tab === 'instructions' ? ' active' : ''}`} onClick={() => setTab('instructions')}>Custom Instructions</button>
          </div>

          {/* ── PROVIDERS TAB ── */}
          {tab === 'providers' && (
            <>
              {providerError && <div className="error-msg mb-4">{providerError}</div>}
              <div className="card mb-4">
                <div style={{ fontWeight: 600, marginBottom: '1rem' }}>{editProviderId ? 'Edit Provider' : 'Add Provider'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <input className="form-input" value={providerForm.display_name} onChange={e => setProviderForm(f => ({ ...f, display_name: e.target.value }))} placeholder="My Ollama" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Provider Type</label>
                    <select className="form-select" value={providerForm.provider_type} onChange={e => selectType(e.target.value)}>
                      {PROVIDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Base URL</label>
                    <input className="form-input" value={providerForm.base_url} onChange={e => setProviderForm(f => ({ ...f, base_url: e.target.value }))} />
                  </div>
                  {providerForm.provider_type !== 'ollama' && providerForm.provider_type !== 'lmstudio' && (
                    <div className="form-group">
                      <label className="form-label">API Key</label>
                      <input className="form-input" type="password" value={providerForm.api_key} onChange={e => setProviderForm(f => ({ ...f, api_key: e.target.value }))} placeholder="Leave blank to keep existing" />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Default Model</label>
                    {models.length > 0 ? (
                      <select className="form-select" value={providerForm.default_model} onChange={e => setProviderForm(f => ({ ...f, default_model: e.target.value }))}>
                        <option value="">— select —</option>
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input className="form-input" value={providerForm.default_model} onChange={e => setProviderForm(f => ({ ...f, default_model: e.target.value }))} placeholder="e.g. llama3.2 or gpt-4o" />
                    )}
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                    <input type="checkbox" id="is_default" checked={providerForm.is_default} onChange={e => setProviderForm(f => ({ ...f, is_default: e.target.checked }))} />
                    <label htmlFor="is_default" className="form-label" style={{ marginBottom: 0 }}>Set as default provider</label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={saveProvider} disabled={providerSaving}>{providerSaving ? 'Saving…' : editProviderId ? 'Update' : 'Add Provider'}</button>
                  {editProviderId && <button className="btn btn-secondary" onClick={cancelEditProvider}>Cancel</button>}
                </div>
              </div>

              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr><th>Name</th><th>Type</th><th>Base URL</th><th>Model</th><th>Default</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {providers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No providers configured.</td></tr>}
                    {providers.map(p => (
                      <tr key={p.id}>
                        <td>{p.display_name}</td>
                        <td>{p.provider_type}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.base_url}</td>
                        <td>{p.default_model || '—'}</td>
                        <td>{p.is_default ? '✓' : ''}</td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => startEditProvider(p)}>Edit</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => testProvider(p.id)} disabled={testing === p.id}>{testing === p.id ? 'Testing…' : 'Test'}</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteProvider(p.id)}>Delete</button>
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
            </>
          )}

          {/* ── INSTRUCTIONS TAB ── */}
          {tab === 'instructions' && (
            <>
              {instrError && <div className="error-msg mb-4">{instrError}</div>}

              {/* Templates */}
              <div className="card mb-4">
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Templates</div>
                <div className="text-muted" style={{ marginBottom: '0.75rem' }}>Click a template to load it into the editor below, then save.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {INSTRUCTION_TEMPLATES.map(tpl => (
                    <button key={tpl.name} className="btn btn-secondary btn-sm" onClick={() => applyTemplate(tpl)}>
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor */}
              <div className="card mb-4">
                <div style={{ fontWeight: 600, marginBottom: '1rem' }}>{editInstrId ? 'Edit Instruction' : 'New Instruction'}</div>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={instrForm.name} onChange={e => setInstrForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Blog Polish" />
                </div>
                <div className="form-group">
                  <label className="form-label">Instruction text</label>
                  <textarea
                    className="form-textarea"
                    rows={6}
                    value={instrForm.instruction}
                    onChange={e => setInstrForm(f => ({ ...f, instruction: e.target.value }))}
                    placeholder="Write the system instruction that will be sent to the AI model…"
                  />
                  <div className="form-help">This becomes the system prompt for AI enhancement. Be specific about tone, format, and what to preserve.</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={saveInstruction} disabled={instrSaving}>{instrSaving ? 'Saving…' : editInstrId ? 'Update' : 'Save Instruction'}</button>
                  {editInstrId && <button className="btn btn-secondary" onClick={cancelEditInstruction}>Cancel</button>}
                </div>
              </div>

              {/* Saved list */}
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr><th>Name</th><th>Preview</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {instructions.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No instructions saved yet.</td></tr>}
                    {instructions.map(instr => (
                      <tr key={instr.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{instr.name}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '420px' }}>
                          {instr.instruction.length > 120 ? instr.instruction.slice(0, 120) + '…' : instr.instruction}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => startEditInstruction(instr)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteInstruction(instr.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
