import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const METAS = [
  { mecanico: "ANGELF", meta: 2102.49 },
  { mecanico: "ARMANDOA", meta: 2102.49 },
  { mecanico: "DIEGOM", meta: 1230.58 },
  { mecanico: "FERNANDOS", meta: 1430.58, incluyeAlineacion: true },
  { mecanico: "JOSELOS", meta: 700.52 },
  { mecanico: "YONG", meta: 1932.0 }
];

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function complianceTone(value) {
  if (value < 50) return "low";
  if (value < 80) return "medium";
  return "high";
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, "0")}`
  };
}

function monthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, monthNumber - 1, 1));
}

export default function CumplimientoView({ api }) {
  const [month, setMonth] = useState(currentMonth);
  const [byMechanic, setByMechanic] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cargarCumplimiento = async () => {
    try {
      setLoading(true);
      setError("");
      const range = monthRange(month);
      const response = await axios.get(`${api}/api/reports/finance`, {
        params: { ...range, year: String(new Date().getFullYear()) }
      });
      setByMechanic(response.data?.byMechanic || []);
      setMonthly(response.data?.monthly || []);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar el cumplimiento de los mecanicos.");
      setByMechanic([]);
      setMonthly([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarCumplimiento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const cumplimiento = useMemo(() => {
    const values = new Map(
      byMechanic.map((item) => [String(item.mecanico || "").toUpperCase(), Number(item.montoManoObra) || 0])
    );

    return METAS.map((item) => {
      const valor = values.get(item.mecanico) || 0;
      const porcentaje = item.meta > 0 ? (valor / item.meta) * 100 : 0;
      return {
        ...item,
        valor,
        porcentaje,
        faltante: Math.max(item.meta - valor, 0),
        utilidad: valor - item.gasto
      };
    });
  }, [byMechanic]);

  const resumen = useMemo(
    () =>
      cumplimiento.reduce(
        (acc, item) => ({
          meta: acc.meta + item.meta,
          valor: acc.valor + item.valor,
          cumplidas: acc.cumplidas + (item.porcentaje >= 100 ? 1 : 0)
        }),
        { meta: 0, valor: 0, cumplidas: 0 }
      ),
    [cumplimiento]
  );

  const porcentajeGeneral = resumen.meta ? (resumen.valor / resumen.meta) * 100 : 0;
  const annualCompliance = useMemo(() => {
    const mechanicNames = new Set(METAS.map((item) => item.mecanico));
    const monthlyGoal = METAS.reduce((total, item) => total + item.meta, 0);

    return monthly.map((item) => {
      const labor = Object.entries(item.manoObraPorMecanico || {}).reduce(
        (total, [mechanicName, amount]) =>
          mechanicNames.has(String(mechanicName).toUpperCase()) ? total + (Number(amount) || 0) : total,
        0
      );

      return {
        month: item.month,
        percentage: monthlyGoal ? (labor / monthlyGoal) * 100 : 0
      };
    });
  }, [monthly]);

  return (
    <section className="compliance-view">
      <div className="panel compliance-toolbar">
        <div>
          <p className="eyebrow">Meta mensual</p>
          <h2>Cumplimiento de mecanicos</h2>
          <p className="compliance-description">
            Mano de obra generada durante {monthLabel(month)}.
          </p>
        </div>
        <label>
          <span>Mes</span>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="compliance-summary">
        <article className="report-kpi count">
          <span>Meta total</span>
          <strong>{formatMoney(resumen.meta)}</strong>
          <small>{METAS.length} mecanicos</small>
        </article>
        <article className="report-kpi">
          <span>Valor alcanzado</span>
          <strong>{formatMoney(resumen.valor)}</strong>

        </article>
        <article className={`report-kpi ${porcentajeGeneral < 100 ? "pending" : ""}`}>
          <span>Cumplimiento general</span>
          <strong>{porcentajeGeneral.toFixed(1)}%</strong>
          <small>{resumen.cumplidas} de {METAS.length} metas cumplidas</small>
        </article>
      </div>

      <section className="compliance-charts" aria-label="Graficas de porcentaje de cumplimiento">
        <article className="panel compliance-overall-chart">
          <div>
            <p className="eyebrow">Porcentaje general</p>
            <h3>Cumplimiento del equipo</h3>
            <p>Promedio ponderado segun las metas del mes.</p>
          </div>
          <div
            className={`compliance-donut ${complianceTone(porcentajeGeneral)}`}
            style={{ "--compliance-percent": Math.min(porcentajeGeneral, 100) }}
            role="img"
            aria-label={`Cumplimiento general: ${porcentajeGeneral.toFixed(1)} por ciento`}
          >
            <div>
              <strong>{porcentajeGeneral.toFixed(1)}%</strong>
              <span>Cumplimiento</span>
            </div>
          </div>
        </article>

        <article className="panel compliance-percent-chart">
          <div>
            <p className="eyebrow">Comparativa</p>
            <h3>Porcentaje por mecanico</h3>
          </div>
          <div className="compliance-percent-bars">
            {[...cumplimiento].sort((a, b) => b.porcentaje - a.porcentaje).map((item) => (
              <div className="compliance-percent-row" key={item.mecanico}>
                <strong>{item.mecanico}</strong>
                <div className="compliance-percent-track">
                  <span
                    className={complianceTone(item.porcentaje)}
                    style={{ width: `${Math.min(item.porcentaje, 100)}%` }}
                  />
                </div>
                <b>{item.porcentaje.toFixed(1)}%</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel annual-progress-chart">
        <div>
          <p className="eyebrow">Avance anual</p>
          <h3>Cumplimiento mes a mes - {new Date().getFullYear()}</h3>
          <p>Porcentaje alcanzado frente a la meta total de cada mes.</p>
        </div>
        <div className="annual-progress-bars">
          {annualCompliance.map((item) => (
            <div className="annual-progress-column" key={item.month}>
              <b>{item.percentage.toFixed(1)}%</b>
              <div className="annual-progress-track">
                <span
                  className={item.percentage >= 100 ? "completed" : ""}
                  style={{ height: `${Math.min(item.percentage, 100)}%` }}
                />
              </div>
              <strong>{item.month.slice(0, 3)}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="compliance-grid">
        {cumplimiento.map((item) => {
          const completed = item.porcentaje >= 100;
          return (
            <article className={`compliance-card ${complianceTone(item.porcentaje)}`} key={item.mecanico}>
              <div className="compliance-card-heading">
                <div>
                  <h3>{item.mecanico}</h3>
                  <small>{item.incluyeAlineacion ? "Mano de obra + alineacion y balanceo" : "Solo mano de obra"}</small>
                </div>
                <strong>{item.porcentaje.toFixed(1)}%</strong>
              </div>

              <div
                className="compliance-progress"
                role="progressbar"
                aria-label={`Cumplimiento de ${item.mecanico}`}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.min(Math.round(item.porcentaje), 100)}
              >
                <span className={complianceTone(item.porcentaje)} style={{ width: `${Math.min(item.porcentaje, 100)}%` }} />
              </div>

              <div className="compliance-values">
                <span>Alcanzado<strong>{formatMoney(item.valor)}</strong></span>
                <span>Meta<strong>{formatMoney(item.meta)}</strong></span>
                <span>{completed ? "Excedente" : "Faltante"}<strong>{formatMoney(completed ? item.valor - item.meta : item.faltante)}</strong></span>
              </div>
            </article>
          );
        })}
      </div>

      {loading ? <p className="empty-state">Actualizando cumplimiento...</p> : null}
    </section>
  );
}
