import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupApi, reposApi } from '../api.js';

const STEPS = ['GitHub Token', 'Repo & Type', 'Set Up Repo', 'AI Provider'];

const SITE_TYPES = [
  {
    id: 'blog',
    icon: '📝',
    label: 'Blog',
    desc: 'Date-ordered posts with draft, publish, and archive workflow.',
    folders: '_posts/, _drafts/, _archive/',
  },
  {
    id: 'wiki',
    icon: '📚',
    label: 'Wiki',
    desc: 'Title-based pages — great for documentation, notes, or a knowledge base.',
    folders: '_pages/',
  },
  {
    id: 'mixed',
    icon: '🔀',
    label: 'Mixed',
    desc: 'Both a blog and a wiki — posts and pages side by side.',
    folders: '_posts/, _drafts/, _archive/, _pages/',
  },
];

export default function Setup({ onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [siteType, setSiteType] = useState('blog');
  const [readiness, setReadiness] = useState(null);
  const [createIndex, setCreateIndex] = useState(true);
  const [createSnapshot, setCreateSnapshot] = useState(true);
  const [initResult, setInitResult] = useState(null);
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

  async function goToSetup() {
    if (!selectedRepo) return;
    setError(''); setLoading(true);
    try {
      const check = await reposApi.check(selectedRepo.owner, selectedRepo.name, selectedRepo.default_branch);
      setReadiness(check);
      setStep(2);
    } catch (e) {
      // Non-fatal — still proceed to setup step
      setReadiness(null);
      setStep(2);
    }
    finally { setLoading(false); }
  }

  async function saveSetup() {
    setError(''); setLoading(true);
    try {
      await setupApi.complete(token, {
        repo_owner: selectedRepo.owner,
        repo_name: selectedRepo.name,
        default_branch: selectedRepo.default_branch,
        ssg_type: readiness?.ssg || 'unknown',
        site_type: siteType,
        sections: [],
      });

      // Initialize folders + optionally create index
      const needsFolders = siteType === 'blog' ? !readiness?.hasBlogFolders
        : siteType === 'wiki' ? !readiness?.hasWikiFolders
        : !readiness?.hasBlogFolders || !readiness?.hasWikiFolders;
      const needsIndex = !readiness?.hasIndex;

      if (needsFolders || (createIndex && needsIndex)) {
        try {
          const result = await reposApi.init(selectedRepo.owner, selectedRepo.name, selectedRepo.default_branch, {
            siteType,
            createSnapshot,
            createIndex: createIndex && needsIndex,
          });
          setInitResult(result);
        } catch { /* non-fatal */ }
      }

      setStep(3);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function ReadinessRow({ ok, label, detail }) {
    return (
      <div className="readiness-row">
        <span className={`readiness-icon${ok ? ' ok' : ' warn'}`}>{ok ? '✓' : '!'}</span>
        <div>
          <span className="text-sm" style={{ color: ok ? 'var(--success)' : 'var(--text-2)', fontWeight: 500 }}>{label}</span>
          {detail && <span className="text-xs text-3" style={{ marginLeft: '8px' }}>{detail}</span>}
        </div>
      </div>
    );
  }

  const hasBlog = siteType === 'blog' || siteType === 'mixed';
  const hasWiki = siteType === 'wiki' || siteType === 'mixed';

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-logo">
          <div className="setup-logo-icon">📄</div>
          <span className="setup-brand">Pages CMS</span>
        </div>

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
              See <strong>How it works → GitHub access</strong> for full instructions.
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
              <div className="form-help">Encrypted before storing locally. Never leaves your machine.</div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary w-full" onClick={validateToken} disabled={loading || !token}>
              {loading ? 'Validating…' : 'Continue →'}
            </button>
          </>
        )}

        {/* Step 1 — Repo + Site Type */}
        {step === 1 && (
          <>
            <p className="setup-desc">
              Signed in as <strong>@{user?.username}</strong>. Choose a repo and how you want to use it.
            </p>
            <div className="form-group">
              <label className="form-label">Repository</label>
              <select
                className="form-select"
                value={selectedRepo?.full_name || ''}
                onChange={e => setSelectedRepo(repos.find(r => r.full_name === e.target.value) || null)}
              >
                <option value="">— pick a repo —</option>
                {repos.map(r => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
              </select>
              {repos.length === 0 && <div className="form-help">No GitHub Pages repos found. Make sure Pages is enabled on the repo, or create a new one from Settings.</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Site type</label>
              <div className="site-type-grid">
                {SITE_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`site-type-card${siteType === t.id ? ' selected' : ''}`}
                    onClick={() => setSiteType(t.id)}
                  >
                    <span className="site-type-icon">{t.icon}</span>
                    <span className="site-type-label">{t.label}</span>
                    <span className="site-type-desc">{t.desc}</span>
                    <span className="site-type-folders">{t.folders}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={goToSetup} disabled={loading || !selectedRepo}>
                {loading ? 'Checking repo…' : 'Continue →'}
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Repo Setup */}
        {step === 2 && (
          <>
            <p className="setup-desc">
              Review your repo's current state and choose what to set up.
            </p>

            {readiness && (
              <div className="readiness-card mb-4">
                <div className="text-xs font-semibold text-3 mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Repo check</div>
                <ReadinessRow ok={readiness.hasIndex} label="Index page" detail={readiness.indexFile || 'none found'} />
                {hasBlog && <ReadinessRow ok={readiness.hasBlogFolders} label="Blog folders" detail={readiness.hasBlogFolders ? '_posts/, _drafts/' : 'will be created'} />}
                {hasWiki && <ReadinessRow ok={readiness.hasWikiFolders} label="Wiki folder" detail={readiness.hasWikiFolders ? '_pages/' : 'will be created'} />}
                <ReadinessRow ok={!!readiness.ssg && readiness.ssg !== 'unknown'} label="SSG detected" detail={readiness.ssg || 'unknown'} />
              </div>
            )}

            <div className="form-group">
              {(!readiness?.hasBlogFolders && hasBlog) || (!readiness?.hasWikiFolders && hasWiki) ? (
                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-1)' }}>
                  <input type="checkbox" checked readOnly disabled />
                  <span>Create folder structure <span className="text-3">(required)</span></span>
                </label>
              ) : null}

              {!readiness?.hasIndex && (
                <label className="flex items-center gap-2 text-sm mb-2" style={{ cursor: 'pointer', color: 'var(--text-1)' }}>
                  <input type="checkbox" checked={createIndex} onChange={e => setCreateIndex(e.target.checked)} />
                  <span>Create a starter <span className="font-mono">index{readiness?.ssg === 'jekyll' ? '.md' : '.html'}</span> homepage</span>
                </label>
              )}

              <label className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer', color: 'var(--text-1)' }}>
                <input type="checkbox" checked={createSnapshot} onChange={e => setCreateSnapshot(e.target.checked)} />
                <span>Create a git snapshot tag before changes <span className="text-3">(safe to revert)</span></span>
              </label>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            <div className="flex gap-2 mt-2">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveSetup} disabled={loading}>
                {loading ? 'Setting up…' : 'Save & Continue →'}
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Done + AI */}
        {step === 3 && (
          <>
            <p className="setup-desc">
              You're all set! Optionally configure an AI provider for content enhancement — or do it anytime from <strong>AI Providers</strong> in the sidebar.
            </p>
            {initResult?.snapshotTag && (
              <div className="alert mb-3" style={{ background: 'var(--success-soft)', color: 'var(--success-text)', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.8125rem' }}>
                Snapshot saved: <span className="font-mono">{initResult.snapshotTag}</span>
              </div>
            )}
            <div className="card mb-4" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}>
              <div className="font-semibold text-sm mb-2" style={{ color: 'var(--brand-text)' }}>Supported AI providers</div>
              <div className="text-sm" style={{ color: 'var(--brand-text)', lineHeight: 1.6 }}>
                🖥 <strong>Ollama</strong> &amp; <strong>LM Studio</strong> — free, runs locally<br />
                ☁️ <strong>OpenAI</strong>, <strong>Anthropic</strong>, <strong>OpenRouter</strong> — cloud APIs
              </div>
            </div>
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
