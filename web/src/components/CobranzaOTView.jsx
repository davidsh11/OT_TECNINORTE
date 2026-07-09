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

function firstMoneyValue(...values) {
  const value = values.find((item) => item !== undefined && item !== null && item !== "");
  return value === undefined ? null : moneyValue(value);
}

function formatMoney(value) {
  return moneyValue(value).toFixed(2);
}

function totalOtValue(ot, valorRepuestosOverride) {
  const apiTotal = valorRepuestosOverride === undefined ? firstMoneyValue(ot?.ValorTotal) : null;
  if (apiTotal !== null) return apiTotal;

  return moneyValue(ot?.ValorCobrar) + moneyValue(valorRepuestosOverride ?? ot?.ValorRepuestos) + moneyValue(ot?.ValorAlineacionBalanceo);
}

function pendingOtValue(ot, totalOverride) {
  const total = totalOverride ?? totalOtValue(ot);
  const apiPending = firstMoneyValue(ot?.ValorPendienteCobro, ot?.SaldoPendiente);

  if (apiPending !== null && (ot?.PagoParcialPendiente || ot?.PagoPendienteEmpresa)) return apiPending;
  if (ot?.PagoParcialPendiente) return Math.max(total - moneyValue(ot?.ValorAbonado), 0);
  if (ot?.PagoPendienteEmpresa) return total;

  return ot?.Cobrado ? 0 : total;
}
export default function CobranzaOTView({ api }) {
  const [search, setSearch] = useState("");
  const [ordenes, setOrdenes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [valorRepuestos, setValorRepuestos] = useState("");
  const [valorAlineacionBalanceo, setValorAlineacionBalanceo] = useState("");
  const [valorAbonado, setValorAbonado] = useState("");
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
      setValorAlineacionBalanceo(res.data.ot?.ValorAlineacionBalanceo || "");
      setValorAbonado(res.data.ot?.ValorAbonado || "");
      setEsEmpresa(Boolean(res.data.ot?.EsEmpresa));
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar la OT para cobranza.");
    } finally {
      setLoading(false);
    }
  };

  const registrarPago = async (tipoPago = "total") => {
    if (!selected?.ID) return;

    const pagoPendienteEmpresa = tipoPago === "empresa";
    const pagoParcialPendiente = tipoPago === "parcial";
    const totalOt = moneyValue(selected.ValorCobrar) + moneyValue(valorRepuestos) + moneyValue(valorAlineacionBalanceo);
    const abono = moneyValue(valorAbonado);

    if (pagoPendienteEmpresa && !esEmpresa) {
      alert("Solo puede dejar pago pendiente de empresa cuando la OT pertenece a una empresa.");
      return;
    }

    if (pagoParcialPendiente && (abono <= 0 || abono >= totalOt)) {
      alert("Para pago parcial, ingrese un abono mayor a 0 y menor al total de la OT.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await axios.patch(`${api}/api/ot/${selected.ID}/pago`, {
        ValorRepuestos: valorRepuestos,
        ValorAbonado: pagoParcialPendiente ? valorAbonado : "",
        EsEmpresa: esEmpresa,
        PagoPendienteEmpresa: pagoPendienteEmpresa,
        PagoParcialPendiente: pagoParcialPendiente
      });

      const message = pagoParcialPendiente
        ? "OT marcada con pago parcial pendiente y habilitada para salida."
        : pagoPendienteEmpresa
          ? "OT marcada como empresa con pago pendiente."
          : "OT marcada como cobrada.";
      alert(message);
      setSelected(null);
      setDetalle([]);
      setValorRepuestos("");
      setValorAlineacionBalanceo("");
      setValorAbonado("");
      setEsEmpresa(false);
      await cargarPendientes();
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo registrar el estado de pago de la OT.");
    } finally {
      setSaving(false);
    }
  };

  const selectedWithLiveValues = selected
    ? { ...selected, ValorRepuestos: valorRepuestos, ValorAlineacionBalanceo: valorAlineacionBalanceo }
    : null;
  const totalSeleccionado = selectedWithLiveValues ? totalOtValue(selectedWithLiveValues, valorRepuestos) : 0;
  const saldoParcial = Math.max(totalSeleccionado - moneyValue(valorAbonado), 0);
  const saldoPendienteSeleccionado = selected?.PagoParcialPendiente || selected?.PagoPendienteEmpresa
    ? pendingOtValue({ ...selectedWithLiveValues, ValorAbonado: valorAbonado }, totalSeleccionado)
    : saldoParcial;
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
          {ordenes.map((ot) => {
            const totalOt = totalOtValue(ot);
            const saldoPendiente = pendingOtValue(ot, totalOt);

            return (
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
                  <strong>Total: ${formatMoney(totalOt)}</strong>
                  <small>Saldo pendiente: ${formatMoney(saldoPendiente)}</small>
                  <small>{ot.Placa || "Sin placa"}</small>
                </span>
              </button>
            );
          })}
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
                  <strong>${formatMoney(totalSeleccionado)}</strong>
                  <small>Total OT</small>
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
                <span>Entrega</span>
                <strong>{formatDate(selected.FechaEntrega) || "-"}</strong>
                <span>Mecanico</span>
                <strong>{selected.MecanicoResponsable || "-"}</strong>
                <span>Mano de obra</span>
                <strong>${selected.ValorCobrar || "0.00"}</strong>
                {selected.RequiereAlineacionBalanceo ? (
                  <>
                    <span>Alineacion y balanceo</span>
                    <strong>${selected.ValorAlineacionBalanceo || "0.00"}</strong>
                  </>
                ) : null}
                <span>Valor repuestos</span>
                <strong>${valorRepuestos || "0.00"}</strong>
                <span>Total a cobrar</span>
                <strong>${formatMoney(totalSeleccionado)}</strong>
                <span>Saldo pendiente cobro</span>
                <strong>${formatMoney(saldoPendienteSeleccionado)}</strong>
              </div>

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
                  {selected.RequiereAlineacionBalanceo ? (
                    <label className="field">
                      <span>Alineacion y balanceo</span>
                      <input
                        readOnly
                        value={Number(valorAlineacionBalanceo || 0).toFixed(2)}
                      />
                    </label>
                  ) : null}
                  <label className="field">
                    <span>Abono recibido</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={valorAbonado}
                      onChange={(event) => setValorAbonado(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Saldo pendiente</span>
                    <input readOnly value={saldoParcial.toFixed(2)} />
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
                  Puede marcar cobro total, dejar pendiente de empresa o registrar un pago parcial. El pago parcial queda pendiente, pero habilita la salida.
                </span>
                <div className="payment-action-buttons">
                  <button className="secondary-button" type="button" onClick={() => registrarPago("empresa")} disabled={saving || !esEmpresa}>
                    {saving ? "Guardando..." : "Dejar pendiente empresa"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => registrarPago("parcial")} disabled={saving}>
                    {saving ? "Guardando..." : "Pago parcial y salida"}
                  </button>
                  <button className="primary-button" type="button" onClick={() => registrarPago("total")} disabled={saving}>
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
