const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../config/db');
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const { getToken, listFiles, getFile, upsertFile, deleteFile } = require('../../services/github');
const { parseFile, serializeFile, isDatedFile, isTemplateFile, buildFilename } = require('../../services/frontmatterParser');

router.use(ensureApiAuth);

const STATUS_DIRS = {
  published: '_posts',
  draft: '_drafts',
  archive: '_archive',
};

function getSite(siteId) {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  if (!site) throw Object.assign(new Error('Site not found'), { status: 404 });
  return site;
}

// GET /api/sites/:siteId/posts?status=draft|published|archive
router.get('/:siteId/posts', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const status = req.query.status || 'draft';
    const dir = STATUS_DIRS[status];
    if (!dir) return res.status(400).json({ error: 'Invalid status' });

    const token = getToken();
    let files;
    try {
      files = await listFiles(site.repo_owner, site.repo_name, dir, site.default_branch, token);
    } catch {
      files = [];
    }

    const results = files
      .filter(f => !isTemplateFile(f.name) && f.name !== '.gitkeep' && f.type === 'file')
      .map(f => ({
        name: f.name,
        path: f.path,
        sha: f.sha,
        status,
        size: f.size,
      }));

    res.json(results);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/sites/:siteId/posts/:encodedPath
router.get('/:siteId/posts/:encodedPath', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const filePath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const fileData = await getFile(site.repo_owner, site.repo_name, filePath, site.default_branch, token);
    const rawContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const filename = filePath.split('/').pop();
    const parsed = parseFile(rawContent, filename);
    res.json({ ...parsed, sha: fileData.sha, path: filePath });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/sites/:siteId/posts — create new draft
router.post('/:siteId/posts', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const token = getToken();
    const { frontmatter, body, filename } = req.body;
    const dir = STATUS_DIRS.draft;
    const name = filename || buildFilename(
      frontmatter.date || new Date().toISOString().slice(0, 10),
      slugify(frontmatter.title || 'untitled'),
      'md'
    );
    const filePath = `${dir}/${name}`;
    const content = serializeFile(frontmatter, body || '');
    const sha = await upsertFile(site.repo_owner, site.repo_name, filePath, content, `draft: save ${name}`, null, site.default_branch, token);
    logAudit(site.id, 'save_draft', filePath, sha);
    res.status(201).json({ ok: true, path: filePath, sha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PUT /api/sites/:siteId/posts/:encodedPath — update (stays in same folder)
router.put('/:siteId/posts/:encodedPath', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const filePath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { frontmatter, body, sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required for update' });
    const content = serializeFile(frontmatter, body || '');
    const filename = filePath.split('/').pop();
    try {
      const newSha = await upsertFile(site.repo_owner, site.repo_name, filePath, content, `post: update ${filename}`, sha, site.default_branch, token);
      logAudit(site.id, 'update', filePath, newSha);
      res.json({ ok: true, sha: newSha });
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.includes('does not match'))) {
        return res.status(409).json({ error: 'File changed remotely — reload?' });
      }
      throw err;
    }
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/sites/:siteId/posts/:encodedPath/publish — move _drafts/ → _posts/
router.post('/:siteId/posts/:encodedPath/publish', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const draftPath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { frontmatter, body, sha } = req.body;
    const filename = draftPath.split('/').pop();
    const publishPath = `${STATUS_DIRS.published}/${filename}`;
    const content = serializeFile(frontmatter, body || '');

    const newSha = await upsertFile(site.repo_owner, site.repo_name, publishPath, content, `post: publish ${filename}`, null, site.default_branch, token);
    if (draftPath !== publishPath && sha) {
      try {
        await deleteFile(site.repo_owner, site.repo_name, draftPath, `post: remove draft ${filename}`, sha, site.default_branch, token);
      } catch { /* ignore */ }
    }
    logAudit(site.id, 'publish', publishPath, newSha);
    res.json({ ok: true, path: publishPath, sha: newSha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/sites/:siteId/posts/:encodedPath/archive — move to _archive/
router.post('/:siteId/posts/:encodedPath/archive', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const srcPath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required' });
    const filename = srcPath.split('/').pop();
    const archivePath = `${STATUS_DIRS.archive}/${filename}`;

    // Read current content
    const fileData = await getFile(site.repo_owner, site.repo_name, srcPath, site.default_branch, token);
    const rawContent = Buffer.from(fileData.content, 'base64').toString('utf8');

    const newSha = await upsertFile(site.repo_owner, site.repo_name, archivePath, rawContent, `post: archive ${filename}`, null, site.default_branch, token);
    try {
      await deleteFile(site.repo_owner, site.repo_name, srcPath, `post: remove from ${srcPath.split('/')[0]} ${filename}`, sha, site.default_branch, token);
    } catch { /* ignore */ }

    logAudit(site.id, 'archive', archivePath, newSha);
    res.json({ ok: true, path: archivePath, sha: newSha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /api/sites/:siteId/posts/:encodedPath
router.delete('/:siteId/posts/:encodedPath', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const filePath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required for delete' });
    const filename = filePath.split('/').pop();
    await deleteFile(site.repo_owner, site.repo_name, filePath, `post: delete ${filename}`, sha, site.default_branch, token);
    logAudit(site.id, 'delete', filePath, null);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function logAudit(siteId, action, filePath, commitSha) {
  try {
    const db = getDb();
    db.prepare('INSERT INTO audit_log (id, site_id, action, file_path, commit_sha) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), siteId, action, filePath, commitSha);
  } catch { /* non-critical */ }
}

module.exports = router;
