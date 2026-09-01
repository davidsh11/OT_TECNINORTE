import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const GASTOS = [
  { mecanico: "ANGELF", gasto: 700.83 },
  { mecanico: "ARMANDOA", gasto: 651.29 },
  { mecanico: "DIEGOM", gasto: 615.29 },
  { mecanico: "FERNANDOS", gasto: 595.29 },
  { mecanico: "JOSELOS", gasto: 595.29 },
  { mecanico: "YONG", gasto: 552.0 }
];

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
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

export default function UtilidadView({ api }) {
  const [month, setMonth] = useState(currentMonth);
  const [byMechanic, setByMechanic] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [reportSummary, setReportSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cargarUtilidad = async () => {
    try {
      setLoading(true);
      setError("");
      const range = monthRange(month);
      const response = await axios.get(`${api}/api/reports/finance`, {
        params: { ...range, year: String(new Date().getFullYear()) }
      });
      setByMechanic(response.data?.byMechanic || []);
      setMonthly(response.data?.monthly || []);
      setReportSummary(response.data?.summary || {});
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar la utilidad de los mecanicos.");
      setByMechanic([]);
      setMonthly([]);
      setReportSummary({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarUtilidad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const utilidades = useMemo(() => {
    const values = new Map(
      byMechanic.map((item) => [String(item.mecanico || "").toUpperCase(), Number(item.montoManoObra) || 0])
    );

    return GASTOS.map((item) => {
      const ingreso = values.get(item.mecanico) || 0;
      return {
        ...item,
        ingreso,
        utilidad: ingreso - item.gasto
      };
    }).sort((a, b) => b.utilidad - a.utilidad);
  }, [byMechanic]);

  const annualUtility = useMemo(() => {
    const mechanicNames = new Set(GASTOS.map((item) => item.mecanico));
    const monthlyExpense = GASTOS.reduce((total, item) => total + item.gasto, 0);

    return monthly.map((item) => {
      const income = Object.entries(item.manoObraPorMecanico || {}).reduce(
        (total, [mechanicName, amount]) =>
          mechanicNames.has(String(mechanicName).toUpperCase()) ? total + (Number(amount) || 0) : total,
        0
      );

      return {
        month: item.month,
        percentage: monthlyExpense ? (income / monthlyExpense) * 100 : 0
      };
    });
  }, [monthly]);

  const maxAbsoluteUtility = Math.max(...utilidades.map((item) => Math.abs(item.utilidad)), 1);
  const totalUtility = utilidades.reduce((total, item) => total + item.utilidad, 0);
  const totalIncome = utilidades.reduce((total, item) => total + item.ingreso, 0);
  const totalExpense = utilidades.reduce((total, item) => total + item.gasto, 0);
  const partsSales = Number(reportSummary.montoRepuestos) || 0;
  const partsProfit = partsSales * 0.35;
  const totalUtilityWithParts = totalUtility + partsProfit;

  return (
    <section className="compliance-view">
      <div className="panel compliance-toolbar">
        <div>
          <p className="eyebrow">Rentabilidad mensual</p>
          <h2>Utilidad por mecanico</h2>
          <p className="compliance-description">
            Mano de obra generada menos gastos durante {monthLabel(month)}.
          </p>
        </div>
        <label>
          <span>Mes</span>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="compliance-summary utility-summary">
        <article className="report-kpi count">
          <span>Ingreso total</span>
          <strong>{formatMoney(totalIncome)}</strong>
          <small>Mano de obra del mes</small>
        </article>
        <article className="report-kpi pending">
          <span>Gasto total</span>
          <strong>{formatMoney(totalExpense)}</strong>
          <small>Gastos mensuales del equipo</small>
        </article>
        <article className={`report-kpi ${totalUtility < 0 ? "pending" : ""}`}>
          <span>Utilidad mano de obra</span>
          <strong>{formatMoney(totalUtility)}</strong>
          <small>Mano de obra menos gastos</small>
        </article>
        <article className={`report-kpi parts-profit ${totalUtilityWithParts < 0 ? "pending" : ""}`}>
          <span>Utilidad total + repuestos</span>
          <strong>{formatMoney(totalUtilityWithParts)}</strong>
          <small>{formatMoney(partsProfit)} corresponde al 35% de repuestos</small>
        </article>
      </div>

      <section className="panel annual-progress-chart">
        <div>
          <p className="eyebrow">Avance anual</p>
          <h3>Cobertura de gastos mes a mes - {new Date().getFullYear()}</h3>
          <p>El 100% representa el punto de equilibrio; un porcentaje mayor indica utilidad.</p>
        </div>
        <div className="annual-progress-bars">
          {annualUtility.map((item) => (
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

      <section className="panel utility-chart">
        <div className="utility-chart-heading">
          <div>
            <p className="eyebrow">Comparativa</p>
            <h3>Utilidad por mecanico</h3>
            <p>Ordenada de mayor a menor utilidad mensual.</p>
          </div>
        </div>

        <div className="utility-bars">
          {utilidades.map((item) => (
            <article className="utility-row" key={item.mecanico}>
              <strong>{item.mecanico}</strong>
              <div className="utility-track">
                <span
                  className={item.utilidad < 0 ? "negative" : "positive"}
                  style={{ width: `${Math.max((Math.abs(item.utilidad) / maxAbsoluteUtility) * 100, 2)}%` }}
                />
              </div>
              <b className={item.utilidad < 0 ? "negative" : "positive"}>
                {formatMoney(item.utilidad)}
              </b>
              <small>Ingreso {formatMoney(item.ingreso)} - gasto {formatMoney(item.gasto)}</small>
            </article>
          ))}
        </div>
      </section>

      {loading ? <p className="empty-state">Actualizando utilidad...</p> : null}
    </section>
  );
}
