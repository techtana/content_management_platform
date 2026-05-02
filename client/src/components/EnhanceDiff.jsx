export default function EnhanceDiff({ original, enhanced, onAccept, onReject }) {
  return (
    <div>
      <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>AI Enhancement Result</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div>
          <div className="text-muted" style={{ marginBottom: '0.25rem' }}>Original</div>
          <div className="diff-view">{original}</div>
        </div>
        <div>
          <div className="text-muted" style={{ marginBottom: '0.25rem' }}>Enhanced</div>
          <div className="diff-view">{enhanced}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={onAccept}>Accept Enhanced</button>
        <button className="btn btn-secondary" onClick={onReject}>Keep Original</button>
      </div>
    </div>
  );
}
