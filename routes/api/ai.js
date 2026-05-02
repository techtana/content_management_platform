const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../config/db');
const { encrypt } = require('../../services/crypto');
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const aiService = require('../../services/ai');

router.use(ensureApiAuth);

router.get('/providers', (req, res) => {
  const db = getDb();
  const providers = db.prepare('SELECT id, display_name, provider_type, base_url, default_model, is_default, created_at FROM ai_providers ORDER BY created_at').all();
  res.json(providers);
});

router.post(
  '/providers',
  [body('display_name').notEmpty(), body('provider_type').notEmpty(), body('base_url').notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = getDb();
    const { display_name, provider_type, base_url, api_key, default_model, is_default } = req.body;
    const id = uuidv4();
    if (is_default) db.prepare('UPDATE ai_providers SET is_default = 0').run();
    db.prepare(`
      INSERT INTO ai_providers (id, display_name, provider_type, base_url, api_key, default_model, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, display_name, provider_type, base_url, api_key ? encrypt(api_key) : null, default_model || null, is_default ? 1 : 0);
    res.status(201).json({ id });
  }
);

router.put('/providers/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  const { display_name, provider_type, base_url, api_key, default_model, is_default } = req.body;
  if (is_default) db.prepare('UPDATE ai_providers SET is_default = 0').run();
  db.prepare(`
    UPDATE ai_providers SET display_name=?, provider_type=?, base_url=?, api_key=?, default_model=?, is_default=? WHERE id=?
  `).run(
    display_name || existing.display_name,
    provider_type || existing.provider_type,
    base_url || existing.base_url,
    api_key ? encrypt(api_key) : existing.api_key,
    default_model || existing.default_model,
    is_default ? 1 : 0,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/providers/:id', (req, res) => {
  const db = getDb();
  const changes = db.prepare('DELETE FROM ai_providers WHERE id = ?').run(req.params.id).changes;
  if (!changes) return res.status(404).json({ error: 'Provider not found' });
  res.json({ ok: true });
});

router.get('/providers/:id/models', async (req, res) => {
  try {
    const provider = await aiService.getProvider(req.params.id);
    const models = await aiService.listModels(provider);
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/providers/:id/test', async (req, res) => {
  try {
    const provider = await aiService.getProvider(req.params.id);
    const result = await aiService.testProvider(provider);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/enhance',
  [body('content').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { content, instruction, providerId } = req.body;
      const result = await aiService.enhance(content, instruction || null, providerId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Instructions CRUD
router.get('/instructions', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM ai_instructions ORDER BY created_at').all());
});

router.post(
  '/instructions',
  [body('name').notEmpty(), body('instruction').notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO ai_instructions (id, name, instruction) VALUES (?, ?, ?)').run(id, req.body.name.trim(), req.body.instruction.trim());
    res.status(201).json({ id });
  }
);

router.put('/instructions/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM ai_instructions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Instruction not found' });
  const { name, instruction } = req.body;
  db.prepare('UPDATE ai_instructions SET name=?, instruction=? WHERE id=?').run(
    name?.trim() || existing.name,
    instruction?.trim() || existing.instruction,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/instructions/:id', (req, res) => {
  const db = getDb();
  const changes = db.prepare('DELETE FROM ai_instructions WHERE id = ?').run(req.params.id).changes;
  if (!changes) return res.status(404).json({ error: 'Instruction not found' });
  res.json({ ok: true });
});

module.exports = router;
