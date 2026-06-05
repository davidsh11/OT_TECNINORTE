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
        <label className="upload-box">
          <span>Evidencia 1</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onEv1Change(event.target.files?.[0] || null)}
          />
          <small>{ev1?.name || "Sin archivo seleccionado"}</small>
        </label>
        <label className="upload-box">
          <span>Evidencia 2</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onEv2Change(event.target.files?.[0] || null)}
          />
          <small>{ev2?.name || "Sin archivo seleccionado"}</small>
        </label>
      </div>
    </article>
  );
}
