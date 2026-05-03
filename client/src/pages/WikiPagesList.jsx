import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postsApi, sitesApi } from '../api.js';
import { Sidebar } from './Dashboard.jsx';

function encPath(p) {
  return btoa(p).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

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

export default function WikiPagesList() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    sitesApi.get(siteId).then(setSite).catch(e => setError(e.message));
  }, [siteId]);

  useEffect(() => {
    if (!site) return;
    setLoading(true);
    postsApi.meta(siteId, 'page')
      .then(setPages)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [siteId, site]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return pages;
    return pages.filter(p =>
      (p.title || p.name).toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [pages, search]);

  async function handleDelete(f) {
    setActionLoading(f.path);
    try {
      await postsApi.delete(siteId, f.path, f.sha);
      setPages(prev => prev.filter(x => x.path !== f.path));
    } catch (e) { alert('Delete failed: ' + e.message); }
    finally { setActionLoading(''); setDeleteTarget(null); }
  }

  return (
    <div className="app-layout">
      <Sidebar site={site} activeStatus="page" />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">Pages</span>
          <div className="topbar-actions">
            <Link className="btn btn-primary" to={`/sites/${siteId}/pages/new`}>+ New Page</Link>
          </div>
        </header>

        <main className="page">
          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <div />
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                placeholder="Search pages…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="card-flush">
            {loading ? (
              <div className="empty-state"><div className="text-3 text-sm">Loading pages…</div></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{search ? '🔍' : '📚'}</div>
                <div className="empty-state-title">{search ? 'No matching pages' : 'No pages yet'}</div>
                <div className="empty-state-desc">
                  {search ? 'Try different search terms.' : 'Create your first wiki page.'}
                </div>
                {!search && (
                  <Link className="btn btn-primary" to={`/sites/${siteId}/pages/new`}>+ New Page</Link>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th style={{ width: '180px' }}>Tags</th>
                      <th style={{ width: '140px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(f => {
                      const title = f.title || f.name.replace(/\.md$/, '').replace(/-/g, ' ');
                      const busy = actionLoading === f.path;
                      return (
                        <tr key={f.path}>
                          <td style={{ fontWeight: 500, maxWidth: '320px' }}>
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
                            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                              {(f.tags || []).length > 0
                                ? f.tags.map(t => <span key={t} className="badge badge-yellow">{t}</span>)
                                : <span style={{ color: 'var(--text-3)' }}>—</span>}
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <Link
                                className="btn btn-secondary btn-sm"
                                to={`/sites/${siteId}/pages/edit/${encPath(f.path)}`}
                              >
                                Edit
                              </Link>
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
