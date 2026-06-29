import { useState } from "react";
import axios from "axios";
import { writePdfTab } from "../utils/pdf";
import { getTecniNorteLogoSvg } from "../utils/logoSvg";

const emptyFilters = {
  cl: "",
  placa: "",
  dateFrom: "",
  dateTo: ""
};

function formatDate(value) {
  if (!value) return "SIN FECHA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString();
}

function formatDateLabel(value, fallback = "SIN FECHA") {
  if (!value) return fallback;
  return formatDate(value);
}

function normalizeInput(value) {
  return String(value || "").toUpperCase().replace(/\s/g, "");
}

function normalizeText(value) {
  return String(value || "").trim().toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateInRange(value, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  if (dateFrom && date < new Date(`${dateFrom}T00:00:00`)) return false;
  if (dateTo && date > new Date(`${dateTo}T23:59:59`)) return false;

  return true;
}

function processStatus(ot) {
  return ot.Cobrado && ot.SalidaAutorizada ? "FINALIZADO" : "EN PROCESO";
}

function toHistoryItem(ot, detalle = []) {
  const trabajos = detalle
    .filter((item) => normalizeText(item.Tipo).includes("TRABAJO"))
    .map((item) => normalizeText(item.Descripcion))
    .filter(Boolean);
  const repuestos = detalle
    .filter((item) => normalizeText(item.Tipo).includes("REPUESTO"))
    .map((item) => ({
      Descripcion: normalizeText(item.Descripcion),
      Cantidad: item.Cantidad ?? ""
    }))
    .filter((item) => item.Descripcion);

  return {
    ID: ot.ID,
    Fecha: ot.FechaEntrega || ot.FechaRecepcion || "",
    FechaRecepcion: ot.FechaRecepcion || "",
    FechaEntrega: ot.FechaEntrega || "",
    Propietario: normalizeText(ot.Propietario),
    CL: normalizeText(ot.CL),
    Telefonos: normalizeText(ot.Telefonos),
    CorreoElectronico: normalizeText(ot.CorreoElectronico),
    Direccion: normalizeText(ot.Direccion),
    Placa: normalizeText(ot.Placa),
    Marca: normalizeText(ot.Marca),
    Modelo: normalizeText(ot.Modelo),
    Color: normalizeText(ot.Color),
    MarcaRadio: normalizeText(ot.MarcaRadio),
    Anio: normalizeText(ot.Anio),
    Kilometraje: normalizeText(ot.Kilometraje),
    MecanicoResponsable: normalizeText(ot.MecanicoResponsable || ot.MecanicoAsignadoNombre || ot.MecanicoAsignado),
    Estado: normalizeText(ot.Estado),
    EstadoProceso: normalizeText(ot.EstadoProceso) || processStatus(ot),
    Cobrado: Boolean(ot.Cobrado),
    PagoPendienteEmpresa: Boolean(ot.PagoPendienteEmpresa),
    PagoParcialPendiente: Boolean(ot.PagoParcialPendiente),
    ValorCobrar: normalizeText(ot.ValorCobrar),
    ValorRepuestos: normalizeText(ot.ValorRepuestos),
    ValorAbonado: normalizeText(ot.ValorAbonado),
    SaldoPendiente: normalizeText(ot.SaldoPendiente),
    SalidaAutorizada: Boolean(ot.SalidaAutorizada),
    Observaciones: normalizeText(ot.Observaciones),
    TrabajoRealizado: ot.TrabajoRealizado || "",
    RepuestosUsados: ot.RepuestosUsados || "",
    trabajos,
    repuestos,
    detalle: detalle.map((item) => ({
      Tipo: normalizeText(item.Tipo),
      Descripcion: normalizeText(item.Descripcion),
      Cantidad: item.Cantidad ?? ""
    }))
  };
}

export default function HistorialOTView({ api }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [historial, setHistorial] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const updateFilter = (key, value) => {
    const nextValue = ["cl", "placa"].includes(key) ? normalizeInput(value) : value.toUpperCase();
    setFilters((current) => ({ ...current, [key]: nextValue }));
  };

  const buscarHistorial = async () => {
    if (!filters.cl && !filters.placa && !filters.dateFrom && !filters.dateTo) {
      alert("Ingrese cedula/RUC, placa o un rango de fechas para buscar el historial.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSearched(true);

      const res = await axios.get(`${api}/api/historial`, {
        params: {
          cl: filters.cl,
          placa: filters.placa,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo
        }
      });

      setHistorial(res.data?.historial || []);
      setVehiculos(res.data?.vehiculos || []);
    } catch (requestError) {
      console.error(requestError);
      try {
        await buscarHistorialDesdeOrdenes();
      } catch (fallbackError) {
        console.error(fallbackError);
        setError(fallbackError.response?.data?.error || "No se pudo cargar el historial.");
        setHistorial([]);
        setVehiculos([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const buscarHistorialDesdeOrdenes = async () => {
    const searchValue = filters.placa || filters.cl;
    const res = await axios.get(`${api}/api/ot`, {
      params: {
        search: searchValue || undefined,
        limit: 100
      }
    });
    const baseOrdenes = res.data?.ordenes || [];
    const filteredOrdenes = baseOrdenes.filter((ot) => {
      const matchesCl = filters.cl ? normalizeInput(ot.CL) === normalizeInput(filters.cl) : true;
      const matchesPlaca = filters.placa ? normalizeInput(ot.Placa) === normalizeInput(filters.placa) : true;

      return (
        matchesCl &&
        matchesPlaca &&
        dateInRange(ot.FechaEntrega || ot.FechaRecepcion, filters.dateFrom, filters.dateTo)
      );
    });

    const rows = await Promise.all(
      filteredOrdenes.map(async (ot) => {
        try {
          const detailRes = await axios.get(`${api}/api/ot/${ot.ID}`);
          return toHistoryItem({ ...ot, ...(detailRes.data?.ot || {}) }, detailRes.data?.detalle || []);
        } catch (detailError) {
          console.error(detailError);
          return toHistoryItem(ot);
        }
      })
    );
    const nextVehiculos = Array.from(
      new Map(
        rows
          .filter((item) => item.Placa)
          .map((item) => [
            item.Placa,
            {
              Placa: item.Placa,
              Marca: item.Marca,
              Modelo: item.Modelo,
              Color: item.Color,
              MarcaRadio: item.MarcaRadio,
              Anio: item.Anio,
              Kilometraje: item.Kilometraje
            }
          ])
      ).values()
    );

    setError("");
    setHistorial(rows);
    setVehiculos(nextVehiculos);
  };

  const limpiarFiltros = () => {
    setFilters(emptyFilters);
    setHistorial([]);
    setVehiculos([]);
    setError("");
    setSearched(false);
  };

  const imprimirPdf = (item) => {
    const pdfTab = window.open("", "_blank");

    if (pdfTab) {
      pdfTab.document.write("<p style='font-family: Arial, sans-serif'>Preparando PDF...</p>");
    }

    const detallePdf = item.detalle?.length
      ? item.detalle
      : [
          item.TrabajoRealizado
            ? {
                Tipo: "TRABAJO",
                Descripcion: item.TrabajoRealizado,
                Cantidad: ""
              }
            : null,
          item.RepuestosUsados
            ? {
                Tipo: "REPUESTO",
                Descripcion: item.RepuestosUsados,
                Cantidad: ""
              }
            : null
        ].filter(Boolean);

    writePdfTab(pdfTab, {
      otId: item.ID,
      fecha: new Date().toLocaleString(),
      cabecera: {
        Propietario: item.Propietario,
        CL: item.CL,
        Telefonos: item.Telefonos,
        CorreoElectronico: item.CorreoElectronico,
        Direccion: item.Direccion,
        Marca: item.Marca,
        Modelo: item.Modelo,
        Placa: item.Placa,
        Color: item.Color,
        MarcaRadio: item.MarcaRadio,
        Anio: item.Anio,
        Kilometraje: item.Kilometraje,
        Observaciones: item.Observaciones,
        MecanicoResponsable: item.MecanicoResponsable,
        FechaEntrega: item.FechaEntrega,
        ValorCobrar: item.ValorCobrar,
        ValorRepuestos: item.ValorRepuestos,
        ValorAbonado: item.ValorAbonado,
        SaldoPendiente: item.SaldoPendiente,
        RepuestosUsados: item.RepuestosUsados,
        TrabajoRealizado: item.TrabajoRealizado
      },
      detalle: detallePdf,
      includeInternal: false,
      firmas: {
        cliente: "",
        recepcion: ""
      },
      evidencias: []
    });
  };

  const imprimirHistorialCompleto = () => {
    if (!historial.length) {
      alert("Busque primero el historial que desea imprimir.");
      return;
    }

    const pdfTab = window.open("", "_blank");

    if (!pdfTab) return;

    const firstItem = historial[0] || {};
    const cliente = firstItem.Propietario || "CLIENTE";
    const cl = firstItem.CL || filters.cl || "SIN DATO";
    const periodo = [
      filters.dateFrom ? `DESDE ${filters.dateFrom}` : "",
      filters.dateTo ? `HASTA ${filters.dateTo}` : ""
    ]
      .filter(Boolean)
      .join(" / ");
    const logoMarkup = getTecniNorteLogoSvg("history-pdf-logo");
    const vehicleRows = vehiculos.length
      ? vehiculos
          .map(
            (vehiculo) => `
              <tr>
                <td>${escapeHtml(vehiculo.Placa)}</td>
                <td>${escapeHtml([vehiculo.Marca, vehiculo.Modelo].filter(Boolean).join(" "))}</td>
                <td>${escapeHtml(vehiculo.Color)}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="3">SIN VEHICULOS IDENTIFICADOS.</td></tr>`;
    const historyRows = historial
      .map((item) => {
        const trabajos = item.TrabajoRealizado || "";
        const repuestos = item.RepuestosUsados || "";

        return `
          <article class="visit">
            <div class="visit-head">
              <div>
                <span>OT ${escapeHtml(item.ID)}</span>
                <strong>${escapeHtml(formatDate(item.Fecha))}</strong>
              </div>
              <div>
                <span>Placa</span>
                <strong>${escapeHtml(item.Placa || "SIN PLACA")}</strong>
              </div>
              <div>
                <span>Kilometraje</span>
                <strong>${escapeHtml(item.Kilometraje || "SIN DATO")}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>${escapeHtml(item.EstadoProceso || "EN PROCESO")}</strong>
              </div>
            </div>
            <div class="visit-meta">
              <span>Vehiculo</span>
              <strong>${escapeHtml([item.Marca, item.Modelo, item.Color].filter(Boolean).join(" / ") || "SIN DATO")}</strong>
              <span>Mecanico</span>
              <strong>${escapeHtml(item.MecanicoResponsable || "SIN ASIGNAR")}</strong>
              <span>Estado</span>
              <strong>${escapeHtml(item.EstadoProceso || "EN PROCESO")}</strong>
            </div>
            <div class="visit-grid">
              <div>
                <h3>Trabajos realizados</h3>
                <p>${escapeHtml(trabajos || "SIN TRABAJOS REGISTRADOS.")}</p>
              </div>
              <div>
                <h3>Repuestos utilizados</h3>
                <p>${escapeHtml(repuestos || "SIN REPUESTOS REGISTRADOS.")}</p>
              </div>
            </div>
          </article>`;
      })
      .join("");

    pdfTab.document.open();
    pdfTab.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Historial ${escapeHtml(cliente)} - TECNINORTE</title>
          <style>
            @page { size: A4; margin: 13mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #061b41;
              background: #edf1f7;
              font-family: Arial, sans-serif;
              font-size: 12px;
            }
            .toolbar {
              position: sticky;
              top: 0;
              display: flex;
              justify-content: flex-end;
              gap: 8px;
              padding: 10px;
              background: #ffffff;
              border-bottom: 1px solid #d1d5db;
            }
            button {
              min-height: 36px;
              padding: 0 14px;
              border: 1px solid #e30613;
              border-radius: 6px;
              background: #e30613;
              color: #ffffff;
              font-weight: 700;
              cursor: pointer;
            }
            main {
              width: min(210mm, 100%);
              margin: 0 auto;
              padding: 14px;
              background: #ffffff;
            }
            header {
              display: grid;
              gap: 10px;
              padding-bottom: 14px;
              border-bottom: 4px solid #061b41;
              position: relative;
            }
            header::after {
              content: "";
              position: absolute;
              left: 0;
              bottom: -4px;
              width: 36%;
              height: 4px;
              background: #e30613;
            }
            h1, h2, h3, p { margin: 0; }
            h1 {
              font-size: 22px;
              text-transform: uppercase;
            }
            h2 {
              margin: 14px 0 8px;
              padding: 7px 9px;
              border-left: 5px solid #e30613;
              background: #f6f8fb;
              font-size: 14px;
              text-transform: uppercase;
            }
            .history-pdf-logo {
              display: block;
              width: 100%;
              max-width: 620px;
              height: auto;
            }
            .muted {
              color: #64748b;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-top: 12px;
            }
            .box {
              padding: 8px;
              border: 1px solid #d8e0eb;
              border-radius: 6px;
              background: #f8fafc;
            }
            .box span,
            .visit-head span,
            .visit-meta span {
              display: block;
              color: #64748b;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .box strong,
            .visit-head strong,
            .visit-meta strong {
              display: block;
              margin-top: 3px;
              color: #061b41;
              font-size: 13px;
              overflow-wrap: anywhere;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 7px;
              border: 1px solid #d8e0eb;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f6f8fb;
              color: #17345f;
              font-size: 11px;
              text-transform: uppercase;
            }
            .visit {
              display: grid;
              gap: 9px;
              margin-top: 10px;
              padding: 10px;
              border: 1px solid #d8e0eb;
              border-left: 5px solid #e30613;
              border-radius: 7px;
              break-inside: avoid;
            }
            .visit-head {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
            }
            .visit-meta {
              display: grid;
              grid-template-columns: 86px 1fr 86px 1fr;
              gap: 6px 10px;
              padding: 8px;
              border-radius: 6px;
              background: #f8fafc;
            }
            .visit-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .visit-grid h3 {
              margin-bottom: 5px;
              color: #17345f;
              font-size: 12px;
              text-transform: uppercase;
            }
            .visit-grid p {
              min-height: 54px;
              padding: 8px;
              border: 1px solid #d8e0eb;
              border-radius: 6px;
              background: #ffffff;
              white-space: pre-wrap;
              line-height: 1.35;
            }
            .footer-note {
              margin-top: 16px;
              padding-top: 8px;
              border-top: 2px solid #061b41;
              color: #64748b;
              font-size: 10px;
              text-align: center;
            }
            @media print {
              body { background: #ffffff; }
              .toolbar { display: none; }
              main { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button onclick="window.print()">Guardar PDF</button>
          </div>
          <main>
            <header>
              ${logoMarkup}
              <p class="muted">Historial general de trabajos realizados</p>
              <h1>${escapeHtml(cliente)}</h1>
              <div class="summary">
                <div class="box"><span>Cedula/RUC</span><strong>${escapeHtml(cl)}</strong></div>
                <div class="box"><span>Ordenes</span><strong>${escapeHtml(historial.length)}</strong></div>
                <div class="box"><span>Vehiculos</span><strong>${escapeHtml(vehiculos.length || "-")}</strong></div>
                <div class="box"><span>Periodo</span><strong>${escapeHtml(periodo || "COMPLETO")}</strong></div>
              </div>
            </header>

            <section>
              <h2>Vehiculos encontrados</h2>
              <table>
                <thead>
                  <tr><th>Placa</th><th>Vehiculo</th><th>Color</th></tr>
                </thead>
                <tbody>${vehicleRows}</tbody>
              </table>
            </section>

            <section>
              <h2>Detalle del historial</h2>
              ${historyRows}
            </section>

            <p class="footer-note">
              JS Servicio Automotriz TecniNorte - Historial emitido para el cliente
            </p>
          </main>
          <script>
            window.addEventListener("load", () => setTimeout(() => window.print(), 350));
          </script>
        </body>
      </html>
    `);
    pdfTab.document.close();
  };

  return (
    <section className="history-view">
      <article className="panel history-filter-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historial</p>
            <h2>Trabajos por cliente y vehiculo</h2>
          </div>
        </div>

        <div className="history-filters">
          <label className="field">
            <span>Cedula / RUC</span>
            <input
              className="searchable-input"
              value={filters.cl}
              onChange={(event) => updateFilter("cl", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Placa</span>
            <input
              className="searchable-input"
              value={filters.placa}
              onChange={(event) => updateFilter("placa", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Desde</span>
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
          </label>
          <div className="history-filter-actions">
            <button className="primary-button" type="button" disabled={loading} onClick={buscarHistorial}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button className="ghost-button" type="button" disabled={!historial.length} onClick={imprimirHistorialCompleto}>
              Imprimir historial
            </button>
            <button className="ghost-button" type="button" onClick={limpiarFiltros}>
              Limpiar
            </button>
          </div>
        </div>

        {error ? <p className="error-state">{error}</p> : null}
      </article>

      {vehiculos.length ? (
        <section className="history-vehicles">
          {vehiculos.map((vehiculo) => (
            <article className="history-vehicle" key={vehiculo.Placa}>
              <strong>{vehiculo.Placa}</strong>
              <span>
                {[vehiculo.Marca, vehiculo.Modelo, vehiculo.Color].filter(Boolean).join(" / ") || "VEHICULO"}
              </span>
            </article>
          ))}
        </section>
      ) : null}

      <section className="history-results">
        {!loading && searched && historial.length === 0 ? (
          <p className="empty-state">No se encontraron trabajos con los filtros seleccionados.</p>
        ) : null}

        {historial.map((item) => (
          <article className="history-card" key={item.ID}>
            <div className="history-card-head">
              <div>
                <h3>OT {item.ID}</h3>
                <div className="history-date-summary">
                  <span>
                    Fecha recepcion
                    <strong>{formatDateLabel(item.FechaRecepcion)}</strong>
                  </span>
                  <span>
                    Fecha entrega
                    <strong>{formatDateLabel(item.FechaEntrega, "SIN ENTREGA")}</strong>
                  </span>
                </div>
              </div>
              <div className="history-card-actions">
                <strong>{item.Placa || "SIN PLACA"}</strong>
                <button className="ghost-button" type="button" onClick={() => imprimirPdf(item)}>
                  Imprimir PDF
                </button>
              </div>
            </div>

            <div className="history-meta">
              <span>Cliente</span>
              <strong>{item.Propietario || "SIN CLIENTE"}</strong>
              <span>Cedula/RUC</span>
              <strong>{item.CL || "SIN DATO"}</strong>
              <span>Vehiculo</span>
              <strong>{[item.Marca, item.Modelo, item.Color].filter(Boolean).join(" / ") || "SIN DATO"}</strong>
              <span>Kilometraje</span>
              <strong>{item.Kilometraje || "SIN DATO"}</strong>
              <span>Mecanico</span>
              <strong>{item.MecanicoResponsable || "SIN ASIGNAR"}</strong>
              <span>Estado</span>
              <strong className={item.EstadoProceso === "FINALIZADO" ? "status-final" : "status-process"}>
                {item.EstadoProceso || "EN PROCESO"}
              </strong>
            </div>

            <div className="history-detail-grid">
              <div>
                <h4>Trabajos realizados</h4>
                <p className="notes-preview">
                  {item.TrabajoRealizado || "SIN TRABAJOS REGISTRADOS."}
                </p>
              </div>
              <div>
                <h4>Repuestos utilizados</h4>
                {item.RepuestosUsados ? (
                  <div className="history-parts">
                    <p>{item.RepuestosUsados}</p>
                  </div>
                ) : (
                  <p className="notes-preview">SIN REPUESTOS REGISTRADOS.</p>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
