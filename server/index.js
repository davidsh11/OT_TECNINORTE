console.log("BOOT:", __filename);

const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { admin, getFirebase, initFirebase, OT_COLLECTION } = require("./firebase");

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 4000;

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isCompleted(ot) {
  const estado = normalizeText(ot.Estado);
  return Boolean(ot.FechaEntrega) || ["entregado", "completado", "finalizado", "finalizada"].includes(estado);
}

function hasChargeValue(ot) {
  return normalizeText(ot.ValorCobrar) !== "";
}

function parseMoney(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function otAmounts(ot) {
  const laborAmount = parseMoney(ot.ValorCobrar);
  const partsAmount = parseMoney(ot.ValorRepuestos);
  return {
    laborAmount,
    partsAmount,
    totalAmount: laborAmount + partsAmount
  };
}

function readDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value._seconds) return new Date(value._seconds * 1000);
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

function reportDate(ot) {
  return readDate(ot.FechaCobro) || readDate(ot.FechaEntrega) || readDate(ot.FechaRecepcion);
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function buildCabecera(cabecera, otId) {
  return {
    ID: otId,
    Propietario: cabecera?.Propietario || "",
    CL: cabecera?.CL || "",
    Telefonos: cabecera?.Telefonos || "",
    Direccion: cabecera?.Direccion || "",
    Marca: cabecera?.Marca || "",
    Modelo: cabecera?.Modelo || "",
    Placa: cabecera?.Placa || "",
    Color: cabecera?.Color || "",
    MarcaRadio: cabecera?.MarcaRadio || "",
    Anio: cabecera?.Anio || "",
    Kilometraje: cabecera?.Kilometraje || "",
    Observaciones: cabecera?.Observaciones || "",
    MecanicoResponsable: cabecera?.MecanicoResponsable || "",
    RepuestosUsados: cabecera?.RepuestosUsados || "",
    TrabajoRealizado: cabecera?.TrabajoRealizado || "",
    ValorCobrar: cabecera?.ValorCobrar || "",
    ValorRepuestos: cabecera?.ValorRepuestos || "",
    Cobrado: Boolean(cabecera?.Cobrado),
    FechaCobro: cabecera?.FechaCobro || "",
    SalidaAutorizada: Boolean(cabecera?.SalidaAutorizada),
    FechaSalida: cabecera?.FechaSalida || "",
    Estado: cabecera?.Estado || "Recibido",
    FechaRecepcion: cabecera?.FechaRecepcion || new Date().toISOString(),
    FechaEntrega: cabecera?.FechaEntrega || "",
    Evidencia1Path: "",
    Evidencia2Path: "",
    FirmaClientePath: "",
    FirmaRecepcionPath: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

app.post("/api/ot", async (req, res) => {
  try {
    const {
      cabecera,
      detalle = []
    } = req.body;

    if (!String(cabecera?.Propietario || "").trim()) {
      return res.status(400).json({ ok: false, error: "Propietario es obligatorio" });
    }

    if (!/^\d{10}$/.test(String(cabecera?.Telefonos || ""))) {
      return res.status(400).json({ ok: false, error: "Telefonos debe tener 10 digitos numericos" });
    }

    if (!String(cabecera?.Placa || "").trim()) {
      return res.status(400).json({ ok: false, error: "Placa es obligatoria" });
    }

    const { db } = getFirebase();
    const otId = String(Date.now());
    const otRef = db.collection(OT_COLLECTION).doc(otId);
    const batch = db.batch();

    batch.set(otRef, buildCabecera(cabecera, otId));

    detalle.forEach((item) => {
      const detalleRef = otRef.collection("detalle").doc(uuidv4());
      batch.set(detalleRef, {
        OrdenID: otId,
        Tipo: item.Tipo || "",
        Descripcion: item.Descripcion || "",
        Cantidad: item.Cantidad ?? "",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    res.json({ ok: true, otId, warnings: [] });
  } catch (e) {
    console.error("POST /api/ot fallo:", e);
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
          ot.MecanicoAsignadoNombre
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
      ordenes = ordenes.filter((ot) => Boolean(ot.Cobrado) && !ot.SalidaAutorizada);
    }

    res.json({ ok: true, ordenes });
  } catch (e) {
    console.error("GET /api/ot fallo:", e);
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
      ordenes = ordenes.filter((ot) => normalizeText(ot.MecanicoResponsable) === mechanic);
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
      const { laborAmount, partsAmount, totalAmount } = otAmounts(ot);

      monthly[monthIndex].montoRepuestos += partsAmount;
      monthly[monthIndex].montoManoObra += laborAmount;
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
        const { laborAmount, partsAmount, totalAmount } = otAmounts(ot);
        acc.totalOt += 1;
        acc.montoGeneral += totalAmount;
        acc.montoRepuestos += partsAmount;
        acc.montoManoObra += laborAmount;

        if (ot.Cobrado) {
          acc.montoCobrado += totalAmount;
          acc.otCobradas += 1;
        } else if (hasChargeValue(ot)) {
          acc.montoPendiente += totalAmount;
          acc.otPendientes += 1;
        }

        const mechanicName = ot.MecanicoResponsable || "Sin mecanico";
        if (!acc.byMechanic[mechanicName]) {
          acc.byMechanic[mechanicName] = {
            mecanico: mechanicName,
            cantidadOt: 0,
            montoGenerado: 0,
            montoCobrado: 0,
            montoPendiente: 0,
            montoRepuestos: 0,
            montoManoObra: 0
          };
        }

        acc.byMechanic[mechanicName].cantidadOt += 1;
        acc.byMechanic[mechanicName].montoGenerado += totalAmount;
        acc.byMechanic[mechanicName].montoRepuestos += partsAmount;
        acc.byMechanic[mechanicName].montoManoObra += laborAmount;
        if (ot.Cobrado) {
          acc.byMechanic[mechanicName].montoCobrado += totalAmount;
        } else if (hasChargeValue(ot)) {
          acc.byMechanic[mechanicName].montoPendiente += totalAmount;
        }

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
      byMechanic: Object.values(summary.byMechanic).sort((a, b) => b.montoGenerado - a.montoGenerado),
      monthly,
      ordenes: ordenes.map((ot) => {
        const { totalAmount } = otAmounts(ot);
        return {
          ID: ot.ID,
          Propietario: ot.Propietario || "",
          CL: ot.CL || "",
          Placa: ot.Placa || "",
          MecanicoResponsable: ot.MecanicoResponsable || "",
          ValorCobrar: ot.ValorCobrar || "",
          ValorRepuestos: ot.ValorRepuestos || "",
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

    await otRef.update({
      ValorCobrar: valorCobrar,
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

    await otRef.update({
      ValorRepuestos: req.body?.ValorRepuestos ?? otSnapshot.data()?.ValorRepuestos ?? "",
      Cobrado: true,
      FechaCobro: new Date().toISOString(),
      EstadoCobro: "Cobrado",
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

    await otRef.update({
      SalidaAutorizada: true,
      FechaSalida: new Date().toISOString(),
      Estado: "Entregado",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, otId: id });
  } catch (e) {
    console.error("PATCH /api/ot/:id/salida fallo:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/ot/:id/taller", async (req, res) => {
  try {
    const { db } = getFirebase();
    const id = String(req.params.id);
    const cabecera = req.body?.cabecera || {};
    const otRef = db.collection(OT_COLLECTION).doc(id);
    const otSnapshot = await otRef.get();

    if (!otSnapshot.exists) {
      return res.status(404).json({ ok: false, error: "OT no encontrada" });
    }

    const nextEstado = cabecera.Estado || "Recibido";
    const isFinalState = ["finalizado", "finalizada", "entregado", "completado"].includes(normalizeText(nextEstado));

    if (isFinalState && !cabecera.FechaEntrega) {
      return res.status(400).json({ ok: false, error: "FechaEntrega es obligatoria para finalizar la OT" });
    }

    if (isFinalState && !String(cabecera.TrabajoRealizado || "").trim()) {
      return res.status(400).json({ ok: false, error: "TrabajoRealizado es obligatorio para finalizar la OT" });
    }

    await otRef.update({
      MecanicoResponsable: cabecera.MecanicoResponsable || "",
      RepuestosUsados: cabecera.RepuestosUsados || "",
      TrabajoRealizado: cabecera.TrabajoRealizado || "",
      FechaEntrega: cabecera.FechaEntrega || "",
      Estado: nextEstado,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

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
      collection: OT_COLLECTION
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
  console.log(`Firestore collection: ${OT_COLLECTION}`);
});
