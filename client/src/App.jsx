import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { setupApi } from './api.js';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ContentList from './pages/ContentList.jsx';
import Editor from './pages/Editor.jsx';
import AISettings from './pages/AISettings.jsx';
import './styles.css';

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

  if (setupDone === null) return <div className="loading">Loading…</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Setup onComplete={() => setSetupDone(true)} />} />
        {!setupDone
          ? <Route path="*" element={<Navigate to="/setup" replace />} />
          : <>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />} />
              <Route path="/sites/:siteId/sections/:sectionSlug" element={<ContentList />} />
              <Route path="/sites/:siteId/sections/:sectionSlug/new" element={<Editor />} />
              <Route path="/sites/:siteId/sections/:sectionSlug/edit/*" element={<Editor />} />
              <Route path="/ai-settings" element={<AISettings />} />
            </>
        }
      </Routes>
    </BrowserRouter>
  );
}
