import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { mechanics } from "../constants/users";

const emptySummary = {
  totalOt: 0,
  otCobradas: 0,
  otPendientes: 0,
  montoGeneral: 0,
  montoCobrado: 0,
  montoPendiente: 0,
  montoRepuestos: 0,
  montoManoObra: 0
};

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD"
  }).format(Number(value) || 0);
}

function formatBarMoney(value) {
  const amount = Number(value) || 0;
  if (amount <= 0) return "";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string") return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return String(value);
}

const PAGE_SIZE = 6;

export default function ReportesOTView({ api }) {
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    mechanic: "",
    search: "",
    year: String(new Date().getFullYear())
  });
  const [summary, setSummary] = useState(emptySummary);
  const [byMechanic, setByMechanic] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [reportPage, setReportPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const maxChartValue = useMemo(
    () => Math.max(...byMechanic.map((item) => Number(item.montoGenerado) || 0), 1),
    [byMechanic]
  );
  const maxLaborPartsValue = useMemo(
    () =>
      Math.max(
        ...monthly.map((item) =>
          Math.max(Number(item.montoRepuestos) || 0, Number(item.montoManoObra) || 0)
        ),
        1
      ),
    [monthly]
  );
  const maxCollectedValue = useMemo(
    () => Math.max(...monthly.map((item) => Number(item.montoCobrado) || 0), 1),
    [monthly]
  );

  const totalReportPages = Math.max(Math.ceil(ordenes.length / PAGE_SIZE), 1);
  const visibleOrdenes = ordenes.slice((reportPage - 1) * PAGE_SIZE, reportPage * PAGE_SIZE);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const cargarReportes = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/reports/finance`, {
        params: {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          mechanic: filters.mechanic || undefined,
          search: filters.search.trim() || undefined,
          year: filters.year || undefined
        }
      });
      setSummary(res.data.summary || emptySummary);
      setByMechanic(res.data.byMechanic || []);
      setMonthly(res.data.monthly || []);
      setOrdenes(res.data.ordenes || []);
      setReportPage(1);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFilters({ dateFrom: "", dateTo: "", mechanic: "", search: "", year: String(new Date().getFullYear()) });
  };

  useEffect(() => {
    cargarReportes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="report-panel">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reportes</p>
            <h2>KPIs de cobranza y mecanicos</h2>
          </div>
          <button type="button" onClick={cargarReportes} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        <div className="report-filters">
          <label className="field">
            <span>Desde</span>
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
          </label>
          <label className="field">
            <span>Mecanico</span>
            <select value={filters.mechanic} onChange={(event) => updateFilter("mechanic", event.target.value)}>
              <option value="">Todos</option>
              {mechanics.map((mechanic) => (
                <option value={mechanic.name} key={mechanic.id}>
                  {mechanic.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>OT, placa o cedula</span>
            <input
              placeholder="ID, placa o cedula/RUC"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && cargarReportes()}
            />
          </label>
          <label className="field">
            <span>Año graficas</span>
            <input
              type="number"
              min="2020"
              max="2100"
              value={filters.year}
              onChange={(event) => updateFilter("year", event.target.value)}
            />
          </label>
          <div className="report-filter-actions">
            <button type="button" onClick={limpiarFiltros}>
              Limpiar
            </button>
            <button className="primary-button" type="button" onClick={cargarReportes} disabled={loading}>
              Aplicar filtros
            </button>
          </div>
        </div>

        {error ? <p className="error-state">{error}</p> : null}
      </div>

      <div className="report-kpis">
        <article className="report-kpi count">
          <span>Monto general</span>
          <strong>{formatMoney(summary.montoGeneral)}</strong>
          <small>{summary.totalOt} OT segun filtros</small>
        </article>
        <article className="report-kpi">
          <span>Monto cobrado</span>
          <strong>{formatMoney(summary.montoCobrado)}</strong>
          <small>{summary.otCobradas} OT cobradas</small>
        </article>
        <article className="report-kpi pending">
          <span>Monto pendiente</span>
          <strong>{formatMoney(summary.montoPendiente)}</strong>
          <small>{summary.otPendientes} OT pendientes</small>
        </article>
        <article className="report-kpi count">
          <span>Repuestos</span>
          <strong>{formatMoney(summary.montoRepuestos)}</strong>
          <small>Total registrado por cobranza</small>
        </article>
        <article className="report-kpi">
          <span>Mano de obra</span>
          <strong>{formatMoney(summary.montoManoObra)}</strong>
          <small>Monto general menos repuestos</small>
        </article>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Grafica</p>
            <h2>OT y monto generado por mecanico</h2>
          </div>
        </div>

        <div className="mechanic-chart">
          {byMechanic.length === 0 ? (
            <p className="empty-state">No hay datos para graficar.</p>
          ) : (
            byMechanic.map((item) => (
              <article className="mechanic-bar" key={item.mecanico}>
                <div className="mechanic-bar-label">
                  <strong>{item.mecanico}</strong>
                  <span>{item.cantidadOt} OT</span>
                </div>
                <div className="mechanic-bar-track">
                  <span style={{ width: `${Math.max((item.montoGenerado / maxChartValue) * 100, 4)}%` }} />
                </div>
                <div className="mechanic-bar-values">
                  <strong>{formatMoney(item.montoGenerado)}</strong>
                  <small>
                    Repuestos {formatMoney(item.montoRepuestos)} / Mano de obra {formatMoney(item.montoManoObra)}
                  </small>
                  <small>Cobrado {formatMoney(item.montoCobrado)} / Pendiente {formatMoney(item.montoPendiente)}</small>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="report-chart-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Evolutivo {filters.year}</p>
              <h2>Repuestos vs mano de obra</h2>
            </div>
          </div>
          <div className="monthly-chart">
            {monthly.map((item) => (
              <div className="monthly-group" key={item.month}>
                <div className="monthly-bars">
                  <span className="bar-item">
                    <em>{formatBarMoney(item.montoRepuestos)}</em>
                    <i
                      className="parts"
                      style={{ height: `${Math.max((item.montoRepuestos / maxLaborPartsValue) * 100, 2)}%` }}
                      title={`Repuestos ${formatMoney(item.montoRepuestos)}`}
                    />
                  </span>
                  <span className="bar-item">
                    <em>{formatBarMoney(item.montoManoObra)}</em>
                    <i
                      className="labor"
                      style={{ height: `${Math.max((item.montoManoObra / maxLaborPartsValue) * 100, 2)}%` }}
                      title={`Mano de obra ${formatMoney(item.montoManoObra)}`}
                    />
                  </span>
                </div>
                <strong>{item.month}</strong>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span><i className="parts" /> Repuestos</span>
            <span><i className="labor" /> Mano de obra</span>
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tendencia {filters.year}</p>
              <h2>Monto cobrado mensual</h2>
            </div>
          </div>
          <div className="monthly-chart single">
            {monthly.map((item) => (
              <div className="monthly-group" key={item.month}>
                <div className="monthly-bars">
                  <span className="bar-item">
                    <em>{formatBarMoney(item.montoCobrado)}</em>
                    <i
                      className="collected"
                      style={{ height: `${Math.max((item.montoCobrado / maxCollectedValue) * 100, 2)}%` }}
                      title={`Cobrado ${formatMoney(item.montoCobrado)}`}
                    />
                  </span>
                </div>
                <strong>{item.month}</strong>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span><i className="collected" /> Monto cobrado</span>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Detalle</p>
            <h2>OT incluidas en el reporte</h2>
          </div>
        </div>
        <div className="report-table">
          {ordenes.length === 0 ? (
            <p className="empty-state">No hay OT con los filtros actuales.</p>
          ) : (
            visibleOrdenes.map((ot) => (
              <article className="report-row" key={ot.ID}>
                <strong>{ot.ID}</strong>
                <span>{ot.Propietario || "Sin propietario"} / CL: {ot.CL || "-"}</span>
                <span>{ot.Placa || "Sin placa"}</span>
                <span>{ot.MecanicoResponsable || "Sin mecanico"}</span>
                <span className={`payment-status-badge ${ot.Cobrado ? "paid" : "pending"}`}>
                  {ot.Cobrado ? "Cobrado" : "Pendiente"}
                </span>
                <strong>{formatMoney(ot.ValorTotal)}</strong>
                <span>Rep. {formatMoney(ot.ValorRepuestos)}</span>
                <small>{formatDate(ot.FechaCobro || ot.FechaEntrega || ot.FechaRecepcion)}</small>
              </article>
            ))
          )}
          {ordenes.length > PAGE_SIZE ? (
            <div className="ot-pagination" aria-label="Paginacion de OT del reporte">
              <button type="button" onClick={() => setReportPage((current) => Math.max(current - 1, 1))} disabled={reportPage === 1}>
                Anterior
              </button>
              <span>
                Pagina {reportPage} de {totalReportPages}
              </span>
              <button type="button" onClick={() => setReportPage((current) => Math.min(current + 1, totalReportPages))} disabled={reportPage === totalReportPages}>
                Siguiente
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
