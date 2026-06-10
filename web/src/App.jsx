import { useRef, useState } from "react";
import axios from "axios";
import AppMenu from "./components/AppMenu";
import BrandHeader from "./components/BrandHeader";
import BuscarOTView from "./components/BuscarOTView";
import CierreOTView from "./components/CierreOTView";
import CobranzaOTView from "./components/CobranzaOTView";
import CrearOTView from "./components/CrearOTView";
import DatosClientesView from "./components/DatosClientesView";
import HistorialOTView from "./components/HistorialOTView";
import HomeMenu from "./components/HomeMenu";
import LoginView from "./components/LoginView";
import ReportesOTView from "./components/ReportesOTView";
import SalidaOTView from "./components/SalidaOTView";
import TallerOTView from "./components/TallerOTView";
import { initialCabecera } from "./constants/formFields";
import { users } from "./constants/users";
import { saveOtMedia } from "./utils/localOtMedia";
import { fileToPdfDataUrl, signatureToDataUrl, writePdfTab } from "./utils/pdf";
import "./App.css";

const LOCAL_API = "http://127.0.0.1:4000";
const RENDER_API = "https://ot-tecninorte.onrender.com";
const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API = import.meta.env.VITE_API_URL || (isLocalhost ? LOCAL_API : RENDER_API);
const uppercaseValue = (value) => String(value || "").toUpperCase();
const normalizeIdentification = (value) => uppercaseValue(value).replace(/\s/g, "");

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUsername = localStorage.getItem("tecninorte-user");
    const savedRole = localStorage.getItem("tecninorte-role");
    return (
      users.find((user) => user.username === savedUsername) ||
      users.find((user) => user.role === savedRole) ||
      null
    );
  });
  const [activeView, setActiveView] = useState("inicio");
  const [cabecera, setCabecera] = useState(initialCabecera);
  const [detalle, setDetalle] = useState([]);
  const [nuevoTrabajo, setNuevoTrabajo] = useState("");
  const [nuevoRepuesto, setNuevoRepuesto] = useState({ desc: "", cant: 1 });
  const [ev1, setEv1] = useState(null);
  const [ev2, setEv2] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [buscandoVehiculo, setBuscandoVehiculo] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  const sigCliente = useRef(null);
  const sigRecep = useRef(null);

  const updateCabecera = (key, value) => {
    let nextValue = uppercaseValue(value);

    if (key === "Telefonos") {
      nextValue = value.replace(/\D/g, "").slice(0, 10);
    }

    if (key === "CL") {
      nextValue = value.replace(/\s/g, "");
    }

    if (key === "Anio" || key === "Kilometraje") {
      nextValue = value.replace(/\D/g, "");
    }

    if (key === "Placa") {
      nextValue = value.toUpperCase().replace(/\s/g, "");
    }

    if (key === "CorreoElectronico") {
      nextValue = uppercaseValue(value).trim();
    }

    setCabecera((current) => ({ ...current, [key]: nextValue }));
  };

  const buscarClientePorCedula = async () => {
    const cl = normalizeIdentification(cabecera.CL);

    if (!cl) {
      alert("Ingrese la cedula o RUC para buscar los datos del cliente.");
      return;
    }

    try {
      setBuscandoCliente(true);
      const res = await axios.get(`${API}/api/clientes/identificacion/${encodeURIComponent(cl)}`);
      const datos = res.data?.cliente;

      if (!datos) {
        await buscarClienteEnOrdenes(cl);
        return;
      }

      setCabecera((current) => ({
        ...current,
        CL: datos.CL || current.CL,
        Propietario: datos.Propietario || current.Propietario,
        Telefonos: datos.Telefonos || current.Telefonos,
        CorreoElectronico: datos.CorreoElectronico || current.CorreoElectronico,
        Direccion: datos.Direccion || current.Direccion,
        ...(res.data?.vehiculos?.length === 1
          ? {
              Placa: res.data.vehiculos[0].Placa || current.Placa,
              Marca: res.data.vehiculos[0].Marca || current.Marca,
              Modelo: res.data.vehiculos[0].Modelo || current.Modelo,
              Color: res.data.vehiculos[0].Color || current.Color,
              Anio: res.data.vehiculos[0].Anio || current.Anio
            }
          : {})
      }));
    } catch (error) {
      if (error.response?.status === 404) {
        await buscarClienteEnOrdenes(cl);
        return;
      }

      console.error(error);
      await buscarClienteEnOrdenes(cl);
    } finally {
      setBuscandoCliente(false);
    }
  };

  const buscarClienteEnOrdenes = async (cl) => {
    const res = await axios.get(`${API}/api/ot`, { params: { search: cl } });
    const orden = (res.data?.ordenes || []).find(
      (item) => normalizeIdentification(item.CL) === normalizeIdentification(cl)
    );

    if (!orden) {
      alert("No se encontraron datos guardados para esa cedula o RUC.");
      return;
    }

    setCabecera((current) => ({
      ...current,
      CL: orden.CL || current.CL,
      Propietario: orden.Propietario || current.Propietario,
      Telefonos: orden.Telefonos || current.Telefonos,
      CorreoElectronico: orden.CorreoElectronico || current.CorreoElectronico,
      Direccion: orden.Direccion || current.Direccion,
      Placa: orden.Placa || current.Placa,
      Marca: orden.Marca || current.Marca,
      Modelo: orden.Modelo || current.Modelo,
      Color: orden.Color || current.Color,
      MarcaRadio: orden.MarcaRadio || current.MarcaRadio,
      Anio: orden.Anio || current.Anio,
      Kilometraje: orden.Kilometraje || current.Kilometraje
    }));
  };

  const buscarVehiculoPorPlaca = async () => {
    const placa = cabecera.Placa.trim();

    if (!placa) {
      alert("Ingrese la placa para buscar los datos del cliente y vehiculo.");
      return;
    }

    try {
      setBuscandoVehiculo(true);
      const res = await axios.get(`${API}/api/clientes-vehiculos/${encodeURIComponent(placa)}`);
      const datos = res.data?.registro;

      if (!datos) {
        alert("No se encontraron datos guardados para esa placa.");
        return;
      }

      setCabecera((current) => ({
        ...current,
        Propietario: datos.Propietario || current.Propietario,
        CL: datos.CL || current.CL,
        Telefonos: datos.Telefonos || current.Telefonos,
        CorreoElectronico: datos.CorreoElectronico || current.CorreoElectronico,
        Direccion: datos.Direccion || current.Direccion,
        Marca: datos.Marca || current.Marca,
        Modelo: datos.Modelo || current.Modelo,
        Placa: datos.Placa || current.Placa,
        Color: datos.Color || current.Color,
        MarcaRadio: datos.MarcaRadio || current.MarcaRadio,
        Anio: datos.Anio || current.Anio,
        Kilometraje: datos.Kilometraje || current.Kilometraje
      }));
    } catch (error) {
      if (error.response?.status === 404) {
        alert("No se encontraron datos guardados para esa placa.");
        return;
      }

      console.error(error);
      alert("No se pudo buscar la placa en la base de datos.");
    } finally {
      setBuscandoVehiculo(false);
    }
  };

  const updateNuevoTrabajo = (value) => {
    setNuevoTrabajo(uppercaseValue(value));
  };

  const updateNuevoRepuesto = (updater) => {
    setNuevoRepuesto((current) => {
      const nextValue = typeof updater === "function" ? updater(current) : updater;

      return {
        ...nextValue,
        desc: uppercaseValue(nextValue.desc),
        cant: nextValue.cant
      };
    });
  };

  const agregarTrabajo = () => {
    if (!nuevoTrabajo.trim()) return;
    setDetalle((current) => [
      ...current,
      { Tipo: "TRABAJO", Descripcion: uppercaseValue(nuevoTrabajo).trim(), Cantidad: "" }
    ]);
    setNuevoTrabajo("");
  };

  const agregarRepuesto = () => {
    if (!nuevoRepuesto.desc.trim()) return;
    setDetalle((current) => [
      ...current,
      {
        Tipo: "REPUESTO",
        Descripcion: uppercaseValue(nuevoRepuesto.desc).trim(),
        Cantidad: Number(nuevoRepuesto.cant) || 1
      }
    ]);
    setNuevoRepuesto({ desc: "", cant: 1 });
  };

  const quitarDetalle = (index) => {
    setDetalle((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const limpiarDatosPrecargados = () => {
    setCabecera((current) => ({
      ...current,
      Propietario: "",
      CL: "",
      Telefonos: "",
      CorreoElectronico: "",
      Direccion: "",
      Marca: "",
      Modelo: "",
      Placa: "",
      Color: "",
      MarcaRadio: "",
      Anio: "",
      Kilometraje: ""
    }));
  };

  const limpiarFormularioOT = () => {
    setCabecera({ ...initialCabecera });
    setDetalle([]);
    setNuevoTrabajo("");
    setNuevoRepuesto({ desc: "", cant: 1 });
    setEv1(null);
    setEv2(null);
    sigCliente.current?.clear();
    sigRecep.current?.clear();
    setFormResetKey((current) => current + 1);
  };

  const abrirPdf = async (pdfTab, otId, pdfCabecera) => {
    try {
      const firmaCliente = signatureToDataUrl(sigCliente);
      const firmaRecepcion = signatureToDataUrl(sigRecep);
      const [evidencia1, evidencia2] = await Promise.all([
        fileToPdfDataUrl(ev1),
        fileToPdfDataUrl(ev2)
      ]);
      const media = {
        firmas: {
          cliente: firmaCliente,
          recepcion: firmaRecepcion
        },
        evidencias: [
          { label: "Evidencia 1", src: evidencia1 },
          { label: "Evidencia 2", src: evidencia2 }
        ]
      };

      await saveOtMedia(otId, media);

      writePdfTab(pdfTab, {
        otId,
        fecha: new Date().toLocaleString(),
        cabecera: pdfCabecera,
        detalle,
        includeInternal: false,
        ...media
      });
    } catch (pdfError) {
      if (pdfTab) pdfTab.close();
      console.error("No se pudo generar el PDF:", pdfError);
      alert("La OT se guardo, pero no se pudo generar el PDF con las firmas/evidencias.");
    }
  };

  const guardarOT = async () => {
    const telefonoValido = /^\d{10}$/.test(cabecera.Telefonos || "");

    if (!cabecera.Propietario.trim()) {
      alert("Ingrese el propietario del vehiculo.");
      return;
    }

    if (!telefonoValido) {
      alert("El numero de telefono debe tener 10 digitos numericos.");
      return;
    }

    if (cabecera.CorreoElectronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cabecera.CorreoElectronico)) {
      alert("Ingrese un correo electronico valido.");
      return;
    }

    if (!cabecera.Placa.trim()) {
      alert("La placa es obligatoria para guardar la OT.");
      return;
    }

    const pdfTab = window.open("", "_blank");

    if (pdfTab) {
      pdfTab.document.write("<p style='font-family: Arial, sans-serif'>Guardando OT...</p>");
    }

    try {
      setGuardando(true);

      const pdfCabecera = {
        ...cabecera,
        Anio: cabecera.Anio ? Number(cabecera.Anio) : "",
        Kilometraje: cabecera.Kilometraje ? Number(cabecera.Kilometraje) : ""
      };
      const payload = {
        cabecera: pdfCabecera,
        detalle
      };

      const res = await axios.post(`${API}/api/ot`, payload);
      const warnings = (res.data.warnings || []).filter(
        (warning) => !String(warning).toLowerCase().includes("datos del cliente")
      );
      const warningText = warnings.length ? `\n\nAviso: ${warnings.join(" ")}` : "";
      const clienteText = res.data.clienteActualizado ? "\nDatos cliente actualizado." : "";

      alert(`OT guardada. ID: ${res.data.otId}${clienteText}${warningText}`);
      await abrirPdf(pdfTab, res.data.otId, pdfCabecera);
      limpiarFormularioOT();
    } catch (error) {
      if (pdfTab) pdfTab.close();
      console.error(error);

      const apiError = error.response?.data?.error;
      const message = apiError
        ? `No se pudo guardar la OT: ${apiError}`
        : `No se pudo conectar con el servidor en ${API}. Abre una terminal en la carpeta server, ejecuta npm install y luego npm start.`;

      alert(message);
    } finally {
      setGuardando(false);
    }
  };

  const login = (user) => {
    localStorage.setItem("tecninorte-user", user.username);
    localStorage.setItem("tecninorte-role", user.role);
    setCurrentUser(user);
    setActiveView("inicio");
  };

  const logout = () => {
    localStorage.removeItem("tecninorte-user");
    localStorage.removeItem("tecninorte-role");
    setCurrentUser(null);
    setActiveView("inicio");
  };

  if (!currentUser) {
    return <LoginView onLogin={login} />;
  }

  const allowedViews = currentUser.allowedViews;
  const safeActiveView = allowedViews.includes(activeView) ? activeView : "inicio";

  const viewTitle = {
    inicio: ["Panel principal", "TECNINORTE"],
    crear: ["Orden de trabajo", "Nueva OT"],
    buscar: ["Consulta", "Buscar OT"],
    datosClientes: ["Clientes", "Datos clientes"],
    historial: ["Historial", "Trabajos realizados"],
    taller: ["Uso interno", "Taller"],
    cierre: ["Cierre", "Cierre OT"],
    cobranza: ["Cobranza", "Cobranza"],
    salida: ["Recepcion", "Salida de taller"],
    reportes: ["Reportes", "KPIs"]
  }[safeActiveView];

  return (
    <main className="app-shell">
      <header className="app-header">
        <BrandHeader />
        <div className="header-summary">
          <div className="user-badge" aria-label={`Usuario ${currentUser.name}`}>
            <span className="user-avatar" aria-hidden="true">
              U
            </span>
            <strong>{currentUser.name}</strong>
          </div>
          <button className="logout-button" type="button" onClick={logout}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <div className="app-body">
        <AppMenu activeView={safeActiveView} allowedViews={allowedViews} onChangeView={setActiveView} />

        <section className="app-content">
          {safeActiveView === "inicio" ? (
            <HomeMenu
              api={API}
              userName={currentUser.name}
              allowedViews={allowedViews}
              onOpenCrear={() => setActiveView("crear")}
              onOpenBuscar={() => setActiveView("buscar")}
              onOpenDatosClientes={() => setActiveView("datosClientes")}
              onOpenHistorial={() => setActiveView("historial")}
              onOpenTaller={() => setActiveView("taller")}
              onOpenCierre={() => setActiveView("cierre")}
              onOpenCobranza={() => setActiveView("cobranza")}
              onOpenSalida={() => setActiveView("salida")}
              onOpenReportes={() => setActiveView("reportes")}
            />
          ) : (
            <div className="view-heading">
              <p className="eyebrow">{viewTitle[0]}</p>
              <h2>{viewTitle[1]}</h2>
            </div>
          )}

          {safeActiveView === "crear" ? (
            <CrearOTView
              key={formResetKey}
              cabecera={cabecera}
              detalle={detalle}
              nuevoTrabajo={nuevoTrabajo}
              nuevoRepuesto={nuevoRepuesto}
              ev1={ev1}
              ev2={ev2}
              guardando={guardando}
              buscandoCliente={buscandoCliente}
              buscandoVehiculo={buscandoVehiculo}
              sigCliente={sigCliente}
              sigRecep={sigRecep}
              onCabeceraChange={updateCabecera}
              onBuscarCliente={buscarClientePorCedula}
              onBuscarVehiculo={buscarVehiculoPorPlaca}
              onLimpiarPrecargados={limpiarDatosPrecargados}
              onNuevoTrabajoChange={updateNuevoTrabajo}
              onNuevoRepuestoChange={updateNuevoRepuesto}
              onAgregarTrabajo={agregarTrabajo}
              onAgregarRepuesto={agregarRepuesto}
              onQuitarDetalle={quitarDetalle}
              onEv1Change={setEv1}
              onEv2Change={setEv2}
              onGuardar={guardarOT}
            />
          ) : safeActiveView === "buscar" ? (
            <BuscarOTView api={API} />
          ) : safeActiveView === "datosClientes" ? (
            <DatosClientesView api={API} />
          ) : safeActiveView === "historial" ? (
            <HistorialOTView api={API} />
          ) : safeActiveView === "taller" ? (
            <TallerOTView api={API} currentUser={currentUser} />
          ) : safeActiveView === "cierre" ? (
            <CierreOTView api={API} />
          ) : safeActiveView === "cobranza" ? (
            <CobranzaOTView api={API} />
          ) : safeActiveView === "salida" ? (
            <SalidaOTView api={API} />
          ) : safeActiveView === "reportes" ? (
            <ReportesOTView api={API} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
