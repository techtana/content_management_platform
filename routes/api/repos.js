const express = require('express');
const router = express.Router();
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const { listUserRepos, getToken, upsertFile, createRepo, enablePages, createTag } = require('../../services/github');
const { detectSsg, proposeSections } = require('../../services/ssgDetector');

router.use(ensureApiAuth);

router.get('/', async (req, res) => {
  try {
    const token = getToken();
    const repos = await listUserRepos(token);
    const ghPages = repos.filter(r => r.has_pages || r.name.endsWith('.github.io'));
    res.json(ghPages.map(r => ({
      id: r.id,
      full_name: r.full_name,
      owner: r.owner.login,
      name: r.name,
      default_branch: r.default_branch,
      has_pages: r.has_pages,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/detect', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

  try {
    const token = getToken();
    const ssgType = await detectSsg(owner, repo, null, token);
    const sections = await proposeSections(owner, repo, null, ssgType, token);
    res.json({ ssgType, sections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/enhance-policies', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

  try {
    const { listFiles } = require('../../services/github');
    const token = getToken();
    const files = await listFiles(owner, repo, '_enhance_policy', null, token);
    const policies = files
      .filter(f => f.name.endsWith('.prompt'))
      .map(f => ({ name: f.name.replace('.prompt', ''), path: f.path, sha: f.sha }));
    res.json(policies);
  } catch {
    res.json([]);
  }
});

// POST /api/repos/init — initialize _posts, _drafts, _archive structure on existing repo
router.post('/init', async (req, res) => {
  const { owner, repo, branch, createSnapshot } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

  try {
    const token = getToken();
    const branchName = branch || 'main';

    let snapshotTag = null;
    if (createSnapshot) {
      const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const tagName = `cms-snapshot-${now}`;
      try {
        await createTag(owner, repo, tagName, 'Snapshot before CMS folder initialization', branchName, token);
        snapshotTag = tagName;
      } catch (e) {
        // Non-fatal — continue even if tag creation fails (e.g. empty repo)
        console.warn('Could not create snapshot tag:', e.message);
      }
    }

    const dirs = ['_posts', '_drafts', '_archive'];
    const created = [];
    for (const dir of dirs) {
      const path = `${dir}/.gitkeep`;
      try {
        // Check if dir already exists by trying to get it
        const { listFiles } = require('../../services/github');
        try {
          const files = await listFiles(owner, repo, dir, branchName, token);
          if (files.length > 0) { created.push({ dir, status: 'exists' }); continue; }
        } catch { /* dir doesn't exist, create it */ }
        await upsertFile(owner, repo, path, '', `init: create ${dir} directory`, null, branchName, token);
        created.push({ dir, status: 'created' });
      } catch (e) {
        created.push({ dir, status: 'error', error: e.message });
      }
    }

    res.json({ ok: true, dirs: created, snapshotTag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repos/create — create a new GitHub Pages repo
router.post('/create', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    const token = getToken();
    const repoInfo = await createRepo(name, description, token);
    // Enable GitHub Pages
    try {
      await enablePages(repoInfo.owner, repoInfo.name, repoInfo.default_branch, token);
    } catch (e) {
      console.warn('Could not enable Pages:', e.message);
    }
    res.status(201).json(repoInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
