import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sitesApi, postsApi, aiApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';
import FrontmatterForm from '../components/FrontmatterForm.jsx';
import EnhanceDiff from '../components/EnhanceDiff.jsx';

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

  // Determine current status from file path
  const currentStatus = filePath.startsWith('_posts/') ? 'published'
    : filePath.startsWith('_archive/') ? 'archive'
    : 'draft';

  useEffect(() => {
    sitesApi.get(siteId).then(setSite).catch(() => {});
    aiApi.providers().then(p => { setAiProviders(p); if (p.length) setSelectedProvider(p[0].id); }).catch(() => {});
    aiApi.instructions().then(setInstructions).catch(() => {});
  }, [siteId]);

  useEffect(() => {
    if (isNew || !encodedPath) return;
    const rawPath = atob(encodedPath.replace(/-/g, '+').replace(/_/g, '/'));
    setFilePath(rawPath);
    postsApi.get(siteId, rawPath).then(data => {
      const fm = data.frontmatter || {};
      const bd = data.body || '';
      const dt = data.date || new Date().toISOString().slice(0, 10);
      const m = rawPath.split('/').pop().match(/^\d{4}-\d{2}-\d{2}-(.+)\.\w+$/);
      const sl = m ? m[1] : '';
      setFrontmatter(fm); setBody(bd); setSha(data.sha); setDate(dt); setSlug(sl);
      original.current = { frontmatter: fm, body: bd, date: dt, slug: sl };
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [isNew, encodedPath, siteId]);

  function handleRevert() {
    if (!confirm('Revert all changes to the last saved version?')) return;
    const o = original.current;
    setFrontmatter(o.frontmatter); setBody(o.body); setDate(o.date); setSlug(o.slug);
    setDiffResult(null);
    setSuccess('Reverted to last saved version.');
  }

  function buildFilename() {
    const s = slug || slugify(frontmatter.title || 'untitled');
    return `${date}-${s}.md`;
  }

  async function saveDraft() {
    setError(''); setSuccess(''); setSaving(true);
    try {
      if (isNew) {
        await postsApi.create(siteId, { frontmatter, body, filename: buildFilename() });
        setSuccess('Draft saved!');
        setTimeout(() => navigate(`/sites/${siteId}/posts/draft`), 1200);
      } else {
        const { sha: newSha } = await postsApi.update(siteId, filePath, { frontmatter, body, sha });
        setSha(newSha); original.current = { frontmatter, body, date, slug }; setSuccess('Draft saved!');
      }
    } catch (e) {
      setError(e.status === 409 ? 'File changed remotely — go back and reload.' : e.message);
    } finally { setSaving(false); }
  }

  async function publish() {
    setError(''); setSuccess(''); setSaving(true);
    try {
      if (isNew) {
        // Save as draft first, then publish
        const { path: draftPath, sha: draftSha } = await postsApi.create(siteId, { frontmatter, body, filename: buildFilename() });
        await postsApi.publish(siteId, draftPath, { frontmatter, body, sha: draftSha });
        setSuccess('Published!');
        setTimeout(() => navigate(`/sites/${siteId}/posts/published`), 1200);
      } else {
        const { sha: newSha, path: newPath } = await postsApi.publish(siteId, filePath, { frontmatter, body, sha });
        setSha(newSha);
        setFilePath(newPath);
        original.current = { frontmatter, body, date, slug };
        setSuccess('Published!');
        setTimeout(() => navigate(`/sites/${siteId}/posts/published`), 1200);
      }
    } catch (e) {
      setError(e.status === 409 ? 'File changed remotely — go back and reload.' : e.message);
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!sha) return;
    if (!confirm('Archive this post?')) return;
    setError(''); setSaving(true);
    try {
      await postsApi.archive(siteId, filePath, { sha });
      setSuccess('Archived!');
      setTimeout(() => navigate(`/sites/${siteId}/posts/archive`), 1200);
    } catch (e) {
      setError(e.message);
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

  const hasAi = aiProviders.length > 0;
  const isDirty = !isNew && (body !== original.current.body || JSON.stringify(frontmatter) !== JSON.stringify(original.current.frontmatter));
  const backPath = isNew ? `/sites/${siteId}/posts/draft` : `/sites/${siteId}/posts/${currentStatus}`;

  return (
    <div className="app-layout">
      <Sidebar site={site} activeStatus={currentStatus} />
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
            {!isNew && currentStatus !== 'archive' && (
              <button className="btn btn-ghost btn-sm" onClick={archive} disabled={saving}>📦 Archive</button>
            )}
            <Link className="btn btn-ghost btn-sm" to={backPath}>Cancel</Link>
            {currentStatus !== 'published' && currentStatus !== 'archive' && (
              <button className="btn btn-secondary" onClick={saveDraft} disabled={saving}>Save Draft</button>
            )}
            {currentStatus !== 'archive' && (
              <button className="btn btn-primary" onClick={publish} disabled={saving}>
                {saving ? 'Publishing…' : currentStatus === 'published' ? 'Update' : 'Publish'}
              </button>
            )}
            {currentStatus === 'published' && (
              <button className="btn btn-secondary" onClick={saveDraft} disabled={saving}>Save</button>
            )}
          </div>
        </header>

        <main className="page">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="editor-layout">
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
                <FrontmatterForm fields={[]} values={frontmatter} onChange={setFrontmatter} />
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

              <div className="card">
                <div className="card-title mb-2">About</div>
                <div className="text-xs font-mono" style={{ color: 'var(--text-3)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                  {isNew ? 'New file → _drafts/' : filePath}
                </div>
                {!isNew && (
                  <div className="mt-2">
                    <span className={`badge ${currentStatus === 'published' ? 'badge-green' : currentStatus === 'archive' ? 'badge-purple' : 'badge-yellow'}`}>
                      {currentStatus}
                    </span>
                  </div>
                )}
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
