import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const CACHE_KEY = "tecninorte-vacaciones-cache-v2";
const CACHE_TTL = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function authConfig() {
  return { headers: { Authorization: "Bearer " + (localStorage.getItem("tecninorte-session-token") || "") } };
}

function localDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function servicePeriod(fechaIngreso) {
  const hireDate = localDate(fechaIngreso);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (!hireDate || hireDate > today) return null;
  const cutoff = new Date(2026, 0, 1, 12);
  const start = hireDate > cutoff ? hireDate : cutoff;
  if (start > today) return null;
  return { start, end: today, today };
}

function vacationSummary(record) {
  const period = servicePeriod(record.fechaIngreso);
  if (!period) return { accrued: 0, adjustments: 0, available: 0, period: null, currentAdjustments: [] };
  const elapsedDays = Math.max((period.today - period.start) / DAY_MS, 0);
  const accrued = (elapsedDays / 365.2425) * (Number(record.diasAnuales) || 15);
  const currentAdjustments = (record.ajustes || []).filter((item) => {
    const date = new Date(item.fecha);
    return date >= period.start;
  });
  const adjustments = currentAdjustments.reduce((total, item) => total + (Number(item.dias) || 0), 0);
  return {
    accrued,
    adjustments,
    available: accrued + adjustments,
    period,
    currentAdjustments: [...currentAdjustments].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  };
}

function formatDays(value) {
  return Number(value || 0).toFixed(2) + " dias";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-EC");
}

export default function VacacionesView({ api }) {
  const [records, setRecords] = useState([]);
  const [reasons, setReasons] = useState({});
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const saveCache = (nextRecords) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), records: nextRecords }));
  };

  const loadVacations = async (force = false) => {
    try {
      setLoading(true);
      setError("");
      if (!force) {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.records)) {
          setRecords(cached.records);
          return;
        }
      }
      const response = await axios.get(api + "/api/vacaciones", authConfig());
      const nextRecords = response.data?.registros || [];
      setRecords(nextRecords);
      saveCache(nextRecords);
    } catch (requestError) {
      console.error(requestError);
      setError(
        requestError.response?.status === 401 || requestError.response?.status === 403
          ? "La sesion administrativa vencio. Cierre sesion y vuelva a ingresar."
          : requestError.response?.data?.error || "No se pudieron cargar las vacaciones."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVacations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateRecord = (mechanic, key, value) => {
    setRecords((current) => current.map((item) => (item.mecanico === mechanic ? { ...item, [key]: value } : item)));
  };

  const saveConfiguration = async (record) => {
    if (!record.fechaIngreso) {
      setError("Ingrese la fecha de ingreso de " + record.mecanico + ".");
      return;
    }
    try {
      setSaving(record.mecanico);
      setError("");
      await axios.patch(
        api + "/api/vacaciones/" + encodeURIComponent(record.mecanico),
        { fechaIngreso: record.fechaIngreso, diasAnuales: Number(record.diasAnuales) || 15 },
        authConfig()
      );
      saveCache(records);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || "No se pudo guardar la configuracion.");
    } finally {
      setSaving("");
    }
  };

  const addAdjustment = async (record, days) => {
    if (!Number.isFinite(days) || days === 0 || Math.abs(days * 2 - Math.round(days * 2)) > 0.000001) {
      setError("Ingrese una cantidad positiva o negativa en pasos de 0.5 días.");
      return;
    }
    const reason = String(reasons[record.mecanico] || "").trim();
    if (!reason) {
      setError("Ingrese el motivo del ajuste de " + record.mecanico + ".");
      return;
    }
    try {
      setSaving(record.mecanico);
      setError("");
      const response = await axios.post(
        api + "/api/vacaciones/" + encodeURIComponent(record.mecanico) + "/ajustes",
        { dias: days, motivo: reason },
        authConfig()
      );
      const adjustment = response.data?.ajuste;
      const nextRecords = records.map((item) =>
        item.mecanico === record.mecanico ? { ...item, ajustes: [...(item.ajustes || []), adjustment] } : item
      );
      setRecords(nextRecords);
      saveCache(nextRecords);
      setReasons((current) => ({ ...current, [record.mecanico]: "" }));
      setAmounts((current) => ({ ...current, [record.mecanico]: "" }));
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || "No se pudo registrar el ajuste.");
    } finally {
      setSaving("");
    }
  };

  const deleteAdjustment = async (record, adjustment) => {
    if (!window.confirm(`¿Eliminar el movimiento de ${adjustment.dias} día(s): ${adjustment.motivo}?`)) return;
    try {
      setSaving(record.mecanico);
      setError("");
      await axios.delete(
        api + "/api/vacaciones/" + encodeURIComponent(record.mecanico) + "/ajustes/" + encodeURIComponent(adjustment.id),
        authConfig()
      );
      const nextRecords = records.map((item) =>
        item.mecanico === record.mecanico
          ? { ...item, ajustes: (item.ajustes || []).filter((entry) => entry.id !== adjustment.id) }
          : item
      );
      setRecords(nextRecords);
      saveCache(nextRecords);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || "No se pudo eliminar el movimiento.");
    } finally {
      setSaving("");
    }
  };
  const totals = useMemo(
    () => records.reduce((acc, record) => {
      const summary = vacationSummary(record);
      return {
        accrued: acc.accrued + summary.accrued,
        adjustments: acc.adjustments + summary.adjustments,
        available: acc.available + summary.available
      };
    }, { accrued: 0, adjustments: 0, available: 0 }),
    [records]
  );

  return (
    <section className="vacation-view">
      <div className="panel vacation-heading">
        <div>
          <p className="eyebrow">Gestion administrativa</p>
          <h2>Vacaciones y permisos</h2>
          <p>Acumulación acumulativa desde 2026.</p>
        </div>
        <button type="button" className="ghost-button" disabled={loading} onClick={() => loadVacations(true)}>
          {loading ? "Actualizando..." : "Actualizar desde Firebase"}
        </button>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="vacation-summary">
        <article className="report-kpi count">
          <span>Acumulado del equipo</span><strong>{formatDays(totals.accrued)}</strong><small>Sin ajustes manuales</small>
        </article>
        <article className={"report-kpi " + (totals.adjustments < 0 ? "pending" : "")}>
          <span>Ajustes del periodo</span><strong>{totals.adjustments > 0 ? "+" : ""}{formatDays(totals.adjustments)}</strong><small>Permisos y dias adicionales</small>
        </article>
        <article className="report-kpi">
          <span>Disponible total</span><strong>{formatDays(totals.available)}</strong><small>Acumulado mas ajustes</small>
        </article>
      </div>

      <div className="vacation-grid">
        {records.map((record) => {
          const summary = vacationSummary(record);
          return (
            <article className="panel vacation-card" key={record.mecanico}>
              <div className="vacation-card-title">
                <div><p className="eyebrow">Mecanico</p><h3>{record.mecanico}</h3></div>
                <strong>{formatDays(summary.available)}</strong>
              </div>

              <div className="vacation-config">
                <label className="field">
                  <span>Fecha de ingreso</span>
                  <input type="date" value={record.fechaIngreso} onChange={(event) => updateRecord(record.mecanico, "fechaIngreso", event.target.value)} />
                </label>
                <label className="field">
                  <span>Días por año</span>
                  <input type="number" min="0.5" max="60" step="0.5" value={record.diasAnuales} onChange={(event) => updateRecord(record.mecanico, "diasAnuales", event.target.value)} />
                </label>
                <button type="button" className="secondary-button" disabled={saving === record.mecanico} onClick={() => saveConfiguration(record)}>Guardar</button>
              </div>

              <div className="vacation-metrics">
                <span>Acumulado<strong>{formatDays(summary.accrued)}</strong></span>
                <span>Ajustes<strong>{summary.adjustments > 0 ? "+" : ""}{formatDays(summary.adjustments)}</strong></span>
                <span>Periodo<strong>{summary.period ? formatDate(summary.period.start) + " - " + formatDate(summary.period.end) : "Ingrese fecha"}</strong></span>
              </div>

              <div className="vacation-adjustment">
                <label className="field">
                  <span>Motivo del permiso o ajuste</span>
                  <input value={reasons[record.mecanico] || ""} placeholder="Ej. permiso personal, dia adicional..." onChange={(event) => setReasons((current) => ({ ...current, [record.mecanico]: event.target.value }))} />
                </label>
                <div className="vacation-adjustment-buttons custom-days">
                  <label className="field">
                    <span>Días (+ o -)</span>
                    <input type="number" step="0.5" min="-365" max="365" placeholder="Ej. -3.5 o 2" value={amounts[record.mecanico] || ""} onChange={(event) => setAmounts((current) => ({ ...current, [record.mecanico]: event.target.value }))} />
                  </label>
                  <button type="button" className={Number(amounts[record.mecanico]) < 0 ? "vacation-remove" : "vacation-add"} disabled={saving === record.mecanico} onClick={() => addAdjustment(record, Number(amounts[record.mecanico]))}>
                    Registrar
                  </button>
                </div>
              </div>

              <details className="vacation-history">
                <summary>Historial del periodo ({summary.currentAdjustments.length})</summary>
                {summary.currentAdjustments.length ? summary.currentAdjustments.map((item) => (
                  <div key={item.id}>
                    <span>{formatDate(item.fecha)}</span>
                    <strong className={Number(item.dias) < 0 ? "negative" : "positive"}>{Number(item.dias) > 0 ? "+" : ""}{item.dias} dia(s)</strong>
                    <p>{item.motivo}</p>
                    <button type="button" className="vacation-delete-adjustment" disabled={saving === record.mecanico} onClick={() => deleteAdjustment(record, item)}>Eliminar</button>
                  </div>
                )) : <p className="empty-state">Sin ajustes en este periodo.</p>}
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}



