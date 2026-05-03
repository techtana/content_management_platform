import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postsApi, sitesApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';

const PAGE_SIZE = 50;
const STATUS_LABELS = { draft: 'Drafts', published: 'Published', archive: 'Archive' };

function encPath(p) {
  return btoa(p).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Delete confirmation modal ──────────────────────────────────────────────
function DeleteModal({ filename, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card">
        <div className="modal-title">Permanently delete?</div>
        <p className="text-sm" style={{ color: 'var(--text-2)', marginBottom: '16px', lineHeight: 1.6 }}>
          This will permanently remove <span className="font-mono" style={{ color: 'var(--text-1)' }}>{filename}</span> from the repository. This cannot be undone.
        </p>
        <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
          Type <strong>delete</strong> to confirm:
        </p>
        <input
          className="form-input mb-4"
          autoFocus
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && typed === 'delete' && onConfirm()}
          placeholder="delete"
        />
        <div className="flex gap-2">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-danger"
            style={{ flex: 1 }}
            disabled={typed !== 'delete'}
            onClick={onConfirm}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PostsList() {
  const { siteId, status } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('date-desc');
  const [filterCat, setFilterCat] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const currentStatus = status || 'draft';

  useEffect(() => {
    sitesApi.get(siteId).then(setSite).catch(e => setError(e.message));
  }, [siteId]);

  useEffect(() => {
    if (!site) return;
    setLoading(true); setPage(0); setFilterCat(''); setFilterTag('');
    postsApi.meta(siteId, currentStatus)
      .then(setPosts)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [siteId, currentStatus, site]);

  // Unique categories + tags from loaded posts
  const allCategories = useMemo(() => {
    const s = new Set(posts.map(p => p.category).filter(Boolean));
    return [...s].sort();
  }, [posts]);

  const allTags = useMemo(() => {
    const s = new Set(posts.flatMap(p => p.tags || []));
    return [...s].sort();
  }, [posts]);

  const filtered = useMemo(() => {
    let result = posts;
    const q = search.toLowerCase();
    if (q) result = result.filter(p =>
      (p.title || p.name).toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
    if (filterCat) result = result.filter(p => p.category === filterCat);
    if (filterTag) result = result.filter(p => (p.tags || []).includes(filterTag));

    const [key, dir] = sortKey.split('-');
    result = [...result].sort((a, b) => {
      let va, vb;
      if (key === 'date') {
        va = a.date || a.name;
        vb = b.date || b.name;
      } else if (key === 'title') {
        va = (a.title || a.name).toLowerCase();
        vb = (b.title || b.name).toLowerCase();
      } else if (key === 'category') {
        va = (a.category || '').toLowerCase();
        vb = (b.category || '').toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [posts, search, sortKey, filterCat, filterTag]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  async function handleDelete(f) {
    setActionLoading(f.path);
    try {
      await postsApi.delete(siteId, f.path, f.sha);
      setPosts(prev => prev.filter(x => x.path !== f.path));
    } catch (e) { alert('Delete failed: ' + e.message); }
    finally { setActionLoading(''); setDeleteTarget(null); }
  }

  async function handleArchive(f) {
    setActionLoading(f.path);
    try {
      await postsApi.archive(siteId, f.path, { sha: f.sha });
      setPosts(prev => prev.filter(x => x.path !== f.path));
    } catch (e) { alert('Archive failed: ' + e.message); }
    finally { setActionLoading(''); }
  }

  async function handleUnarchive(f) {
    setActionLoading(f.path);
    try {
      await postsApi.unarchive(siteId, f.path, { sha: f.sha });
      setPosts(prev => prev.filter(x => x.path !== f.path));
    } catch (e) { alert('Reopen failed: ' + e.message); }
    finally { setActionLoading(''); }
  }

  const hasFilters = filterCat || filterTag || search;

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
          {error && <div className="alert alert-error mb-4">{error}</div>}

          {/* Status tabs */}
          <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: '8px' }}>
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
                placeholder="Search…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
          </div>

          {/* Sort + filter row */}
          <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '0.8125rem', height: '34px', padding: '0 10px' }}
              value={sortKey}
              onChange={e => { setSortKey(e.target.value); setPage(0); }}
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="title-asc">Title A → Z</option>
              <option value="title-desc">Title Z → A</option>
              <option value="category-asc">Category A → Z</option>
            </select>

            {allCategories.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.8125rem', height: '34px', padding: '0 10px' }}
                value={filterCat}
                onChange={e => { setFilterCat(e.target.value); setPage(0); }}
              >
                <option value="">All categories</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {allTags.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.8125rem', height: '34px', padding: '0 10px' }}
                value={filterTag}
                onChange={e => { setFilterTag(e.target.value); setPage(0); }}
              >
                <option value="">All tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            {hasFilters && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setSearch(''); setFilterCat(''); setFilterTag(''); setPage(0); }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="card-flush">
            {loading ? (
              <div className="empty-state"><div className="text-3 text-sm">Loading posts…</div></div>
            ) : paged.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{hasFilters ? '🔍' : currentStatus === 'draft' ? '📝' : currentStatus === 'published' ? '📄' : '📦'}</div>
                <div className="empty-state-title">{hasFilters ? 'No matching posts' : `No ${STATUS_LABELS[currentStatus].toLowerCase()}`}</div>
                <div className="empty-state-desc">
                  {hasFilters ? 'Try different filters or search terms.'
                    : currentStatus === 'draft' ? 'Create a new post to get started.'
                    : currentStatus === 'published' ? 'Publish a draft to see it here.'
                    : 'Archive a post to see it here.'}
                </div>
                {!hasFilters && currentStatus === 'draft' && (
                  <Link className="btn btn-primary" to={`/sites/${siteId}/posts/new`}>+ New Post</Link>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '96px' }}>Date</th>
                      <th>Title</th>
                      <th style={{ width: '120px' }}>Category</th>
                      <th style={{ width: '180px' }}>Tags</th>
                      <th style={{ width: '160px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(f => {
                      const m = f.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.\w+$/);
                      const title = f.title || (m ? m[2].replace(/-/g, ' ') : f.name);
                      const busy = actionLoading === f.path;
                      return (
                        <tr key={f.path}>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
                            {f.date || (m ? m[1] : '—')}
                          </td>
                          <td style={{ fontWeight: 500, maxWidth: '260px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {title}
                            </div>
                            {site && (
                              <a
                                href={`https://github.com/${site.repo_owner}/${site.repo_name}/blob/${site.default_branch}/${f.path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontFamily: 'monospace', textDecoration: 'none' }}
                                title="View source on GitHub"
                              >
                                {f.name} ↗
                              </a>
                            )}
                          </td>
                          <td>
                            {f.category
                              ? <span className="badge badge-purple" style={{ cursor: 'pointer' }} onClick={() => { setFilterCat(f.category); setPage(0); }}>{f.category}</span>
                              : <span style={{ color: 'var(--text-3)' }}>—</span>}
                          </td>
                          <td>
                            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                              {(f.tags || []).length > 0
                                ? f.tags.map(t => (
                                    <span key={t} className="badge badge-yellow" style={{ cursor: 'pointer' }} onClick={() => { setFilterTag(t); setPage(0); }}>{t}</span>
                                  ))
                                : <span style={{ color: 'var(--text-3)' }}>—</span>}
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <Link
                                className="btn btn-secondary btn-sm"
                                to={`/sites/${siteId}/posts/edit/${encPath(f.path)}`}
                              >
                                Edit
                              </Link>
                              {currentStatus === 'archive' ? (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled={busy}
                                  onClick={() => handleUnarchive(f)}
                                  title="Reopen as draft"
                                >
                                  {busy ? '…' : '↩ Reopen'}
                                </button>
                              ) : (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  disabled={busy}
                                  onClick={() => handleArchive(f)}
                                  title="Archive"
                                >
                                  {busy ? '…' : '📦'}
                                </button>
                              )}
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={busy}
                                onClick={() => setDeleteTarget(f)}
                              >
                                Del
                              </button>
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

      {deleteTarget && (
        <DeleteModal
          filename={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
