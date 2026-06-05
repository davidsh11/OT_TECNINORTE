export default function ObservacionesForm({ value, onChange }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Diagnostico</p>
          <h2>Observaciones</h2>
        </div>
      </div>
      <label className="field">
        <span>Notas recibidas</span>
        <textarea
          rows="4"
          value={value}
          onChange={(event) => onChange("Observaciones", event.target.value)}
        />
      </label>
    </section>
  );
}
