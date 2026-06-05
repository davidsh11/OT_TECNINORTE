import { useEffect, useState } from "react";
import axios from "axios";

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string") return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return String(value);
}

export default function CierreOTView({ api }) {
  const [search, setSearch] = useState("");
  const [ordenes, setOrdenes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [valorCobrar, setValorCobrar] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cargarFinalizadas = async (term = search) => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot`, {
        params: {
          search: term.trim() || undefined,
          completed: true,
          limit: 100
        }
      });
      setOrdenes(res.data.ordenes || []);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudieron cargar las OT finalizadas.");
    } finally {
      setLoading(false);
    }
  };

  const cargarDetalle = async (otId) => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot/${otId}`);
      setSelected(res.data.ot);
      setDetalle(res.data.detalle || []);
      setValorCobrar(res.data.ot?.ValorCobrar || "");
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar el cierre de la OT.");
    } finally {
      setLoading(false);
    }
  };

  const guardarCobro = async () => {
    if (!selected?.ID) return;

    try {
      setSaving(true);
      setError("");
      await axios.patch(`${api}/api/ot/${selected.ID}/cobro`, { ValorCobrar: valorCobrar });
      setSelected((current) => ({ ...current, ValorCobrar: valorCobrar }));
      alert("Valor de mano de obra guardado.");
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo guardar el valor de mano de obra.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    cargarFinalizadas("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="panel search-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cierre</p>
          <h2>OT finalizadas para cobro</h2>
        </div>
      </div>

      <div className="search-tools">
        <input
          placeholder="Buscar finalizadas por ID, cliente, cedula/RUC o placa"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && cargarFinalizadas()}
        />
        <button type="button" onClick={() => cargarFinalizadas()} disabled={loading}>
          Buscar
        </button>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="ot-browser">
        <div className="ot-list">
          {loading && ordenes.length === 0 ? <p className="empty-state">Cargando OT finalizadas...</p> : null}
          {!loading && ordenes.length === 0 ? (
            <p className="empty-state">No hay OT finalizadas para mostrar.</p>
          ) : null}
          {ordenes.map((ot) => (
            <button
              className={`ot-row ${selected?.ID === ot.ID ? "active" : ""}`}
              type="button"
              key={ot.ID}
              onClick={() => cargarDetalle(ot.ID)}
            >
              <span>
                <strong>{ot.ID}</strong>
                <small>{ot.Propietario || "Sin propietario"}</small>
                <small>Mecanico: {ot.MecanicoResponsable || "-"}</small>
              </span>
              <span>
                <strong>{ot.Placa || "Sin placa"}</strong>
                <small>{formatDate(ot.FechaEntrega) || formatDate(ot.FechaRecepcion)}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="ot-detail">
          {!selected ? (
            <p className="empty-state">Seleccione una OT finalizada para revisar el trabajo y cobrar.</p>
          ) : (
            <>
              <div className="ot-detail-header">
                <div>
                  <p className="eyebrow">OT {selected.ID}</p>
                  <h3>{selected.Propietario || "Sin propietario"}</h3>
                </div>
                <div className="ot-detail-actions">
                  <strong>{selected.Estado || "Finalizada"}</strong>
                </div>
              </div>

              <div className="read-grid">
                <span>CL</span>
                <strong>{selected.CL || "-"}</strong>
                <span>Telefonos</span>
                <strong>{selected.Telefonos || "-"}</strong>
                <span>Vehiculo</span>
                <strong>
                  {[selected.Marca, selected.Modelo, selected.Color].filter(Boolean).join(" ") || "-"}
                </strong>
                <span>Placa</span>
                <strong>{selected.Placa || "-"}</strong>
                <span>Recepcion</span>
                <strong>{formatDate(selected.FechaRecepcion) || "-"}</strong>
                <span>Entrega</span>
                <strong>{formatDate(selected.FechaEntrega) || "-"}</strong>
                <span>Mecanico</span>
                <strong>{selected.MecanicoResponsable || "-"}</strong>
              </div>

              <h4>Observaciones</h4>
              <p className="notes-preview">{selected.Observaciones || "Sin observaciones."}</p>

              <h4>Repuestos usados</h4>
              <p className="notes-preview">{selected.RepuestosUsados || "Sin repuestos registrados."}</p>

              <h4>Detalle completo del trabajo</h4>
              <p className="notes-preview">
                {selected.TrabajoRealizado || "Sin detalle de trabajo realizado."}
              </p>

              <h4>Detalle inicial registrado</h4>
              <div className="consult-detail-list">
                {detalle.length === 0 ? (
                  <p className="empty-state">Sin trabajos ni repuestos registrados.</p>
                ) : (
                  detalle.map((item) => (
                    <div className="consult-detail-item" key={item.ID}>
                      <span className="type-pill">{item.Tipo}</span>
                      <strong>{item.Descripcion}</strong>
                      <span>{item.Cantidad || ""}</span>
                    </div>
                  ))
                )}
              </div>

              <section className="panel charge-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Cobro</p>
                    <h2>Valor mano de obra</h2>
                  </div>
                </div>
                <div className="search-tools">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={valorCobrar}
                    onChange={(event) => setValorCobrar(event.target.value)}
                  />
                  <button className="primary-button" type="button" onClick={guardarCobro} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar mano de obra"}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
