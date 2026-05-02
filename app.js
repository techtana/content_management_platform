const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initDb } = require('./config/db');

dotenv.config({ path: './config/config.env' });

initDb();

const app = express();

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// API routes
app.use('/api/setup', require('./routes/api/setup'));
app.use('/api/me', require('./routes/api/me'));
app.use('/api/repos', require('./routes/api/repos'));
app.use('/api/sites', require('./routes/api/sites'));
app.use('/api/sites', require('./routes/api/content'));
app.use('/api/ai', require('./routes/api/ai'));
app.use('/api/notebook', require('./routes/api/notebook'));

// Serve React SPA (Vite build output)
const clientDist = path.join(__dirname, 'public');
app.use(express.static(clientDist));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.CMS_PORT || process.env.PORT || 3000;
const BIND = process.env.CMS_BIND || '127.0.0.1';

app.listen(PORT, BIND, () => {
  console.log(`CMS running at http://${BIND}:${PORT}`);
});
