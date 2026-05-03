import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postsApi, sitesApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';

const PAGE_SIZE = 50;

const STATUS_LABELS = { draft: 'Drafts', published: 'Published', archive: 'Archive' };
const STATUS_ICONS = { draft: '📝', published: '📄', archive: '📦' };

export default function PostsList() {
  const { siteId, status } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    sitesApi.get(siteId).then(setSite).catch(e => setError(e.message));
  }, [siteId]);

  useEffect(() => {
    if (!site) return;
    setLoading(true); setPage(0);
    postsApi.list(siteId, status || 'draft')
      .then(setFiles)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [siteId, status, site]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return files.filter(f => !q || f.name.toLowerCase().includes(q));
  }, [files, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  async function handleDelete(f) {
    if (!confirm(`Delete ${f.name}?`)) return;
    try {
      await postsApi.delete(siteId, f.path, f.sha);
      setFiles(prev => prev.filter(x => x.path !== f.path));
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  async function handleArchive(f) {
    if (!confirm(`Archive ${f.name}?`)) return;
    try {
      await postsApi.archive(siteId, f.path, { sha: f.sha });
      setFiles(prev => prev.filter(x => x.path !== f.path));
    } catch (e) { alert('Archive failed: ' + e.message); }
  }

  const currentStatus = status || 'draft';

  return (
    <div className="app-layout">
      <Sidebar site={site} activeStatus={currentStatus} />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{STATUS_LABELS[currentStatus] || currentStatus}</span>
          <div className="topbar-actions">
            <Link className="btn btn-primary" to={`/sites/${siteId}/posts/new`}>+ New Post</Link>
          </div>
        </header>

        <main className="page">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="flex items-center justify-between mb-4">
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
              {['draft', 'published', 'archive'].map(s => (
                <button
                  key={s}
                  className={`tab${currentStatus === s ? ' active' : ''}`}
                  onClick={() => navigate(`/sites/${siteId}/posts/${s}`)}
                >
                  {STATUS_LABELS[s]}
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
                <div className="empty-state-icon">{search ? '🔍' : STATUS_ICONS[currentStatus]}</div>
                <div className="empty-state-title">{search ? 'No results' : `No ${STATUS_LABELS[currentStatus].toLowerCase()}`}</div>
                <div className="empty-state-desc">
                  {search
                    ? `No posts match "${search}".`
                    : currentStatus === 'draft' ? 'Create a new post to get started.'
                    : currentStatus === 'published' ? 'Publish a draft to see it here.'
                    : 'Archive a post to see it here.'}
                </div>
                {!search && currentStatus === 'draft' && (
                  <Link className="btn btn-primary" to={`/sites/${siteId}/posts/new`}>+ New Post</Link>
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
                      <th style={{ width: '150px' }}>Actions</th>
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
                            <div className="flex gap-1">
                              <Link
                                className="btn btn-secondary btn-sm"
                                to={`/sites/${siteId}/posts/edit/${btoa(f.path).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`}
                              >
                                Edit
                              </Link>
                              {currentStatus !== 'archive' && (
                                <button className="btn btn-ghost btn-sm" onClick={() => handleArchive(f)} title="Archive">📦</button>
                              )}
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
