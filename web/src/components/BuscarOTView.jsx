import { useEffect, useState } from "react";
import axios from "axios";
import { getOtMedia } from "../utils/localOtMedia";
import { writePdfTab } from "../utils/pdf";

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string") return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return String(value);
}

export default function BuscarOTView({ api }) {
  const [search, setSearch] = useState("");
  const [ordenes, setOrdenes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cargarOrdenes = async (term = search) => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot`, {
        params: { search: term, limit: 50 }
      });
      setOrdenes(res.data.ordenes || []);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudieron cargar las OT.");
    } finally {
      setLoading(false);
    }
  };

  const cargarDetalle = async (otId) => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot/${otId}`);
      const localMedia = await getOtMedia(otId);
      setSelected(res.data.ot);
      setDetalle(res.data.detalle || []);
      setMedia(localMedia);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudo cargar el detalle de la OT.");
    } finally {
      setLoading(false);
    }
  };

  const imprimirOT = () => {
    if (!selected) return;

    const pdfTab = window.open("", "_blank");
    if (pdfTab) {
      pdfTab.document.write("<p style='font-family: Arial, sans-serif'>Preparando OT...</p>");
    }

    writePdfTab(pdfTab, {
      otId: selected.ID,
      fecha: formatDate(selected.FechaRecepcion) || new Date().toLocaleString(),
      cabecera: selected,
      detalle,
      firmas: {
        cliente: media?.firmas?.cliente || "",
        recepcion: media?.firmas?.recepcion || ""
      },
      evidencias: media?.evidencias || []
    });
  };

  useEffect(() => {
    cargarOrdenes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="panel search-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Consulta</p>
          <h2>OT generadas</h2>
        </div>
      </div>

      <div className="search-tools">
        <input
          placeholder="Buscar por ID, cliente, cedula/RUC, telefono o placa"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && cargarOrdenes()}
        />
        <button type="button" onClick={() => cargarOrdenes()} disabled={loading}>
          Buscar
        </button>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="ot-browser">
        <div className="ot-list">
          {loading && ordenes.length === 0 ? <p className="empty-state">Cargando OT...</p> : null}
          {!loading && ordenes.length === 0 ? (
            <p className="empty-state">No hay OT para mostrar.</p>
          ) : null}
          {ordenes.map((ot) => (
            <button
              className={`ot-row ${selected?.ID === ot.ID ? "active" : ""}`}
              type="button"
              key={ot.ID}
              onClick={() => cargarDetalle(ot.ID)}
            >
              <span>
                <strong>{ot.ID}</strong>
                <small>{ot.Propietario || "Sin propietario"}</small>
              </span>
              <span>
                <strong>{ot.Placa || "Sin placa"}</strong>
                <small>{formatDate(ot.FechaRecepcion)}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="ot-detail">
          {!selected ? (
            <p className="empty-state">Seleccione una OT para ver sus datos.</p>
          ) : (
            <>
              <div className="ot-detail-header">
                <div>
                  <p className="eyebrow">OT {selected.ID}</p>
                  <h3>{selected.Propietario || "Sin propietario"}</h3>
                </div>
                <div className="ot-detail-actions">
                  <strong>{selected.Estado || "Recibido"}</strong>
                  <button type="button" onClick={imprimirOT}>
                    Imprimir OT
                  </button>
                </div>
              </div>

              <div className="read-grid">
                <span>CL</span>
                <strong>{selected.CL || "-"}</strong>
                <span>Telefonos</span>
                <strong>{selected.Telefonos || "-"}</strong>
                <span>Direccion</span>
                <strong>{selected.Direccion || "-"}</strong>
                <span>Vehiculo</span>
                <strong>
                  {[selected.Marca, selected.Modelo, selected.Color].filter(Boolean).join(" ") || "-"}
                </strong>
                <span>Placa</span>
                <strong>{selected.Placa || "-"}</strong>
                <span>Kilometraje</span>
                <strong>{selected.Kilometraje || "-"}</strong>
                <span>Recepcion</span>
                <strong>{formatDate(selected.FechaRecepcion) || "-"}</strong>
                <span>Entrega</span>
                <strong>{formatDate(selected.FechaEntrega) || "-"}</strong>
                <span>Mecanico</span>
                <strong>{selected.MecanicoResponsable || "-"}</strong>
              </div>

              <h4>Observaciones</h4>
              <p className="notes-preview">{selected.Observaciones || "Sin observaciones."}</p>

              <h4>Repuestos usados</h4>
              <p className="notes-preview">{selected.RepuestosUsados || "Sin repuestos registrados."}</p>

              <h4>Trabajo realizado</h4>
              <p className="notes-preview">
                {selected.TrabajoRealizado || "Sin detalle de trabajo realizado."}
              </p>

              <h4>Detalle</h4>
              <div className="consult-detail-list">
                {detalle.length === 0 ? (
                  <p className="empty-state">Sin trabajos ni repuestos registrados.</p>
                ) : (
                  detalle.map((item) => (
                    <div className="consult-detail-item" key={item.ID}>
                      <span className="type-pill">{item.Tipo}</span>
                      <strong>{item.Descripcion}</strong>
                      <span>{item.Cantidad || ""}</span>
                    </div>
                  ))
                )}
              </div>

              <h4>Firmas y evidencias locales</h4>
              {!media ? (
                <p className="empty-state">
                  No hay fotos o firmas locales para esta OT en este navegador.
                </p>
              ) : (
                <div className="local-media-grid">
                  <figure>
                    {media.firmas?.cliente ? (
                      <img src={media.firmas.cliente} alt="Firma cliente" />
                    ) : (
                      <div className="local-media-empty" />
                    )}
                    <figcaption>Firma cliente</figcaption>
                  </figure>
                  <figure>
                    {media.firmas?.recepcion ? (
                      <img src={media.firmas.recepcion} alt="Firma recepcion" />
                    ) : (
                      <div className="local-media-empty" />
                    )}
                    <figcaption>Firma recepcion</figcaption>
                  </figure>
                  {(media.evidencias || [])
                    .filter((item) => item.src)
                    .map((item) => (
                      <figure key={item.label}>
                        <img src={item.src} alt={item.label} />
                        <figcaption>{item.label}</figcaption>
                      </figure>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
