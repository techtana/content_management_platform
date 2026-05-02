const express = require('express');
const router = express.Router();
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const { listUserRepos, getToken } = require('../../services/github');
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

module.exports = router;
