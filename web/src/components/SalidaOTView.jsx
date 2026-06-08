import { useEffect, useState } from "react";
import axios from "axios";

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string") return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return String(value);
}

export default function SalidaOTView({ api }) {
  const [search, setSearch] = useState("");
  const [ordenes, setOrdenes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cargarCobradas = async (term = search) => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot`, {
        params: {
          search: term.trim() || undefined,
          pendingExit: true,
          limit: 100
        }
      });
      setOrdenes(res.data.ordenes || []);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudieron cargar las OT cobradas.");
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
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar la OT para salida.");
    } finally {
      setLoading(false);
    }
  };

  const autorizarSalida = async () => {
    if (!selected?.ID) return;

    try {
      setSaving(true);
      setError("");
      await axios.patch(`${api}/api/ot/${selected.ID}/salida`);
      alert("Salida del vehiculo autorizada.");
      setSelected(null);
      await cargarCobradas();
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo autorizar la salida del vehiculo.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    cargarCobradas("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="panel search-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Recepcion</p>
          <h2>Salida de vehiculos cobrados</h2>
        </div>
      </div>

      <div className="search-tools">
        <input
          placeholder="Buscar cobradas por ID, cliente, cedula/RUC o placa"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && cargarCobradas()}
        />
        <button type="button" onClick={() => cargarCobradas()} disabled={loading}>
          Buscar
        </button>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="ot-browser">
        <div className="ot-list">
          {loading && ordenes.length === 0 ? <p className="empty-state">Cargando OT cobradas...</p> : null}
          {!loading && ordenes.length === 0 ? (
            <p className="empty-state">No hay OT cobradas pendientes de salida.</p>
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
                <small>Cobrado: {formatDate(ot.FechaCobro) || "Si"}</small>
              </span>
              <span>
                <strong>{ot.Placa || "Sin placa"}</strong>
                <small>Listo para salida</small>
              </span>
            </button>
          ))}
        </div>

        <div className="ot-detail">
          {!selected ? (
            <p className="empty-state">Seleccione una OT cobrada para autorizar la salida.</p>
          ) : (
            <>
              <div className="ot-detail-header">
                <div>
                  <p className="eyebrow">OT {selected.ID}</p>
                  <h3>{selected.Propietario || "Sin propietario"}</h3>
                </div>
                <div className="ot-detail-actions">
                  <strong>Cobrado</strong>
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
                <span>Fecha cobro</span>
                <strong>{formatDate(selected.FechaCobro) || "-"}</strong>
              </div>

              <h4>Observaciones</h4>
              <p className="notes-preview">{selected.Observaciones || "Sin observaciones."}</p>

              <div className="workshop-actions">
                <span>Confirme la salida solo cuando el vehiculo se entregue al cliente.</span>
                <button className="primary-button" type="button" onClick={autorizarSalida} disabled={saving}>
                  {saving ? "Guardando..." : "Autorizar salida"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
