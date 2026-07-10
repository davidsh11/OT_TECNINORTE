console.log("BOOT:", __filename);

const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { admin, getFirebase, initFirebase, OT_COLLECTION } = require("./firebase");

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 4000;
const CLIENTES_COLLECTION = process.env.FIRESTORE_CLIENTES_COLLECTION || "Clientes";
const CLIENTES_VEHICULOS_COLLECTION =
  process.env.FIRESTORE_CLIENTES_VEHICULOS_COLLECTION || "ClientesVehiculos";
const SYSTEM_USERS_COLLECTION = process.env.SYSTEM_USERS_COLLECTION || "UsuariosSistema";
const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function upperText(value) {
  return String(value || "").trim().toUpperCase();
}

function sentenceText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/(^\s*[\p{L}])|([.!?:]\s+[\p{L}])|(\n\s*[\p{L}])/gu, (match) =>
      match.toUpperCase()
    );
}

function normalizePlate(value) {
  return String(value || "").trim().toUpperCase().replace(/\s/g, "");
}

function normalizeIdentification(value) {
  return String(value || "").trim().toUpperCase().replace(/\s/g, "");
}

function buildClienteVehiculo(cabecera) {
  const placa = normalizePlate(cabecera?.Placa);
  const cl = normalizeIdentification(cabecera?.CL);

  return {
    Propietario: upperText(cabecera?.Propietario),
    CL: cl,
    CLKey: cl,
    Telefonos: upperText(cabecera?.Telefonos),
    CorreoElectronico: upperText(cabecera?.CorreoElectronico),
    Direccion: upperText(cabecera?.Direccion),
    Marca: upperText(cabecera?.Marca),
    Modelo: upperText(cabecera?.Modelo),
    Placa: placa,
    Color: upperText(cabecera?.Color),
    MarcaRadio: upperText(cabecera?.MarcaRadio),
    Anio: upperText(cabecera?.Anio),
    Kilometraje: upperText(cabecera?.Kilometraje),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function buildCliente(cabecera) {
  const cl = normalizeIdentification(cabecera?.CL);

  return {
    CL: cl,
    Propietario: upperText(cabecera?.Propietario),
    Telefonos: upperText(cabecera?.Telefonos),
    CorreoElectronico: upperText(cabecera?.CorreoElectronico),
    Direccion: upperText(cabecera?.Direccion),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function clientFromRecord(record, cl) {
  return {
    Propietario: upperText(record?.Propietario),
    CL: upperText(record?.CL || cl),
    Telefonos: upperText(record?.Telefonos),
    CorreoElectronico: upperText(record?.CorreoElectronico),
    Direccion: upperText(record?.Direccion)
  };
}

function recordDateValue(record) {
  return record?.updatedAt?.toMillis?.() || record?.createdAt?.toMillis?.() || 0;
}

function latestRecord(records) {
  return records.reduce((latest, item) => {
    return recordDateValue(item) > recordDateValue(latest) ? item : latest;
  }, records[0]);
}


function isCurrentMonthDate(value) {
  if (!value) return false;
  const date = value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}
function hasAlignmentBalanceWork(ot) {
  return Boolean(ot?.RequiereAlineacionBalanceo);
}

function isAlignmentBalanceCompleted(ot) {
  if (!hasAlignmentBalanceWork(ot)) return true;
  return Boolean(ot?.FechaAlineacionBalanceo) && normalizeText(ot?.TrabajoAlineacionBalanceo) !== "";
}

function isMechanicalCompleted(ot) {
  const estado = normalizeText(ot.Estado);
  return Boolean(ot.FechaEntrega) || ["entregado", "completado", "finalizado", "finalizada"].includes(estado);
}

function hasOilChangeWork(ot) {
  return Boolean(ot?.RequiereCambioAceite);
}

function isOilChangeCompleted(ot) {
  if (!hasOilChangeWork(ot)) return true;
  return Boolean(ot?.FechaCambioAceite) && normalizeText(ot?.TrabajoCambioAceite) !== "";
}

function isCompleted(ot) {
  return isMechanicalCompleted(ot) && isAlignmentBalanceCompleted(ot) && isOilChangeCompleted(ot);
}
function hasChargeValue(ot) {
  return [ot.ValorCobrar, ot.ValorRepuestos, ot.ValorAlineacionBalanceo].some(
    (value) => normalizeText(value) !== ""
  );
}

function parseMoney(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function otAmounts(ot) {
  const laborAmount = parseMoney(ot.ValorCobrar);
  const partsAmount = parseMoney(ot.ValorRepuestos);
  const alignmentAmount = parseMoney(ot.ValorAlineacionBalanceo);
  return {
    laborAmount,
    partsAmount,
    alignmentAmount,
    totalAmount: laborAmount + partsAmount + alignmentAmount
  };
}
function moneyText(value) {
  return Number(value || 0).toFixed(2);
}

function pendingAmount(ot) {
  const { totalAmount } = otAmounts(ot);

  if (ot?.PagoParcialPendiente) {
    const savedBalance = parseMoney(ot.SaldoPendiente);
    if (savedBalance > 0) return savedBalance;

    return Math.max(totalAmount - parseMoney(ot.ValorAbonado), 0);
  }

  if (ot?.PagoPendienteEmpresa) {
    return totalAmount;
  }

  return ot?.Cobrado ? 0 : totalAmount;
}

function otListPayload(ot) {
  const { totalAmount } = otAmounts(ot);
  const pending = pendingAmount(ot);

  return {
    ...ot,
    ValorTotal: moneyText(totalAmount),
    ValorPendienteCobro: moneyText(pending),
    SaldoPendiente: pending > 0 ? moneyText(pending) : upperText(ot.SaldoPendiente),
    EstadoProceso: ot.Cobrado && ot.SalidaAutorizada ? "FINALIZADO" : "EN PROCESO"
  };
}
function readDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const localMatch = value.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*|\s+)?(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (localMatch) {
      const [, day, month, year, hour = "0", minute = "0", second = "0"] = localMatch;
      const localDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );
      return Number.isNaN(localDate.getTime()) ? null : localDate;
    }

    return null;
  }
  if (value._seconds) return new Date(value._seconds * 1000);
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

function reportDate(ot) {
  return readDate(ot.FechaCobro) || readDate(ot.FechaEntrega) || readDate(ot.FechaRecepcion);
}

function displayDate(value) {
  const date = readDate(value);
  if (date) return date.toISOString();
  return typeof value === "string" ? value : "";
}

function matchesDateRange(ot, dateFrom, dateTo) {
  const date = reportDate(ot);
  if (!date) return false;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function processStatus(ot) {
  return ot?.Cobrado && ot?.SalidaAutorizada ? "FINALIZADO" : "EN PROCESO";
}

function mechanicTrackingStatus(ot) {
  const mechanic = upperText(ot.MecanicoResponsable || ot.MecanicoAsignadoNombre || ot.MecanicoAsignado);
  const estado = normalizeText(ot.Estado);
  const delivered = isMechanicalCompleted(ot);
  const closed = Boolean(ot.SalidaAutorizada);
  const charged = Boolean(ot.Cobrado);
  const hasWorkshopProgress = Boolean(
    readDate(ot.FechaInicioTrabajo) ||
    normalizeText(ot.TrabajoRealizado) ||
      normalizeText(ot.RepuestosUsados) ||
      ["en proceso", "realizando", "proceso", "en taller"].includes(estado)
  );

  if (!mechanic && !delivered && !charged && !closed) return "sin_asignar";
  if (delivered || charged || closed) return "finalizada";
  if (hasWorkshopProgress) return "realizando";
  return "pendiente";
}

function alignmentTrackingStatus(ot) {
  if (!ot?.RequiereAlineacionBalanceo) return "finalizada";
  if (ot.FechaAlineacionBalanceo && normalizeText(ot.TrabajoAlineacionBalanceo)) return "finalizada";
  if (ot.FechaInicioAlineacionBalanceo || normalizeText(ot.EstadoAlineacionBalanceo) === "realizando") return "realizando";
  return "pendiente";
}

function oilChangeTrackingStatus(ot) {
  if (!ot?.RequiereCambioAceite) return "finalizada";
  if (ot.FechaCambioAceite && normalizeText(ot.TrabajoCambioAceite)) return "finalizada";
  if (ot.FechaInicioCambioAceite || normalizeText(ot.EstadoCambioAceite) === "realizando") return "realizando";
  return "pendiente";
}
function trackingOtPayload(ot) {
  const mechanic = upperText(ot.MecanicoResponsable || ot.MecanicoAsignadoNombre || ot.MecanicoAsignado);
  const status = mechanicTrackingStatus(ot);

  return {
    ID: ot.ID,
    Propietario: upperText(ot.Propietario),
    CL: upperText(ot.CL),
    Placa: upperText(ot.Placa),
    Marca: upperText(ot.Marca),
    Modelo: upperText(ot.Modelo),
    MecanicoResponsable: mechanic,
    Estado: upperText(ot.Estado || "RECIBIDO"),
    EstadoSeguimiento: status,
    FinalizadaMesActual: isCurrentMonthDate(ot.FechaEntrega),
    FechaRecepcion: displayDate(ot.FechaRecepcion),
    FechaInicioTrabajo: displayDate(ot.FechaInicioTrabajo),
    FechaEntrega: displayDate(ot.FechaEntrega),
    FechaCobro: displayDate(ot.FechaCobro),
    FechaSalida: displayDate(ot.FechaSalida),
    TrabajoRealizado: sentenceText(ot.TrabajoRealizado),
    RepuestosUsados: sentenceText(ot.RepuestosUsados),
    RequiereAlineacionBalanceo: Boolean(ot.RequiereAlineacionBalanceo),
    MecanicoAlineacionBalanceo: upperText(ot.MecanicoAlineacionBalanceo),
    EstadoAlineacionBalanceo: upperText(ot.EstadoAlineacionBalanceo),
    FechaInicioAlineacionBalanceo: displayDate(ot.FechaInicioAlineacionBalanceo),
    FechaAlineacionBalanceo: displayDate(ot.FechaAlineacionBalanceo),
    ObservacionAlineacionBalanceo: sentenceText(ot.ObservacionAlineacionBalanceo),
    TrabajoAlineacionBalanceo: sentenceText(ot.TrabajoAlineacionBalanceo),
    RequiereCambioAceite: Boolean(ot.RequiereCambioAceite),
    MecanicoCambioAceite: upperText(ot.MecanicoCambioAceite),
    EstadoCambioAceite: upperText(ot.EstadoCambioAceite),
    FechaInicioCambioAceite: displayDate(ot.FechaInicioCambioAceite),
    FechaCambioAceite: displayDate(ot.FechaCambioAceite),
    AceiteSolicitado: sentenceText(ot.AceiteSolicitado),
    TrabajoCambioAceite: sentenceText(ot.TrabajoCambioAceite),
    Cobrado: Boolean(ot.Cobrado),
    EsEmpresa: Boolean(ot.EsEmpresa),
    PagoPendienteEmpresa: Boolean(ot.PagoPendienteEmpresa),
    FechaPagoPendienteEmpresa: displayDate(ot.FechaPagoPendienteEmpresa),
    PagoParcialPendiente: Boolean(ot.PagoParcialPendiente),
    ValorAbonado: upperText(ot.ValorAbonado),
    SaldoPendiente: upperText(ot.SaldoPendiente),
    FechaPagoParcial: displayDate(ot.FechaPagoParcial),
    SalidaAutorizada: Boolean(ot.SalidaAutorizada)
  };
}

const PRE_COMPRA_REPORT_SECTIONS = [
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
const PRE_COMPRA_REQUIRED_ITEMS = PRE_COMPRA_REPORT_SECTIONS.flatMap((section) => section.items);
const DEFAULT_SYSTEM_USERS = [
  { username: "recepcion", password: "1234", role: "recepcion", name: "Recepción", allowedViews: ["inicio", "crear", "buscar", "historial", "seguimiento", "salida"] },
  { username: "cobranza", password: "1234", role: "cobranza", name: "Cobranza", allowedViews: ["inicio", "datosClientes", "buscar", "historial", "seguimiento", "cobranza"] },
  { username: "jefe", password: "1234", role: "jefe_taller", name: "Jefe de taller", allowedViews: ["inicio", "buscar", "historial", "taller", "seguimiento", "cierre", "reportes"], canAssignOt: true },
  { username: "angelf", password: "1234", role: "mecanico", name: "ANGELF", mechanicId: "ANGELF", allowedViews: ["inicio", "taller", "seguimiento"], canAssignOt: false },
  { username: "fernandos", password: "1234", role: "mecanico", name: "FERNANDOS", mechanicId: "FERNANDOS", allowedViews: ["inicio", "taller", "seguimiento"], canAssignOt: false },
  { username: "diegom", password: "1234", role: "mecanico", name: "DIEGOM", mechanicId: "DIEGOM", allowedViews: ["inicio", "taller", "seguimiento"], canAssignOt: false },
  { username: "jorges", password: "1234", role: "mecanico", name: "JORGES", mechanicId: "JORGES", allowedViews: ["inicio", "taller", "seguimiento"], canAssignOt: false },
  { username: "joselos", password: "1234", role: "mecanico", name: "JOSELOS", mechanicId: "JOSELOS", allowedViews: ["inicio", "taller", "seguimiento"], canAssignOt: false },
  { username: "yong", password: "1234", role: "mecanico", name: "YONG", mechanicId: "YONG", allowedViews: ["inicio", "taller", "seguimiento"], canAssignOt: false },
  { username: "armandoa", password: "1234", role: "mecanico", name: "ARMANDOA", mechanicId: "ARMANDOA", allowedViews: ["inicio", "taller", "seguimiento"], canAssignOt: false },
  { username: "admin", password: "admin", role: "admin", name: "Administrador", allowedViews: ["inicio", "crear", "buscar", "datosClientes", "historial", "taller", "seguimiento", "cierre", "cobranza", "salida", "reportes", "usuarios"], canAssignOt: true }
];

function userDocId(username) {
  return normalizeText(username);
}

function publicSystemUser(user) {
  const { password, ...safeUser } = user;
  if (safeUser.role === "cobranza") {
    const views = new Set(safeUser.allowedViews || []);
    views.delete("reportes");
    views.add("buscar");
    views.add("seguimiento");
    safeUser.allowedViews = Array.from(views);
  }
  if (safeUser.role === "mecanico") {
    const views = new Set(safeUser.allowedViews || []);
    views.add("seguimiento");
    safeUser.allowedViews = Array.from(views);
  }
  if (safeUser.role === "jefe_taller") {
    const views = new Set(safeUser.allowedViews || []);
    views.add("buscar");
    safeUser.allowedViews = Array.from(views);
  }
  return safeUser;
}

async function ensureSystemUsers(db) {
  const collection = db.collection(SYSTEM_USERS_COLLECTION);
  const snapshot = await collection.limit(1).get();
  if (!snapshot.empty) return;

  const batch = db.batch();
  DEFAULT_SYSTEM_USERS.forEach((user) => {
    batch.set(collection.doc(userDocId(user.username)), {
      ...user,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

async function getSystemUser(db, username) {
  await ensureSystemUsers(db);
  const doc = await db.collection(SYSTEM_USERS_COLLECTION).doc(userDocId(username)).get();
  return doc.exists ? { username: doc.id, ...doc.data() } : null;
}



function normalizePreCompraReport(report = {}) {
  const safeReport = report && typeof report === "object" ? report : {};
  const safeItems = safeReport.items && typeof safeReport.items === "object" ? safeReport.items : {};
  const items = {};

  PRE_COMPRA_REQUIRED_ITEMS.forEach(([itemId]) => {
    const current = safeItems[itemId] && typeof safeItems[itemId] === "object" ? safeItems[itemId] : {};
    items[itemId] = {
      estado: upperText(current.estado).toLowerCase(),
      observacion: sentenceText(current.observacion)
    };
  });

  return {
    items,
    observacionRuta: sentenceText(safeReport.observacionRuta),
    conclusionCliente: sentenceText(safeReport.conclusionCliente)
  };
}
function buildCabecera(cabecera, otId) {
  return {
    ID: otId,
    Propietario: upperText(cabecera?.Propietario),
    CL: normalizeIdentification(cabecera?.CL),
    Telefonos: upperText(cabecera?.Telefonos),
    CorreoElectronico: upperText(cabecera?.CorreoElectronico),
    Direccion: upperText(cabecera?.Direccion),
    Marca: upperText(cabecera?.Marca),
    Modelo: upperText(cabecera?.Modelo),
    Placa: normalizePlate(cabecera?.Placa),
    Color: upperText(cabecera?.Color),
    MarcaRadio: upperText(cabecera?.MarcaRadio),
    Anio: upperText(cabecera?.Anio),
    Kilometraje: upperText(cabecera?.Kilometraje),
    Observaciones: upperText(cabecera?.Observaciones),
    MecanicoResponsable: upperText(cabecera?.MecanicoResponsable),
    RepuestosUsados: sentenceText(cabecera?.RepuestosUsados),
    TrabajoRealizado: sentenceText(cabecera?.TrabajoRealizado),
    RequiereChequeoPreCompra: Boolean(cabecera?.RequiereChequeoPreCompra),
    ObservacionPreCompra: sentenceText(cabecera?.ObservacionPreCompra),
    InformePreCompra: normalizePreCompraReport(cabecera?.InformePreCompra),
    ValorCobrar: upperText(cabecera?.ValorCobrar),
    ValorAlineacionBalanceo: upperText(cabecera?.ValorAlineacionBalanceo),
    ValorRepuestos: upperText(cabecera?.ValorRepuestos),
    RequiereAlineacionBalanceo: Boolean(cabecera?.RequiereAlineacionBalanceo),
    MecanicoAlineacionBalanceo: Boolean(cabecera?.RequiereAlineacionBalanceo) ? "FERNANDOS" : "",
    EstadoAlineacionBalanceo: Boolean(cabecera?.RequiereAlineacionBalanceo) ? upperText(cabecera?.EstadoAlineacionBalanceo || "PENDIENTE") : "",
    FechaInicioAlineacionBalanceo: upperText(cabecera?.FechaInicioAlineacionBalanceo),
    FechaAlineacionBalanceo: upperText(cabecera?.FechaAlineacionBalanceo),
    TrabajoAlineacionBalanceo: sentenceText(cabecera?.TrabajoAlineacionBalanceo),
    ObservacionAlineacionBalanceo: sentenceText(cabecera?.ObservacionAlineacionBalanceo),
    RequiereCambioAceite: Boolean(cabecera?.RequiereCambioAceite),
    MecanicoCambioAceite: Boolean(cabecera?.RequiereCambioAceite) ? "JOSELOS" : "",
    EstadoCambioAceite: Boolean(cabecera?.RequiereCambioAceite) ? upperText(cabecera?.EstadoCambioAceite || "PENDIENTE") : "",
    FechaInicioCambioAceite: upperText(cabecera?.FechaInicioCambioAceite),
    FechaCambioAceite: upperText(cabecera?.FechaCambioAceite),
    AceiteSolicitado: sentenceText(cabecera?.AceiteSolicitado),
    TrabajoCambioAceite: sentenceText(cabecera?.TrabajoCambioAceite),
    EsEmpresa: Boolean(cabecera?.EsEmpresa),
    PagoPendienteEmpresa: Boolean(cabecera?.PagoPendienteEmpresa),
    FechaPagoPendienteEmpresa: upperText(cabecera?.FechaPagoPendienteEmpresa),
    PagoParcialPendiente: Boolean(cabecera?.PagoParcialPendiente),
    ValorAbonado: upperText(cabecera?.ValorAbonado),
    SaldoPendiente: upperText(cabecera?.SaldoPendiente),
    FechaPagoParcial: upperText(cabecera?.FechaPagoParcial),
    Cobrado: Boolean(cabecera?.Cobrado),
    FechaCobro: upperText(cabecera?.FechaCobro),
    SalidaAutorizada: Boolean(cabecera?.SalidaAutorizada),
    FechaSalida: upperText(cabecera?.FechaSalida),
    Estado: upperText(cabecera?.Estado || "RECIBIDO"),
    FechaRecepcion: cabecera?.FechaRecepcion || new Date().toISOString(),
    FechaInicioTrabajo: upperText(cabecera?.FechaInicioTrabajo),
    MecanicoInicioTrabajo: upperText(cabecera?.MecanicoInicioTrabajo),
    FechaEntrega: upperText(cabecera?.FechaEntrega),
    Evidencia1Path: "",
    Evidencia2Path: "",
    FirmaClientePath: "",
    FirmaRecepcionPath: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = userDocId(req.body?.username);
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "Usuario y clave son obligatorios" });
    }

    const { db } = getFirebase();
    const user = await getSystemUser(db, username);

    if (!user || !user.active || user.password !== password) {
      return res.status(401).json({ ok: false, error: "Usuario o clave incorrectos" });
    }

    res.json({ ok: true, user: publicSystemUser(user) });
  } catch (e) {
    console.error("POST /api/auth/login fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/system-users", async (req, res) => {
  try {
    const { db } = getFirebase();
    await ensureSystemUsers(db);
    const snapshot = await db.collection(SYSTEM_USERS_COLLECTION).get();
    const usuarios = snapshot.docs
      .map((doc) => publicSystemUser({ username: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.name || a.username).localeCompare(String(b.name || b.username)));

    res.json({ ok: true, usuarios });
  } catch (e) {
    console.error("GET /api/system-users fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/system-users/:username/password", async (req, res) => {
  try {
    const username = userDocId(req.params.username);
    const password = String(req.body?.password || "").trim();

    if (password.length < 3) {
      return res.status(400).json({ ok: false, error: "La clave debe tener al menos 3 caracteres" });
    }

    const { db } = getFirebase();
    const user = await getSystemUser(db, username);
    if (!user) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    await db.collection(SYSTEM_USERS_COLLECTION).doc(username).update({
      password,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, username });
  } catch (e) {
    console.error("PATCH /api/system-users/:username/password fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/system-users/:username/active", async (req, res) => {
  try {
    const username = userDocId(req.params.username);
    const active = Boolean(req.body?.active);

    if (username === "admin" && !active) {
      return res.status(400).json({ ok: false, error: "No se puede desactivar el usuario admin principal" });
    }

    const { db } = getFirebase();
    const user = await getSystemUser(db, username);
    if (!user) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    await db.collection(SYSTEM_USERS_COLLECTION).doc(username).update({
      active,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, username, active });
  } catch (e) {
    console.error("PATCH /api/system-users/:username/active fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});


app.post("/api/ot", async (req, res) => {
  try {
    const {
      cabecera,
      detalle = []
    } = req.body;

    const requiredFields = [
      ["CL", "Cédula / RUC"],
      ["Propietario", "Propietario"],
      ["Telefonos", "Teléfonos"],
      ["CorreoElectronico", "Correo electrónico"],
      ["Direccion", "Dirección"],
      ["Placa", "Placa"],
      ["Marca", "Marca"],
      ["Modelo", "Modelo"],
      ["Color", "Color"],
      ["MarcaRadio", "Marca radio"],
      ["Anio", "Año"],
      ["Kilometraje", "Kilometraje"]
    ];
    const missingField = requiredFields.find(([key]) => !String(cabecera?.[key] || "").trim());

    if (missingField) {
      return res.status(400).json({ ok: false, error: `Complete todos los datos del cliente y vehículo. Falta: ${missingField[1]}` });
    }

    if (!/^\d{10}$/.test(String(cabecera?.Telefonos || ""))) {
      return res.status(400).json({ ok: false, error: "Teléfonos debe tener 10 dígitos numéricos" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(cabecera.CorreoElectronico))) {
      return res.status(400).json({ ok: false, error: "Correo electrónico no es válido" });
    }

    const placa = normalizePlate(cabecera?.Placa);

    if (!placa) {
      return res.status(400).json({ ok: false, error: "Placa es obligatoria" });
    }

    const { db } = getFirebase();
    const otId = String(Date.now());
    const cl = normalizeIdentification(cabecera?.CL);
    const otRef = db.collection(OT_COLLECTION).doc(otId);
    const clienteVehiculoRef = db.collection(CLIENTES_VEHICULOS_COLLECTION).doc(placa);
    const batch = db.batch();

    batch.set(otRef, buildCabecera(cabecera, otId));
    if (cl) {
      batch.set(
        db.collection(CLIENTES_COLLECTION).doc(cl),
        {
          ...buildCliente(cabecera),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }
    batch.set(
      clienteVehiculoRef,
      {
        ...buildClienteVehiculo(cabecera),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    detalle.forEach((item) => {
      const detalleRef = otRef.collection("detalle").doc(uuidv4());
      batch.set(detalleRef, {
        OrdenID: otId,
        Tipo: upperText(item.Tipo),
        Descripcion: upperText(item.Descripcion),
        Cantidad: item.Cantidad ?? "",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    res.json({
      ok: true,
      otId,
      clienteActualizado: true,
      clientesActualizados: {
        clientes: Boolean(cl),
        clientesVehiculos: true,
        placa
      },
      warnings: ["Datos del cliente actualizados."]
    });
  } catch (e) {
    console.error("POST /api/ot fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/clientes/identificacion/:cl", async (req, res) => {
  try {
    const cl = normalizeIdentification(req.params.cl);

    if (!cl) {
      return res.status(400).json({ ok: false, error: "Cédula/RUC es obligatorio" });
    }

    const { db } = getFirebase();
    const clienteSnapshot = await db.collection(CLIENTES_COLLECTION).doc(cl).get();

    if (clienteSnapshot.exists) {
      return res.json({
        ok: true,
        cliente: clientFromRecord(clienteSnapshot.data(), cl),
        vehiculos: []
      });
    }

    let snapshot = await db
      .collection(CLIENTES_VEHICULOS_COLLECTION)
      .where("CLKey", "==", cl)
      .limit(10)
      .get();

    if (snapshot.empty) {
      snapshot = await db
        .collection(CLIENTES_VEHICULOS_COLLECTION)
        .where("CL", "==", cl)
        .limit(10)
        .get();
    }

    if (snapshot.empty) {
      const allVehiclesSnapshot = await db.collection(CLIENTES_VEHICULOS_COLLECTION).limit(500).get();
      const matchedVehicles = allVehiclesSnapshot.docs
        .map((doc) => ({
          ID: doc.id,
          ...doc.data()
        }))
        .filter((item) => normalizeIdentification(item.CL || item.CLKey) === cl);

      if (matchedVehicles.length) {
        const cliente = latestRecord(matchedVehicles);

        return res.json({
          ok: true,
          cliente: clientFromRecord(cliente, cl),
          vehiculos: matchedVehicles.map((item) => ({
            Placa: upperText(item.Placa || item.ID),
            Marca: upperText(item.Marca),
            Modelo: upperText(item.Modelo),
            Color: upperText(item.Color),
            Anio: upperText(item.Anio)
          }))
        });
      }

      const otSnapshot = await db.collection(OT_COLLECTION).limit(500).get();
      const matchedOts = otSnapshot.docs
        .map((doc) => ({
          ID: doc.id,
          ...doc.data()
        }))
        .filter((item) => normalizeIdentification(item.CL) === cl);

      if (!matchedOts.length) {
        return res.status(404).json({ ok: false, error: "Cliente no encontrado" });
      }

      const cliente = latestRecord(matchedOts);

      return res.json({
        ok: true,
        cliente: clientFromRecord(cliente, cl),
        vehiculos: matchedOts.map((item) => ({
          Placa: upperText(item.Placa),
          Marca: upperText(item.Marca),
          Modelo: upperText(item.Modelo),
          Color: upperText(item.Color),
          Anio: upperText(item.Anio)
        }))
      });
    }

    const registros = snapshot.docs.map((doc) => ({
      ID: doc.id,
      ...doc.data()
    }));
    const cliente = latestRecord(registros);

    res.json({
      ok: true,
      cliente: clientFromRecord(cliente, cl),
      vehiculos: registros.map((item) => ({
        Placa: upperText(item.Placa || item.ID),
        Marca: upperText(item.Marca),
        Modelo: upperText(item.Modelo),
        Color: upperText(item.Color),
        Anio: upperText(item.Anio)
      }))
    });
  } catch (e) {
    console.error("GET /api/clientes/identificacion/:cl fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/clientes-vehiculos/:placa", async (req, res) => {
  try {
    const placa = normalizePlate(req.params.placa);

    if (!placa) {
      return res.status(400).json({ ok: false, error: "Placa es obligatoria" });
    }

    const { db } = getFirebase();
    const snapshot = await db.collection(CLIENTES_VEHICULOS_COLLECTION).doc(placa).get();

    if (!snapshot.exists) {
      return res.status(404).json({ ok: false, error: "Registro no encontrado" });
    }

    res.json({
      ok: true,
      registro: {
        Propietario: upperText(snapshot.data()?.Propietario),
        CL: upperText(snapshot.data()?.CL),
        Telefonos: upperText(snapshot.data()?.Telefonos),
        CorreoElectronico: upperText(snapshot.data()?.CorreoElectronico),
        Direccion: upperText(snapshot.data()?.Direccion),
        Marca: upperText(snapshot.data()?.Marca),
        Modelo: upperText(snapshot.data()?.Modelo),
        Placa: placa,
        Color: upperText(snapshot.data()?.Color),
        MarcaRadio: upperText(snapshot.data()?.MarcaRadio),
        Anio: upperText(snapshot.data()?.Anio),
        Kilometraje: upperText(snapshot.data()?.Kilometraje)
      }
    });
  } catch (e) {
    console.error("GET /api/clientes-vehiculos/:placa fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/clientes-datos", async (req, res) => {
  try {
    const cl = normalizeIdentification(req.query.cl);
    const placa = normalizePlate(req.query.placa);

    if (!cl && !placa) {
      return res.status(400).json({ ok: false, error: "Ingrese cédula/RUC o placa" });
    }

    const { db } = getFirebase();
    let registro = null;

    if (placa) {
      const snapshot = await db.collection(CLIENTES_VEHICULOS_COLLECTION).doc(placa).get();
      if (snapshot.exists) {
        registro = snapshot.data();
      }
    }

    if (!registro && cl) {
      const clienteSnapshot = await db.collection(CLIENTES_COLLECTION).doc(cl).get();
      let vehiculo = null;
      const vehiculoSnapshot = await db
        .collection(CLIENTES_VEHICULOS_COLLECTION)
        .where("CL", "==", cl)
        .limit(1)
        .get();

      if (!vehiculoSnapshot.empty) {
        vehiculo = vehiculoSnapshot.docs[0].data();
      }

      if (clienteSnapshot.exists || vehiculo) {
        registro = {
          ...(vehiculo || {}),
          ...(clienteSnapshot.exists ? clienteSnapshot.data() : {})
        };
      }
    }

    if (!registro) {
      const search = placa || cl;
      const otSnapshot = await db.collection(OT_COLLECTION).limit(300).get();
      const ots = otSnapshot.docs
        .map((doc) => ({
          ID: doc.id,
          ...doc.data()
        }))
        .filter((ot) => {
          if (placa) return normalizePlate(ot.Placa) === search;
          return normalizeIdentification(ot.CL) === search;
        });

      if (ots.length) {
        registro = latestRecord(ots);
      }
    }

    if (!registro) {
      return res.status(404).json({ ok: false, error: "Cliente no encontrado" });
    }

    res.json({
      ok: true,
      registro: {
        Propietario: upperText(registro.Propietario),
        CL: upperText(registro.CL || cl),
        Telefonos: upperText(registro.Telefonos),
        CorreoElectronico: upperText(registro.CorreoElectronico),
        Direccion: upperText(registro.Direccion),
        Placa: normalizePlate(registro.Placa || placa),
        Marca: upperText(registro.Marca),
        Modelo: upperText(registro.Modelo),
        Color: upperText(registro.Color),
        MarcaRadio: upperText(registro.MarcaRadio),
        Anio: upperText(registro.Anio)
      }
    });
  } catch (e) {
    console.error("GET /api/clientes-datos fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/clientes-datos", async (req, res) => {
  try {
    const registro = req.body?.registro || {};
    const original = req.body?.original || {};
    const cl = normalizeIdentification(registro.CL);
    const placa = normalizePlate(registro.Placa);
    const originalPlaca = normalizePlate(original.placa);

    if (!cl) {
      return res.status(400).json({ ok: false, error: "Cédula/RUC es obligatoria" });
    }

    if (!placa) {
      return res.status(400).json({ ok: false, error: "Placa es obligatoria" });
    }

    if (registro.Telefonos && !/^\d{10}$/.test(String(registro.Telefonos))) {
      return res.status(400).json({ ok: false, error: "Teléfonos debe tener 10 dígitos numéricos" });
    }

    if (
      registro.CorreoElectronico &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(registro.CorreoElectronico))
    ) {
      return res.status(400).json({ ok: false, error: "Correo electrónico no es válido" });
    }

    const { db } = getFirebase();
    const batch = db.batch();
    const normalized = {
      Propietario: upperText(registro.Propietario),
      CL: cl,
      CLKey: cl,
      Telefonos: upperText(registro.Telefonos),
      CorreoElectronico: upperText(registro.CorreoElectronico),
      Direccion: upperText(registro.Direccion),
      Placa: placa,
      Marca: upperText(registro.Marca),
      Modelo: upperText(registro.Modelo),
      Color: upperText(registro.Color),
      MarcaRadio: upperText(registro.MarcaRadio),
      Anio: upperText(registro.Anio),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.set(
      db.collection(CLIENTES_COLLECTION).doc(cl),
      {
        CL: cl,
        Propietario: normalized.Propietario,
        Telefonos: normalized.Telefonos,
        CorreoElectronico: normalized.CorreoElectronico,
        Direccion: normalized.Direccion,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    batch.set(db.collection(CLIENTES_VEHICULOS_COLLECTION).doc(placa), normalized, { merge: true });

    if (originalPlaca && originalPlaca !== placa) {
      batch.delete(db.collection(CLIENTES_VEHICULOS_COLLECTION).doc(originalPlaca));
    }

    await batch.commit();

    res.json({
      ok: true,
      registro: normalized
    });
  } catch (e) {
    console.error("PATCH /api/clientes-datos fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/ot", async (req, res) => {
  try {
    const { db } = getFirebase();
    const search = normalizeText(req.query.search);
    const assignedTo = normalizeText(req.query.assignedTo);
    const unassigned = String(req.query.unassigned || "").toLowerCase() === "true";
    const completed = String(req.query.completed || "").toLowerCase() === "true";
    const chargeReady = String(req.query.chargeReady || "").toLowerCase() === "true";
    const paid = String(req.query.paid || "").toLowerCase() === "true";
    const pendingExit = String(req.query.pendingExit || "").toLowerCase() === "true";
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const snapshot = await db
      .collection(OT_COLLECTION)
      .orderBy("FechaRecepcion", "desc")
      .limit(limit)
      .get();

    let ordenes = snapshot.docs.map((doc) => ({
      ID: doc.id,
      ...doc.data()
    }));

    if (search) {
      ordenes = ordenes.filter((ot) => {
        const values = [
          ot.ID,
          ot.Propietario,
          ot.CL,
          ot.Telefonos,
          ot.Placa,
          ot.Marca,
          ot.Modelo,
          ot.Estado,
          ot.MecanicoAsignado,
          ot.MecanicoAsignadoNombre,
          ot.MecanicoResponsable,
          ot.MecanicoAlineacionBalanceo,
          ot.TrabajoAlineacionBalanceo,
          ot.ObservacionAlineacionBalanceo,
          ot.MecanicoCambioAceite,
          ot.AceiteSolicitado,
          ot.TrabajoCambioAceite,
          ot.ValorCobrar,
          ot.ValorRepuestos,
          ot.Cobrado ? "cobrado" : "",
          ot.RepuestosUsados,
          ot.TrabajoRealizado
        ];

        return values.some((value) => normalizeText(value).includes(search));
      });
    }

    if (assignedTo) {
      ordenes = ordenes.filter((ot) =>
        [
          ot.MecanicoResponsable,
          ot.MecanicoAsignado,
          ot.MecanicoAsignadoNombre,
          ot.MecanicoAlineacionBalanceo,
          ot.MecanicoCambioAceite
        ].some((value) => normalizeText(value) === assignedTo)
      );
    }

    if (unassigned) {
      ordenes = ordenes.filter((ot) => !normalizeText(ot.MecanicoResponsable));
    }

    if (completed) {
      ordenes = ordenes.filter(isCompleted);
    }

    if (chargeReady) {
      ordenes = ordenes.filter((ot) => isCompleted(ot) && hasChargeValue(ot) && !ot.Cobrado);
    }

    if (paid) {
      ordenes = ordenes.filter((ot) => Boolean(ot.Cobrado));
    }

    if (pendingExit) {
      ordenes = ordenes.filter((ot) => (Boolean(ot.Cobrado) || Boolean(ot.PagoPendienteEmpresa) || Boolean(ot.PagoParcialPendiente)) && !ot.SalidaAutorizada);
    }

    ordenes = ordenes.map(otListPayload);

    res.json({ ok: true, ordenes });
  } catch (e) {
    console.error("GET /api/ot fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/ot/seguimiento", async (req, res) => {
  try {
    const { db } = getFirebase();
    const limit = Math.min(Number(req.query.limit) || 500, 800);
    const snapshot = await db
      .collection(OT_COLLECTION)
      .orderBy("FechaRecepcion", "desc")
      .limit(limit)
      .get();

    const baseOrdenes = snapshot.docs.map((doc) => ({
      ID: doc.id,
      ...doc.data()
    }));
    const ordenes = baseOrdenes.flatMap((ot) => {
      const baseRow = trackingOtPayload(ot);
      const rows = [baseRow];

      if (ot.RequiereCambioAceite) {
        const oilMechanic = upperText(ot.MecanicoCambioAceite || "JOSELOS");
        const primaryMechanic = upperText(baseRow.MecanicoResponsable);
        const oilStatus = oilChangeTrackingStatus(ot);

        if (oilMechanic && oilMechanic === primaryMechanic) {
          baseRow.AreaTrabajo = baseRow.AreaTrabajo ? `${baseRow.AreaTrabajo} + CAMBIO DE ACEITE` : "MECANICA + CAMBIO DE ACEITE";
          baseRow.AceiteSolicitado = sentenceText(ot.AceiteSolicitado);
          if (baseRow.EstadoSeguimiento === "finalizada" && oilStatus !== "finalizada") {
            baseRow.EstadoSeguimiento = oilStatus;
          } else if (oilStatus === "realizando") {
            baseRow.EstadoSeguimiento = "realizando";
          }
        } else {
          rows.push({
            ...trackingOtPayload(ot),
            MecanicoResponsable: oilMechanic || "JOSELOS",
            AreaTrabajo: "CAMBIO DE ACEITE",
            EstadoSeguimiento: oilStatus,
            FinalizadaMesActual: isCurrentMonthDate(ot.FechaCambioAceite),
            FechaInicioTrabajo: displayDate(ot.FechaInicioCambioAceite),
            FechaEntrega: displayDate(ot.FechaCambioAceite),
            TrabajoRealizado: sentenceText(ot.TrabajoCambioAceite),
            AceiteSolicitado: sentenceText(ot.AceiteSolicitado),
            TrabajoCambioAceite: sentenceText(ot.TrabajoCambioAceite)
          });
        }
      }
      if (ot.RequiereAlineacionBalanceo) {
        const alignmentMechanic = upperText(ot.MecanicoAlineacionBalanceo || "FERNANDOS");
        const primaryMechanic = upperText(baseRow.MecanicoResponsable);
        const alignmentStatus = alignmentTrackingStatus(ot);

        if (alignmentMechanic && alignmentMechanic === primaryMechanic) {
          baseRow.AreaTrabajo = baseRow.AreaTrabajo ? `${baseRow.AreaTrabajo} + ALINEACION Y BALANCEO` : "MECANICA + ALINEACION Y BALANCEO";
          baseRow.ObservacionAlineacionBalanceo = sentenceText(ot.ObservacionAlineacionBalanceo);
          if (baseRow.EstadoSeguimiento === "finalizada" && alignmentStatus !== "finalizada") {
            baseRow.EstadoSeguimiento = alignmentStatus;
          } else if (alignmentStatus === "realizando") {
            baseRow.EstadoSeguimiento = "realizando";
          }
        } else {
          rows.push({
            ...trackingOtPayload(ot),
            MecanicoResponsable: alignmentMechanic || "FERNANDOS",
            AreaTrabajo: "ALINEACION Y BALANCEO",
            EstadoSeguimiento: alignmentStatus,
            FinalizadaMesActual: isCurrentMonthDate(ot.FechaAlineacionBalanceo),
            FechaInicioTrabajo: displayDate(ot.FechaInicioAlineacionBalanceo),
            FechaEntrega: displayDate(ot.FechaAlineacionBalanceo),
            TrabajoRealizado: sentenceText(ot.TrabajoAlineacionBalanceo),
            ObservacionAlineacionBalanceo: sentenceText(ot.ObservacionAlineacionBalanceo)
          });
        }
      }

      return rows;
    });
    const pendientesSalida = ordenes.filter((ot) => !ot.AreaTrabajo && (ot.Cobrado || ot.PagoPendienteEmpresa || ot.PagoParcialPendiente) && !ot.SalidaAutorizada);
    const activas = ordenes.filter((ot) => !ot.Cobrado && !ot.PagoPendienteEmpresa && !ot.PagoParcialPendiente && !ot.SalidaAutorizada && ot.EstadoSeguimiento !== "finalizada");
    const mecanicosMap = new Map();

    ordenes
      .filter((ot) => ot.MecanicoResponsable)
      .forEach((ot) => {
        const name = ot.MecanicoResponsable;
        const current = mecanicosMap.get(name) || {
          mecanico: name,
          asignadas: 0,
          realizando: 0,
          pendientes: 0,
          finalizadas: 0,
          ots: []
        };

        current.asignadas += ot.EstadoSeguimiento === "finalizada" ? 0 : 1;
        current.realizando += ot.EstadoSeguimiento === "realizando" ? 1 : 0;
        current.pendientes += ot.EstadoSeguimiento === "pendiente" ? 1 : 0;
        current.finalizadas += ot.EstadoSeguimiento === "finalizada" && ot.FinalizadaMesActual ? 1 : 0;
        if (ot.EstadoSeguimiento !== "finalizada") current.ots.push(ot);
        mecanicosMap.set(name, current);
      });

    const mecanicos = Array.from(mecanicosMap.values()).sort((a, b) => {
      const loadDiff = b.asignadas - a.asignadas;
      return loadDiff || a.mecanico.localeCompare(b.mecanico);
    });

    res.json({
      ok: true,
      resumen: {
        ingresoTaller: activas.length,
        sinAsignar: activas.filter((ot) => ot.EstadoSeguimiento === "sin_asignar").length,
        asignadas: activas.filter((ot) => ot.MecanicoResponsable).length,
        realizando: activas.filter((ot) => ot.EstadoSeguimiento === "realizando").length,
        pendientes: activas.filter((ot) => ot.EstadoSeguimiento === "pendiente").length,
        pendientesSalida: pendientesSalida.length
      },
      mecanicos,
      ordenes: activas,
      pendientesSalida
    });
  } catch (e) {
    console.error("GET /api/ot/seguimiento fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/ot/stats", async (req, res) => {
  try {
    const { db } = getFirebase();
    const snapshot = await db.collection(OT_COLLECTION).get();
    const ordenes = snapshot.docs.map((doc) => doc.data());
    const completadas = ordenes.filter(isCompleted).length;

    res.json({
      ok: true,
      stats: {
        total: ordenes.length,
        completadas,
        proceso: ordenes.length - completadas
      }
    });
  } catch (e) {
    console.error("GET /api/ot/stats fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/historial", async (req, res) => {
  try {
    const { db } = getFirebase();
    const cl = normalizeIdentification(req.query.cl);
    const placa = normalizePlate(req.query.placa);
    const search = normalizeText(req.query.search);
    const dateFrom = req.query.dateFrom ? new Date(`${req.query.dateFrom}T00:00:00`) : null;
    const dateTo = req.query.dateTo ? new Date(`${req.query.dateTo}T23:59:59`) : null;
    const limit = Math.min(Number(req.query.limit) || 150, 300);
    const snapshot = await db
      .collection(OT_COLLECTION)
      .orderBy("FechaRecepcion", "desc")
      .limit(limit)
      .get();

    let ordenes = snapshot.docs.map((doc) => ({
      ID: doc.id,
      ...doc.data()
    }));

    if (cl) {
      ordenes = ordenes.filter((ot) => normalizeIdentification(ot.CL) === cl);
    }

    if (placa) {
      ordenes = ordenes.filter((ot) => normalizePlate(ot.Placa) === placa);
    }

    if (dateFrom || dateTo) {
      ordenes = ordenes.filter((ot) => matchesDateRange(ot, dateFrom, dateTo));
    }

    if (search) {
      ordenes = ordenes.filter((ot) => {
        const values = [
          ot.ID,
          ot.Propietario,
          ot.CL,
          ot.Placa,
          ot.Marca,
          ot.Modelo,
          ot.Kilometraje,
          ot.TrabajoRealizado,
          ot.RepuestosUsados,
          ot.Observaciones,
          ot.MecanicoResponsable,
          ot.Estado
        ];

        return values.some((value) => normalizeText(value).includes(search));
      });
    }

    const historial = await Promise.all(
      ordenes.map(async (ot) => {
        const detalleSnapshot = await db.collection(OT_COLLECTION).doc(String(ot.ID)).collection("detalle").get();
        const detalle = detalleSnapshot.docs.map((doc) => ({
          ID: doc.id,
          ...doc.data()
        }));
        const trabajos = detalle
          .filter((item) => normalizeText(item.Tipo).includes("trabajo"))
          .map((item) => upperText(item.Descripcion))
          .filter(Boolean);
        const repuestos = detalle
          .filter((item) => normalizeText(item.Tipo).includes("repuesto"))
          .map((item) => ({
            Descripcion: upperText(item.Descripcion),
            Cantidad: item.Cantidad ?? ""
          }))
          .filter((item) => item.Descripcion);

        return {
          ID: ot.ID,
          Fecha: displayDate(ot.FechaEntrega || ot.FechaRecepcion),
          FechaRecepcion: displayDate(ot.FechaRecepcion),
          FechaEntrega: displayDate(ot.FechaEntrega),
          Propietario: upperText(ot.Propietario),
          CL: upperText(ot.CL),
          Telefonos: upperText(ot.Telefonos),
          CorreoElectronico: upperText(ot.CorreoElectronico),
          Direccion: upperText(ot.Direccion),
          Placa: upperText(ot.Placa),
          Marca: upperText(ot.Marca),
          Modelo: upperText(ot.Modelo),
          Color: upperText(ot.Color),
          MarcaRadio: upperText(ot.MarcaRadio),
          Anio: upperText(ot.Anio),
          Kilometraje: upperText(ot.Kilometraje),
          MecanicoResponsable: upperText(ot.MecanicoResponsable || ot.MecanicoAsignadoNombre || ot.MecanicoAsignado),
          MecanicoAsignado: upperText(ot.MecanicoAsignado),
          MecanicoAsignadoNombre: upperText(ot.MecanicoAsignadoNombre),
          MecanicoInicioTrabajo: upperText(ot.MecanicoInicioTrabajo),
          Estado: upperText(ot.Estado),
          EstadoProceso: processStatus(ot),
          FechaInicioTrabajo: displayDate(ot.FechaInicioTrabajo),
          FechaCobro: displayDate(ot.FechaCobro),
          FechaSalida: displayDate(ot.FechaSalida),
          FechaPagoPendienteEmpresa: displayDate(ot.FechaPagoPendienteEmpresa),
          ValorCobrar: upperText(ot.ValorCobrar),
          ValorAlineacionBalanceo: upperText(ot.ValorAlineacionBalanceo),
          ValorRepuestos: upperText(ot.ValorRepuestos),
          EsEmpresa: Boolean(ot.EsEmpresa),
          PagoPendienteEmpresa: Boolean(ot.PagoPendienteEmpresa),
          Cobrado: Boolean(ot.Cobrado),
          SalidaAutorizada: Boolean(ot.SalidaAutorizada),
          Observaciones: upperText(ot.Observaciones),
          TrabajoRealizado: sentenceText(ot.TrabajoRealizado),
          RepuestosUsados: sentenceText(ot.RepuestosUsados),
          RequiereAlineacionBalanceo: Boolean(ot.RequiereAlineacionBalanceo),
          MecanicoAlineacionBalanceo: upperText(ot.MecanicoAlineacionBalanceo),
          TrabajoAlineacionBalanceo: sentenceText(ot.TrabajoAlineacionBalanceo),
          ObservacionAlineacionBalanceo: sentenceText(ot.ObservacionAlineacionBalanceo),
          FechaAlineacionBalanceo: displayDate(ot.FechaAlineacionBalanceo),
          Evidencia1Path: ot.Evidencia1Path || "",
          Evidencia2Path: ot.Evidencia2Path || "",
          FirmaClientePath: ot.FirmaClientePath || "",
          FirmaRecepcionPath: ot.FirmaRecepcionPath || "",
          trabajos,
          repuestos,
          detalle
        };
      })
    );

    const vehiculos = Array.from(
      new Map(
        historial
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

    res.json({
      ok: true,
      total: historial.length,
      vehiculos,
      historial
    });
  } catch (e) {
    console.error("GET /api/historial fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/reports/finance", async (req, res) => {
  try {
    const { db } = getFirebase();
    const search = normalizeText(req.query.search);
    const mechanic = normalizeText(req.query.mechanic);
    const reportYear = Number(req.query.year) || new Date().getFullYear();
    const dateFrom = req.query.dateFrom ? new Date(`${req.query.dateFrom}T00:00:00`) : null;
    const dateTo = req.query.dateTo ? new Date(`${req.query.dateTo}T23:59:59`) : null;
    const snapshot = await db.collection(OT_COLLECTION).get();

    let ordenes = snapshot.docs.map((doc) => ({
      ID: doc.id,
      ...doc.data()
    }));

    if (search) {
      ordenes = ordenes.filter((ot) => {
        const values = [ot.ID, ot.Propietario, ot.CL, ot.Telefonos, ot.Placa, ot.Marca, ot.Modelo];
        return values.some((value) => normalizeText(value).includes(search));
      });
    }

    if (mechanic) {
      ordenes = ordenes.filter((ot) => (
        normalizeText(ot.MecanicoResponsable) === mechanic ||
        normalizeText(ot.MecanicoAlineacionBalanceo) === mechanic
      ));
    }

    const monthly = MONTH_LABELS.map((month) => ({
      month,
      montoCobrado: 0,
      montoRepuestos: 0,
      montoManoObra: 0
    }));

    ordenes.forEach((ot) => {
      const date = reportDate(ot);
      if (!date || date.getFullYear() !== reportYear) return;

      const monthIndex = date.getMonth();
      const { laborAmount, partsAmount, alignmentAmount, totalAmount } = otAmounts(ot);

      monthly[monthIndex].montoRepuestos += partsAmount;
      monthly[monthIndex].montoManoObra += laborAmount + alignmentAmount;
      if (ot.Cobrado) {
        monthly[monthIndex].montoCobrado += totalAmount;
      }
    });

    if (dateFrom || dateTo) {
      ordenes = ordenes.filter((ot) => {
        const date = reportDate(ot);
        if (!date) return false;
        if (dateFrom && date < dateFrom) return false;
        if (dateTo && date > dateTo) return false;
        return true;
      });
    }

    const summary = ordenes.reduce(
      (acc, ot) => {
        const { laborAmount, partsAmount, alignmentAmount, totalAmount } = otAmounts(ot);
        const primaryAmount = laborAmount + partsAmount;
        const isCharged = Boolean(ot.Cobrado);
        const isPendingCharge = !isCharged && hasChargeValue(ot);
        const addMechanicAmount = (mechanicName, amount, parts = 0, labor = amount) => {
          if (amount <= 0) return;

          const name = mechanicName || "Sin mecánico";
          if (!acc.byMechanic[name]) {
            acc.byMechanic[name] = {
              mecanico: name,
              cantidadOt: 0,
              montoGenerado: 0,
              montoCobrado: 0,
              montoPendiente: 0,
              montoRepuestos: 0,
              montoManoObra: 0,
              otIds: new Set()
            };
          }

          if (!acc.byMechanic[name].otIds.has(ot.ID)) {
            acc.byMechanic[name].otIds.add(ot.ID);
            acc.byMechanic[name].cantidadOt += 1;
          }
          acc.byMechanic[name].montoGenerado += amount;
          acc.byMechanic[name].montoRepuestos += parts;
          acc.byMechanic[name].montoManoObra += labor;
          if (isCharged) {
            acc.byMechanic[name].montoCobrado += amount;
          } else if (isPendingCharge) {
            acc.byMechanic[name].montoPendiente += amount;
          }
        };

        acc.totalOt += 1;
        acc.montoGeneral += totalAmount;
        acc.montoRepuestos += partsAmount;
        acc.montoManoObra += laborAmount + alignmentAmount;

        if (isCharged) {
          acc.montoCobrado += totalAmount;
          acc.otCobradas += 1;
        } else if (isPendingCharge) {
          acc.montoPendiente += totalAmount;
          acc.otPendientes += 1;
        }

        addMechanicAmount(ot.MecanicoResponsable, primaryAmount, partsAmount, laborAmount);
        addMechanicAmount(ot.MecanicoAlineacionBalanceo || "FERNANDOS", alignmentAmount, 0, alignmentAmount);
        return acc;
      },
      {
        totalOt: 0,
        otCobradas: 0,
        otPendientes: 0,
        montoGeneral: 0,
        montoCobrado: 0,
        montoPendiente: 0,
        montoRepuestos: 0,
        montoManoObra: 0,
        byMechanic: {}
      }
    );

    res.json({
      ok: true,
      summary: {
        totalOt: summary.totalOt,
        otCobradas: summary.otCobradas,
        otPendientes: summary.otPendientes,
        montoGeneral: summary.montoGeneral,
        montoCobrado: summary.montoCobrado,
        montoPendiente: summary.montoPendiente,
        montoRepuestos: summary.montoRepuestos,
        montoManoObra: summary.montoManoObra
      },
      byMechanic: Object.values(summary.byMechanic)
        .map(({ otIds, ...item }) => item)
        .sort((a, b) => b.montoGenerado - a.montoGenerado),
      monthly,
      ordenes: ordenes.map((ot) => {
        const { totalAmount } = otAmounts(ot);
        return {
          ID: ot.ID,
          Propietario: ot.Propietario || "",
          CL: ot.CL || "",
          Placa: ot.Placa || "",
          MecanicoResponsable: ot.MecanicoResponsable || "",
          MecanicoAlineacionBalanceo: ot.MecanicoAlineacionBalanceo || "",
          ValorCobrar: ot.ValorCobrar || "",
          ValorRepuestos: ot.ValorRepuestos || "",
          ValorAlineacionBalanceo: ot.ValorAlineacionBalanceo || "",
          ValorTotal: totalAmount,
          Cobrado: Boolean(ot.Cobrado),
          FechaCobro: ot.FechaCobro || "",
          FechaEntrega: ot.FechaEntrega || "",
          FechaRecepcion: ot.FechaRecepcion || ""
        };
      })
    });
  } catch (e) {
    console.error("GET /api/reports/finance fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/ot/:id/cobro", async (req, res) => {
  try {
    const { db } = getFirebase();
    const id = String(req.params.id);
    const valorCobrar = req.body?.ValorCobrar ?? "";
    const otRef = db.collection(OT_COLLECTION).doc(id);
    const otSnapshot = await otRef.get();

    if (!otSnapshot.exists) {
      return res.status(404).json({ ok: false, error: "OT no encontrada" });
    }

    const currentOt = otSnapshot.data() || {};

    if (currentOt.Cobrado) {
      return res.status(409).json({
        ok: false,
        error: "La OT ya fue cobrada y no se puede editar el valor de mano de obra"
      });
    }

    await otRef.update({
      ValorCobrar: upperText(valorCobrar),
      ValorAlineacionBalanceo: upperText(req.body?.ValorAlineacionBalanceo ?? currentOt.ValorAlineacionBalanceo ?? ""),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, otId: id });
  } catch (e) {
    console.error("PATCH /api/ot/:id/cobro fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/ot/:id/pago", async (req, res) => {
  try {
    const { db } = getFirebase();
    const id = String(req.params.id);
    const otRef = db.collection(OT_COLLECTION).doc(id);
    const otSnapshot = await otRef.get();

    if (!otSnapshot.exists) {
      return res.status(404).json({ ok: false, error: "OT no encontrada" });
    }

    const currentOt = otSnapshot.data() || {};
    const isCompany = Boolean(req.body?.EsEmpresa);
    const pendingCompanyPayment = Boolean(req.body?.PagoPendienteEmpresa);
    const partialPendingPayment = Boolean(req.body?.PagoParcialPendiente);
    const valorRepuestos = upperText(req.body?.ValorRepuestos ?? currentOt.ValorRepuestos ?? "");
    const valorAbonado = upperText(req.body?.ValorAbonado ?? "");
    const totalAmount = parseMoney(currentOt.ValorCobrar) + parseMoney(valorRepuestos) + parseMoney(currentOt.ValorAlineacionBalanceo);
    const paidAmount = parseMoney(valorAbonado);
    const saldoPendiente = pendingCompanyPayment ? totalAmount : partialPendingPayment ? Math.max(totalAmount - paidAmount, 0) : 0;

    if (pendingCompanyPayment && !isCompany) {
      return res.status(400).json({
        ok: false,
        error: "Solo una empresa puede quedar con pago pendiente para autorizar salida"
      });
    }

    if (partialPendingPayment && (paidAmount <= 0 || paidAmount >= totalAmount)) {
      return res.status(400).json({
        ok: false,
        error: "Para pago parcial, el abono debe ser mayor a 0 y menor al total de la OT"
      });
    }

    const hasPendingPayment = pendingCompanyPayment || partialPendingPayment;
    const now = new Date().toISOString();

    await otRef.update({
      ValorRepuestos: valorRepuestos,
      EsEmpresa: isCompany,
      PagoPendienteEmpresa: pendingCompanyPayment,
      FechaPagoPendienteEmpresa: pendingCompanyPayment ? now : "",
      PagoParcialPendiente: partialPendingPayment,
      ValorAbonado: partialPendingPayment ? valorAbonado : "",
      SaldoPendiente: hasPendingPayment ? saldoPendiente.toFixed(2) : "",
      FechaPagoParcial: partialPendingPayment ? now : "",
      Cobrado: hasPendingPayment ? false : true,
      FechaCobro: hasPendingPayment ? "" : now,
      EstadoCobro: pendingCompanyPayment ? "PENDIENTE_EMPRESA" : partialPendingPayment ? "PENDIENTE_PARCIAL" : "COBRADO",
      Estado: currentOt.SalidaAutorizada ? "FINALIZADO" : currentOt.Estado || "RECIBIDO",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, otId: id });
  } catch (e) {
    console.error("PATCH /api/ot/:id/pago fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/ot/:id/salida", async (req, res) => {
  try {
    const { db } = getFirebase();
    const id = String(req.params.id);
    const otRef = db.collection(OT_COLLECTION).doc(id);
    const otSnapshot = await otRef.get();

    if (!otSnapshot.exists) {
      return res.status(404).json({ ok: false, error: "OT no encontrada" });
    }

    const currentOt = otSnapshot.data() || {};
    const canExit = Boolean(currentOt.Cobrado) || Boolean(currentOt.PagoPendienteEmpresa) || Boolean(currentOt.PagoParcialPendiente);

    if (!canExit) {
      return res.status(409).json({
        ok: false,
        error: "La salida solo se puede autorizar si la OT está cobrada o tiene pago pendiente autorizado"
      });
    }

    await otRef.update({
      SalidaAutorizada: true,
      FechaSalida: new Date().toISOString(),
      Estado: "FINALIZADO",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, otId: id });
  } catch (e) {
    console.error("PATCH /api/ot/:id/salida fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/ot/:id/inicio-trabajo", async (req, res) => {
  try {
    const { db } = getFirebase();
    const id = String(req.params.id);
    const mecanico = upperText(req.body?.MecanicoResponsable);
    const area = normalizeText(req.body?.AreaTrabajo);
    const isAlignmentArea = area === "alineacion_balanceo";
    const isOilChangeArea = area === "cambio_aceite";
    const otRef = db.collection(OT_COLLECTION).doc(id);
    const otSnapshot = await otRef.get();

    if (!otSnapshot.exists) {
      return res.status(404).json({ ok: false, error: "OT no encontrada" });
    }

    const currentOt = otSnapshot.data() || {};
    const assignedMechanic = isAlignmentArea
      ? upperText(currentOt.MecanicoAlineacionBalanceo || "FERNANDOS")
      : isOilChangeArea
        ? upperText(currentOt.MecanicoCambioAceite || "JOSELOS")
        : upperText(currentOt.MecanicoResponsable);

    if (!assignedMechanic) {
      return res.status(400).json({ ok: false, error: "La OT no tiene mecánico asignado" });
    }

    if (mecanico && mecanico !== assignedMechanic) {
      return res.status(403).json({ ok: false, error: "La OT está asignada a otro mecánico" });
    }

    if (currentOt.Cobrado || currentOt.SalidaAutorizada || (!isAlignmentArea && !isOilChangeArea && isCompleted(currentOt))) {
      return res.status(409).json({ ok: false, error: "La OT ya no está disponible para iniciar trabajo" });
    }

    if (isAlignmentArea) {
      const startDate = currentOt.FechaInicioAlineacionBalanceo || new Date().toISOString();
      await otRef.update({
        FechaInicioAlineacionBalanceo: startDate,
        EstadoAlineacionBalanceo: "REALIZANDO",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({
        ok: true,
        otId: id,
        FechaInicioAlineacionBalanceo: startDate,
        EstadoAlineacionBalanceo: "REALIZANDO"
      });
    }

    if (isOilChangeArea) {
      const startDate = currentOt.FechaInicioCambioAceite || new Date().toISOString();
      await otRef.update({
        FechaInicioCambioAceite: startDate,
        EstadoCambioAceite: "REALIZANDO",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({
        ok: true,
        otId: id,
        FechaInicioCambioAceite: startDate,
        EstadoCambioAceite: "REALIZANDO"
      });
    }

    const startDate = currentOt.FechaInicioTrabajo || new Date().toISOString();

    await otRef.update({
      Estado: "REALIZANDO",
      FechaInicioTrabajo: startDate,
      MecanicoInicioTrabajo: assignedMechanic,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      ok: true,
      otId: id,
      FechaInicioTrabajo: startDate,
      Estado: "REALIZANDO"
    });
  } catch (e) {
    console.error("PATCH /api/ot/:id/inicio-trabajo fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/ot/:id/taller", async (req, res) => {
  try {
    const { db } = getFirebase();
    const id = String(req.params.id);
    const cabecera = req.body?.cabecera || {};
    const userRole = normalizeText(req.body?.userRole);
    const area = normalizeText(req.body?.areaTrabajo || req.body?.AreaTrabajo);
    const isAlignmentArea = area === "alineacion_balanceo";
    const isOilChangeArea = area === "cambio_aceite";
    const otRef = db.collection(OT_COLLECTION).doc(id);
    const otSnapshot = await otRef.get();

    if (!otSnapshot.exists) {
      return res.status(404).json({ ok: false, error: "OT no encontrada" });
    }

    const currentOt = otSnapshot.data() || {};
    const hasLaborPrice = hasChargeValue(currentOt);

    if (hasLaborPrice && userRole !== "admin") {
      return res.status(409).json({
        ok: false,
        error: "La OT ya tiene precio de mano de obra. Solo admin puede editar datos de taller"
      });
    }

    const assignmentOnly = Boolean(req.body?.assignmentOnly);

    if (assignmentOnly) {
      const assignedMechanic = upperText(cabecera.MecanicoResponsable);

      if (!assignedMechanic) {
        return res.status(400).json({ ok: false, error: "Seleccione el mecanico responsable" });
      }

      await otRef.update({
        MecanicoResponsable: assignedMechanic,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ ok: true, otId: id, MecanicoResponsable: assignedMechanic });
    }

    if (isAlignmentArea) {
      if (!hasAlignmentBalanceWork(currentOt)) {
        return res.status(400).json({ ok: false, error: "La OT no tiene alineación y balanceo asignado" });
      }

      if (!String(cabecera.TrabajoAlineacionBalanceo || "").trim()) {
        return res.status(400).json({ ok: false, error: "Ingrese el trabajo realizado en alineación y balanceo" });
      }

      const finishDate = cabecera.FechaAlineacionBalanceo || new Date().toISOString();

      await otRef.update({
        MecanicoAlineacionBalanceo: "FERNANDOS",
        TrabajoAlineacionBalanceo: sentenceText(cabecera.TrabajoAlineacionBalanceo),
        FechaAlineacionBalanceo: upperText(finishDate),
        EstadoAlineacionBalanceo: "FINALIZADO",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ ok: true, otId: id });
    }

    if (isOilChangeArea) {
      if (!hasOilChangeWork(currentOt)) {
        return res.status(400).json({ ok: false, error: "La OT no tiene cambio de aceite asignado" });
      }

      if (!String(cabecera.TrabajoCambioAceite || "").trim()) {
        return res.status(400).json({ ok: false, error: "Ingrese el trabajo realizado en cambio de aceite" });
      }

      const finishDate = cabecera.FechaCambioAceite || new Date().toISOString();

      await otRef.update({
        MecanicoCambioAceite: "JOSELOS",
        AceiteSolicitado: sentenceText(cabecera.AceiteSolicitado || currentOt.AceiteSolicitado),
        TrabajoCambioAceite: sentenceText(cabecera.TrabajoCambioAceite),
        FechaCambioAceite: upperText(finishDate),
        EstadoCambioAceite: "FINALIZADO",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ ok: true, otId: id });
    }

    const nextEstado = cabecera.Estado || "Recibido";
    const isFinalState = ["finalizado", "finalizada", "entregado", "completado"].includes(normalizeText(nextEstado));

    if (isFinalState && !cabecera.FechaEntrega) {
      return res.status(400).json({ ok: false, error: "FechaEntrega es obligatoria para finalizar la OT" });
    }

    if (isFinalState && !String(cabecera.TrabajoRealizado || "").trim()) {
      return res.status(400).json({ ok: false, error: "TrabajoRealizado es obligatorio para finalizar la OT" });
    }

    if (
      isFinalState &&
      (cabecera.RequiereCambioAceite || currentOt.RequiereCambioAceite) &&
      !isOilChangeCompleted(currentOt) &&
      !String(cabecera.TrabajoCambioAceite || "").trim()
    ) {
      return res.status(400).json({ ok: false, error: "No se puede finalizar la OT hasta que JOSELOS marque realizado el cambio de aceite" });
    }

    if (isFinalState && (cabecera.RequiereChequeoPreCompra || currentOt.RequiereChequeoPreCompra)) {
      const report = cabecera.InformePreCompra || currentOt.InformePreCompra || {};

      if (!String(report.conclusionCliente || "").trim()) {
        return res.status(400).json({ ok: false, error: "Ingrese la conclusión para el cliente del informe pre compra" });
      }
    }

    const assignedMechanic = upperText(cabecera.MecanicoResponsable);

    const requiresAlignmentBalance = Boolean(cabecera.RequiereAlineacionBalanceo) || Boolean(currentOt.RequiereAlineacionBalanceo);
    const requiresOilChange = Boolean(cabecera.RequiereCambioAceite) || Boolean(currentOt.RequiereCambioAceite);
    const oilWork = sentenceText(cabecera.TrabajoCambioAceite);
    const oilRequested = sentenceText(cabecera.AceiteSolicitado ?? currentOt.AceiteSolicitado);
    const alignmentWork = sentenceText(cabecera.TrabajoAlineacionBalanceo);
    const alignmentObservation = sentenceText(cabecera.ObservacionAlineacionBalanceo ?? currentOt.ObservacionAlineacionBalanceo);
    const updatePayload = {
      MecanicoResponsable: assignedMechanic,
      RepuestosUsados: sentenceText(cabecera.RepuestosUsados),
      TrabajoRealizado: sentenceText(cabecera.TrabajoRealizado),
      RequiereChequeoPreCompra: Boolean(cabecera.RequiereChequeoPreCompra) || Boolean(currentOt.RequiereChequeoPreCompra),
      ObservacionPreCompra: sentenceText(cabecera.ObservacionPreCompra ?? currentOt.ObservacionPreCompra),
      InformePreCompra: normalizePreCompraReport(cabecera.InformePreCompra || currentOt.InformePreCompra),
      FechaEntrega: upperText(cabecera.FechaEntrega),
      Estado: upperText(nextEstado),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (requiresOilChange) {
      updatePayload.RequiereCambioAceite = true;
      updatePayload.MecanicoCambioAceite = upperText(currentOt.MecanicoCambioAceite || "JOSELOS");
      updatePayload.EstadoCambioAceite = upperText(currentOt.EstadoCambioAceite || "PENDIENTE");
      updatePayload.AceiteSolicitado = oilRequested;

      if (oilWork) {
        updatePayload.TrabajoCambioAceite = oilWork;
        updatePayload.FechaCambioAceite = upperText(cabecera.FechaCambioAceite || currentOt.FechaCambioAceite || new Date().toISOString());
        updatePayload.EstadoCambioAceite = "FINALIZADO";
      }
    }

    if (requiresAlignmentBalance) {
      updatePayload.RequiereAlineacionBalanceo = true;
      updatePayload.MecanicoAlineacionBalanceo = upperText(currentOt.MecanicoAlineacionBalanceo || "FERNANDOS");
      updatePayload.EstadoAlineacionBalanceo = upperText(currentOt.EstadoAlineacionBalanceo || "PENDIENTE");
      updatePayload.ObservacionAlineacionBalanceo = alignmentObservation;

      if (alignmentWork) {
        updatePayload.TrabajoAlineacionBalanceo = alignmentWork;
        updatePayload.FechaAlineacionBalanceo = upperText(cabecera.FechaAlineacionBalanceo || currentOt.FechaAlineacionBalanceo || new Date().toISOString());
        updatePayload.EstadoAlineacionBalanceo = "FINALIZADO";
      }
    }

    await otRef.update(updatePayload);

    res.json({ ok: true, otId: id });
  } catch (e) {
    console.error("PATCH /api/ot/:id/taller fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/ot/:id", async (req, res) => {
  try {
    const { db } = getFirebase();
    const id = String(req.params.id);
    const otRef = db.collection(OT_COLLECTION).doc(id);
    const otSnapshot = await otRef.get();

    if (!otSnapshot.exists) {
      return res.status(404).json({ ok: false, error: "OT no encontrada" });
    }

    const detalleSnapshot = await otRef.collection("detalle").get();
    const detalle = detalleSnapshot.docs.map((doc) => ({
      ID: doc.id,
      ...doc.data()
    }));

    res.json({
      ok: true,
      ot: otSnapshot.data(),
      detalle
    });
  } catch (e) {
    console.error("GET /api/ot/:id fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/health", (req, res) => {
  try {
    initFirebase();
    res.json({
      ok: true,
      storage: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
      imageStorage: "disabled",
      collection: OT_COLLECTION,
      clientesVehiculosCollection: CLIENTES_VEHICULOS_COLLECTION
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
  console.log(`Firestore collection: ${OT_COLLECTION}`);
});





