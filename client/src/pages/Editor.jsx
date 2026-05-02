import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sitesApi, contentApi, aiApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';
import FrontmatterForm from '../components/FrontmatterForm.jsx';
import EnhanceDiff from '../components/EnhanceDiff.jsx';

export default function Editor() {
  const { siteId, sectionSlug, '*': encodedPath } = useParams();
  const navigate = useNavigate();
  const isNew = !encodedPath;

  const [site, setSite] = useState(null);
  const [section, setSection] = useState(null);
  const [sha, setSha] = useState(null);
  const [filePath, setFilePath] = useState('');
  const [frontmatter, setFrontmatter] = useState({});
  const [body, setBody] = useState('');
  const [slug, setSlug] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const original = useRef({ frontmatter: {}, body: '', slug: '', date: '' });

  // AI
  const [aiProviders, setAiProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [instructions, setInstructions] = useState([]);
  const [selectedInstruction, setSelectedInstruction] = useState('');
  const [adHocInstruction, setAdHocInstruction] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [diffResult, setDiffResult] = useState(null);

  useEffect(() => {
    sitesApi.get(siteId).then(s => {
      setSite(s);
      const sec = s.sections.find(x => x.slug === sectionSlug);
      setSection(sec);
      if (sec) {
        const defaults = {};
        sec.frontmatterFields?.forEach(f => { if (f.default) defaults[f.key] = f.default; });
        setFrontmatter(prev => ({ ...defaults, ...prev }));
      }
      // Load instructions and auto-select section default
      aiApi.instructions().then(list => {
        setInstructions(list);
        const defaultId = sec?.defaultInstructionId;
        if (defaultId && list.find(i => i.id === defaultId)) {
          setSelectedInstruction(defaultId);
        }
      }).catch(() => {});
    });
    aiApi.providers().then(p => { setAiProviders(p); if (p.length) setSelectedProvider(p[0].id); });
  }, [siteId, sectionSlug]);

  useEffect(() => {
    if (isNew || !encodedPath) return;
    const rawPath = atob(encodedPath.replace(/-/g, '+').replace(/_/g, '/'));
    setFilePath(rawPath);
    contentApi.get(siteId, sectionSlug, rawPath).then(data => {
      const fm = data.frontmatter || {};
      const bd = data.body || '';
      const dt = data.date || new Date().toISOString().slice(0, 10);
      const m = rawPath.split('/').pop().match(/^\d{4}-\d{2}-\d{2}-(.+)\.\w+$/);
      const sl = m ? m[1] : '';
      setFrontmatter(fm); setBody(bd); setSha(data.sha); setDate(dt); setSlug(sl);
      original.current = { frontmatter: fm, body: bd, date: dt, slug: sl };
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [isNew, encodedPath, siteId, sectionSlug]);

  function handleRevert() {
    if (!confirm('Revert all changes to the last saved version?')) return;
    const o = original.current;
    setFrontmatter(o.frontmatter); setBody(o.body); setDate(o.date); setSlug(o.slug);
    setDiffResult(null);
    setSuccess('Reverted to last saved version.');
  }

  function buildFilename() {
    const s = slug || slugify(frontmatter.title || 'untitled');
    return `${date}-${s}.${section?.fileType || 'md'}`;
  }

  async function save(asDraft) {
    setError(''); setSuccess(''); setSaving(true);
    try {
      if (isNew) {
        await contentApi.create(siteId, sectionSlug, { frontmatter, body, filename: buildFilename(), saveAsDraft: asDraft });
        setSuccess(asDraft ? 'Draft saved!' : 'Published!');
        setTimeout(() => navigate(`/sites/${siteId}/sections/${sectionSlug}`), 1200);
      } else {
        if (asDraft) {
          const { sha: newSha } = await contentApi.update(siteId, sectionSlug, filePath, { frontmatter, body, sha });
          setSha(newSha); original.current = { frontmatter, body, date, slug }; setSuccess('Draft saved!');
        } else {
          const { sha: newSha } = await contentApi.publish(siteId, sectionSlug, filePath, { frontmatter, body, sha });
          setSha(newSha); original.current = { frontmatter, body, date, slug }; setSuccess('Published!');
          setTimeout(() => navigate(`/sites/${siteId}/sections/${sectionSlug}`), 1200);
        }
      }
    } catch (e) {
      setError(e.status === 409 ? 'File changed remotely — go back and reload.' : e.message);
    } finally { setSaving(false); }
  }

  function buildInstruction() {
    const saved = instructions.find(i => i.id === selectedInstruction)?.instruction || '';
    if (saved && adHocInstruction.trim()) return `${saved}\n\nAdditional instructions: ${adHocInstruction.trim()}`;
    return adHocInstruction.trim() || saved || null;
  }

  async function handleEnhance() {
    setEnhancing(true); setError('');
    try {
      const result = await aiApi.enhance(body, buildInstruction(), selectedProvider || undefined);
      setDiffResult({ original: body, enhanced: result.enhanced });
    } catch (e) { setError('AI enhance failed: ' + e.message); }
    finally { setEnhancing(false); }
  }

  if (loading) return <div className="loading">Loading post…</div>;

  const fields = section?.frontmatterFields || [];
  const hasAi = section?.aiEnabled && aiProviders.length > 0;
  const isDirty = !isNew && (body !== original.current.body || JSON.stringify(frontmatter) !== JSON.stringify(original.current.frontmatter));

  return (
    <div className="app-layout">
      <Sidebar site={site} activeSlug={sectionSlug} />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">
            {isNew ? 'New Post' : 'Edit Post'}
            {isDirty && <span className="topbar-unsaved">• unsaved</span>}
          </span>
          <div className="topbar-actions">
            {!isNew && isDirty && (
              <button className="btn btn-ghost btn-sm" onClick={handleRevert} title="Revert to saved">↩ Revert</button>
            )}
            <Link className="btn btn-ghost btn-sm" to={`/sites/${siteId}/sections/${sectionSlug}`}>Cancel</Link>
            <button className="btn btn-secondary" onClick={() => save(true)} disabled={saving}>Save Draft</button>
            <button className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
              {saving ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </header>

        <main className="page">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="editor-layout">
            {/* Left — metadata + body */}
            <div>
              <div className="card mb-4">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Slug</label>
                    <input className="form-input" value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto from title" />
                  </div>
                </div>
                <div className="form-help mb-3">Filename: <span className="font-mono">{buildFilename()}</span></div>
                <FrontmatterForm fields={fields} values={frontmatter} onChange={setFrontmatter} />
              </div>

              <div className="card">
                <label className="form-label">Content <span className="form-label-opt">(Markdown)</span></label>
                <textarea
                  className="form-textarea editor-body"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write your post content in Markdown…"
                />
              </div>
            </div>

            {/* Right — AI + info */}
            <div className="flex-col gap-3">
              {hasAi && (
                <div className="card">
                  <div className="ai-panel-title">✨ AI Enhancement</div>

                  <div className="form-group">
                    <label className="form-label">Provider</label>
                    <select className="form-select" value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}>
                      {aiProviders.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Instruction
                      {section?.defaultInstructionId === selectedInstruction && selectedInstruction && (
                        <span className="badge badge-purple" style={{ marginLeft: '6px' }}>section default</span>
                      )}
                    </label>
                    <select className="form-select" value={selectedInstruction} onChange={e => setSelectedInstruction(e.target.value)}>
                      <option value="">— default (improve clarity) —</option>
                      {instructions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    {instructions.length === 0 && (
                      <div className="form-help">
                        <Link to="/ai-settings">Add instructions</Link> in AI Settings.
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Ad-hoc instruction <span className="form-label-opt">(optional)</span>
                    </label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={adHocInstruction}
                      onChange={e => setAdHocInstruction(e.target.value)}
                      placeholder="e.g. Make the intro more punchy…"
                    />
                    {selectedInstruction && adHocInstruction.trim() && (
                      <div className="form-help">Combined with selected instruction above.</div>
                    )}
                  </div>

                  <button className="btn btn-secondary w-full" onClick={handleEnhance} disabled={enhancing || !body}>
                    {enhancing ? 'Enhancing…' : '✨ Enhance'}
                  </button>
                </div>
              )}

              <div className="card">
                <div className="card-title mb-2">About</div>
                <div className="text-xs font-mono" style={{ color: 'var(--text-3)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                  {isNew
                    ? `New file → ${section?.publishedDir || '…'}`
                    : filePath}
                </div>
              </div>
            </div>
          </div>

          {diffResult && (
            <div className="card mt-4">
              <EnhanceDiff
                original={diffResult.original}
                enhanced={diffResult.enhanced}
                onAccept={() => { setBody(diffResult.enhanced); setDiffResult(null); }}
                onReject={() => setDiffResult(null)}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
