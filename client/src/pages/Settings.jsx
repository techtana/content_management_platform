import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { meApi, sitesApi, reposApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';
import { DarkModeContext } from '../App.jsx';

export default function Settings() {
  const { darkMode, onToggleDark } = useContext(DarkModeContext);
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [sites, setSites] = useState([]);

  // Repo init state
  const [initSite, setInitSite] = useState(null);
  const [initSnapshot, setInitSnapshot] = useState(true);
  const [initLoading, setInitLoading] = useState(false);
  const [initResult, setInitResult] = useState(null);
  const [initError, setInitError] = useState('');

  // Create new repo state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  async function handleCreateRepo() {
    if (!createName.trim()) return;
    setCreateLoading(true); setCreateError('');
    try {
      const repo = await reposApi.create(createName.trim(), createDesc.trim());
      // Auto-add to sites
      const site = await sitesApi.create({
        repo_owner: repo.owner,
        repo_name: repo.name,
        default_branch: repo.default_branch,
        ssg_type: 'unknown',
        sections: [],
      });
      setSites(prev => prev.find(s => s.id === site.id) ? prev : [...prev, site]);
      setCreateOpen(false); setCreateName(''); setCreateDesc('');
      navigate(`/sites/${site.id}/posts/draft`);
    } catch (e) { setCreateError('Create failed: ' + e.message); }
    finally { setCreateLoading(false); }
  }

  // Add-site form
  const [addOpen, setAddOpen] = useState(false);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [detectResult, setDetectResult] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    Promise.all([meApi.get(), sitesApi.list()])
      .then(([m, s]) => { setMe(m); setSites(s); })
      .catch(() => {});
  }, []);

  async function openAddSite() {
    setAddOpen(true);
    setAddError('');
    setDetectResult(null);
    setSelectedRepo(null);
    if (repos.length === 0) {
      try { setRepos(await reposApi.list()); } catch { setAddError('Could not load repos.'); }
    }
  }

  function cancelAdd() {
    setAddOpen(false);
    setDetectResult(null);
    setSelectedRepo(null);
    setAddError('');
  }

  async function handleDetect() {
    if (!selectedRepo) return;
    setAddLoading(true); setAddError(''); setDetectResult(null);
    try {
      const result = await reposApi.detect(selectedRepo.owner, selectedRepo.name);
      setDetectResult(result);
    } catch (e) { setAddError('Detection failed: ' + e.message); }
    finally { setAddLoading(false); }
  }

  async function handleAddSite() {
    if (!selectedRepo || !detectResult) return;
    setAddLoading(true); setAddError('');
    try {
      const site = await sitesApi.create({
        repo_owner: selectedRepo.owner,
        repo_name: selectedRepo.name,
        default_branch: selectedRepo.default_branch,
        ssg_type: detectResult.ssgType || 'unknown',
        sections: detectResult.sections || [],
      });
      setSites(prev => prev.find(s => s.id === site.id) ? prev : [...prev, site]);
      cancelAdd();
    } catch (e) { setAddError('Failed to add site: ' + e.message); }
    finally { setAddLoading(false); }
  }

  async function handleRemove(site) {
    if (!confirm(`Remove ${site.repo_owner}/${site.repo_name}? This only removes it from the CMS — your GitHub repo is not affected.`)) return;
    try {
      await sitesApi.delete(site.id);
      setSites(prev => prev.filter(s => s.id !== site.id));
    } catch (e) { alert('Remove failed: ' + e.message); }
  }

  const alreadyAdded = new Set(repos.filter(r =>
    sites.some(s => s.repo_owner === r.owner && s.repo_name === r.name)
  ).map(r => r.full_name));

  return (
    <div className="app-layout">
      <Sidebar site={sites[0] || null} activeSlug="__settings" />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">Preferences</span>
        </header>

        <main className="page" style={{ maxWidth: 560 }}>

          <div className="card mb-4">
            <div className="card-title mb-4">Profile</div>
            {me ? (
              <div className="profile-row">
                <a href={`https://github.com/${me.username}`} target="_blank" rel="noopener noreferrer" style={{ display: 'contents' }}>
                  {me.avatar
                    ? <img className="avatar-lg" src={me.avatar} alt={me.username} style={{ cursor: 'pointer' }} />
                    : <div className="avatar-lg" style={{ background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: 'var(--brand-text)', fontWeight: 700, cursor: 'pointer' }}>{me.username?.[0]?.toUpperCase()}</div>
                  }
                </a>
                <div>
                  <a
                    href={`https://github.com/${me.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)', textDecoration: 'none' }}
                    onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.target.style.textDecoration = 'none'}
                  >
                    @{me.username}
                  </a>
                  <div className="text-xs text-3 mt-2">GitHub account · connected via personal access token</div>
                </div>
              </div>
            ) : (
              <div className="text-3 text-sm">Loading…</div>
            )}
          </div>

          <div className="card mb-4">
            <div className="card-title mb-2">Display</div>
            <div className="setting-row">
              <div>
                <div className="setting-row-label">Dark mode</div>
                <div className="setting-row-desc">Use a dark color scheme across the app</div>
              </div>
              <button
                className={`toggle-switch${darkMode ? ' on' : ''}`}
                onClick={onToggleDark}
                role="switch"
                aria-checked={darkMode}
                aria-label="Toggle dark mode"
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>

          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="card-title">Connected Sites</div>
              {!addOpen && (
                <button className="btn btn-secondary btn-sm" onClick={openAddSite}>+ Add Site</button>
              )}
            </div>

            {sites.length === 0 && !addOpen && (
              <div className="text-sm text-3">
                No sites configured. <Link to="/setup">Run setup wizard →</Link>
              </div>
            )}

            {sites.length > 0 && (
              <div>
                {sites.map((site, i) => (
                  <div
                    key={site.id}
                    className="flex items-center justify-between"
                    style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}
                  >
                    <div>
                      <div className="font-medium text-sm">{site.repo_owner}/{site.repo_name}</div>
                      <div className="text-xs text-3">{site.ssg_type} · {site.sections.length} section{site.sections.length !== 1 ? 's' : ''} · branch: {site.default_branch}</div>
                    </div>
                    <div className="flex gap-1">
                      <Link
                        className="btn btn-secondary btn-sm"
                        to={site.sections.length > 0
                          ? `/sites/${site.id}/sections/${site.sections[0].slug}`
                          : '/dashboard'}
                      >
                        View
                      </Link>
                      {sites.length > 1 && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemove(site)}>Remove</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Site inline panel */}
            {addOpen && (
              <div style={{ borderTop: sites.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: sites.length > 0 ? '14px' : '0', marginTop: sites.length > 0 ? '10px' : '0' }}>
                <div className="card-title mb-3">Add a site</div>
                {addError && <div className="alert alert-error mb-3">{addError}</div>}

                <div className="form-group">
                  <label className="form-label">Repository</label>
                  <select
                    className="form-select"
                    value={selectedRepo?.full_name || ''}
                    onChange={e => {
                      const r = repos.find(r => r.full_name === e.target.value);
                      setSelectedRepo(r || null);
                      setDetectResult(null);
                    }}
                  >
                    <option value="">— pick a repo —</option>
                    {repos.map(r => (
                      <option key={r.id} value={r.full_name} disabled={alreadyAdded.has(r.full_name)}>
                        {r.full_name}{alreadyAdded.has(r.full_name) ? ' (already added)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRepo && !detectResult && (
                  <button className="btn btn-secondary" onClick={handleDetect} disabled={addLoading}>
                    {addLoading ? 'Detecting…' : 'Detect SSG & Sections'}
                  </button>
                )}

                {detectResult && (
                  <div className="alert" style={{ background: 'var(--brand-soft)', color: 'var(--brand-text)', border: 'none', borderRadius: 'var(--radius)', marginBottom: '12px' }}>
                    Detected <strong>{detectResult.ssgType || 'unknown'}</strong> · {detectResult.sections?.length || 0} section{detectResult.sections?.length !== 1 ? 's' : ''} proposed
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button className="btn btn-secondary" onClick={cancelAdd}>Cancel</button>
                  {detectResult && (
                    <button className="btn btn-primary" onClick={handleAddSite} disabled={addLoading}>
                      {addLoading ? 'Adding…' : 'Add Site'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {sites.length > 0 && (
            <div className="card mb-4">
              <div className="card-title mb-2">Initialize Repo Structure</div>
              <div className="text-sm text-3 mb-3">
                Create <span className="font-mono">_posts/</span>, <span className="font-mono">_drafts/</span>, and <span className="font-mono">_archive/</span> folders on a repo. Existing content is not touched.
              </div>

              {sites.length > 1 && (
                <div className="form-group">
                  <label className="form-label">Repository</label>
                  <select
                    className="form-select"
                    value={initSite?.id || ''}
                    onChange={e => setInitSite(sites.find(s => s.id === e.target.value) || null)}
                  >
                    <option value="">— pick a site —</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.repo_owner}/{s.repo_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm mb-3" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={initSnapshot} onChange={e => setInitSnapshot(e.target.checked)} />
                <span>Create git snapshot tag before changes (recommended)</span>
              </label>

              {initError && <div className="alert alert-error mb-3">{initError}</div>}

              {initResult && (
                <div className="alert mb-3" style={{ background: 'var(--brand-soft)', color: 'var(--brand-text)', border: 'none', borderRadius: 'var(--radius)' }}>
                  {initResult.snapshotTag && <div className="text-xs mb-1">Snapshot: <span className="font-mono">{initResult.snapshotTag}</span></div>}
                  {initResult.dirs?.map(d => (
                    <div key={d.dir} className="text-xs font-mono">{d.dir}/: {d.status}</div>
                  ))}
                </div>
              )}

              <button
                className="btn btn-secondary"
                onClick={async () => {
                  const target = sites.length === 1 ? sites[0] : initSite;
                  if (!target) return;
                  setInitLoading(true); setInitError(''); setInitResult(null);
                  try {
                    const result = await reposApi.init(target.repo_owner, target.repo_name, target.default_branch, initSnapshot);
                    setInitResult(result);
                  } catch (e) { setInitError('Init failed: ' + e.message); }
                  finally { setInitLoading(false); }
                }}
                disabled={initLoading || (sites.length > 1 && !initSite)}
              >
                {initLoading ? 'Initializing…' : 'Initialize Folders'}
              </button>
            </div>
          )}

          <div className="card mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="card-title">Create New GitHub Pages Repo</div>
              {!createOpen && (
                <button className="btn btn-secondary btn-sm" onClick={() => setCreateOpen(true)}>+ New Repo</button>
              )}
            </div>
            <div className="text-sm text-3 mb-3">
              Create a new GitHub repo with Pages enabled and CMS folder structure ready.
            </div>

            {createOpen && (
              <div>
                {createError && <div className="alert alert-error mb-3">{createError}</div>}
                <div className="form-group">
                  <label className="form-label">Repository name</label>
                  <input
                    className="form-input"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="my-blog"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description <span className="form-label-opt">(optional)</span></label>
                  <input
                    className="form-input"
                    value={createDesc}
                    onChange={e => setCreateDesc(e.target.value)}
                    placeholder="My personal blog"
                  />
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary" onClick={() => { setCreateOpen(false); setCreateName(''); setCreateDesc(''); setCreateError(''); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleCreateRepo} disabled={createLoading || !createName.trim()}>
                    {createLoading ? 'Creating…' : 'Create Repo'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title mb-2">Advanced</div>
            <div className="text-sm text-3 mb-4">
              Re-run the setup wizard to update your GitHub token or connect a different repository.
            </div>
            <Link className="btn btn-secondary" to="/setup">Re-run Setup Wizard</Link>
          </div>

        </main>
      </div>
    </div>
  );
}
