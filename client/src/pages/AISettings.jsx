import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { aiApi, sitesApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';

const PROVIDER_TYPES = [
  { value: 'ollama',     label: 'Ollama (local)',   defaultUrl: 'http://localhost:11434/v1' },
  { value: 'lmstudio',  label: 'LM Studio (local)', defaultUrl: 'http://localhost:1234/v1' },
  { value: 'openai',    label: 'OpenAI',            defaultUrl: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic',         defaultUrl: 'https://api.anthropic.com' },
  { value: 'openrouter',label: 'OpenRouter',        defaultUrl: 'https://openrouter.ai/api/v1' },
  { value: 'custom',    label: 'Custom',            defaultUrl: '' },
];

const BLANK_PROVIDER = { display_name: '', provider_type: 'ollama', base_url: 'http://localhost:11434/v1', api_key: '', default_model: '', is_default: false };
const BLANK_INSTR    = { name: '', instruction: '' };

const TEMPLATES = [
  { name: 'Blog Polish',         instruction: `Improve the clarity, flow, and readability of this blog post. Fix grammar and spelling. Keep the author's voice and all key facts intact. Do not add new sections or change the topic.` },
  { name: 'Technical Clarity',   instruction: `Rewrite this technical post for clarity. Use precise language, define jargon on first use, and ensure code examples are well explained. Preserve all technical details and accuracy.` },
  { name: 'Casual & Friendly',   instruction: `Rewrite in a warm, casual, conversational tone. Use contractions, short sentences, and friendly language. Feel like the author is talking directly to the reader.` },
  { name: 'Concise — cut fat',   instruction: `Tighten this content. Remove filler phrases, redundant sentences, and unnecessary preamble. Keep every sentence purposeful. Target 20–30% shorter while preserving all key points.` },
  { name: 'SEO Structure',       instruction: `Restructure for readability and SEO. Use descriptive H2/H3 headings, short paragraphs, a brief intro and clear conclusion. Do not change the factual content.` },
  { name: 'Local Model (simple)',instruction: `You are an editor. Fix grammar, improve sentence flow, and make the text clearer. Return only the improved text with no commentary.` },
  { name: 'Journal Polish',      instruction: `Polish this personal journal entry. Improve sentence rhythm and word choice while preserving the personal, reflective tone. Keep all emotions and personal details exactly as written.` },
];

export default function AISettings() {
  const [tab, setTab] = useState('providers');

  // Providers
  const [providers, setProviders]         = useState([]);
  const [pForm, setPForm]                 = useState(BLANK_PROVIDER);
  const [editPId, setEditPId]             = useState(null);
  const [models, setModels]               = useState([]);
  const [testing, setTesting]             = useState(null);
  const [testResult, setTestResult]       = useState(null);
  const [pSaving, setPSaving]             = useState(false);
  const [pError, setPError]               = useState('');

  // Instructions
  const [instructions, setInstructions]   = useState([]);
  const [iForm, setIForm]                 = useState(BLANK_INSTR);
  const [editIId, setEditIId]             = useState(null);
  const [iSaving, setISaving]             = useState(false);
  const [iError, setIError]               = useState('');

  // Section defaults
  const [sites, setSites]                 = useState([]);
  const [sectionDefaults, setSectionDefaults] = useState({});  // { siteId_slug: instructionId }
  const [sdSaving, setSdSaving]           = useState(null);

  useEffect(() => {
    loadProviders(); loadInstructions();
    sitesApi.list().then(s => {
      setSites(s);
      const map = {};
      s.forEach(site => site.sections.forEach(sec => {
        if (sec.defaultInstructionId) map[`${site.id}_${sec.slug}`] = sec.defaultInstructionId;
      }));
      setSectionDefaults(map);
    });
  }, []);

  function loadProviders()    { aiApi.providers().then(setProviders).catch(e => setPError(e.message)); }
  function loadInstructions() { aiApi.instructions().then(setInstructions).catch(() => {}); }

  // Provider helpers
  function selectType(type) {
    const def = PROVIDER_TYPES.find(p => p.value === type);
    setPForm(f => ({ ...f, provider_type: type, base_url: def?.defaultUrl || '' }));
  }
  async function loadModels(id) { try { setModels(await aiApi.models(id)); } catch { setModels([]); } }

  async function testProvider(id) {
    setTesting(id); setTestResult(null);
    try { setTestResult({ id, ...(await aiApi.test(id)), ok: true }); }
    catch (e) { setTestResult({ id, ok: false, error: e.message }); }
    finally { setTesting(null); }
  }

  function startEditP(p) {
    setEditPId(p.id);
    setPForm({ display_name: p.display_name, provider_type: p.provider_type, base_url: p.base_url, api_key: '', default_model: p.default_model || '', is_default: !!p.is_default });
    loadModels(p.id);
  }
  function cancelEditP() { setEditPId(null); setPForm(BLANK_PROVIDER); setModels([]); }

  async function saveProvider() {
    setPError(''); setPSaving(true);
    try {
      editPId ? await aiApi.updateProvider(editPId, pForm) : await aiApi.createProvider(pForm);
      loadProviders(); cancelEditP();
    } catch (e) { setPError(e.message); }
    finally { setPSaving(false); }
  }

  async function deleteProvider(id) {
    if (!confirm('Delete this provider?')) return;
    try { await aiApi.deleteProvider(id); loadProviders(); } catch (e) { alert(e.message); }
  }

  // Instruction helpers
  function applyTemplate(tpl) { setIForm({ name: tpl.name, instruction: tpl.instruction }); setEditIId(null); }
  function startEditI(i)      { setEditIId(i.id); setIForm({ name: i.name, instruction: i.instruction }); }
  function cancelEditI()      { setEditIId(null); setIForm(BLANK_INSTR); }

  async function saveInstruction() {
    if (!iForm.name.trim() || !iForm.instruction.trim()) { setIError('Name and instruction text required.'); return; }
    setIError(''); setISaving(true);
    try {
      editIId ? await aiApi.updateInstruction(editIId, iForm) : await aiApi.createInstruction(iForm);
      loadInstructions(); cancelEditI();
    } catch (e) { setIError(e.message); }
    finally { setISaving(false); }
  }

  async function deleteInstruction(id) {
    if (!confirm('Delete this instruction?')) return;
    try { await aiApi.deleteInstruction(id); loadInstructions(); } catch (e) { alert(e.message); }
  }

  // Section defaults
  async function setSectionDefault(site, sectionSlug, instructionId) {
    const key = `${site.id}_${sectionSlug}`;
    setSdSaving(key);
    try {
      await sitesApi.setSectionInstruction(site.id, sectionSlug, instructionId || null);
      setSectionDefaults(prev => ({ ...prev, [key]: instructionId || '' }));
      // Refresh sites to keep in sync
      sitesApi.list().then(setSites);
    } catch (e) { alert('Failed: ' + e.message); }
    finally { setSdSaving(null); }
  }

  const allSections = sites.flatMap(site => site.sections.map(s => ({ site, section: s })));

  return (
    <div className="app-layout">
      <Sidebar site={sites[0] || null} activeSlug="__ai" />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">AI Settings</span>
        </header>
        <main className="page">
          <div className="tabs">
            <button className={`tab${tab === 'providers'    ? ' active' : ''}`} onClick={() => setTab('providers')}>Providers</button>
            <button className={`tab${tab === 'instructions' ? ' active' : ''}`} onClick={() => setTab('instructions')}>Custom Instructions</button>
            <button className={`tab${tab === 'defaults'     ? ' active' : ''}`} onClick={() => setTab('defaults')}>Section Defaults</button>
          </div>

          {/* ── PROVIDERS ── */}
          {tab === 'providers' && (
            <>
              {pError && <div className="alert alert-error">{pError}</div>}
              <div className="card mb-4">
                <div className="card-title mb-4">{editPId ? 'Edit Provider' : 'Add Provider'}</div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <input className="form-input" value={pForm.display_name} onChange={e => setPForm(f => ({ ...f, display_name: e.target.value }))} placeholder="My Ollama" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Provider Type</label>
                    <select className="form-select" value={pForm.provider_type} onChange={e => selectType(e.target.value)}>
                      {PROVIDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Base URL</label>
                    <input className="form-input font-mono" value={pForm.base_url} onChange={e => setPForm(f => ({ ...f, base_url: e.target.value }))} />
                  </div>
                  {!['ollama','lmstudio'].includes(pForm.provider_type) && (
                    <div className="form-group">
                      <label className="form-label">API Key</label>
                      <input className="form-input" type="password" value={pForm.api_key} onChange={e => setPForm(f => ({ ...f, api_key: e.target.value }))} placeholder="Leave blank to keep existing" />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Default Model</label>
                    {models.length > 0
                      ? <select className="form-select" value={pForm.default_model} onChange={e => setPForm(f => ({ ...f, default_model: e.target.value }))}>
                          <option value="">— select —</option>
                          {models.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      : <input className="form-input" value={pForm.default_model} onChange={e => setPForm(f => ({ ...f, default_model: e.target.value }))} placeholder="e.g. llama3.2 or gpt-4o" />
                    }
                  </div>
                  <div className="form-group flex items-center gap-2" style={{ paddingTop: '22px' }}>
                    <input type="checkbox" id="is_default" checked={pForm.is_default} onChange={e => setPForm(f => ({ ...f, is_default: e.target.checked }))} />
                    <label htmlFor="is_default" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Set as default provider</label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-primary" onClick={saveProvider} disabled={pSaving}>{pSaving ? 'Saving…' : editPId ? 'Update' : 'Add Provider'}</button>
                  {editPId && <button className="btn btn-secondary" onClick={cancelEditP}>Cancel</button>}
                </div>
              </div>

              <div className="card-flush">
                <table>
                  <thead><tr><th>Name</th><th>Type</th><th>Base URL</th><th>Model</th><th>Default</th><th>Actions</th></tr></thead>
                  <tbody>
                    {providers.length === 0
                      ? <tr><td colSpan={6}><div className="empty-state" style={{ padding: '32px' }}><div className="empty-state-desc">No providers yet.</div></div></td></tr>
                      : providers.map(p => (
                        <tr key={p.id}>
                          <td className="font-medium">{p.display_name}</td>
                          <td><span className="badge badge-purple">{p.provider_type}</span></td>
                          <td className="td-mono">{p.base_url}</td>
                          <td className="td-mono">{p.default_model || '—'}</td>
                          <td>{p.is_default ? <span className="badge badge-green">default</span> : ''}</td>
                          <td>
                            <div className="flex gap-1">
                              <button className="btn btn-secondary btn-sm" onClick={() => startEditP(p)}>Edit</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => testProvider(p.id)} disabled={testing === p.id}>{testing === p.id ? '…' : 'Test'}</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteProvider(p.id)}>Del</button>
                            </div>
                            {testResult?.id === p.id && (
                              <div className={testResult.ok ? 'success-msg' : 'error-msg'} style={{ marginTop: '4px' }}>
                                {testResult.ok ? `✓ OK — ${testResult.latencyMs}ms` : `✗ ${testResult.error}`}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── INSTRUCTIONS ── */}
          {tab === 'instructions' && (
            <>
              {iError && <div className="alert alert-error">{iError}</div>}

              <div className="card mb-4">
                <div className="card-title mb-3">Templates</div>
                <div className="flex" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  {TEMPLATES.map(t => (
                    <button key={t.name} className="btn btn-secondary btn-sm" onClick={() => applyTemplate(t)}>{t.name}</button>
                  ))}
                </div>
                <div className="form-help mt-2">Click a template to load it into the editor below, then save.</div>
              </div>

              <div className="card mb-4">
                <div className="card-title mb-4">{editIId ? 'Edit Instruction' : 'New Instruction'}</div>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={iForm.name} onChange={e => setIForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Blog Polish" />
                </div>
                <div className="form-group">
                  <label className="form-label">Instruction text</label>
                  <textarea className="form-textarea" rows={6} value={iForm.instruction} onChange={e => setIForm(f => ({ ...f, instruction: e.target.value }))} placeholder="Write the system instruction sent to the AI model…" />
                  <div className="form-help">This becomes the system prompt. Be specific about tone, format, and what to preserve.</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={saveInstruction} disabled={iSaving}>{iSaving ? 'Saving…' : editIId ? 'Update' : 'Save Instruction'}</button>
                  {editIId && <button className="btn btn-secondary" onClick={cancelEditI}>Cancel</button>}
                </div>
              </div>

              <div className="card-flush">
                <table>
                  <thead><tr><th>Name</th><th>Preview</th><th>Actions</th></tr></thead>
                  <tbody>
                    {instructions.length === 0
                      ? <tr><td colSpan={3}><div className="empty-state" style={{ padding: '32px' }}><div className="empty-state-desc">No instructions saved yet. Use a template above to get started.</div></div></td></tr>
                      : instructions.map(instr => (
                        <tr key={instr.id}>
                          <td className="font-medium" style={{ whiteSpace: 'nowrap' }}>{instr.name}</td>
                          <td className="text-xs" style={{ color: 'var(--text-2)', maxWidth: '400px' }}>
                            {instr.instruction.length > 110 ? instr.instruction.slice(0, 110) + '…' : instr.instruction}
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <button className="btn btn-secondary btn-sm" onClick={() => startEditI(instr)}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteInstruction(instr.id)}>Del</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── SECTION DEFAULTS ── */}
          {tab === 'defaults' && (
            <>
              <p className="text-muted mb-4">Set a default AI instruction for each content section. The editor will auto-select it when you open a post.</p>
              {instructions.length === 0 && (
                <div className="alert" style={{ background: 'var(--warn-soft)', color: 'var(--warn-text)', border: 'none', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
                  No instructions saved yet. <button className="btn btn-ghost btn-sm" onClick={() => setTab('instructions')} style={{ padding: '0 6px', height: 'auto', color: 'var(--warn-text)', textDecoration: 'underline' }}>Add instructions first →</button>
                </div>
              )}
              <div className="card-flush">
                <table>
                  <thead><tr><th>Repo</th><th>Section</th><th>Dir</th><th>Default Instruction</th></tr></thead>
                  <tbody>
                    {allSections.length === 0
                      ? <tr><td colSpan={4}><div className="empty-state" style={{ padding: '32px' }}><div className="empty-state-desc">No sections configured.</div></div></td></tr>
                      : allSections.map(({ site, section }) => {
                          const key = `${site.id}_${section.slug}`;
                          const current = sectionDefaults[key] || '';
                          return (
                            <tr key={key}>
                              <td className="text-xs td-mono">{site.repo_owner}/{site.repo_name}</td>
                              <td className="font-medium">{section.name}</td>
                              <td className="td-mono">{section.publishedDir}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <select
                                    className="form-select"
                                    style={{ width: '220px' }}
                                    value={current}
                                    onChange={e => setSectionDefault(site, section.slug, e.target.value)}
                                    disabled={sdSaving === key}
                                  >
                                    <option value="">— none —</option>
                                    {instructions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                  </select>
                                  {sdSaving === key && <span className="text-xs text-3">Saving…</span>}
                                  {current && sdSaving !== key && <span className="badge badge-green">set</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    }
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
