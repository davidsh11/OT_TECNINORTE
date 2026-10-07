import axios from "axios";

export const blockLabels = { repuestos: "Esperando repuestos", autorizacion: "Esperando autorización" };
export const blockStates = { por_gestionar: "Por gestionar", pedido: "Pedido", disponible: "Disponible", pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado: requiere una decisión", cerrado_sin_ejecutar: "Cerrado sin ejecutar el trabajo" };
export function blockRequest() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem("tecninorte-session-token") || ""}` } };
}
export function blockUrl(api, otId, id = "") {
  return `${api}/api/ot/${encodeURIComponent(otId)}/bloqueos${id ? `/${encodeURIComponent(id)}` : ""}`;
}
export function blockDate(value) {
  if (!value) return "Sin registrar";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("es-EC", value.length === 10 ? { dateStyle: "medium" } : { dateStyle: "short", timeStyle: "short" });
}
export function waitTime(block, now = Date.now()) {
  const end = block.resueltoEn ? new Date(block.resueltoEn).getTime() : now;
  const hours = Math.max(0, Math.floor((end - new Date(block.creadoEn).getTime()) / 3600000));
  return hours >= 24 ? `${Math.floor(hours / 24)} días, ${hours % 24} h` : hours ? `${hours} h` : "Menos de 1 h";
}
export function loadBlocks(api, otId, signal) {
  return axios.get(blockUrl(api, otId), { ...blockRequest(), signal });
}
export function matchesBlockFilters(ot, statusFilter, reasonFilter) {
  const blocks = ot.BloqueosActivos || [];
  if (statusFilter === "bloqueadas" && !blocks.length) return false;
  if (statusFilter !== "todos" && statusFilter !== "bloqueadas" && ot.EstadoSeguimiento !== statusFilter) return false;
  return reasonFilter === "todos" || blocks.some((b) => b.motivo === reasonFilter);
}

export function blockError(error, fallback = "No se pudieron cargar los bloqueos") {
  const status = error.response?.status;
  if (status === 401) return "Su sesion vencio o no esta disponible. Cierre sesion y vuelva a ingresar.";
  if (status === 404 && !error.response?.data?.error) return "El servidor aun no tiene habilitados los bloqueos. Reinicie el backend actualizado o publique la nueva version del servidor.";
  return error.response?.data?.error || (error.request && !error.response ? "No se pudo conectar con el servidor. Revise que el backend este encendido y vuelva a intentar." : fallback);
}

// Older running backends still require a work ID. Use only options returned
// by that backend, keeping the reason-only form and its permission checks.
export function blockRegistrationPayload(data, area, motivo, detalle) {
  if (data.registroPorMotivo === true) return { area, motivo, detalle };
  const works = data.trabajos || [];
  const candidates = works.filter((work) => !area || work.area === area);
  const work = candidates.find((item) => item.id.startsWith("general:")) || candidates[0];
  if (!work) throw new Error("Actualice las respuestas para verificar la asignacion actual de esta OT.");
  return {
    area: work.area,
    trabajoId: work.id,
    motivo,
    detalle: detalle.trim() || ({ repuestos: "Falta de repuestos", autorizacion: "Falta de autorizacion del cliente", ambos: "Falta de repuestos y autorizacion del cliente" })[motivo]
  };
}
