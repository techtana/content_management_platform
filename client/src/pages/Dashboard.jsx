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
      setSites(s);
      setMe(m);
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
      <aside className="sidebar">
        <div className="sidebar-logo">📄 Pages CMS</div>
        <nav>
          {activeSite && (
            <>
              <div className="sidebar-section">{activeSite.repo_owner}/{activeSite.repo_name}</div>
              {sections.map(s => (
                <Link
                  key={s.slug}
                  className="sidebar-link"
                  to={`/sites/${activeSite.id}/sections/${s.slug}`}
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
          <span className="topbar-title">Dashboard</span>
          <div className="topbar-actions">
            <button className="toggle-btn" onClick={toggleDark} title="Toggle dark mode">
              {darkMode ? '☀️' : '🌙'}
            </button>
            {me && <img className="avatar" src={me.avatar} alt={me.username} title={me.username} />}
          </div>
        </header>
        <main className="page">
          {sites.length === 0 ? (
            <div className="card">
              <p>No sites configured. Run the setup wizard to add a site.</p>
              <button className="btn btn-primary" onClick={() => navigate('/setup')}>Open Setup</button>
            </div>
          ) : (
            <div>
              <h2 style={{ marginTop: 0 }}>Welcome back{me ? `, ${me.username}` : ''}!</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {sections.map(s => (
                  <Link
                    key={s.slug}
                    to={`/sites/${activeSite.id}/sections/${s.slug}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="card" style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{s.name}</div>
                      <div className="text-muted">{s.publishedDir}</div>
                      {s.aiEnabled && <span className="badge badge-green" style={{ marginTop: '0.5rem' }}>AI ✓</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
