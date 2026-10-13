import { useEffect, useState } from "react";
import axios from "axios";
import { blockRegistrationPayload, blockError, blockDate, blockLabels, blockRequest, blockStates, blockUrl, loadBlocks, waitTime } from "../utils/bloqueos";

export function BlockBadges({ blocks = [] }) {
  return <div className="block-badges">{blocks.map((b) => (
    <div className={`block-summary block-${b.motivo}`} key={b.id}>
      <strong>{blockLabels[b.motivo]} · {waitTime(b)}</strong>
      <span>{b.detalle}</span>
      {b.respuesta === "rechazado" ? <b>Cliente rechazó: trabajo sin autorizar</b> : null}
      <small>{b.responsable} · Próxima acción: {b.proximaAccion}</small>
      {b.llegadaEstimada ? <small>Llegada prevista: {blockDate(b.llegadaEstimada)}</small> : null}
    </div>
  ))}</div>;
}

function BlockHistory({ api, block }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${blockUrl(api, block.otId, block.id)}/historial`, blockRequest());
      setEntries(res.data.historial || []);
    } catch (e) { setError(e.response?.data?.error || "No se pudo cargar el historial"); }
    finally { setLoading(false); }
  };
  return <div className="block-history">
    <button type="button" onClick={load} disabled={loading}>{loading ? "Cargando..." : "Ver / actualizar historial"}</button>
    {error ? <p role="alert">{error}</p> : null}
    {entries ? <ol>{entries.map((entry) => <li key={entry.id}>
      <strong>{blockDate(entry.fecha)} · {entry.nombre} ({entry.rol}) · {entry.accion}</strong>
      <span>{entry.antes ? `${blockStates[entry.antes.estado]} → ` : ""}{blockStates[entry.despues.estado]}</span>
      <span>Responsable: {entry.despues.responsable} · Próxima acción: {entry.despues.proximaAccion}</span>
      {entry.despues.repuesto ? <span>Repuesto: {entry.despues.repuesto} · Proveedor: {entry.despues.proveedor || "Sin registrar"}</span> : null}
      {entry.despues.trabajoAutorizar ? <span>Aprobación solicitada: {entry.despues.trabajoAutorizar}</span> : null}
      {entry.despues.llegadaEstimada ? <span>Llegada: {blockDate(entry.despues.llegadaEstimada)}</span> : null}
      {entry.despues.fechaContacto ? <span>Contacto: {blockDate(entry.despues.fechaContacto)}</span> : null}
      <span>{entry.despues.observaciones || entry.despues.detalle}</span>
      {entry.despues.resolucion ? <span>Resolución: {entry.despues.resolucion}</span> : null}
    </li>)}</ol> : null}
  </div>;
}

export function BlockCard({ api, block, canManage = false, onUpdated }) {
  const [form, setForm] = useState({ ...block, descartarTrabajo: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (form.descartarTrabajo && !window.confirm("Se cerrará este bloqueo sin autorizar ni ejecutar el trabajo rechazado. ¿Confirmar esta decisión?")) return;
    setSaving(true);
    setError("");
    try {
      await axios.patch(blockUrl(api, block.otId, block.id), form, blockRequest());
      await onUpdated?.();
    } catch (e) { setError(blockError(e, "No se pudo guardar. Intente nuevamente")); }
    finally { setSaving(false); }
  };
  return <article className={`block-card block-${block.motivo}`}>
    <div className="block-card-heading">
      <strong>{blockLabels[block.motivo]}</strong>
      <span>{blockStates[block.estado]} · {block.activo ? "Espera" : "Tiempo de espera"}: {waitTime(block)}</span>
    </div>
    {block.placa !== undefined ? <p><strong>OT {block.otId} · {block.placa}</strong> · {block.vehiculo} · {block.cliente}</p> : null}
    <p><strong>{block.mecanico}</strong> · {block.trabajo}</p>
    <p>{block.detalle}</p>
    <small>Registrado: {blockDate(block.creadoEn)} · {block.creadoPor}</small>
    {block.respuesta === "rechazado" ? <p className="block-rejection">Cliente rechazó. Este trabajo NO está autorizado.{block.activo ? " Se requiere una decisión explícita de Cobranza." : " Se cerró sin ejecutarlo."}</p> : null}
    <dl className="block-info">
      <dt>Responsable</dt><dd>{block.responsable}</dd>
      <dt>Próxima acción</dt><dd>{block.proximaAccion}</dd>
      {block.motivo === "repuestos" ? <>
        <dt>Repuesto / proveedor</dt><dd>{block.repuesto} / {block.proveedor || "Por confirmar"}</dd>
        <dt>Llegada prevista</dt><dd>{blockDate(block.llegadaEstimada)}</dd>
      </> : <>
        <dt>Trabajo por autorizar</dt><dd>{block.trabajoAutorizar}</dd>
        <dt>Respuesta</dt><dd>{blockStates[block.respuesta]}</dd>
        <dt>Contacto</dt><dd>{blockDate(block.fechaContacto)}</dd>
      </>}
      <dt>Observaciones</dt><dd>{block.observaciones || "Sin observaciones"}</dd>
      {block.resueltoEn ? <><dt>Resolución</dt><dd>{block.resolucion} · {blockDate(block.resueltoEn)} · {block.resueltoPor}</dd></> : null}
    </dl>
    {canManage && block.activo ? <form onSubmit={save} className="block-management">
      <fieldset disabled={saving}>
        <legend>Gestión de Cobranza</legend>
        <div className="block-fields">
          <label>Responsable de gestión<input required maxLength={600} value={form.responsable} onChange={(e) => update("responsable", e.target.value)} /></label>
          <label>Próxima acción<input required maxLength={600} value={form.proximaAccion} onChange={(e) => update("proximaAccion", e.target.value)} /></label>
          {block.motivo === "repuestos" ? <>
            <label>Repuesto solicitado<input required maxLength={600} value={form.repuesto} onChange={(e) => update("repuesto", e.target.value)} /></label>
            <label>Proveedor<input required={form.estado === "pedido"} maxLength={600} value={form.proveedor} onChange={(e) => update("proveedor", e.target.value)} /></label>
            <label>Estado<select value={form.estado} onChange={(e) => update("estado", e.target.value)}>
              <option value="por_gestionar">Por gestionar</option><option value="pedido">Pedido - aun no llega</option><option value="disponible">Disponible — resolver bloqueo</option>
            </select></label>
            <label>Fecha estimada de llegada<input type="date" value={form.llegadaEstimada} onChange={(e) => update("llegadaEstimada", e.target.value)} /></label>
          </> : <>
            <label>Trabajo que necesita aprobación<input required maxLength={600} value={form.trabajoAutorizar} onChange={(e) => update("trabajoAutorizar", e.target.value)} /></label>
            <label>Fecha y hora de contacto<input type="datetime-local" required={form.respuesta !== "pendiente"} value={form.fechaContacto} onChange={(e) => update("fechaContacto", e.target.value)} /></label>
            <label>Respuesta del cliente<select value={form.respuesta} onChange={(e) => update("respuesta", e.target.value)}>
              <option value="pendiente">Pendiente</option><option value="aprobado">Aprobado — resolver bloqueo</option><option value="rechazado">Rechazado — mantener bloqueo</option>
            </select></label>
            {block.respuesta === "rechazado" && form.respuesta === "rechazado" ? <>
              <label className="block-checkbox"><input type="checkbox" checked={form.descartarTrabajo} onChange={(e) => update("descartarTrabajo", e.target.checked)} />Cerrar sin ejecutar el trabajo rechazado</label>
              {form.descartarTrabajo ? <label>Decisión sobre el trabajo<input required maxLength={600} value={form.resolucion} onChange={(e) => update("resolucion", e.target.value)} placeholder="Ej.: Se retira este trabajo del alcance por decisión del cliente" /></label> : null}
            </> : null}
          </>}
          <label className="block-wide">Observaciones<textarea maxLength={600} value={form.observaciones} onChange={(e) => update("observaciones", e.target.value)} /></label>
        </div>
        <button type="submit">{saving ? "Guardando..." : "Guardar seguimiento"}</button>
        {error ? <p className="error-state" role="alert">{error}</p> : null}
      </fieldset>
    </form> : null}
    <BlockHistory api={api} block={block} />
  </article>;
}

export default function BloqueosOTPanel({ api, otId, currentUser, area }) {
  const [data, setData] = useState({ bloqueos: [], trabajos: [] });
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("repuestos");
  const [detail, setDetail] = useState("");
  const canManage = ["admin", "cobranza"].includes(currentUser?.role);
  const refresh = () => { setLoading(true); setRevision((v) => v + 1); };
  useEffect(() => {
    const controller = new AbortController();
    loadBlocks(api, otId, controller.signal).then((res) => {
      setData((current) => ({ ...current, ...res.data }));
      setError("");
    }).catch((e) => { if (!controller.signal.aborted) setError(blockError(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, otId, revision]);
  const create = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = blockRegistrationPayload(data, area, reason, detail);
      await axios.post(blockUrl(api, otId), payload, blockRequest());
      setOpen(false); setDetail(""); setMessage("Bloqueo registrado. Cobranza ya puede gestionarlo."); refresh();
    } catch (e) { setError(blockError(e, "No se pudo registrar el bloqueo")); }
    finally { setSaving(false); }
  };
  return <section className="blocks-panel" aria-label="Bloqueos de la OT">
    <div className="section-heading"><h3>Bloqueos de la OT</h3><button type="button" onClick={refresh} disabled={loading || saving}>Actualizar respuestas</button></div>
    {error ? <p className="error-state" role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {!canManage ? <small>Use Actualizar respuestas para consultar los cambios de Cobranza. Al guardar, se actualiza esta vista.</small> : null}
    {loading ? <p role="status">Consultando bloqueos...</p> : null}
    {!loading && !error && data.trabajos.length ? <button type="button" onClick={() => setOpen(!open)} disabled={saving}>{open ? "Cancelar registro" : "Registrar bloqueo"}</button> : null}
    {open ? <form className="block-create" onSubmit={create}>
      <fieldset disabled={saving || loading}>
        <legend>Registrar bloqueo</legend>
        <div className="block-fields">
          <label>Motivo<select value={reason} onChange={(e) => setReason(e.target.value)}><option value="repuestos">Falta de repuestos</option><option value="autorizacion">Falta de autorización del cliente</option><option value="ambos">Ambos</option></select></label>
          <label className="block-wide">Detalle (opcional)<textarea maxLength={600} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Indique qué repuesto falta o qué debe aprobar el cliente" /></label>
        </div>
        <button type="submit">{saving ? "Registrando..." : "Registrar bloqueo"}</button>
      </fieldset>
    </form> : null}
    {!loading && !error && !data.bloqueos.length ? <p className="empty-state">Esta OT no tiene bloqueos registrados.</p> : null}
    <div className="block-list">{data.bloqueos.map((block) => <BlockCard key={`${block.id}:${block.version}`} api={api} block={block} canManage={canManage} onUpdated={refresh} />)}</div>
  </section>;
}
