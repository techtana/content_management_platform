import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sitesApi, meApi } from '../api.js';
import { DarkModeContext } from '../App.jsx';

export default function Dashboard() {
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

  const sections = activeSite?.sections || [];

  return (
    <div className="app-layout">
      <Sidebar site={activeSite} activeSlug={null} />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">Dashboard</span>
          {me?.avatar && <img className="avatar" src={me.avatar} alt={me.username} title={`@${me.username}`} />}
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
              {sites.length > 1 && (
                <div className="tabs" style={{ marginBottom: '20px' }}>
                  {sites.map(s => (
                    <button
                      key={s.id}
                      className={`tab${activeSite?.id === s.id ? ' active' : ''}`}
                      onClick={() => setActiveSite(s)}
                    >
                      {s.repo_name}
                    </button>
                  ))}
                </div>
              )}

              <div className="page-header">
                <div>
                  <h1 className="page-title">Welcome back{me ? `, @${me.username}` : ''}!</h1>
                  <div className="page-subtitle">{activeSite?.repo_owner}/{activeSite?.repo_name}</div>
                </div>
              </div>

              <div className="section-grid">
                {[
                  { status: 'draft', label: 'Drafts', icon: '📝', desc: 'Work in progress' },
                  { status: 'published', label: 'Published', icon: '📄', desc: 'Live posts' },
                  { status: 'archive', label: 'Archive', icon: '📦', desc: 'Archived posts' },
                ].map(({ status, label, icon, desc }) => (
                  <Link key={status} className="section-card" to={`/sites/${activeSite.id}/posts/${status}`}>
                    <div className="section-card-name">{icon} {label}</div>
                    <div className="section-card-dir">{desc}</div>
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

export function Sidebar({ site, activeSlug, activeStatus }) {
  const { darkMode, onToggleDark } = useContext(DarkModeContext);
  const [me, setMe] = useState(null);
  const [allSites, setAllSites] = useState([]);

  useEffect(() => {
    meApi.get().then(setMe).catch(() => {});
    sitesApi.list().then(setAllSites).catch(() => {});
  }, []);

  const multiSite = allSites.length > 1;

  function siteNavItems(s, isActive) {
    return (
      <div className="sidebar-site-sections">
        {[
          { status: 'draft', label: 'Drafts', icon: '📝' },
          { status: 'published', label: 'Published', icon: '📄' },
          { status: 'archive', label: 'Archive', icon: '📦' },
        ].map(({ status, label, icon }) => (
          <Link
            key={status}
            className={`sidebar-link${isActive && activeStatus === status ? ' active' : ''}`}
            to={`/sites/${s.id}/posts/${status}`}
          >
            <span style={{ marginRight: '6px', fontSize: '0.75rem' }}>{icon}</span>{label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <Link to="/dashboard" className="sidebar-logo">
        <div className="sidebar-logo-icon">📄</div>
        Pages CMS
      </Link>
      <nav>
        {multiSite ? (
          allSites.map(s => {
            const isActive = s.id === site?.id;
            return (
              <div key={s.id}>
                <div
                  className={`sidebar-site-row${isActive ? ' active' : ''}`}
                  onClick={() => {
                    if (!isActive) {
                      window.location.href = `/sites/${s.id}/posts/draft`;
                    }
                  }}
                  title={isActive ? undefined : `Switch to ${s.repo_owner}/${s.repo_name}`}
                >
                  <span className="truncate">{s.repo_owner}/{s.repo_name}</span>
                  <span className="sidebar-site-row-chevron">{isActive ? '▾' : '▸'}</span>
                </div>
                {isActive && siteNavItems(s, true)}
              </div>
            );
          })
        ) : (
          site && (
            <>
              <div className="sidebar-section">{site.repo_owner}/{site.repo_name}</div>
              {siteNavItems(site, true)}
            </>
          )
        )}
        <div className="sidebar-section">Settings</div>
        <Link className={`sidebar-link${activeSlug === '__ai' ? ' active' : ''}`} to="/ai-settings">AI Providers</Link>
        <Link className={`sidebar-link${activeSlug === '__settings' ? ' active' : ''}`} to="/settings">Preferences</Link>
      </nav>
      <div className="sidebar-footer">
        {me && (
          <div className="sidebar-user">
            {me.avatar
              ? <img className="avatar-sm" src={me.avatar} alt={me.username} />
              : <div className="avatar-sm" style={{ background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', color: 'var(--brand-text)', fontWeight: 700 }}>{me.username?.[0]?.toUpperCase()}</div>
            }
            <span className="sidebar-username">@{me.username}</span>
          </div>
        )}
        <button className="toggle-btn" onClick={onToggleDark} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </aside>
  );
}
