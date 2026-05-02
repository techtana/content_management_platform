import { useState } from 'react';
import { setupApi, reposApi } from '../api.js';

const STEPS = ['GitHub Token', 'Select Repo', 'Configure Sections', 'AI Provider'];

export default function Setup({ onComplete }) {
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
    setError('');
    setLoading(true);
    try {
      const data = await setupApi.validateToken(token);
      setUser(data);
      // Temporarily save token to fetch repos
      await setupApi.complete(token, { repo_owner: '_pending_', repo_name: '_pending_', sections: [] });
      const repoList = await reposApi.list();
      setRepos(repoList);
      setStep(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function detectRepo() {
    if (!selectedRepo) return;
    setError('');
    setLoading(true);
    try {
      const { ssgType: ssg, sections: proposed } = await reposApi.detect(selectedRepo.owner, selectedRepo.name);
      setSsgType(ssg);
      setSections(proposed);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSetup() {
    setError('');
    setLoading(true);
    try {
      await setupApi.complete(token, {
        repo_owner: selectedRepo.owner,
        repo_name: selectedRepo.name,
        default_branch: selectedRepo.default_branch,
        ssg_type: ssgType,
        sections,
      });
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    onComplete();
  }

  function updateSection(i, field, value) {
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-title">GitHub Pages CMS</div>
        <div className="setup-subtitle">Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>
        <div className="steps">
          {STEPS.map((_, i) => (
            <div key={i} className={`step ${i < step ? 'done' : i === step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <p className="text-muted">Create a GitHub Personal Access Token with <strong>repo</strong> + <strong>read:user</strong> scopes, then paste it below.</p>
            <div className="form-group">
              <label className="form-label">GitHub Personal Access Token</label>
              <input
                className="form-input"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={e => setToken(e.target.value)}
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary" onClick={validateToken} disabled={loading || !token}>
              {loading ? 'Validating…' : 'Validate Token'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="text-muted">Signed in as <strong>{user?.username}</strong>. Select the GitHub Pages repo to manage.</p>
            <div className="form-group">
              <label className="form-label">Repository</label>
              <select
                className="form-select"
                value={selectedRepo ? selectedRepo.full_name : ''}
                onChange={e => setSelectedRepo(repos.find(r => r.full_name === e.target.value))}
              >
                <option value="">— pick a repo —</option>
                {repos.map(r => (
                  <option key={r.id} value={r.full_name}>{r.full_name}</option>
                ))}
              </select>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
              <button className="btn btn-primary" onClick={detectRepo} disabled={loading || !selectedRepo}>
                {loading ? 'Detecting…' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-muted">Detected SSG: <strong>{ssgType || 'unknown'}</strong>. Review and adjust sections below.</p>
            {sections.map((s, i) => (
              <div key={i} className="card mb-4" style={{ padding: '0.75rem' }}>
                <div className="flex gap-2 mb-4">
                  <input className="form-input" value={s.name} onChange={e => updateSection(i, 'name', e.target.value)} placeholder="Section name" />
                  <input className="form-input" value={s.publishedDir} onChange={e => updateSection(i, 'publishedDir', e.target.value)} placeholder="Published dir" />
                  <input className="form-input" value={s.draftDir} onChange={e => updateSection(i, 'draftDir', e.target.value)} placeholder="Draft dir" />
                </div>
                <label className="flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={s.aiEnabled} onChange={e => updateSection(i, 'aiEnabled', e.target.checked)} />
                  AI Enhancement enabled
                </label>
              </div>
            ))}
            {sections.length === 0 && (
              <p className="text-muted">No sections auto-detected. You can add them later in Settings.</p>
            )}
            {error && <div className="error-msg">{error}</div>}
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary" onClick={saveSetup} disabled={loading}>
                {loading ? 'Saving…' : 'Save & Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-muted">Optionally configure an AI provider for content enhancement. You can skip this and add it later in AI Settings.</p>
            <p className="text-muted">Supported: <strong>Ollama</strong> (local, free), <strong>LM Studio</strong> (local, free), <strong>OpenAI</strong>, <strong>Anthropic</strong>, <strong>OpenRouter</strong></p>
            <p className="text-muted">You can configure AI providers in <strong>AI Settings</strong> from the dashboard sidebar.</p>
            {error && <div className="error-msg">{error}</div>}
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button className="btn btn-primary" onClick={finish}>Go to Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
