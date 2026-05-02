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
            <input
              className="form-input"
              value={Array.isArray(values[field.key]) ? values[field.key].join(', ') : (values[field.key] || '')}
              onChange={e => set(field.key, e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              placeholder="Comma-separated values"
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
