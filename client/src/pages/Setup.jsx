import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupApi, reposApi } from '../api.js';

const STEPS = ['GitHub Token', 'Select Repo', 'Configure Sections', 'AI Provider'];

export default function Setup({ onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [ssgType, setSsgType] = useState('');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function validateToken() {
    setError(''); setLoading(true);
    try {
      const data = await setupApi.validateToken(token);
      setUser(data);
      const repoList = await reposApi.list();
      setRepos(repoList);
      setStep(1);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function detectRepo() {
    if (!selectedRepo) return;
    setError(''); setLoading(true);
    try {
      const { ssgType: ssg, sections: proposed } = await reposApi.detect(selectedRepo.owner, selectedRepo.name);
      setSsgType(ssg); setSections(proposed); setStep(2);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function saveSetup() {
    setError(''); setLoading(true);
    try {
      await setupApi.complete(token, {
        repo_owner: selectedRepo.owner,
        repo_name: selectedRepo.name,
        default_branch: selectedRepo.default_branch,
        ssg_type: ssgType,
        sections,
      });
      setStep(3);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function updateSection(i, field, value) {
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        {/* Logo */}
        <div className="setup-logo">
          <div className="setup-logo-icon">📄</div>
          <span className="setup-brand">Pages CMS</span>
        </div>

        {/* Progress */}
        <div className="steps">
          {STEPS.map((_, i) => (
            <div key={i} className={`step${i < step ? ' done' : i === step ? ' active' : ''}`} />
          ))}
        </div>

        <div className="step-label">Step {step + 1} of {STEPS.length}</div>
        <h2 className="setup-heading">{STEPS[step]}</h2>

        {/* Step 0 — Token */}
        {step === 0 && (
          <>
            <p className="setup-desc">
              Create a GitHub Personal Access Token with <strong>repo</strong> + <strong>read:user</strong> scopes, then paste it below.
            </p>
            <div className="form-group">
              <label className="form-label">Personal Access Token</label>
              <input
                className="form-input"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && token && !loading && validateToken()}
                autoFocus
              />
              <div className="form-help">Your token is encrypted before being stored locally.</div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary w-full" onClick={validateToken} disabled={loading || !token}>
              {loading ? 'Validating…' : 'Continue →'}
            </button>
          </>
        )}

        {/* Step 1 — Repo */}
        {step === 1 && (
          <>
            <p className="setup-desc">
              Signed in as <strong>@{user?.username}</strong>. Choose the GitHub Pages repo to manage.
            </p>
            <div className="form-group">
              <label className="form-label">Repository</label>
              <select
                className="form-select"
                value={selectedRepo?.full_name || ''}
                onChange={e => setSelectedRepo(repos.find(r => r.full_name === e.target.value))}
              >
                <option value="">— pick a repo —</option>
                {repos.map(r => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
              </select>
              {repos.length === 0 && <div className="form-help">No GitHub Pages repos found. Make sure your repo has Pages enabled.</div>}
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={detectRepo} disabled={loading || !selectedRepo}>
                {loading ? 'Detecting SSG…' : 'Continue →'}
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Sections */}
        {step === 2 && (
          <>
            <p className="setup-desc">
              Detected <strong>{ssgType || 'unknown'}</strong> site. Review the auto-proposed sections below.
            </p>
            {sections.length === 0
              ? <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="empty-state-icon">📂</div>
                  <div className="empty-state-desc">No sections detected. You can configure them later in Settings.</div>
                </div>
              : sections.map((s, i) => (
                  <div key={i} className="section-row">
                    <div className="form-grid-2 mb-2">
                      <div className="form-group">
                        <label className="form-label">Name</label>
                        <input className="form-input" value={s.name} onChange={e => updateSection(i, 'name', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Published dir</label>
                        <input className="form-input font-mono" value={s.publishedDir} onChange={e => updateSection(i, 'publishedDir', e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label">Draft dir</label>
                      <input className="form-input font-mono" value={s.draftDir} onChange={e => updateSection(i, 'draftDir', e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={s.aiEnabled} onChange={e => updateSection(i, 'aiEnabled', e.target.checked)} />
                      <span>Enable AI enhancement for this section</span>
                    </label>
                  </div>
                ))
            }
            {error && <div className="alert alert-error">{error}</div>}
            <div className="flex gap-2 mt-4">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveSetup} disabled={loading}>
                {loading ? 'Saving…' : 'Save & Continue →'}
              </button>
            </div>
          </>
        )}

        {/* Step 3 — AI (optional) */}
        {step === 3 && (
          <>
            <p className="setup-desc">
              You're all set! Optionally configure an AI provider for content enhancement — this can be done anytime from <strong>AI Settings</strong> in the sidebar.
            </p>
            <div className="card" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)', marginBottom: '20px' }}>
              <div className="font-semibold text-sm mb-2" style={{ color: 'var(--brand-text)' }}>Supported AI providers</div>
              <div className="text-sm" style={{ color: 'var(--brand-text)', lineHeight: 1.6 }}>
                🖥 <strong>Ollama</strong> &amp; <strong>LM Studio</strong> — free, runs locally<br />
                ☁️ <strong>OpenAI</strong>, <strong>Anthropic</strong>, <strong>OpenRouter</strong> — cloud APIs
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { onComplete(); navigate('/dashboard'); }}>
                Go to Dashboard →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
