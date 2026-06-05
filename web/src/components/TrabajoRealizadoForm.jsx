export default function TrabajoRealizadoForm({ cabecera, onChange, lockMechanic = false }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Entrega</p>
          <h2>Trabajo realizado</h2>
        </div>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Mecanico responsable</span>
          <input
            value={cabecera.MecanicoResponsable}
            readOnly={lockMechanic}
            aria-readonly={lockMechanic}
            onChange={(event) => onChange("MecanicoResponsable", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Fecha y hora de entrega</span>
          <input
            type="datetime-local"
            required
            value={cabecera.FechaEntrega}
            onChange={(event) => onChange("FechaEntrega", event.target.value)}
          />
        </label>
      </div>

      <div className="form-grid textarea-grid">
        <label className="field">
          <span>Repuestos usados</span>
          <textarea
            rows="5"
            value={cabecera.RepuestosUsados}
            onChange={(event) => onChange("RepuestosUsados", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Detalle completo del trabajo</span>
          <textarea
            rows="5"
            required
            value={cabecera.TrabajoRealizado}
            onChange={(event) => onChange("TrabajoRealizado", event.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
