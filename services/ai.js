const { getDb } = require('../config/db');
const { decrypt } = require('./crypto');

async function getProvider(id) {
  const db = getDb();
  const row = id
    ? db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM ai_providers WHERE is_default = 1').get();
  if (!row) throw new Error('AI provider not found');
  return { ...row, api_key: row.api_key ? decrypt(row.api_key) : null };
}

async function listModels(provider) {
  if (provider.provider_type === 'anthropic') {
    return ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
  }

  const modelsUrl = provider.provider_type === 'ollama'
    ? provider.base_url.replace('/v1', '') + '/api/tags'
    : provider.base_url + '/models';

  const headers = {};
  if (provider.api_key) headers['Authorization'] = `Bearer ${provider.api_key}`;

  const res = await fetch(modelsUrl, { headers });
  if (!res.ok) throw new Error(`Model list failed: ${res.status}`);
  const data = await res.json();

  if (provider.provider_type === 'ollama') {
    return (data.models || []).map(m => m.name);
  }
  return (data.data || []).map(m => m.id);
}

async function enhance(content, policy, providerId) {
  const provider = await getProvider(providerId);

  const systemPrompt = policy
    ? `You are a writing assistant. Follow these instructions:\n${policy}`
    : 'You are a writing assistant. Improve the clarity, structure, and style of the content while preserving the author\'s voice.';

  const start = Date.now();

  if (provider.provider_type === 'anthropic') {
    return enhanceAnthropic(provider, systemPrompt, content, start);
  }
  return enhanceOpenAICompat(provider, systemPrompt, content, start);
}

async function enhanceOpenAICompat(provider, systemPrompt, content, start) {
  const headers = { 'Content-Type': 'application/json' };
  if (provider.api_key) headers['Authorization'] = `Bearer ${provider.api_key}`;

  const res = await fetch(`${provider.base_url}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.default_model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    enhanced: data.choices[0].message.content,
    model: data.model,
    latencyMs: Date.now() - start,
  };
}

async function enhanceAnthropic(provider, systemPrompt, content, start) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.api_key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: provider.default_model || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    enhanced: data.content[0].text,
    model: data.model,
    latencyMs: Date.now() - start,
  };
}

async function testProvider(provider) {
  const start = Date.now();
  const models = await listModels(provider);
  return { ok: true, latencyMs: Date.now() - start, modelsFound: models.length };
}

module.exports = { getProvider, listModels, enhance, testProvider };
