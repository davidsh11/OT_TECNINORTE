import { useEffect, useState } from "react";
import axios from "axios";

const VACATION_CACHE_TTL = 15 * 60 * 1000;
const VACATION_DAY_MS = 24 * 60 * 60 * 1000;

function availableVacationDays(record) {
  if (!record?.fechaIngreso) return 0;
  const [year, month, day] = String(record.fechaIngreso).slice(0, 10).split("-").map(Number);
  const hireDate = new Date(year, month - 1, day, 12);
  const cutoff = new Date(2026, 0, 1, 12);
  const start = hireDate > cutoff ? hireDate : cutoff;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || start > today) return 0;
  const accrued = (((today - start) / VACATION_DAY_MS) / 365.2425) * (Number(record.diasAnuales) || 15);
  const adjustments = (record.ajustes || [])
    .filter((item) => new Date(item.fecha) >= start)
    .reduce((total, item) => total + (Number(item.dias) || 0), 0);
  return accrued + adjustments;
}
const MECHANIC_GOALS = {
  ANGELF: 2102.49,
  ARMANDOA: 1953.87,
  DIEGOM: 1230.58,
  FERNANDOS: 1190.58,
  JOSELOS: 1071.52,
  YONG: 1932.0
};

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const monthNumber = now.getMonth() + 1;
  const month = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const lastDay = new Date(year, monthNumber, 0).getDate();

  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, "0")}`,
    year: String(year)
  };
}

const actions = [
  {
    view: "crear",
    title: "Nueva OT",
    description: "Crear una orden de trabajo y generar respaldo PDF.",
    icon: "filePlus",
    tone: "red",
    handler: "onOpenCrear"
  },
  {
    view: "taller",
    title: "Taller",
    description: "Actualizar mecánico, repuestos, trabajo realizado y entrega.",
    icon: "wrench",
    tone: "green",
    handler: "onOpenTaller"
  },
  {
    view: "seguimiento",
    title: "Seguimiento",
    description: "Ver carga, avance y pendientes por mecánico.",
    icon: "check",
    tone: "blue",
    handler: "onOpenSeguimiento"
  },
  {
    view: "cierre",
    title: "Cierre OT",
    description: "Revisar trabajos finalizados y registrar el valor a cobrar.",
    icon: "file",
    tone: "blue",
    handler: "onOpenCierre"
  },
  {
    view: "cobranza",
    title: "Cobranza",
    description: "Ver OT listas para cobro y marcarlas como cobradas.",
    icon: "file",
    tone: "green",
    handler: "onOpenCobranza"
  },
  {
    view: "salida",
    title: "Salida de taller",
    description: "Autorizar la salida del vehículo cuando la OT ya está cobrada.",
    icon: "wrench",
    tone: "red",
    handler: "onOpenSalida"
  },
  {
    view: "buscar",
    title: "Buscar OT",
    description: "Consultar ordenes generadas por cliente, placa o ID.",
    icon: "search",
    tone: "blue",
    handler: "onOpenBuscar"
  },
  {
    view: "datosClientes",
    title: "Datos clientes",
    description: "Buscar y actualizar datos de contacto y vehículo.",
    icon: "userEdit",
    tone: "green",
    handler: "onOpenDatosClientes"
  },
  {
    view: "historial",
    title: "Historial",
    description: "Revisar trabajos, kilometraje y repuestos por cliente o placa.",
    icon: "history",
    tone: "blue",
    handler: "onOpenHistorial"
  },
  {
    view: "reportes",
    title: "Reportes",
    description: "Ver KPIs de cobros, pendientes y rendimiento por mecánico.",
    icon: "file",
    tone: "blue",
    handler: "onOpenReportes"
  },
  {
    view: "cumplimiento",
    title: "Cumplimiento",
    description: "Revisar metas y porcentajes de cumplimiento por mecanico.",
    icon: "check",
    tone: "green",
    handler: "onOpenCumplimiento"
  },
  {
    view: "utilidad",
    title: "Utilidad",
    description: "Consultar utilidad y cobertura de gastos por mecanico.",
    icon: "file",
    tone: "blue",
    handler: "onOpenUtilidad"
  },
  {
    view: "usuarios",
    title: "Usuarios",
    description: "Restablecer claves y activar o desactivar accesos.",
    icon: "userEdit",
    tone: "red",
    handler: "onOpenUsuarios"
  }
];const defaultStats = [
  ["Ordenes totales", "0", "Registradas", "clipboard"],
  ["Ordenes completadas", "0", "Entregadas", "check"],
  ["Ordenes en proceso", "0", "En taller", "clock"]
];

function DashboardIcon({ name }) {
  const common = {
    width: 34,
    height: 34,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  };

  if (name === "filePlus") {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M12 18v-6" />
        <path d="M9 15h6" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v6h6" />
        <path d="M12 7v5l4 2" />
      </svg>
    );
  }

  if (name === "userEdit") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m16 11 5 5" />
        <path d="m21 11-5 5" />
      </svg>
    );
  }

  if (name === "wrench") {
    return (
      <svg {...common}>
        <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.6 2.6-3-3z" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === "file") {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M9 5h6" />
      <path d="M9 3h6v4H9z" />
      <path d="M6 5H5a2 2 0 0 0-2 2v13h18V7a2 2 0 0 0-2-2h-1" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  );
}

export default function HomeMenu({
  api,
  userName,
  userRole,
  mechanicId,
  allowedViews,
  onOpenCrear,
  onOpenBuscar,
  onOpenDatosClientes,
  onOpenHistorial,
  onOpenTaller,
  onOpenSeguimiento,
  onOpenCierre,
  onOpenCobranza,
  onOpenSalida,
  onOpenReportes,
  onOpenCumplimiento,
  onOpenUtilidad,
  onOpenUsuarios
}) {
  const handlers = {
    onOpenCrear,
    onOpenBuscar,
    onOpenDatosClientes,
    onOpenHistorial,
    onOpenTaller,
    onOpenSeguimiento,
    onOpenCierre,
    onOpenCobranza,
    onOpenSalida,
    onOpenReportes,
    onOpenCumplimiento,
    onOpenUtilidad,
    onOpenUsuarios
  };
  const [stats, setStats] = useState(defaultStats);
  const [mechanicCompliance, setMechanicCompliance] = useState(null);
  const [personalVacationDays, setPersonalVacationDays] = useState(null);
  const showStats = userRole === "admin";

  useEffect(() => {
    if (!showStats) return undefined;

    let ignore = false;

    axios
      .get(`${api}/api/ot/stats`)
      .then((response) => {
        if (ignore) return;

        const values = response.data?.stats || {};
        setStats([
          ["Ordenes totales", String(values.total ?? 0), "Registradas", "clipboard"],
          ["Ordenes completadas", String(values.completadas ?? 0), "Entregadas", "check"],
          ["Ordenes en proceso", String(values.proceso ?? 0), "En taller", "clock"]
        ]);
      })
      .catch((error) => {
        console.error("No se pudieron cargar los KPIs:", error);
      });

    return () => {
      ignore = true;
    };
  }, [api, showStats]);

  useEffect(() => {
    if (userRole !== "mecanico" || !mechanicId) return undefined;

    const normalizedMechanic = String(mechanicId).toUpperCase();
    const goal = MECHANIC_GOALS[normalizedMechanic];
    if (!goal) return undefined;

    let ignore = false;
    const range = currentMonthRange();

    axios
      .get(`${api}/api/reports/finance`, {
        params: { ...range, mechanic: normalizedMechanic }
      })
      .then((response) => {
        if (ignore) return;
        const mechanicData = (response.data?.byMechanic || []).find(
          (item) => String(item.mecanico || "").toUpperCase() === normalizedMechanic
        );
        const labor = Number(mechanicData?.montoManoObra) || 0;
        setMechanicCompliance((labor / goal) * 100);
      })
      .catch((error) => {
        console.error("No se pudo cargar el cumplimiento mensual:", error);
        if (!ignore) setMechanicCompliance(0);
      });

    return () => {
      ignore = true;
    };
  }, [api, mechanicId, userRole]);

  useEffect(() => {
    if (!(["mecanico", "cobranza"].includes(userRole))) return undefined;
    const employee = userRole === "cobranza" ? "DANNAS" : String(mechanicId || userName || "").toUpperCase();
    if (!employee) return undefined;
    const cacheKey = `tecninorte-vacaciones-personal-${employee}`;
    let ignore = false;

    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached?.savedAt && Date.now() - cached.savedAt < VACATION_CACHE_TTL) {
        queueMicrotask(() => {
          if (!ignore) setPersonalVacationDays(Number(cached.days) || 0);
        });
        return () => {
          ignore = true;
        };
      }
    } catch {
      localStorage.removeItem(cacheKey);
    }

    axios.get(`${api}/api/vacaciones/mias`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("tecninorte-session-token") || ""}` }
    }).then((response) => {
      if (ignore) return;
      const days = availableVacationDays(response.data?.registro);
      setPersonalVacationDays(days);
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), days }));
    }).catch((error) => {
      console.error("No se pudo cargar el saldo personal de vacaciones:", error);
    });

    return () => {
      ignore = true;
    };
  }, [api, mechanicId, userName, userRole]);
  return (
    <section className="home-menu">
      <div className="dashboard-heading">
        <h2>Bienvenido, {userName}</h2>
        <p>Selecciona una opcion para comenzar</p>
      </div>

      {userRole === "mecanico" && mechanicCompliance !== null ? (
        <article className="mechanic-compliance-banner">
          <div>
            <p className="eyebrow">Tu meta del mes</p>
            <h3>Tu cumplimiento actual</h3>

          </div>
          <div
            className="mechanic-compliance-donut"
            style={{
              "--mechanic-compliance": Math.min(mechanicCompliance, 100),
              "--mechanic-compliance-color":
                mechanicCompliance < 50 ? "#d93636" : mechanicCompliance < 80 ? "#ff8a1f" : "#16a75c"
            }}
            role="img"
            aria-label={`Cumplimiento mensual: ${mechanicCompliance.toFixed(1)} por ciento`}
          >
            <div>
              <strong>{mechanicCompliance.toFixed(1)}%</strong>
              <span>Cumplimiento</span>
            </div>
          </div>
        </article>
      ) : null}

      {["mecanico", "cobranza"].includes(userRole) && personalVacationDays !== null ? (
        <article className="mechanic-compliance-banner vacation-balance-banner">
          <div>
            <p className="eyebrow">Tu saldo disponible</p>
            <h3>Días de vacaciones</h3>
            <p>Puedes solicitar estos días libres según el saldo registrado.</p>
          </div>
          <div className="vacation-balance-value" aria-label={`${personalVacationDays.toFixed(2)} días de vacaciones disponibles`}>
            <strong>{personalVacationDays.toFixed(2)}</strong>
            <span>días disponibles</span>
          </div>
        </article>
      ) : null}
      {showStats ? (
        <div className="stats-row">
          {stats.map(([label, value, description, icon]) => (
            <article className="stat-card" key={label}>
              <span className="dashboard-icon stat">
                <DashboardIcon name={icon} />
              </span>
              <div>
                <strong>{value}</strong>
                <span>{label}</span>
                <small>{description}</small>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="dashboard-grid">
        <div className="home-actions">
          {actions
            .filter((action) => allowedViews.includes(action.view))
            .map((action) => (
              <button
                className={`home-action ${action.tone}`}
                type="button"
                onClick={handlers[action.handler]}
                key={action.view}
              >
                <span className="dashboard-icon">
                  <DashboardIcon name={action.icon} />
                </span>
                <span className="action-copy">
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <span className="action-arrow" aria-hidden="true">
                  -&gt;
                </span>
              </button>
            ))}
        </div>
      </div>

    </section>
  );
}
