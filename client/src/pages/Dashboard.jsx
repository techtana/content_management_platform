import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sitesApi, meApi } from '../api.js';

export default function Dashboard({ darkMode, onToggleDark }) {
  const [sites, setSites] = useState([]);
  const [me, setMe] = useState(null);
  const [activeSite, setActiveSite] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([sitesApi.list(), meApi.get()]).then(([s, m]) => {
      setSites(s); setMe(m);
      if (s.length > 0) setActiveSite(s[0]);
    });
  }, []);

  async function toggleDark() {
    onToggleDark();
    await meApi.patch({ darkMode: !darkMode });
  }

  const sections = activeSite?.sections || [];

  return (
    <div className="app-layout">
      <Sidebar site={activeSite} activeSlug={null} />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">Dashboard</span>
          <div className="topbar-actions">
            <button className="toggle-btn" onClick={toggleDark} title="Toggle dark mode">
              {darkMode ? '☀️' : '🌙'}
            </button>
            {me?.avatar && <img className="avatar" src={me.avatar} alt={me.username} title={`@${me.username}`} />}
          </div>
        </header>

        <main className="page">
          {sites.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">⚙️</div>
                <div className="empty-state-title">No site configured</div>
                <div className="empty-state-desc">Run the setup wizard to connect a GitHub Pages repo.</div>
                <button className="btn btn-primary" onClick={() => navigate('/setup')}>Open Setup Wizard</button>
              </div>
            </div>
          ) : (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Welcome back{me ? `, @${me.username}` : ''}!</h1>
                  <div className="page-subtitle">{activeSite?.repo_owner}/{activeSite?.repo_name}</div>
                </div>
              </div>

              <div className="section-grid">
                {sections.map(s => (
                  <Link key={s.slug} className="section-card" to={`/sites/${activeSite.id}/sections/${s.slug}`}>
                    <div className="section-card-name">{s.name}</div>
                    <div className="section-card-dir">{s.publishedDir}</div>
                    <div className="flex gap-2 mt-2">
                      {s.aiEnabled && <span className="badge badge-purple">AI</span>}
                      {s.fileType === 'ipynb' && <span className="badge badge-yellow">Jupyter</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export function Sidebar({ site, activeSlug }) {
  const sections = site?.sections || [];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">📄</div>
        Pages CMS
      </div>
      <nav>
        {site && (
          <>
            <div className="sidebar-section">{site.repo_owner}/{site.repo_name}</div>
            {sections.map(s => (
              <Link
                key={s.slug}
                className={`sidebar-link${s.slug === activeSlug ? ' active' : ''}`}
                to={`/sites/${site.id}/sections/${s.slug}`}
              >
                {s.name}
              </Link>
            ))}
          </>
        )}
        <div className="sidebar-section">Settings</div>
        <Link className={`sidebar-link${activeSlug === '__ai' ? ' active' : ''}`} to="/ai-settings">AI Providers</Link>
      </nav>
    </aside>
  );
}
