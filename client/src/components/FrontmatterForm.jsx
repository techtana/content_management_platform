import { useState, useEffect } from 'react';

function ArrayInput({ fieldKey, value, onChange }) {
  const toDisplay = (v) => (Array.isArray(v) ? v.join(', ') : (v || ''));
  const [raw, setRaw] = useState(() => toDisplay(value));

  // Sync inbound value changes (e.g. defaults loaded after mount) without
  // overwriting what the user is actively typing.
  useEffect(() => {
    setRaw(toDisplay(value));
  }, [JSON.stringify(value)]);

  function handleChange(e) {
    setRaw(e.target.value);
  }

  function handleBlur() {
    const parsed = raw.split(',').map(t => t.trim()).filter(Boolean);
    onChange(parsed);
    // Normalise display so "tag1," becomes "tag1" after blur
    setRaw(parsed.join(', '));
  }

  return (
    <input
      className="form-input"
      value={raw}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="Comma-separated values"
    />
  );
}

export default function FrontmatterForm({ fields, values, onChange }) {
  function set(key, val) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div>
      {fields.map(field => (
        <div className="form-group" key={field.key}>
          <label className="form-label">
            {field.label}
            {field.required && <span style={{ color: 'var(--danger)' }}> *</span>}
          </label>
          {field.type === 'array' ? (
            <ArrayInput
              fieldKey={field.key}
              value={values[field.key]}
              onChange={val => set(field.key, val)}
            />
          ) : field.type === 'select' ? (
            <select className="form-select" value={values[field.key] || ''} onChange={e => set(field.key, e.target.value)}>
              <option value="">— select —</option>
              {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              className="form-input"
              type={field.type === 'date' ? 'date' : 'text'}
              value={values[field.key] ?? (field.default || '')}
              onChange={e => set(field.key, e.target.value)}
              placeholder={field.default || ''}
            />
          )}
        </div>
      ))}
    </div>
  );
}
