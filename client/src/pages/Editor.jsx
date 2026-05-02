import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sitesApi, contentApi, aiApi, reposApi } from '../api.js';
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

  // AI
  const [aiProviders, setAiProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState('');
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
    });
    aiApi.providers().then(p => { setAiProviders(p); if (p.length) setSelectedProvider(p[0].id); });
  }, [siteId, sectionSlug]);

  useEffect(() => {
    if (!site) return;
    reposApi.enhancePolicies(site.repo_owner, site.repo_name).then(setPolicies).catch(() => {});
  }, [site]);

  useEffect(() => {
    if (isNew || !encodedPath) return;
    const rawPath = atob(encodedPath.replace(/-/g, '+').replace(/_/g, '/'));
    setFilePath(rawPath);
    contentApi.get(siteId, sectionSlug, rawPath).then(data => {
      setFrontmatter(data.frontmatter || {});
      setBody(data.body || '');
      setSha(data.sha);
      setDate(data.date || new Date().toISOString().slice(0, 10));
      const m = rawPath.split('/').pop().match(/^\d{4}-\d{2}-\d{2}-(.+)\.\w+$/);
      if (m) setSlug(m[1]);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [isNew, encodedPath, siteId, sectionSlug]);

  function buildFilename() {
    const s = slug || slugify(frontmatter.title || 'untitled');
    return `${date}-${s}.${section?.fileType || 'md'}`;
  }

  async function save(asDraft) {
    setError(''); setSuccess(''); setSaving(true);
    try {
      if (isNew) {
        const filename = buildFilename();
        await contentApi.create(siteId, sectionSlug, { frontmatter, body, filename, saveAsDraft: asDraft });
        setSuccess(asDraft ? 'Draft saved!' : 'Published!');
        setTimeout(() => navigate(`/sites/${siteId}/sections/${sectionSlug}`), 1200);
      } else {
        if (asDraft) {
          const { sha: newSha } = await contentApi.update(siteId, sectionSlug, filePath, { frontmatter, body, sha });
          setSha(newSha);
          setSuccess('Draft saved!');
        } else {
          const { sha: newSha } = await contentApi.publish(siteId, sectionSlug, filePath, { frontmatter, body, sha });
          setSha(newSha);
          setSuccess('Published!');
          setTimeout(() => navigate(`/sites/${siteId}/sections/${sectionSlug}`), 1200);
        }
      }
    } catch (e) {
      if (e.status === 409) {
        setError('File changed remotely — please go back and reload the file.');
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleEnhance() {
    setEnhancing(true); setError('');
    try {
      const policyContent = selectedPolicy
        ? (await (await fetch(`https://raw.githubusercontent.com/${site.repo_owner}/${site.repo_name}/${site.default_branch}/${selectedPolicy}`)).text())
        : null;
      const result = await aiApi.enhance(body, policyContent, selectedProvider || undefined);
      setDiffResult({ original: body, enhanced: result.enhanced });
    } catch (e) {
      setError('AI enhance failed: ' + e.message);
    } finally {
      setEnhancing(false);
    }
  }

  if (loading) return <div className="loading">Loading…</div>;

  const fields = section?.frontmatterFields || [];
  const hasAi = section?.aiEnabled && aiProviders.length > 0;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">📄 Pages CMS</div>
        <nav>
          {site && (
            <>
              <div className="sidebar-section">{site.repo_owner}/{site.repo_name}</div>
              {site.sections.map(s => (
                <Link key={s.slug} className={`sidebar-link${s.slug === sectionSlug ? ' active' : ''}`} to={`/sites/${siteId}/sections/${s.slug}`}>{s.name}</Link>
              ))}
            </>
          )}
          <div className="sidebar-section">Settings</div>
          <Link className="sidebar-link" to="/ai-settings">AI Providers</Link>
        </nav>
      </aside>
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{isNew ? 'New Post' : 'Edit Post'}</span>
          <div className="topbar-actions">
            <Link className="btn btn-secondary btn-sm" to={`/sites/${siteId}/sections/${sectionSlug}`}>Cancel</Link>
            <button className="btn btn-secondary" onClick={() => save(true)} disabled={saving}>Save Draft</button>
            <button className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
              {saving ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </header>
        <main className="page">
          {error && <div className="error-msg" style={{ marginBottom: '1rem' }}>{error}</div>}
          {success && <div className="success-msg" style={{ marginBottom: '1rem' }}>{success}</div>}

          <div className="editor-layout">
            <div className="editor-left">
              <div className="card mb-4">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input className="form-input" value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto-generated from title" />
                  <div className="form-help">Filename: {buildFilename()}</div>
                </div>
                <FrontmatterForm fields={fields} values={frontmatter} onChange={setFrontmatter} />
              </div>

              <div className="card">
                <label className="form-label">Content (Markdown)</label>
                <textarea
                  className="form-textarea editor-body"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write your post content in Markdown…"
                />
              </div>
            </div>

            <div className="editor-right">
              {hasAi && (
                <div className="card mb-4">
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.875rem' }}>AI Enhancement</div>
                  <div className="form-group">
                    <label className="form-label">Provider</label>
                    <select className="form-select" value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}>
                      {aiProviders.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                    </select>
                  </div>
                  {policies.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Policy</label>
                      <select className="form-select" value={selectedPolicy} onChange={e => setSelectedPolicy(e.target.value)}>
                        <option value="">Default</option>
                        {policies.map(p => <option key={p.path} value={p.path}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleEnhance} disabled={enhancing || !body}>
                    {enhancing ? 'Enhancing…' : '✨ Enhance with AI'}
                  </button>
                </div>
              )}

              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>About this post</div>
                <div className="text-muted">
                  {isNew
                    ? `New ${section?.fileType || 'md'} file in ${section?.publishedDir || 'published dir'}`
                    : <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>{filePath}</span>}
                </div>
              </div>
            </div>
          </div>

          {diffResult && (
            <div className="card" style={{ marginTop: '1rem' }}>
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
