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
  buscandoCliente,
  buscandoVehiculo,
  sigCliente,
  sigRecep,
  onCabeceraChange,
  onBuscarCliente,
  onBuscarVehiculo,
  onLimpiarPrecargados,
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
      <div className="preload-actions">
        <button className="ghost-button" type="button" onClick={onLimpiarPrecargados}>
          Limpiar datos precargados
        </button>
      </div>

      <section className="section-grid">
        <ClienteForm
          cabecera={cabecera}
          buscandoCliente={buscandoCliente}
          onBuscarCliente={onBuscarCliente}
          onChange={onCabeceraChange}
        />
        <VehiculoForm
          cabecera={cabecera}
          buscandoVehiculo={buscandoVehiculo}
          onBuscarVehiculo={onBuscarVehiculo}
          onChange={onCabeceraChange}
        />
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
