import ActionsBar from "./ActionsBar";
import ClienteForm from "./ClienteForm";
import DetalleForm from "./DetalleForm";
import EvidenciasForm from "./EvidenciasForm";
import FirmasForm from "./FirmasForm";
import ObservacionesForm from "./ObservacionesForm";
import VehiculoForm from "./VehiculoForm";

export default function CrearOTView({
  cabecera,
  detalle,
  nuevoTrabajo,
  nuevoRepuesto,
  ev1,
  ev2,
  guardando,
  sigCliente,
  sigRecep,
  onCabeceraChange,
  onNuevoTrabajoChange,
  onNuevoRepuestoChange,
  onAgregarTrabajo,
  onAgregarRepuesto,
  onQuitarDetalle,
  onEv1Change,
  onEv2Change,
  onGuardar
}) {
  return (
    <>
      <section className="section-grid">
        <ClienteForm cabecera={cabecera} onChange={onCabeceraChange} />
        <VehiculoForm cabecera={cabecera} onChange={onCabeceraChange} />
      </section>

      <ObservacionesForm value={cabecera.Observaciones} onChange={onCabeceraChange} />

      <DetalleForm
        detalle={detalle}
        nuevoTrabajo={nuevoTrabajo}
        nuevoRepuesto={nuevoRepuesto}
        onNuevoTrabajoChange={onNuevoTrabajoChange}
        onNuevoRepuestoChange={onNuevoRepuestoChange}
        onAgregarTrabajo={onAgregarTrabajo}
        onAgregarRepuesto={onAgregarRepuesto}
        onQuitarDetalle={onQuitarDetalle}
      />

      <section className="section-grid">
        <FirmasForm sigCliente={sigCliente} sigRecep={sigRecep} />
        <EvidenciasForm ev1={ev1} ev2={ev2} onEv1Change={onEv1Change} onEv2Change={onEv2Change} />
      </section>

      <ActionsBar guardando={guardando} onGuardar={onGuardar} />
    </>
  );
}
