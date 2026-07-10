import { clienteFields, vehiculoFields } from "../constants/formFields";
import { getTecniNorteLogoSvg } from "./logoSvg";

const PDF_IMAGE_MAX_SIZE = 900;
const PDF_IMAGE_QUALITY = 0.68;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function fileToPdfDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        const scale = Math.min(
          1,
          PDF_IMAGE_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight)
        );
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", PDF_IMAGE_QUALITY));
      } catch (error) {
        console.warn("No se pudo preparar evidencia para PDF:", error);
        resolve("");
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve("");
    };

    image.src = objectUrl;
  });
}

export function signatureToDataUrl(signatureRef) {
  try {
    const signature = signatureRef.current;
    if (!signature || signature.isEmpty()) return "";

    try {
      return signature.getTrimmedCanvas().toDataURL("image/png");
    } catch (error) {
      console.warn("No se pudo recortar la firma para PDF:", error);
      return signature.getCanvas().toDataURL("image/png");
    }
  } catch (error) {
    console.warn("No se pudo preparar firma para PDF:", error);
    return "";
  }
}

export function writePdfTab(tab, data) {
  if (!tab) return;

  const clienteRows = clienteFields
    .map(
      ([key, label]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(data.cabecera[key])}</td></tr>`
    )
    .join("");
  const vehiculoRows = vehiculoFields
    .map(
      ([key, label]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(data.cabecera[key])}</td></tr>`
    )
    .join("");
  const detalleRows = data.detalle.length
    ? data.detalle
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.Tipo)}</td>
              <td>${escapeHtml(item.Descripcion)}</td>
              <td>${escapeHtml(item.Cantidad || "")}</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="3">Sin trabajos ni repuestos registrados.</td></tr>`;
  const entregaRows = `
    <tr><th>Mecanico</th><td>${escapeHtml(data.cabecera.MecanicoResponsable || "")}</td></tr>
    <tr><th>Fecha entrega</th><td>${escapeHtml(data.cabecera.FechaEntrega || "")}</td></tr>
  `;
  const hasInternalInfo = Boolean(
    data.includeInternal !== false &&
      (data.cabecera.MecanicoResponsable ||
        data.cabecera.FechaEntrega ||
        data.cabecera.RepuestosUsados ||
        data.cabecera.TrabajoRealizado ||
        data.cabecera.TrabajoAlineacionBalanceo)
  );
  const evidenceBlocks = data.evidencias
    .filter((item) => item.src)
    .map(
      (item) => `
        <figure>
          <img src="${item.src}" alt="${escapeHtml(item.label)}" />
          <figcaption>${escapeHtml(item.label)}</figcaption>
        </figure>`
    )
    .join("");
  const logoMarkup = getTecniNorteLogoSvg("pdf-logo");
  const serviceConditions = [
    "Autorizo realizar el trabajo de reparación del vehículo de las características detalladas anteriormente. Si al efectuar el trabajo solicitado en esta orden se encontrasen trabajos adicionales que hacer, autorizo a Talleres TecniNorte para ejecutarlos, cambiando los repuestos que sean necesarios.",
    "El valor correspondiente a la reparación, incluyendo repuestos y suministros, me comprometo a cancelar contra presentación de la factura.",
    "Pasadas las 24 horas de estar listo el auto se cobrara garaje.",
    "Talleres TecniNorte no se hace responsable por los objetos dejados en el vehículo, sin haber sido declarados y verificados por el supervisor.",
    "Si en 24 horas no autoriza que se realice el trabajo se cobrara garaje."
  ];

  tab.document.open();
  tab.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>OT ${escapeHtml(data.otId)} - TECNINORTE</title>
        <style>
          @page { size: A4; margin: 14mm; }
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
            grid-template-columns: 1fr;
            gap: 10px;
            align-items: start;
            padding: 10px 0 16px;
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
          h1, h2, p { margin: 0; }
          h1 {
            color: #061b41;
            font-size: 23px;
            text-transform: uppercase;
            letter-spacing: 0;
          }
          h2 {
            margin: 14px 0 8px;
            padding: 7px 9px;
            border-left: 5px solid #e30613;
            background: #f6f8fb;
            color: #061b41;
            font-size: 14px;
            text-transform: uppercase;
          }
          .muted {
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .meta {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            text-align: left;
          }
          .meta-box {
            padding: 7px 9px;
            border: 1px solid #d8e0eb;
            border-radius: 6px;
            background: #f8fafc;
          }
          .meta-box span {
            display: block;
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .meta-box strong {
            display: block;
            color: #061b41;
            font-size: 13px;
          }
          .pdf-logo {
            display: block;
            width: 100%;
            max-width: 640px;
            height: auto;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 6px 7px;
            border: 1px solid #d8e0eb;
            text-align: left;
            vertical-align: top;
          }
          th {
            width: 34%;
            background: #f6f8fb;
            color: #17345f;
            font-size: 11px;
            text-transform: uppercase;
          }
          .detalle th:nth-child(1), .detalle td:nth-child(1) { width: 22%; }
          .detalle th:nth-child(3), .detalle td:nth-child(3) { width: 14%; text-align: center; }
          .notes {
            min-height: 60px;
            padding: 9px;
            border: 1px solid #d8e0eb;
            border-radius: 6px;
            background: #ffffff;
            white-space: pre-wrap;
          }
          .signatures, .evidences {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          figure {
            margin: 0;
            break-inside: avoid;
          }
          img {
            display: block;
            max-width: 100%;
            max-height: 210px;
            object-fit: contain;
            border: 1px solid #d8e0eb;
            border-radius: 6px;
            background: #ffffff;
          }
          figcaption {
            margin-top: 5px;
            color: #374151;
            font-weight: 700;
          }
          .empty-box {
            height: 110px;
            border: 1px solid #d8e0eb;
            border-radius: 6px;
            background: #f6f8fb;
          }
          .footer-note {
            margin-top: 16px;
            padding-top: 8px;
            border-top: 2px solid #061b41;
            color: #64748b;
            font-size: 10px;
            text-align: center;
          }
          .conditions {
            margin-top: 14px;
            padding: 10px 12px;
            border: 1px solid #061b41;
            border-radius: 6px;
            break-inside: avoid;
          }
          .conditions h2 {
            margin: 0 0 8px;
            padding: 0;
            border: 0;
            background: transparent;
            text-align: center;
            font-size: 12px;
          }
          .conditions ol {
            margin: 0;
            padding-left: 18px;
          }
          .conditions li {
            margin-bottom: 5px;
            color: #111827;
            font-size: 10.5px;
            line-height: 1.35;
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
            <div>
              ${logoMarkup}
              <p class="muted">Orden de trabajo generada por el sistema</p>
            </div>
            <div class="meta">
              <div class="meta-box">
                <span>Orden</span>
                <strong>${escapeHtml(data.otId)}</strong>
              </div>
              <div class="meta-box">
                <span>Fecha</span>
                <strong>${escapeHtml(data.fecha)}</strong>
              </div>
              <div class="meta-box">
                <span>Placa</span>
                <strong>${escapeHtml(data.cabecera.Placa || "Sin placa")}</strong>
              </div>
            </div>
          </header>

          <section class="grid">
            <div>
              <h2>Cliente</h2>
              <table>${clienteRows}</table>
            </div>
            <div>
              <h2>Vehiculo</h2>
              <table>${vehiculoRows}</table>
            </div>
          </section>

          <section>
            <h2>Observaciones</h2>
            <div class="notes">${escapeHtml(data.cabecera.Observaciones || "Sin observaciones.")}</div>
          </section>

          ${
            data.cabecera.RequiereAlineacionBalanceo || data.cabecera.ObservacionAlineacionBalanceo
              ? `<section>
                  <h2>Trabajo solicitado para alineación y balanceo</h2>
                  <div class="notes">${escapeHtml(
                    data.cabecera.ObservacionAlineacionBalanceo || "Sin observación registrada para alineación y balanceo."
                  )}</div>
                </section>`
              : ""
          }


          ${
            data.cabecera.RequiereCambioAceite || data.cabecera.AceiteSolicitado
              ? `<section>
                  <h2>Cambio de aceite solicitado</h2>
                  <div class="notes">${escapeHtml(
                    data.cabecera.AceiteSolicitado || "Sin aceite especificado."
                  )}</div>
                </section>`
              : ""
          }
          ${
            hasInternalInfo
              ? `<section>
                  <h2>Entrega y trabajo realizado</h2>
                  <table>${entregaRows}</table>
                  <h2>Repuestos usados</h2>
                  <div class="notes">${escapeHtml(
                    data.cabecera.RepuestosUsados || "Sin repuestos registrados."
                  )}</div>
                  <h2>Detalle completo del trabajo</h2>
                  <div class="notes">${escapeHtml(
                    data.cabecera.TrabajoRealizado || "Sin detalle de trabajo realizado."
                  )}</div>
                  ${
                    data.cabecera.RequiereAlineacionBalanceo || data.cabecera.TrabajoAlineacionBalanceo
                      ? `<h2>Detalle de alineación y balanceo</h2>
                        <div class="notes">${escapeHtml(
                          data.cabecera.TrabajoAlineacionBalanceo || "Sin detalle de alineación y balanceo."
                        )}</div>`
                      : ""
                  }
                  ${
                    data.cabecera.RequiereCambioAceite || data.cabecera.TrabajoCambioAceite
                      ? `<h2>Detalle de cambio de aceite</h2>
                        <div class="notes"><strong>Aceite:</strong> ${escapeHtml(
                          data.cabecera.AceiteSolicitado || "Sin aceite especificado."
                        )}<br/><strong>Trabajo realizado:</strong> ${escapeHtml(
                          data.cabecera.TrabajoCambioAceite || "Sin detalle de cambio de aceite."
                        )}</div>`
                      : ""
                  }                </section>`
              : ""
          }

          <section>
            <h2>Trabajos y repuestos</h2>
            <table class="detalle">
              <thead>
                <tr><th>Tipo</th><th>Descripción</th><th>Cantidad</th></tr>
              </thead>
              <tbody>${detalleRows}</tbody>
            </table>
          </section>

          ${
            evidenceBlocks
              ? `<section><h2>Evidencias</h2><div class="evidences">${evidenceBlocks}</div></section>`
              : ""
          }

          <section>
            <h2>Firmas</h2>
            <div class="signatures">
              <figure>
                ${
                  data.firmas.cliente
                    ? `<img src="${data.firmas.cliente}" alt="Firma cliente" />`
                    : `<div class="empty-box"></div>`
                }
                <figcaption>Cliente</figcaption>
              </figure>
              <figure>
                ${
                  data.firmas.recepcion
                    ? `<img src="${data.firmas.recepcion}" alt="Firma recepcion" />`
                    : `<div class="empty-box"></div>`
                }
                <figcaption>Recepcion</figcaption>
              </figure>
            </div>
          </section>

          <section class="conditions">
            <h2>Condiciones de servicio de este taller</h2>
            <ol>
              ${serviceConditions.map((condition) => `<li>${escapeHtml(condition)}</li>`).join("")}
            </ol>
          </section>
          <p class="footer-note">
            JS Servicio Automotriz TecniNorte - Respaldo de orden de trabajo para cliente
          </p>
        </main>
        <script>
          window.addEventListener("load", () => setTimeout(() => window.print(), 350));
        </script>
      </body>
    </html>
  `);
  tab.document.close();
}

const preCompraReportSections = [
  {
    title: "1 - Body kit",
    items: [
      ["body_latas", "Revisión latas"],
      ["body_pintura", "Revisión estado pintura"],
      ["body_choques", "Revisión choques"],
      ["body_parabrisas", "Revisión parabrisas"],
      ["body_puertas", "Revisión apertura y cierre cuadratura puertas"],
      ["body_espejos", "Revisión espejos laterales"],
      ["body_repuesto", "Revisión neumático repuesto"],
      ["body_herramientas", "Revisión herramientas auto"],
      ["body_botiquin", "Revisión botiquín"],
      ["body_seguridad", "Revisión dado de seguridad"],
      ["body_vidrios", "Revisión vidrios de puertas"],
      ["body_kilometraje", "Revisión kilometraje"],
      ["body_vin_chasis", "Revisión VIN visual en chasis"],
      ["body_molduras", "Revisión molduras e insignias"],
      ["body_opticos_focos", "Revisión ópticos y focos"],
      ["body_antena", "Revisión antena eléctrica"],
      ["body_alarma", "Revisión alarma"]
    ]
  },
  {
    title: "2 - Interior",
    items: [
      ["int_alzavidrios", "Revisión alza vidrios, controles y apertura"],
      ["int_arranque", "Revisión arranque motor"],
      ["int_luces_testigos", "Revisión luces y testigos tablero apagados"],
      ["int_vibracion", "Revisión vibración ralentí"],
      ["int_sensores_cables", "Revisión estado plásticos air bag, cinturones, bobina y cables"],
      ["int_direccion", "Revisión dirección: tope, ruidos, vibración o golpes"],
      ["int_nivel_embrague", "Revisión ruidos de embrague"],
      ["int_dureza_pedal", "Revisión dureza en pedal embrague"],
      ["int_capota", "Revisión capota eléctrica si aplica"],
      ["int_corte_embrague", "Revisión corte de embrague"],
      ["int_pedal_freno", "Revisión pedal de freno"],
      ["int_aceleracion", "Revisión pedal de aceleración"],
      ["int_bocina", "Revisión bocina"],
      ["int_cierre", "Revisión cierre centralizado"],
      ["int_espejos", "Revisión espejos eléctricos laterales"],
      ["int_luces", "Revisión luces"],
      ["int_mandos_calefaccion", "Revisión comandos calefacción y A/C"],
      ["int_controles_volante", "Revisión controles al volante"],
      ["int_asientos", "Revisión asientos delanteros y traseros"],
      ["int_limpia_parabrisas", "Revisión limpia parabrisas"],
      ["int_radio", "Revisión radio"],
      ["int_fugas_agua", "Revisión fugas de agua radiador/calefacción"],
      ["int_calefaccion", "Revisión calefacción"],
      ["int_enfriamiento_ac", "Revisión enfriamiento A/C"],
      ["int_tapices", "Revisión tapices"],
      ["int_eficacia_freno", "Revisión eficacia freno mano"],
      ["int_sensores_acercamiento", "Revisión sensores acercamiento"],
      ["int_camara_retroceso", "Revisión cámara retroceso"],
      ["int_correderas", "Revisión correderas asientos"],
      ["int_cinturones", "Revisión cinturones seguridad"]
    ]
  },
  {
    title: "3 - Motor, chasis y seguridad",
    items: [
      ["mot_presion_valvulas", "Presión de válvulas / compresión"],
      ["mot_estado_motor", "Estado general motor"],
      ["mot_fugas", "Fugas de aceite, refrigerante o combustible"],
      ["mot_humo", "Humo, temperatura y ralentí"],
      ["mot_correas", "Correas, mangueras y soportes"],
      ["mot_caja", "Caja, embrague y transmisión"],
      ["mot_suspension", "Suspensión, bujes y amortiguadores"],
      ["mot_frenos", "Frenos, discos y pastillas"],
      ["mot_llantas", "Estado llantas y desgaste"],
      ["mot_bateria", "Batería, alternador y sistema de carga"],
      ["mot_scanner", "Scanner y códigos de falla"],
      ["mot_sensores", "Sensores o alertas encendidas"]
    ]
  }
];

function statusMark(item, status) {
  return item?.estado === status ? "X" : "";
}

export function writePreCompraPdfTab(tab, data) {
  if (!tab) return;

  const cabecera = data.cabecera || {};
  const informe = cabecera.InformePreCompra || {};
  const reportItems = informe.items || {};
  const logoMarkup = getTecniNorteLogoSvg("pdf-logo");
  const clienteRows = clienteFields
    .map(([key, label]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(cabecera[key])}</td></tr>`)
    .join("");
  const vehiculoRows = vehiculoFields
    .map(([key, label]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(cabecera[key])}</td></tr>`)
    .join("");
  const reportSections = preCompraReportSections
    .map(
      (section) => `
        <section class="check-section">
          <h2>${escapeHtml(section.title)}</h2>
          <table class="report-table">
            <thead>
              <tr>
                <th class="detail-col">Detalle</th>
                <th>Buen estado</th>
                <th>Regular</th>
                <th>Mal estado</th>
                <th class="obs-col">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${section.items
                .map(([itemId, label], index) => {
                  const item = reportItems[itemId] || {};
                  return `
                    <tr>
                      <td>${index + 1}. ${escapeHtml(label)}</td>
                      <td class="status-cell">${statusMark(item, "bueno")}</td>
                      <td class="status-cell">${statusMark(item, "regular")}</td>
                      <td class="status-cell">${statusMark(item, "malo")}</td>
                      <td>${escapeHtml(item.observacion || (item.estado ? "" : "No aplica"))}</td>
                    </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </section>`
    )
    .join("");
  const routeObservation = informe.observacionRuta || "No aplica";
  const conclusion = informe.conclusionCliente || "Sin conclusión registrada.";

  tab.document.open();
  tab.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Informe pre compra OT ${escapeHtml(data.otId)} - TECNINORTE</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #061b41; background: #edf1f7; font-family: Arial, sans-serif; font-size: 10.5px; }
          .toolbar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 8px; padding: 10px; background: #fff; border-bottom: 1px solid #d8e0eb; }
          button { min-height: 36px; padding: 0 14px; border: 1px solid #e30613; border-radius: 6px; background: #e30613; color: #fff; font-weight: 700; cursor: pointer; }
          main { width: min(210mm, 100%); margin: 0 auto; padding: 10px; background: #fff; }
          header { padding: 8px 0 12px; border-bottom: 3px solid #061b41; position: relative; }
          header::after { content: ""; position: absolute; left: 0; bottom: -3px; width: 36%; height: 3px; background: #e30613; }
          .pdf-logo { display: block; width: min(100%, 620px); max-width: 620px; height: auto; margin: 0 auto 6px; }
          h1 { margin: 8px 0 3px; font-size: 20px; text-transform: uppercase; letter-spacing: 0; }
          h2 { margin: 10px 0 5px; padding: 5px 7px; border-left: 4px solid #e30613; background: #f6f8fb; font-size: 11.5px; text-transform: uppercase; break-after: avoid; }
          p { margin: 0; }
          .muted { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 9px; }
          .meta-box { padding: 6px 7px; border: 1px solid #8eb4d7; border-radius: 4px; background: #f8fafc; }
          .meta-box span { display: block; color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; }
          .meta-box strong { display: block; color: #061b41; font-size: 11px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 4px 5px; border: 1px solid #8eb4d7; text-align: left; vertical-align: middle; }
          th { background: #f6f8fb; color: #17345f; font-size: 9px; text-transform: uppercase; }
          .grid th { width: 35%; }
          .notes { min-height: 42px; padding: 7px; border: 1px solid #8eb4d7; border-radius: 4px; background: #fff; white-space: pre-wrap; }
          .check-section { break-inside: avoid; }
          .report-table th { text-align: center; }
          .report-table .detail-col { width: 42%; text-align: left; }
          .report-table .obs-col { width: 28%; text-align: left; }
          .report-table td:nth-child(1) { font-size: 9.5px; }
          .status-cell { width: 7%; text-align: center; font-weight: 800; font-size: 12px; color: #061b41; }
          .conclusion { border: 2px solid #061b41; background: #f8fafc; }
          .footer-note { margin-top: 12px; padding-top: 7px; border-top: 2px solid #061b41; color: #64748b; font-size: 9px; text-align: center; }
          @media print { body { background: #fff; } .toolbar { display: none; } main { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Guardar PDF</button></div>
        <main>
          <header>
            ${logoMarkup}
            <h1>Informe técnico pre compra</h1>
            <p class="muted">Checklist técnico con estado del vehículo y observaciones</p>
            <div class="meta">
              <div class="meta-box"><span>OT</span><strong>${escapeHtml(data.otId)}</strong></div>
              <div class="meta-box"><span>Fecha</span><strong>${escapeHtml(data.fecha)}</strong></div>
              <div class="meta-box"><span>Placa</span><strong>${escapeHtml(cabecera.Placa || "-")}</strong></div>
              <div class="meta-box"><span>Mecánico</span><strong>${escapeHtml(cabecera.MecanicoResponsable || "-")}</strong></div>
            </div>
          </header>
          <section class="grid">
            <div><h2>Cliente</h2><table>${clienteRows}</table></div>
            <div><h2>Vehículo</h2><table>${vehiculoRows}</table></div>
          </section>

          ${reportSections}
          <section>
            <h2>Observación prueba de ruta</h2>
            <div class="notes">${escapeHtml(routeObservation)}</div>
          </section>
          <section>
            <h2>Conclusión para el cliente</h2>
            <div class="notes conclusion">${escapeHtml(conclusion)}</div>
          </section>
          <p class="footer-note">JS Servicio Automotriz TecniNorte - Informe pre compra para envío al cliente</p>
        </main>
        <script>window.addEventListener("load", () => setTimeout(() => window.print(), 350));</script>
      </body>
    </html>
  `);
  tab.document.close();
}