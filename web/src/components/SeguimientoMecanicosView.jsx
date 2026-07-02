import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { mechanics } from "../constants/users";

const statusLabels = {
  todos: "Todas",
  sin_asignar: "Sin asignar",
  pendiente: "Pendientes",
  realizando: "Realizando",
  finalizada: "Finalizadas"
};

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function statusText(status) {
  if (status === "sin_asignar") return "Sin asignar";
  if (status === "realizando") return "Realizando";
  if (status === "pendiente") return "Pendiente";
  if (status === "finalizada") return "Finalizada";
  return "En taller";
}

function buildMechanicRows(apiMechanics) {
  const byName = new Map((apiMechanics || []).map((item) => [item.mecanico, item]));

  mechanics.forEach((mechanic) => {
    if (!byName.has(mechanic.name)) {
      byName.set(mechanic.name, {
        mecanico: mechanic.name,
        asignadas: 0,
        realizando: 0,
        pendientes: 0,
        finalizadas: 0,
        ots: []
      });
    }
  });

  return Array.from(byName.values()).sort((a, b) => {
    const loadDiff = b.asignadas - a.asignadas;
    return loadDiff || a.mecanico.localeCompare(b.mecanico);
  });
}

export default function SeguimientoMecanicosView({ api }) {
  const [data, setData] = useState({ resumen: {}, mecanicos: [], ordenes: [], pendientesSalida: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [mechanicFilter, setMechanicFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const cargarSeguimiento = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot/seguimiento`);
      setData({
        resumen: res.data?.resumen || {},
        mecanicos: buildMechanicRows(res.data?.mecanicos || []),
        ordenes: res.data?.ordenes || [],
        pendientesSalida: res.data?.pendientesSalida || []
      });
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar el seguimiento de mecanicos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSeguimiento();
  }, [api]);

  const salidaChart = useMemo(() => {
    const activeCount = Number(data.resumen.ingresoTaller || 0);
    const approvedCount = Number(data.resumen.pendientesSalida || 0);
    const total = activeCount + approvedCount;

    return {
      activeCount,
      approvedCount,
      approvedPercent: total ? Math.round((approvedCount / total) * 100) : 0,
      activePercent: total ? Math.round((activeCount / total) * 100) : 0
    };
  }, [data.resumen]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (data.ordenes || []).filter((ot) => {
      if (statusFilter !== "todos" && ot.EstadoSeguimiento !== statusFilter) return false;
      if (mechanicFilter !== "todos" && ot.MecanicoResponsable !== mechanicFilter) return false;
      if (!query) return true;

      return [
        ot.ID,
        ot.Propietario,
        ot.CL,
        ot.Placa,
        ot.Marca,
        ot.Modelo,
        ot.MecanicoResponsable,
        ot.Estado
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [data.ordenes, mechanicFilter, search, statusFilter]);

  return (
    <section className="panel tracking-panel">
      <div className="section-heading tracking-heading">
        <div>
          <p className="eyebrow">Control de taller</p>
          <h2>Seguimiento de mecanicos</h2>
        </div>
        <button type="button" onClick={cargarSeguimiento} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="tracking-kpis">
        <article className="report-kpi count">
          <span>Ingreso en taller</span>
          <strong>{data.resumen.ingresoTaller ?? 0}</strong>
          <small>OT activas por gestionar</small>
        </article>
        <article className="report-kpi pending">
          <span>Sin asignar</span>
          <strong>{data.resumen.sinAsignar ?? 0}</strong>
          <small>Pendientes de asignacion</small>
        </article>
        <article className="report-kpi">
          <span>Realizando</span>
          <strong>{data.resumen.realizando ?? 0}</strong>
          <small>Con avance de taller</small>
        </article>
        <article className="report-kpi">
          <span>Pendientes</span>
          <strong>{data.resumen.pendientes ?? 0}</strong>
          <small>Asignadas sin finalizar</small>
        </article>
      </div>

      <section className="exit-chart-panel">
        <div className="exit-chart-copy">
          <p className="eyebrow">Salida de taller</p>
          <h3>{salidaChart.approvedCount} vehiculos listos para salida</h3>
          <span>{salidaChart.approvedPercent}% del flujo visible ya esta cobrado</span>
        </div>
        <div className="exit-chart-bars" aria-label="Grafica de vehiculos con salida autorizada">
          <div>
            <span>Listos para salida</span>
            <strong>{salidaChart.approvedCount}</strong>
            <i style={{ width: `${Math.max(salidaChart.approvedPercent, salidaChart.approvedCount ? 8 : 0)}%` }} />
          </div>
          <div>
            <span>En taller</span>
            <strong>{salidaChart.activeCount}</strong>
            <i style={{ width: `${Math.max(salidaChart.activePercent, salidaChart.activeCount ? 8 : 0)}%` }} />
          </div>
        </div>
        <div className="exit-approved-list">
          {(data.pendientesSalida || []).slice(0, 5).map((ot) => (
            <article key={ot.ID}>
              <strong>{ot.Placa || "Sin placa"}</strong>
              <span>OT {ot.ID}</span>
              <small>{formatDate(ot.FechaCobro || ot.FechaPagoPendienteEmpresa || ot.FechaEntrega)}</small>
            </article>
          ))}
          {!loading && (data.pendientesSalida || []).length === 0 ? (
            <p className="empty-state">No hay vehiculos listos para salida.</p>
          ) : null}
        </div>
      </section>

      <div className="mechanic-tracking-grid">
        {data.mecanicos.map((mechanic) => (
          <article className="mechanic-card" key={mechanic.mecanico}>
            <div>
              <h3>{mechanic.mecanico}</h3>
              <span>{mechanic.asignadas} OT activas</span>
            </div>
            <dl>
              <div className="mechanic-state doing">
                <dt>Realizando</dt>
                <dd>{mechanic.realizando}</dd>
              </div>
              <div className="mechanic-state pending">
                <dt>Pendientes</dt>
                <dd>{mechanic.pendientes}</dd>
              </div>
              <div className="mechanic-state done">
                <dt>Finalizadas</dt>
                <dd>{mechanic.finalizadas}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="tracking-tools">
        <input
          placeholder="Buscar OT, placa, cliente o mecanico"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={mechanicFilter} onChange={(event) => setMechanicFilter(event.target.value)}>
          <option value="todos">Todos los mecanicos</option>
          {data.mecanicos.map((mechanic) => (
            <option value={mechanic.mecanico} key={mechanic.mecanico}>
              {mechanic.mecanico}
            </option>
          ))}
        </select>
      </div>

      <div className="tracking-tabs" role="tablist" aria-label="Filtro de seguimiento">
        {Object.entries(statusLabels).map(([status, label]) => (
          <button
            type="button"
            className={statusFilter === status ? "active" : ""}
            onClick={() => setStatusFilter(status)}
            key={status}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tracking-table">
        {loading && filteredOrders.length === 0 ? <p className="empty-state">Cargando seguimiento...</p> : null}
        {!loading && filteredOrders.length === 0 ? (
          <p className="empty-state">No hay OT con los filtros actuales.</p>
        ) : null}
        {filteredOrders.map((ot) => (
          <article className={`tracking-row status-${ot.EstadoSeguimiento || "pendiente"}`} key={ot.ID}>
            <div>
              <strong>OT {ot.ID}</strong>
              <small>{ot.Propietario || "Sin propietario"} / CL: {ot.CL || "-"}</small>
            </div>
            <div>
              <span>{ot.Placa || "Sin placa"}</span>
              <small>{[ot.Marca, ot.Modelo].filter(Boolean).join(" ") || "Sin vehiculo"}</small>
            </div>
            <div>
              <span>{ot.MecanicoResponsable || "Sin asignar"}</span>
              <small>{ot.AreaTrabajo || "MECANICA"}</small>
              <small>{formatDate(ot.FechaRecepcion)}</small>
            </div>
            <span className={`tracking-status ${ot.EstadoSeguimiento}`}>{statusText(ot.EstadoSeguimiento)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}




