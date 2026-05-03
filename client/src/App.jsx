import { useState, useEffect, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { setupApi, meApi } from './api.js';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ContentList from './pages/ContentList.jsx';
import Editor from './pages/Editor.jsx';
import AISettings from './pages/AISettings.jsx';
import Settings from './pages/Settings.jsx';
import Help from './pages/Help.jsx';
import PostsList from './pages/PostsList.jsx';
import PostEditor from './pages/PostEditor.jsx';
import WikiPagesList from './pages/WikiPagesList.jsx';
import WikiPageEditor from './pages/WikiPageEditor.jsx';
import './styles.css';

export const DarkModeContext = createContext({ darkMode: false, onToggleDark: () => {} });

export default function App() {
  const [setupDone, setSetupDone] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === '1');

  useEffect(() => {
    setupApi.status().then(s => setSetupDone(s.setupComplete)).catch(() => setSetupDone(false));
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode ? '1' : '0');
  }, [darkMode]);

  function handleToggleDark() {
    setDarkMode(d => {
      const next = !d;
      meApi.patch({ darkMode: next }).catch(() => {});
      return next;
    });
  }

  if (setupDone === null) return <div className="loading">Loading…</div>;

  return (
    <DarkModeContext.Provider value={{ darkMode, onToggleDark: handleToggleDark }}>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<Setup onComplete={() => setSetupDone(true)} />} />
          {!setupDone
            ? <Route path="*" element={<Navigate to="/setup" replace />} />
            : <>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sites/:siteId/sections/:sectionSlug" element={<ContentList />} />
                <Route path="/sites/:siteId/sections/:sectionSlug/new" element={<Editor />} />
                <Route path="/sites/:siteId/sections/:sectionSlug/edit/*" element={<Editor />} />
                <Route path="/sites/:siteId/posts/new" element={<PostEditor />} />
                <Route path="/sites/:siteId/posts/edit/*" element={<PostEditor />} />
                <Route path="/sites/:siteId/posts/:status" element={<PostsList />} />
                <Route path="/sites/:siteId/pages" element={<WikiPagesList />} />
                <Route path="/sites/:siteId/pages/new" element={<WikiPageEditor />} />
                <Route path="/sites/:siteId/pages/edit/*" element={<WikiPageEditor />} />
                <Route path="/ai-settings" element={<AISettings />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/help" element={<Help />} />
              </>
          }
        </Routes>
      </BrowserRouter>
    </DarkModeContext.Provider>
  );
}
