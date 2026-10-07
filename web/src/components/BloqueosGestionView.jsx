import { useEffect, useState } from "react";
import axios from "axios";
import { BlockCard } from "./BloqueosOTPanel";
import { blockError, blockRequest } from "../utils/bloqueos";

export default function BloqueosGestionView({ api }) {
  const [blocks, setBlocks] = useState([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [reason, setReason] = useState("todos");
  const refresh = () => { setLoading(true); setRevision((v) => v + 1); };
  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${api}/api/bloqueos`, { ...blockRequest(), params: { historial: showHistory }, signal: controller.signal }).then((res) => { setBlocks(res.data.bloqueos || []); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) setError(blockError(e, "No se pudo cargar la bandeja de bloqueos")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, revision, showHistory]);
  const query = search.trim().toLowerCase();
  const visible = blocks.filter((b) => (reason === "todos" || b.motivo === reason) && [b.otId, b.placa, b.cliente, b.vehiculo, b.mecanico, b.detalle, b.responsable].some((v) => String(v || "").toLowerCase().includes(query)));
  return <section className="blocks-panel">
    <div className="section-heading"><div><p className="eyebrow">Gestión de Cobranza</p><h3>Bloqueos por gestionar</h3><p>{new Set(blocks.filter((b) => b.activo).map((b) => b.otId)).size} OT · {blocks.filter((b) => b.activo).length} motivos pendientes</p></div><button type="button" disabled={loading} onClick={refresh}>Actualizar bloqueos</button></div>
    <p>Registre aquí los pedidos y contactos realizados. No se envían mensajes al cliente.</p>
    <div className="block-fields"><label>Buscar bloqueo<input placeholder="OT, placa, cliente, mecánico o responsable" value={search} onChange={(e) => setSearch(e.target.value)} /></label><label>Motivo<select value={reason} onChange={(e) => setReason(e.target.value)}><option value="todos">Todos los motivos</option><option value="repuestos">Repuestos</option><option value="autorizacion">Autorización</option></select></label></div>
    <label className="block-history-toggle"><input type="checkbox" checked={showHistory} onChange={(e) => { setLoading(true); setShowHistory(e.target.checked); }} /> Incluir resueltos e historial</label>
    {error ? <p className="error-state" role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {loading ? <p role="status">Actualizando bloqueos...</p> : null}
    {!loading && !error && !visible.length ? <p className="empty-state">No hay bloqueos pendientes con estos filtros. Los resueltos permanecen en el historial de cada OT.</p> : null}
    <div className="block-list">{visible.map((b) => <BlockCard key={`${b.id}:${b.version}`} api={api} block={b} canManage onUpdated={() => { setMessage("Seguimiento guardado. La respuesta ya está disponible para el mecánico."); refresh(); }} />)}</div>
  </section>;
}
