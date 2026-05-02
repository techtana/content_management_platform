const express = require('express');
const router = express.Router();
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const { convertNotebook } = require('../../services/notebook');

router.use(ensureApiAuth);

router.post('/convert', express.text({ type: 'application/json', limit: '50mb' }), (req, res) => {
  try {
    const ipynbContent = req.body;
    if (!ipynbContent) return res.status(400).json({ error: 'Request body must be the .ipynb JSON content' });
    const result = convertNotebook(ipynbContent);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'Failed to parse notebook: ' + err.message });
  }
});

module.exports = router;
