import { useEffect, useState } from "react";
import axios from "axios";

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
    onOpenUsuarios
  };
  const [stats, setStats] = useState(defaultStats);
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

  return (
    <section className="home-menu">
      <div className="dashboard-heading">
        <h2>Bienvenido, {userName}</h2>
        <p>Selecciona una opcion para comenzar</p>
      </div>

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


