import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sitesApi, postsApi, aiApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';
import EnhanceDiff from '../components/EnhanceDiff.jsx';

// ── Tag / category multi-input ─────────────────────────────────────────────
function TagInput({ values, onChange, options, placeholder }) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const suggestions = (options || []).filter(
    o => !values.includes(o) && o.toLowerCase().includes(input.toLowerCase())
  );

  function addTag(raw) {
    const t = raw.trim().replace(/,/g, '');
    if (t && !values.includes(t)) onChange([...values, t]);
    setInput('');
  }

  function removeTag(tag) {
    onChange(values.filter(t => t !== tag));
  }

  return (
    <>
      <div className="tag-input-wrap" onClick={() => inputRef.current?.focus()}>
        {values.map(t => (
          <span key={t} className="tag-chip">
            {t}
            <button
              type="button"
              className="tag-chip-remove"
              onMouseDown={e => { e.preventDefault(); removeTag(t); }}
            >×</button>
          </span>
        ))}
        <div style={{ position: 'relative', flex: '1 1 80px', minWidth: '80px' }}>
          <input
            ref={inputRef}
            className="tag-inner-input"
            value={input}
            onChange={e => { setInput(e.target.value); setOpen(true); }}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); addTag(input); }
              if (e.key === 'Backspace' && !input && values.length > 0) removeTag(values[values.length - 1]);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={values.length === 0 ? (placeholder || 'Add…') : ''}
          />
          {open && suggestions.length > 0 && (
            <div className="combobox-dropdown">
              {suggestions.map(o => (
                <div
                  key={o}
                  className="combobox-option"
                  onMouseDown={e => { e.preventDefault(); addTag(o); }}
                >
                  {o}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {open && !suggestions.length && <div className="form-help" style={{ marginTop: 3 }}>Enter or , to add</div>}
    </>
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────
function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function readingTime(words) {
  const mins = Math.ceil(words / 200);
  return mins <= 1 ? '< 1 min' : `${mins} min`;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isImageUrl(url) {
  return /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i.test(url);
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PostEditor() {
  const { siteId, '*': encodedPath } = useParams();
  const navigate = useNavigate();
  const isNew = !encodedPath;

  const [site, setSite] = useState(null);
  const [sha, setSha] = useState(null);
  const [filePath, setFilePath] = useState('');
  const [frontmatter, setFrontmatter] = useState({});
  const [body, setBody] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [taxonomy, setTaxonomy] = useState({ categories: [], tags: [] });

  const original = useRef({ frontmatter: {}, body: '', slug: '', date: '' });

  // AI
  const [aiProviders, setAiProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [instructions, setInstructions] = useState([]);
  const [selectedInstruction, setSelectedInstruction] = useState('');
  const [adHocInstruction, setAdHocInstruction] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [diffResult, setDiffResult] = useState(null);

  const currentStatus = filePath.startsWith('_posts/') ? 'published'
    : filePath.startsWith('_archive/') ? 'archive'
    : 'draft';

  const fm = frontmatter;
  function setFm(key, val) {
    setFrontmatter(prev => (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0))
      ? (({ [key]: _, ...rest }) => rest)(prev)
      : { ...prev, [key]: val }
    );
  }

  useEffect(() => {
    Promise.all([sitesApi.get(siteId), aiApi.instructions()]).then(([s, instrs]) => {
      setSite(s);
      setInstructions(instrs);
      const def = s?.sections?.find(sec => sec.slug === 'posts')?.defaultInstructionId;
      if (def && instrs.some(i => i.id === def)) setSelectedInstruction(def);
    }).catch(() => {});
    aiApi.providers().then(p => { setAiProviders(p); if (p.length) setSelectedProvider(p[0].id); }).catch(() => {});
    postsApi.taxonomy(siteId).then(setTaxonomy).catch(() => {});
  }, [siteId]);

  useEffect(() => {
    if (isNew || !encodedPath) return;
    const rawPath = atob(encodedPath.replace(/-/g, '+').replace(/_/g, '/'));
    setFilePath(rawPath);
    postsApi.get(siteId, rawPath).then(data => {
      const rawFm = data.frontmatter || {};
      // Normalize categories: read categories[] or legacy category string
      const catRaw = rawFm.categories || rawFm.category;
      const categories = Array.isArray(catRaw) ? catRaw : catRaw ? [catRaw] : [];
      const { category: _cat, ...restFm } = rawFm;
      const fmData = { ...restFm, ...(categories.length ? { categories } : {}) };
      const bd = data.body || '';
      const dt = data.date || rawFm.date || new Date().toISOString().slice(0, 10);
      const m = rawPath.split('/').pop().match(/^\d{4}-\d{2}-\d{2}-(.+)\.\w+$/);
      const sl = m ? m[1] : '';
      setFrontmatter(fmData); setBody(bd); setSha(data.sha); setDate(dt); setSlug(sl);
      original.current = { frontmatter: fmData, body: bd, date: dt, slug: sl };
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [isNew, encodedPath, siteId]);

  useEffect(() => {
    if (isNew && !slugEdited) setSlug(slugify(fm.title || ''));
  }, [fm.title]);

  function handleRevert() {
    if (!confirm('Revert all changes to the last saved version?')) return;
    const o = original.current;
    setFrontmatter(o.frontmatter); setBody(o.body); setDate(o.date); setSlug(o.slug);
    setDiffResult(null);
    setSuccess('Reverted to last saved version.');
  }

  function buildFilename() {
    const s = slug || slugify(fm.title || 'untitled');
    return `${date}-${s}.md`;
  }

  async function saveDraft() {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const payload = { frontmatter: { ...fm, date }, body, filename: buildFilename() };
      if (isNew) {
        await postsApi.create(siteId, payload);
        setSuccess('Draft saved!');
        setTimeout(() => navigate(`/sites/${siteId}/posts/draft`), 1200);
      } else {
        const { sha: newSha } = await postsApi.update(siteId, filePath, { frontmatter: { ...fm, date }, body, sha });
        setSha(newSha); original.current = { frontmatter: fm, body, date, slug }; setSuccess('Draft saved!');
      }
    } catch (e) {
      setError(e.status === 409 ? 'File changed remotely — go back and reload.' : e.message);
    } finally { setSaving(false); }
  }

  async function publish() {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const fmWithDate = { ...fm, date };
      if (isNew) {
        const { path: draftPath, sha: draftSha } = await postsApi.create(siteId, { frontmatter: fmWithDate, body, filename: buildFilename() });
        await postsApi.publish(siteId, draftPath, { frontmatter: fmWithDate, body, sha: draftSha });
        setSuccess('Published!');
        setTimeout(() => navigate(`/sites/${siteId}/posts/published`), 1200);
      } else {
        const { sha: newSha, path: newPath } = await postsApi.publish(siteId, filePath, { frontmatter: fmWithDate, body, sha });
        setSha(newSha); setFilePath(newPath);
        original.current = { frontmatter: fm, body, date, slug };
        setSuccess('Published!');
        setTimeout(() => navigate(`/sites/${siteId}/posts/published`), 1200);
      }
    } catch (e) {
      setError(e.status === 409 ? 'File changed remotely — go back and reload.' : e.message);
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!sha || !confirm('Archive this post?')) return;
    setError(''); setSaving(true);
    try {
      await postsApi.archive(siteId, filePath, { sha });
      setSuccess('Archived!');
      setTimeout(() => navigate(`/sites/${siteId}/posts/archive`), 1200);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function unarchive() {
    if (!sha || !confirm('Reopen this post as a draft?')) return;
    setError(''); setSaving(true);
    try {
      await postsApi.unarchive(siteId, filePath, { sha });
      setSuccess('Reopened as draft!');
      setTimeout(() => navigate(`/sites/${siteId}/posts/draft`), 1200);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleEnhance() {
    setEnhancing(true); setError('');
    try {
      const saved = instructions.find(i => i.id === selectedInstruction)?.instruction || '';
      const instruction = (saved && adHocInstruction.trim())
        ? `${saved}\n\nAdditional: ${adHocInstruction.trim()}`
        : adHocInstruction.trim() || saved || null;
      const result = await aiApi.enhance(body, instruction, selectedProvider || undefined);
      setDiffResult({ original: body, enhanced: result.enhanced });
    } catch (e) { setError('AI enhance failed: ' + e.message); }
    finally { setEnhancing(false); }
  }

  if (loading) return <div className="loading">Loading post…</div>;

  const hasAi = aiProviders.length > 0;
  const isDirty = !isNew && (body !== original.current.body || JSON.stringify(fm) !== JSON.stringify(original.current.frontmatter));
  const backPath = isNew ? `/sites/${siteId}/posts/draft` : `/sites/${siteId}/posts/${currentStatus}`;
  const words = wordCount(body);
  const categories = Array.isArray(fm.categories) ? fm.categories : [];
  const tags = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []);
  const banner = fm.banner || '';
  const ghBase = site ? `https://github.com/${site.repo_owner}/${site.repo_name}/blob/${site.default_branch}` : '';

  return (
    <div className="app-layout">
      <Sidebar site={site} activeStatus={currentStatus} />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">
            {isNew ? 'New Post' : (fm.title || 'Edit Post')}
            {isDirty && <span className="topbar-unsaved">• unsaved</span>}
          </span>
          <div className="topbar-actions">
            {!isNew && isDirty && (
              <button className="btn btn-ghost btn-sm" onClick={handleRevert}>↩ Revert</button>
            )}
            {currentStatus === 'archive' ? (
              <button className="btn btn-secondary btn-sm" onClick={unarchive} disabled={saving}>↩ Reopen as draft</button>
            ) : (
              !isNew && <button className="btn btn-ghost btn-sm" onClick={archive} disabled={saving}>📦 Archive</button>
            )}
            <Link className="btn btn-ghost btn-sm" to={backPath}>Cancel</Link>
            {currentStatus !== 'archive' && (
              <>
                {(isNew || currentStatus === 'draft') && (
                  <button className="btn btn-secondary" onClick={saveDraft} disabled={saving}>Save Draft</button>
                )}
                <button className="btn btn-primary" onClick={publish} disabled={saving}>
                  {saving ? 'Saving…' : currentStatus === 'published' ? 'Update' : 'Publish'}
                </button>
                {currentStatus === 'published' && (
                  <button className="btn btn-secondary" onClick={saveDraft} disabled={saving}>Save</button>
                )}
              </>
            )}
          </div>
        </header>

        <main className="page">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="editor-layout">
            {/* ── Left column ── */}
            <div>
              <div className="card mb-4">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    className="form-input"
                    value={fm.title || ''}
                    onChange={e => setFm('title', e.target.value)}
                    placeholder="Post title…"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Subtitle <span className="form-label-opt">(optional)</span></label>
                  <input
                    className="form-input"
                    value={fm.subtitle || ''}
                    onChange={e => setFm('subtitle', e.target.value)}
                    placeholder="A brief subtitle…"
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Author <span className="form-label-opt">(optional)</span></label>
                    <input
                      className="form-input"
                      value={fm.author || ''}
                      onChange={e => setFm('author', e.target.value)}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input
                    className="form-input"
                    value={slug}
                    onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
                    placeholder="auto from title"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Categories</label>
                  <TagInput
                    values={categories}
                    onChange={v => setFm('categories', v)}
                    options={taxonomy.categories}
                    placeholder="Add categories…"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <TagInput
                    values={tags}
                    onChange={v => setFrontmatter(prev => ({ ...prev, tags: v }))}
                    options={taxonomy.tags}
                    placeholder="Add tags…"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Banner <span className="form-label-opt">(image or video URL)</span></label>
                  <input
                    className="form-input"
                    value={banner}
                    onChange={e => setFm('banner', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                  {banner && isImageUrl(banner) && (
                    <div className="banner-preview">
                      <img src={banner} alt="banner preview" onError={e => { e.target.style.display = 'none'; }} />
                    </div>
                  )}
                </div>
                <div className="form-help">Filename: <span className="font-mono">{buildFilename()}</span></div>
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

            {/* ── Right column ── */}
            <div className="flex-col gap-3">
              {/* About — always first */}
              <div className="card">
                <div className="card-title mb-3">About</div>
                <div className="about-row">
                  <span className="about-label">File</span>
                  <span className="about-value" style={{ wordBreak: 'break-all' }}>
                    {isNew ? (
                      <span className="font-mono" style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>_drafts/{buildFilename()}</span>
                    ) : ghBase ? (
                      <a
                        href={`${ghBase}/${filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono"
                        style={{ fontSize: '0.75rem' }}
                        title="View source on GitHub"
                      >
                        {filePath} ↗
                      </a>
                    ) : (
                      <span className="font-mono" style={{ fontSize: '0.75rem' }}>{filePath}</span>
                    )}
                  </span>
                </div>
                <div className="about-row">
                  <span className="about-label">Status</span>
                  <span className={`badge ${currentStatus === 'published' ? 'badge-green' : currentStatus === 'archive' ? 'badge-purple' : 'badge-yellow'}`}>
                    {currentStatus}
                  </span>
                </div>
                <div className="about-row">
                  <span className="about-label">Words</span>
                  <span className="about-value">{words.toLocaleString()}</span>
                </div>
                <div className="about-row">
                  <span className="about-label">Read time</span>
                  <span className="about-value">{readingTime(words)}</span>
                </div>
              </div>

              {/* AI Enhancement */}
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
                    <label className="form-label">Instruction</label>
                    <select className="form-select" value={selectedInstruction} onChange={e => setSelectedInstruction(e.target.value)}>
                      <option value="">— default (improve clarity) —</option>
                      {instructions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ad-hoc <span className="form-label-opt">(optional)</span></label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={adHocInstruction}
                      onChange={e => setAdHocInstruction(e.target.value)}
                      placeholder="e.g. Make the intro more punchy…"
                    />
                  </div>
                  <button className="btn btn-secondary w-full" onClick={handleEnhance} disabled={enhancing || !body}>
                    {enhancing ? 'Enhancing…' : '✨ Enhance'}
                  </button>
                </div>
              )}
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
