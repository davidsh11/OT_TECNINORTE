import { useState } from "react";
import axios from "axios";
import { mechanics } from "../constants/users";
import TrabajoRealizadoForm from "./TrabajoRealizadoForm";

const emptyTaller = {
  MecanicoResponsable: "",
  RepuestosUsados: "",
  TrabajoRealizado: "",
  FechaEntrega: "",
  Estado: "Recibido"
};

function sentenceText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^\s*[\p{L}])|([.!?:]\s+[\p{L}])|(\n\s*[\p{L}])/gu, (match) =>
      match.toUpperCase()
    );
}

function toTallerForm(ot) {
  return {
    MecanicoResponsable: ot?.MecanicoResponsable || "",
    RepuestosUsados: sentenceText(ot?.RepuestosUsados),
    TrabajoRealizado: sentenceText(ot?.TrabajoRealizado),
    FechaEntrega: ot?.FechaEntrega || "",
    Estado: ot?.Estado || "Recibido"
  };
}

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string") return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return String(value);
}

export default function TallerOTView({ api, currentUser }) {
  const [search, setSearch] = useState("");
  const [resultados, setResultados] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [form, setForm] = useState(emptyTaller);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateForm = (key, value) => {
    const nextValue = ["RepuestosUsados", "TrabajoRealizado"].includes(key)
      ? sentenceText(value)
      : value;
    setForm((current) => ({ ...current, [key]: nextValue }));
  };

  const canAssign = Boolean(currentUser?.canAssignOt);
  const isAdmin = currentUser?.role === "admin";
  const assignedTo = currentUser?.role === "mecanico" ? currentUser.name : "";
  const isMechanic = currentUser?.role === "mecanico";
  const hasLaborPrice = Boolean(String(selected?.ValorCobrar || "").trim());
  const canEditWorkshopData = isAdmin || (!canAssign && !hasLaborPrice);
  const hasStartedWork = Boolean(selected?.FechaInicioTrabajo);
  const canStartWork = isMechanic && selected?.ID && !hasStartedWork && !hasLaborPrice && !selected?.FechaEntrega;

  const updateAssignedMechanic = (mechanicName) => {
    setForm((current) => ({
      ...current,
      MecanicoResponsable: mechanicName
    }));
  };

  const buscarOTs = async () => {
    if (!search.trim() && !assignedTo && !canAssign) return;

    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot`, {
        params: {
          search: search.trim() || undefined,
          assignedTo: assignedTo || undefined,
          unassigned: canAssign && !search.trim() ? true : undefined,
          limit: 50
        }
      });
      setResultados(res.data.ordenes || []);
      setSelected(null);
      setDetalle([]);
      setForm(emptyTaller);
    } catch (requestError) {
      console.error(requestError);
      setResultados([]);
      setError("No se pudieron buscar las OT.");
    } finally {
      setLoading(false);
    }
  };

  const cargarOT = async (otId) => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/ot/${otId}`);
      setSelected(res.data.ot);
      setDetalle(res.data.detalle || []);
      const nextForm = toTallerForm(res.data.ot);
      if (currentUser?.role === "mecanico" && !nextForm.MecanicoResponsable) {
        nextForm.MecanicoResponsable = currentUser.name;
      }
      setForm(nextForm);
    } catch (requestError) {
      console.error(requestError);
      setSelected(null);
      setDetalle([]);
      setError("No se pudo cargar la OT seleccionada.");
    } finally {
      setLoading(false);
    }
  };

  const iniciarTrabajo = async () => {
    if (!selected?.ID) return;

    try {
      setSaving(true);
      setError("");
      const res = await axios.patch(`${api}/api/ot/${selected.ID}/inicio-trabajo`, {
        MecanicoResponsable: currentUser?.name
      });
      const nextValues = {
        Estado: res.data?.Estado || "REALIZANDO",
        FechaInicioTrabajo: res.data?.FechaInicioTrabajo || new Date().toISOString()
      };
      setSelected((current) => ({ ...current, ...nextValues }));
      setResultados((current) =>
        current.map((ot) => (ot.ID === selected.ID ? { ...ot, ...nextValues } : ot))
      );
      setForm((current) => ({ ...current, Estado: nextValues.Estado }));
      alert("Trabajo iniciado. La OT queda en estado REALIZANDO.");
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || "No se pudo iniciar el trabajo.");
    } finally {
      setSaving(false);
    }
  };

  const guardarTaller = async () => {
    if (!selected?.ID) return;

    if (canAssign && !form.MecanicoResponsable.trim()) {
      alert("Seleccione el mecanico responsable antes de guardar la asignacion.");
      return;
    }

    if (hasLaborPrice && !isAdmin) {
      alert("Esta OT ya tiene precio de mano de obra. Solo admin puede editar repuestos o detalle de trabajo.");
      return;
    }

    if (!canAssign || isAdmin) {
      if (!form.MecanicoResponsable.trim()) {
        alert("La OT debe tener un mecanico responsable.");
        return;
      }

      if (!form.TrabajoRealizado.trim()) {
        alert("Ingrese el detalle completo del trabajo realizado.");
        return;
      }

      if (!form.FechaEntrega) {
        alert("Ingrese la fecha y hora de entrega para finalizar la OT.");
        return;
      }
    }

    try {
      setSaving(true);
      setError("");
      const formattedForm = {
        ...form,
        RepuestosUsados: sentenceText(form.RepuestosUsados),
        TrabajoRealizado: sentenceText(form.TrabajoRealizado)
      };
      const payload = canAssign && !isAdmin ? formattedForm : { ...formattedForm, Estado: "Finalizado" };
      const res = await axios.patch(`${api}/api/ot/${selected.ID}/taller`, {
        cabecera: payload,
        userRole: currentUser?.role
      });

      if (canAssign && !isAdmin) {
        alert("Mecanico asignado correctamente.");
        setSelected(null);
        setDetalle([]);
        setForm(emptyTaller);
        setResultados((current) => current.filter((ot) => ot.ID !== selected.ID));
      } else if (!canAssign) {
        alert("Datos de taller guardados.");
        setSelected(null);
        setDetalle([]);
        setForm(emptyTaller);
        setResultados((current) => current.filter((ot) => ot.ID !== selected.ID));
      } else {
        setSelected((current) => ({ ...current, ...payload }));
        setForm(payload);
        alert("Datos de taller guardados.");
      }
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudieron guardar los datos de taller.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel workshop-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Uso interno</p>
          <h2>{canAssign ? "Asignar y actualizar taller" : "Mis ordenes asignadas"}</h2>
        </div>
      </div>

      <div className="search-tools">
        <input
          placeholder={canAssign ? "Buscar por placa o cedula/RUC" : "Buscar dentro de mis OT por placa o cedula/RUC"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && buscarOTs()}
        />
        <button type="button" onClick={buscarOTs} disabled={loading}>
          {canAssign ? (search.trim() ? "Buscar" : "Ver no asignadas") : "Ver mis OT"}
        </button>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      {resultados.length > 0 ? (
        <div className="workshop-results">
          {resultados.map((ot, index) => (
            <button
              className={`ot-row ${selected?.ID === ot.ID ? "active" : ""}`}
              type="button"
              key={ot.ID}
              onClick={() => cargarOT(ot.ID)}
            >
              <span>
                <strong>{index === 0 ? `${ot.ID} - Ultima` : ot.ID}</strong>
                <small>{ot.Propietario || "Sin propietario"} / CL: {ot.CL || "-"}</small>
                <small>
                  Responsable: {ot.MecanicoResponsable || "Sin asignar"}
                </small>
              </span>
              <span>
                <strong>{ot.Placa || "Sin placa"}</strong>
                <small>{formatDate(ot.FechaRecepcion) || "Sin fecha"}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {!selected ? (
        <p className="empty-state workshop-empty">
          {canAssign
            ? "Presione Ver no asignadas para listar las OT pendientes de asignar, o busque por placa o cedula/RUC."
            : "Presione Ver mis OT para cargar las ordenes asignadas a su usuario."}
        </p>
      ) : (
        <>
          <div className="workshop-summary">
            <div>
              <p className="eyebrow">OT {selected.ID}</p>
              <h3>{selected.Propietario || "Sin propietario"}</h3>
            </div>
            <div className="workshop-summary-meta">
              <strong>{selected.Placa || "Sin placa"}</strong>
              <small>{formatDate(selected.FechaRecepcion) || "Sin fecha"}</small>
              <small>
                Responsable: {form.MecanicoResponsable || "Sin asignar"}
              </small>
              <small>
                Estado: {selected.Estado || form.Estado || "RECIBIDO"}
              </small>
              <small>
                Inicio: {formatDate(selected.FechaInicioTrabajo) || "Sin iniciar"}
              </small>
            </div>
          </div>

          <section className="panel workshop-vehicle-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Vehiculo</p>
                <h2>Detalle del vehiculo</h2>
              </div>
            </div>
            <div className="read-grid">
              <span>Placa</span>
              <strong>{selected.Placa || "-"}</strong>
              <span>Marca</span>
              <strong>{selected.Marca || "-"}</strong>
              <span>Modelo</span>
              <strong>{selected.Modelo || "-"}</strong>
              <span>Color</span>
              <strong>{selected.Color || "-"}</strong>
              <span>Anio</span>
              <strong>{selected.Anio || "-"}</strong>
              <span>Kilometraje</span>
              <strong>{selected.Kilometraje || "-"}</strong>
              <span>Propietario</span>
              <strong>{selected.Propietario || "-"}</strong>
              <span>CL</span>
              <strong>{selected.CL || "-"}</strong>
              <span>Telefono</span>
              <strong>{selected.Telefonos || "-"}</strong>
            </div>
          </section>


          {isMechanic ? (
            <section className="panel start-work-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Control de tiempo</p>
                  <h2>{hasStartedWork ? "Trabajo en realizacion" : "Inicio de trabajo"}</h2>
                </div>
              </div>
              <div className="workshop-actions">
                <span>
                  {hasStartedWork
                    ? `Iniciado: ${formatDate(selected.FechaInicioTrabajo) || "Sin fecha"}`
                    : "Marque el inicio cuando empiece a trabajar esta OT."}
                </span>
                <button className="primary-button" type="button" onClick={iniciarTrabajo} disabled={saving || !canStartWork}>
                  {hasStartedWork ? "Trabajo iniciado" : saving ? "Guardando..." : "Empezar trabajo"}
                </button>
              </div>
            </section>
          ) : null}


          {canAssign ? (
            <section className="panel assignment-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Asignacion</p>
                  <h2>Asignar mecanico responsable</h2>
                </div>
              </div>
              <label className="field">
                <span>Mecanico responsable</span>
                <select
                  value={form.MecanicoResponsable}
                  onChange={(event) => updateAssignedMechanic(event.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {mechanics.map((mechanic) => (
                    <option value={mechanic.name} key={mechanic.id}>
                      {mechanic.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          ) : null}

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recepcion</p>
                <h2>Observaciones</h2>
              </div>
            </div>
            <p className="notes-preview">
              {selected.Observaciones || "Sin observaciones registradas."}
            </p>
          </section>

          {hasLaborPrice && !isAdmin ? (
            <p className="empty-state workshop-empty">
              Esta OT ya tiene precio de mano de obra. Los repuestos y el detalle del trabajo quedan bloqueados.
            </p>
          ) : null}

          {canEditWorkshopData ? (
            <TrabajoRealizadoForm cabecera={form} onChange={updateForm} lockMechanic />
          ) : null}

          <h4>Detalle inicial registrado</h4>
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

          <div className="workshop-actions">
            <span>
              {canAssign
                ? isAdmin
                  ? "Admin puede editar los datos de taller."
                  : "El jefe de taller solo asigna el mecanico responsable."
                : hasLaborPrice
                  ? "Esta OT ya tiene precio de mano de obra y no puede ser editada por mecanico."
                  : "Estos datos actualizan la misma OT para uso interno."}
            </span>
            <button
              className="primary-button"
              type="button"
              onClick={guardarTaller}
              disabled={saving || (hasLaborPrice && !isAdmin)}
            >
              {saving ? "Guardando..." : canAssign && !isAdmin ? "Guardar asignacion" : "Guardar datos de taller"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

