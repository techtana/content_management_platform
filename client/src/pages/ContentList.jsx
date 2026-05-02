import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { contentApi, sitesApi } from '../api.js';

const PAGE_SIZE = 50;

export default function ContentList() {
  const { siteId, sectionSlug } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [files, setFiles] = useState([]);
  const [tab, setTab] = useState('published');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');

  const section = site?.sections.find(s => s.slug === sectionSlug);

  useEffect(() => {
    sitesApi.get(siteId).then(setSite).catch(e => setError(e.message));
  }, [siteId]);

  useEffect(() => {
    if (!site) return;
    setLoading(true);
    setPage(0);
    contentApi.list(siteId, sectionSlug, tab)
      .then(setFiles)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [siteId, sectionSlug, tab, site]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return files.filter(f => !q || f.name.toLowerCase().includes(q));
  }, [files, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  async function handleDelete(f) {
    if (!confirm(`Delete ${f.name}?`)) return;
    try {
      const detail = await contentApi.get(siteId, sectionSlug, f.path);
      await contentApi.delete(siteId, sectionSlug, f.path, detail.sha);
      setFiles(prev => prev.filter(x => x.path !== f.path));
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  function encodePath(p) {
    return btoa(p).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  const sidebarSections = site?.sections || [];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">📄 Pages CMS</div>
        <nav>
          {site && (
            <>
              <div className="sidebar-section">{site.repo_owner}/{site.repo_name}</div>
              {sidebarSections.map(s => (
                <Link
                  key={s.slug}
                  className={`sidebar-link${s.slug === sectionSlug ? ' active' : ''}`}
                  to={`/sites/${siteId}/sections/${s.slug}`}
                >
                  {s.name}
                </Link>
              ))}
            </>
          )}
          <div className="sidebar-section">Settings</div>
          <Link className="sidebar-link" to="/ai-settings">AI Providers</Link>
        </nav>
      </aside>
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{section?.name || sectionSlug}</span>
          <div className="topbar-actions">
            <Link className="btn btn-primary btn-sm" to={`/sites/${siteId}/sections/${sectionSlug}/new`}>+ New Post</Link>
          </div>
        </header>
        <main className="page">
          {error && <div className="error-msg">{error}</div>}
          <div className="flex justify-between items-center mb-4">
            <div className="tabs" style={{ marginBottom: 0 }}>
              {['published', 'draft'].map(t => (
                <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <input
              className="search-bar"
              placeholder="Search…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          {loading ? (
            <div className="text-muted">Loading…</div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title / Slug</th>
                      <th>Path</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No posts found.</td></tr>
                    )}
                    {paged.map(f => {
                      const m = f.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.\w+$/);
                      return (
                        <tr key={f.path}>
                          <td>{m ? m[1] : '—'}</td>
                          <td>{m ? m[2] : f.name}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{f.path}</td>
                          <td>
                            <span className={`badge ${f.status === 'published' ? 'badge-green' : 'badge-yellow'}`}>
                              {f.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <Link
                                className="btn btn-secondary btn-sm"
                                to={`/sites/${siteId}/sections/${sectionSlug}/edit/${encodePath(f.path)}`}
                              >
                                Edit
                              </Link>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex gap-2 items-center" style={{ padding: '0.75rem 1rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Prev</button>
                  <span className="text-muted">Page {page + 1} / {totalPages}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next</button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
