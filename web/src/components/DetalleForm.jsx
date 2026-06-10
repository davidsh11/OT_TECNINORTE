export default function DetalleForm({
  detalle,
  nuevoTrabajo,
  nuevoRepuesto,
  onNuevoTrabajoChange,
  onNuevoRepuestoChange,
  onAgregarTrabajo,
  onAgregarRepuesto,
  onQuitarDetalle
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Detalle</p>
          <h2>Trabajos y repuestos</h2>
        </div>
      </div>

      <div className="detail-entry">
        <div className="entry-row">
          <input
            placeholder="Descripcion del trabajo"
            value={nuevoTrabajo}
            onChange={(event) => onNuevoTrabajoChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onAgregarTrabajo()}
          />
          <button type="button" onClick={onAgregarTrabajo}>
            Agregar trabajo
          </button>
        </div>

        <div className="entry-row">
          <input
            placeholder="Descripcion del repuesto"
            value={nuevoRepuesto.desc}
            onChange={(event) =>
              onNuevoRepuestoChange((current) => ({ ...current, desc: event.target.value }))
            }
            onKeyDown={(event) => event.key === "Enter" && onAgregarRepuesto()}
          />
          <input
            className="qty-input"
            type="number"
            min="1"
            value={nuevoRepuesto.cant}
            onChange={(event) =>
              onNuevoRepuestoChange((current) => ({ ...current, cant: event.target.value }))
            }
          />
          <button type="button" onClick={onAgregarRepuesto}>
            Agregar repuesto
          </button>
        </div>
      </div>

      <div className="detail-list">
        {detalle.length === 0 ? (
          <p className="empty-state">Aun no hay trabajos ni repuestos agregados.</p>
        ) : (
          detalle.map((item, index) => (
            <div className="detail-item" key={`${item.Tipo}-${item.Descripcion}-${index}`}>
              <span className="type-pill">{item.Tipo}</span>
              <strong>{item.Descripcion}</strong>
              <span className="quantity">
                {item.Tipo === "REPUESTO" ? `Cant. ${item.Cantidad}` : "Servicio"}
              </span>
              <button
                className="ghost-button"
                type="button"
                onClick={() => onQuitarDetalle(index)}
                aria-label={`Quitar ${item.Descripcion}`}
              >
                Quitar
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
