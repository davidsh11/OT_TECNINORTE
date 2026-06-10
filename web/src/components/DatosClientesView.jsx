import { useState } from "react";
import axios from "axios";

const emptyForm = {
  Propietario: "",
  CL: "",
  Telefonos: "",
  CorreoElectronico: "",
  Direccion: "",
  Placa: "",
  Marca: "",
  Modelo: "",
  Color: "",
  MarcaRadio: "",
  Anio: ""
};

const clienteFields = [
  ["CL", "Cedula / RUC"],
  ["Propietario", "Propietario"],
  ["Telefonos", "Telefonos"],
  ["CorreoElectronico", "Correo electronico"],
  ["Direccion", "Direccion"]
];

const vehiculoFields = [
  ["Placa", "Placa"],
  ["Marca", "Marca"],
  ["Modelo", "Modelo"],
  ["Color", "Color"],
  ["MarcaRadio", "Marca radio"],
  ["Anio", "Anio"]
];

function uppercase(value) {
  return String(value || "").toUpperCase();
}

function normalizeId(value) {
  return uppercase(value).replace(/\s/g, "");
}

function normalizePlate(value) {
  return uppercase(value).replace(/\s/g, "");
}

export default function DatosClientesView({ api }) {
  const [search, setSearch] = useState({ cl: "", placa: "" });
  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState({ cl: "", placa: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const updateSearch = (key, value) => {
    setSearch((current) => ({
      ...current,
      [key]: key === "placa" ? normalizePlate(value) : normalizeId(value)
    }));
  };

  const updateForm = (key, value) => {
    let nextValue = uppercase(value);

    if (key === "Telefonos") {
      nextValue = value.replace(/\D/g, "").slice(0, 10);
    }

    if (key === "CL") {
      nextValue = normalizeId(value);
    }

    if (key === "Placa") {
      nextValue = normalizePlate(value);
    }

    if (key === "Anio") {
      nextValue = value.replace(/\D/g, "");
    }

    setForm((current) => ({ ...current, [key]: nextValue }));
  };

  const applyRecord = (record) => {
    const nextForm = {
      ...emptyForm,
      ...record,
      CL: normalizeId(record.CL),
      Placa: normalizePlate(record.Placa)
    };

    setForm(nextForm);
    setOriginal({ cl: nextForm.CL, placa: nextForm.Placa });
    setLoaded(true);
  };

  const buscarDatos = async () => {
    if (!search.cl && !search.placa) {
      alert("Ingrese cedula/RUC o placa para buscar.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await axios.get(`${api}/api/clientes-datos`, {
        params: {
          cl: search.cl || undefined,
          placa: search.placa || undefined
        }
      });

      applyRecord(res.data?.registro || {});
    } catch (requestError) {
      console.error(requestError);
      try {
        await buscarDatosDesdeRespaldos();
      } catch (fallbackError) {
        console.error(fallbackError);
        setError(fallbackError.response?.data?.error || "No se encontraron datos del cliente.");
        setLoaded(false);
        setForm(emptyForm);
        setOriginal({ cl: "", placa: "" });
      }
    } finally {
      setLoading(false);
    }
  };

  const buscarDatosDesdeRespaldos = async () => {
    if (search.placa) {
      try {
        const placaRes = await axios.get(`${api}/api/clientes-vehiculos/${encodeURIComponent(search.placa)}`);
        const registro = placaRes.data?.registro;

        if (registro) {
          setError("");
          applyRecord(registro);
          return;
        }
      } catch (placaError) {
        console.error(placaError);
      }
    }

    const searchValue = search.cl || search.placa;
    const res = await axios.get(`${api}/api/ot`, {
      params: {
        search: searchValue,
        limit: 100
      }
    });
    const ordenes = res.data?.ordenes || [];
    const orden = ordenes.find((item) => {
      const matchesCl = search.cl ? normalizeId(item.CL) === normalizeId(search.cl) : true;
      const matchesPlate = search.placa ? normalizePlate(item.Placa) === normalizePlate(search.placa) : true;
      return matchesCl && matchesPlate;
    });

    if (!orden) {
      throw new Error("No se encontraron datos del cliente.");
    }

    setError("");
    applyRecord({
      Propietario: orden.Propietario,
      CL: orden.CL,
      Telefonos: orden.Telefonos,
      CorreoElectronico: orden.CorreoElectronico,
      Direccion: orden.Direccion,
      Placa: orden.Placa,
      Marca: orden.Marca,
      Modelo: orden.Modelo,
      Color: orden.Color,
      MarcaRadio: orden.MarcaRadio,
      Anio: orden.Anio
    });
  };

  const guardarDatos = async () => {
    if (!form.CL) {
      alert("La cedula/RUC es obligatoria.");
      return;
    }

    if (!form.Placa) {
      alert("La placa es obligatoria.");
      return;
    }

    if (form.Telefonos && !/^\d{10}$/.test(form.Telefonos)) {
      alert("El numero de telefono debe tener 10 digitos numericos.");
      return;
    }

    if (form.CorreoElectronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.CorreoElectronico)) {
      alert("Ingrese un correo electronico valido.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const res = await axios.patch(`${api}/api/clientes-datos`, {
        registro: form,
        original
      });

      applyRecord(res.data?.registro || form);
      alert("Datos del cliente guardados.");
    } catch (requestError) {
      console.error(requestError);
      const endpointMissing =
        requestError.response?.status === 404 || String(requestError.response?.data || "").includes("Cannot PATCH");
      setError(
        endpointMissing
          ? "Para guardar cambios reinicie el backend y vuelva a intentar."
          : requestError.response?.data?.error || "No se pudieron guardar los datos."
      );
    } finally {
      setSaving(false);
    }
  };

  const limpiar = () => {
    setSearch({ cl: "", placa: "" });
    setForm(emptyForm);
    setOriginal({ cl: "", placa: "" });
    setLoaded(false);
    setError("");
  };

  return (
    <section className="client-data-view">
      <article className="panel client-data-search">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clientes</p>
            <h2>Buscar datos del cliente</h2>
          </div>
        </div>
        <div className="client-data-tools">
          <label className="field">
            <span>Cedula / RUC</span>
            <input
              className="searchable-input"
              value={search.cl}
              onChange={(event) => updateSearch("cl", event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && buscarDatos()}
            />
          </label>
          <label className="field">
            <span>Placa</span>
            <input
              className="searchable-input"
              value={search.placa}
              onChange={(event) => updateSearch("placa", event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && buscarDatos()}
            />
          </label>
          <div className="client-data-actions">
            <button className="primary-button" type="button" disabled={loading} onClick={buscarDatos}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button className="ghost-button" type="button" onClick={limpiar}>
              Limpiar
            </button>
          </div>
        </div>
        {error ? <p className="error-state">{error}</p> : null}
      </article>

      <section className="section-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cliente</p>
              <h2>Datos de contacto</h2>
            </div>
          </div>
          <div className="form-grid">
            {clienteFields.map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  className={key === "CL" ? "searchable-input" : undefined}
                  value={form[key]}
                  onChange={(event) => updateForm(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vehiculo</p>
              <h2>Datos del vehiculo</h2>
            </div>
          </div>
          <div className="form-grid compact">
            {vehiculoFields.map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  className={key === "Placa" ? "searchable-input" : undefined}
                  value={form[key]}
                  onChange={(event) => updateForm(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </article>
      </section>

      <div className="actions-bar">
        <span>
          {loaded
            ? "Los cambios actualizan la base de clientes y vehiculos para futuras OT."
            : "Puede buscar un cliente existente o llenar los datos para crear la ficha."}
        </span>
        <button className="primary-button" type="button" disabled={saving} onClick={guardarDatos}>
          {saving ? "Guardando..." : "Guardar datos"}
        </button>
      </div>
    </section>
  );
}
