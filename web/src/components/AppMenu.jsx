const menuItems = [
  ["inicio", "Inicio", "home"],
  ["crear", "Nueva OT", "filePlus"],
  ["taller", "Taller", "wrench"],
  ["cierre", "Cierre OT", "money"],
  ["cobranza", "Cobranza", "money"],
  ["salida", "Salida de taller", "exit"],
  ["buscar", "Buscar OT", "search"],
  ["datosClientes", "Datos clientes", "userEdit"],
  ["historial", "Historial", "history"],
  ["reportes", "Reportes", "chart"]
];

function MenuIcon({ name }) {
  const common = {
    width: 28,
    height: 28,
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

  if (name === "money") {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 9v.01" />
        <path d="M18 15v.01" />
      </svg>
    );
  }

  if (name === "exit") {
    return (
      <svg {...common}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <rect x="7" y="11" width="3" height="5" />
        <rect x="12" y="8" width="3" height="8" />
        <rect x="17" y="4" width="3" height="12" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

export default function AppMenu({ activeView, allowedViews, onChangeView }) {
  return (
    <nav className="app-menu" aria-label="Menu principal">
      {menuItems
        .filter(([view]) => allowedViews.includes(view))
        .map(([view, label, icon]) => (
          <button
            type="button"
            className={activeView === view ? "active" : ""}
            onClick={() => onChangeView(view)}
            key={view}
          >
            <MenuIcon name={icon} />
            {label}
          </button>
        ))}
    </nav>
  );
}
