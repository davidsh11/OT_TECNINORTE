function EvidenceCapture({ label, file, onChange }) {
  return (
    <label className="upload-box camera-capture-box">
      <span>{label}</span>
      <strong>Tomar foto</strong>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <small>{file?.name || "Foto pendiente"}</small>
    </label>
  );
}

export default function EvidenciasForm({ ev1, ev2, onEv1Change, onEv2Change }) {
  return (
    <article className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Evidencias</p>
          <h2>Fotos de respaldo</h2>
        </div>
      </div>
      <div className="evidence-grid">
        <EvidenceCapture label="Evidencia 1" file={ev1} onChange={onEv1Change} />
        <EvidenceCapture label="Evidencia 2" file={ev2} onChange={onEv2Change} />
      </div>
    </article>
  );
}
