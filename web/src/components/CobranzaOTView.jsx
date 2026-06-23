import { useEffect, useState } from "react";
import axios from "axios";

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string") return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return String(value);
}

function moneyValue(value) {
  return Number(value || 0);
}

export default function CobranzaOTView({ api }) {
  const [search, setSearch] = useState("");
  const [ordenes, setOrdenes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [valorRepuestos, setValorRepuestos] = useState("");
  const [esEmpresa, setEsEmpresa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cargarPendientes = async (term = search) => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot`, {
        params: {
          search: term.trim() || undefined,
          chargeReady: true,
          limit: 100
        }
      });
      setOrdenes(res.data.ordenes || []);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudieron cargar las OT pendientes de cobro.");
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
      setValorRepuestos(res.data.ot?.ValorRepuestos || "");
      setEsEmpresa(Boolean(res.data.ot?.EsEmpresa));
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar la OT para cobranza.");
    } finally {
      setLoading(false);
    }
  };

  const registrarPago = async (pagoPendienteEmpresa = false) => {
    if (!selected?.ID) return;

    if (pagoPendienteEmpresa && !esEmpresa) {
      alert("Solo puede dejar pago pendiente cuando la OT pertenece a una empresa.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await axios.patch(`${api}/api/ot/${selected.ID}/pago`, {
        ValorRepuestos: valorRepuestos,
        EsEmpresa: esEmpresa,
        PagoPendienteEmpresa: pagoPendienteEmpresa
      });
      alert(pagoPendienteEmpresa ? "OT marcada como empresa con pago pendiente." : "OT marcada como cobrada.");
      setSelected(null);
      setDetalle([]);
      setValorRepuestos("");
      setEsEmpresa(false);
      await cargarPendientes();
    } catch (requestError) {
      console.error(requestError);
      setError(pagoPendienteEmpresa ? "No se pudo dejar el pago pendiente para empresa." : "No se pudo marcar la OT como cobrada.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    cargarPendientes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="panel search-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cobranza</p>
          <h2>OT pendientes de cobro</h2>
        </div>
      </div>

      <div className="search-tools">
        <input
          placeholder="Buscar por ID, cliente, cedula/RUC o placa"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && cargarPendientes()}
        />
        <button type="button" onClick={() => cargarPendientes()} disabled={loading}>
          Buscar
        </button>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="ot-browser">
        <div className="ot-list">
          {loading && ordenes.length === 0 ? <p className="empty-state">Cargando OT...</p> : null}
          {!loading && ordenes.length === 0 ? (
            <p className="empty-state">No hay OT pendientes de cobro.</p>
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
                <small>CL: {ot.CL || "-"}</small>
              </span>
              <span>
                <strong>${moneyValue(ot.ValorCobrar) + moneyValue(ot.ValorRepuestos)}</strong>
                <small>{ot.Placa || "Sin placa"}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="ot-detail">
          {!selected ? (
            <p className="empty-state">Seleccione una OT para ver el detalle y marcar cobrado.</p>
          ) : (
            <>
              <div className="ot-detail-header">
                <div>
                  <p className="eyebrow">OT {selected.ID}</p>
                  <h3>{selected.Propietario || "Sin propietario"}</h3>
                </div>
                <div className="ot-detail-actions">
                  <strong>${moneyValue(selected.ValorCobrar) + moneyValue(valorRepuestos)}</strong>
                  <small>Total OT</small>
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
                <span>Entrega</span>
                <strong>{formatDate(selected.FechaEntrega) || "-"}</strong>
                <span>Mecanico</span>
                <strong>{selected.MecanicoResponsable || "-"}</strong>
                <span>Mano de obra</span>
                <strong>${selected.ValorCobrar || "0.00"}</strong>
                <span>Valor repuestos</span>
                <strong>${valorRepuestos || "0.00"}</strong>
                <span>Total a cobrar</span>
                <strong>${moneyValue(selected.ValorCobrar) + moneyValue(valorRepuestos)}</strong>
              </div>

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
                    <p className="eyebrow">Valores</p>
                    <h2>Valor de repuestos</h2>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Total de repuestos</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={valorRepuestos}
                      onChange={(event) => setValorRepuestos(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Mano de obra calculada</span>
                    <input
                      readOnly
                      value={Number(selected.ValorCobrar || 0).toFixed(2)}
                    />
                  </label>
                </div>
                <label className="company-payment-toggle">
                  <input
                    type="checkbox"
                    checked={esEmpresa}
                    onChange={(event) => setEsEmpresa(event.target.checked)}
                  />
                  <span>Es empresa</span>
                  <small>Permite dejar el pago pendiente y habilitar salida.</small>
                </label>
              </section>

              <div className="workshop-actions cobranza-actions">
                <span>
                  Si no es empresa, debe marcarse como cobrado para autorizar salida. Si es empresa, puede quedar pendiente.
                </span>
                <div className="payment-action-buttons">
                  <button className="secondary-button" type="button" onClick={() => registrarPago(true)} disabled={saving || !esEmpresa}>
                    {saving ? "Guardando..." : "Dejar pendiente empresa"}
                  </button>
                  <button className="primary-button" type="button" onClick={() => registrarPago(false)} disabled={saving}>
                    {saving ? "Guardando..." : "Marcar cobrado"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
