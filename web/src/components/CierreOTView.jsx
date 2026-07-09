import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { writePreCompraPdfTab } from "../utils/pdf";

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string") return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return String(value);
}

function hasLaborPrice(ot) {
  const hasMechanicalPrice = String(ot?.ValorCobrar || "").trim() !== "";
  const hasAlignmentPrice = !ot?.RequiereAlineacionBalanceo || String(ot?.ValorAlineacionBalanceo || "").trim() !== "";
  return hasMechanicalPrice && hasAlignmentPrice;
}

function CobroBadge({ cobrado }) {
  return (
    <span className={`payment-status-badge ${cobrado ? "paid" : "pending"}`}>
      {cobrado ? "Cobrado" : "Pendiente de cobro"}
    </span>
  );
}

function LaborPriceBadge({ hasPrice }) {
  return (
    <span className={`payment-status-badge ${hasPrice ? "paid" : "pending"}`}>
      {hasPrice ? "Precio colocado" : "Falta precio mano de obra"}
    </span>
  );
}

export default function CierreOTView({ api }) {
  const [search, setSearch] = useState("");
  const [ordenes, setOrdenes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [valorCobrar, setValorCobrar] = useState("");
  const [valorAlineacionBalanceo, setValorAlineacionBalanceo] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

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
      setPage(1);
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
      setValorAlineacionBalanceo(res.data.ot?.ValorAlineacionBalanceo || "");
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar el cierre de la OT.");
    } finally {
      setLoading(false);
    }
  };

  const guardarCobro = async () => {
    if (!selected?.ID) return;

    if (selected.Cobrado) {
      setError("Esta OT ya fue cobrada y no se puede editar el valor de mano de obra.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await axios.patch(`${api}/api/ot/${selected.ID}/cobro`, {
        ValorCobrar: valorCobrar,
        ValorAlineacionBalanceo: valorAlineacionBalanceo
      });
      alert("Valor de mano de obra guardado.");
      setSelected(null);
      setDetalle([]);
      setValorCobrar("");
      setValorAlineacionBalanceo("");
      await cargarFinalizadas();
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo guardar el valor de mano de obra.");
    } finally {
      setSaving(false);
    }
  };


  const imprimirInformePreCompra = () => {
    if (!selected?.RequiereChequeoPreCompra) return;

    const pdfTab = window.open("", "_blank");
    if (pdfTab) {
      pdfTab.document.write("<p style='font-family: Arial, sans-serif'>Preparando informe pre compra...</p>");
    }

    writePreCompraPdfTab(pdfTab, {
      otId: selected.ID,
      fecha: formatDate(selected.FechaEntrega || selected.FechaRecepcion) || new Date().toLocaleString(),
      cabecera: selected
    });
  };
  const pageSize = 5;
  const orderedOrdenes = useMemo(() => {
    return [...ordenes].sort((a, b) => Number(hasLaborPrice(a)) - Number(hasLaborPrice(b)));
  }, [ordenes]);
  const totalPages = Math.max(1, Math.ceil(orderedOrdenes.length / pageSize));
  const visibleOrdenes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return orderedOrdenes.slice(start, start + pageSize);
  }, [orderedOrdenes, page]);
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
          {visibleOrdenes.map((ot) => (
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
                <LaborPriceBadge hasPrice={hasLaborPrice(ot)} />
                <CobroBadge cobrado={Boolean(ot.Cobrado)} />
                <small>{formatDate(ot.FechaEntrega) || formatDate(ot.FechaRecepcion)}</small>
              </span>
            </button>
          ))}
          {ordenes.length > pageSize ? (
            <div className="ot-pagination">
              <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1}>
                Anterior
              </button>
              <span>Pagina {page} de {totalPages} / {ordenes.length} OT</span>
              <button type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page === totalPages}>
                Siguiente
              </button>
            </div>
          ) : null}
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
                  <LaborPriceBadge hasPrice={hasLaborPrice(selected)} />
                  <CobroBadge cobrado={Boolean(selected.Cobrado)} />
                  {selected.Cobrado ? <small>No editable</small> : null}
                </div>
              </div>

              <div className="read-grid">
                <span>CL</span>
                <strong>{selected.CL || "-"}</strong>
                <span>Teléfonos</span>
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

                            {selected.RequiereAlineacionBalanceo ? (
                <>
                  <h4>Detalle de alineación y balanceo</h4>
                  <p className="notes-preview">
                    {selected.TrabajoAlineacionBalanceo || "Sin detalle de alineación y balanceo."}
                  </p>
                </>
              ) : null}

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
                <div className="form-grid">
                  <label className="field">
                    <span>Mano de obra mecanica</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      readOnly={Boolean(selected.Cobrado)}
                      value={valorCobrar}
                      onChange={(event) => setValorCobrar(event.target.value)}
                    />
                  </label>
                  {selected.RequiereAlineacionBalanceo ? (
                    <label className="field">
                      <span>Alineacion y balanceo</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        readOnly={Boolean(selected.Cobrado)}
                        value={valorAlineacionBalanceo}
                        onChange={(event) => setValorAlineacionBalanceo(event.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="workshop-actions cobranza-actions">
                  {selected.RequiereChequeoPreCompra ? (
                    <button className="secondary-button" type="button" onClick={imprimirInformePreCompra}>
                      Generar informe pre compra
                    </button>
                  ) : null}
                  {selected.Cobrado ? (
                    <button className="paid-lock-button" type="button" disabled>
                      Cobrado
                    </button>
                  ) : (
                    <button className="primary-button" type="button" onClick={guardarCobro} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar valores"}
                    </button>
                  )}
                </div>
                {selected.Cobrado ? (
                  <p className="empty-state workshop-empty">
                    Esta OT ya fue cobrada por cobranza. El valor de mano de obra queda bloqueado.
                  </p>
                ) : null}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
