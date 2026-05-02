import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { contentApi, sitesApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';

const PAGE_SIZE = 50;

export default function ContentList() {
  const { siteId, sectionSlug } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [files, setFiles] = useState([]);
  const [tab, setTab] = useState('draft');
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
    setLoading(true); setPage(0);
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
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  function encodePath(p) {
    return btoa(p).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  return (
    <div className="app-layout">
      <Sidebar site={site} activeSlug={sectionSlug} />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{section?.name || sectionSlug}</span>
          <div className="topbar-actions">
            <Link className="btn btn-primary" to={`/sites/${siteId}/sections/${sectionSlug}/new`}>
              + New Post
            </Link>
          </div>
        </header>

        <main className="page">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="flex items-center justify-between mb-4">
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
              {['draft', 'published'].map(t => (
                <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  {!loading && tab === t && (
                    <span style={{ marginLeft: '6px', background: 'var(--border)', borderRadius: 'var(--radius-full)', padding: '1px 7px', fontSize: '0.6875rem', fontWeight: 600 }}>
                      {filtered.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                placeholder="Search posts…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
          </div>

          <div className="card-flush">
            {loading ? (
              <div className="empty-state"><div className="text-3 text-sm">Loading…</div></div>
            ) : paged.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{search ? '🔍' : tab === 'draft' ? '📝' : '📄'}</div>
                <div className="empty-state-title">{search ? 'No results' : `No ${tab} posts`}</div>
                <div className="empty-state-desc">
                  {search ? `No posts match "${search}".` : tab === 'draft' ? 'Save a post as draft to see it here.' : 'Publish a post to see it here.'}
                </div>
                {!search && (
                  <Link className="btn btn-primary" to={`/sites/${siteId}/sections/${sectionSlug}/new`}>+ New Post</Link>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Slug</th>
                      <th>Path</th>
                      <th>Status</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(f => {
                      const m = f.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.\w+$/);
                      return (
                        <tr key={f.path}>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: '0.8125rem' }}>
                            {m ? m[1] : '—'}
                          </td>
                          <td style={{ fontWeight: 500 }}>{m ? m[2] : f.name}</td>
                          <td className="td-mono">{f.path}</td>
                          <td>
                            <span className={`badge ${f.status === 'published' ? 'badge-green' : 'badge-yellow'}`}>
                              {f.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <Link
                                className="btn btn-secondary btn-sm"
                                to={`/sites/${siteId}/sections/${sectionSlug}/edit/${encodePath(f.path)}`}
                              >
                                Edit
                              </Link>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f)}>Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex gap-2 items-center" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Prev</button>
                    <span className="text-xs text-3">Page {page + 1} / {totalPages}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
