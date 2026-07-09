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

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Servicios adicionales</p>
            <h2>Alineacion y balanceo</h2>
          </div>
        </div>
        <label className="company-payment-toggle">
          <input
            type="checkbox"
            checked={Boolean(cabecera.RequiereAlineacionBalanceo)}
            onChange={(event) => onCabeceraChange("RequiereAlineacionBalanceo", event.target.checked)}
          />
          <span>Esta OT requiere alineación y balanceo</span>
        </label>
        <label className="field">
          <span>Trabajo solicitado para alineación y balanceo</span>
          <textarea
            rows="4"
            disabled={!cabecera.RequiereAlineacionBalanceo}
            placeholder="Indique qué se debe realizar en el área de alineación y balanceo"
            value={cabecera.ObservacionAlineacionBalanceo || ""}
            onChange={(event) => onCabeceraChange("ObservacionAlineacionBalanceo", event.target.value)}
          />
        </label>
      </section>

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
        <EvidenciasForm ev1={ev1} ev2={ev2} onEv1Change={onEv1Change} onEv2Change={onEv2Change} />
        <FirmasForm sigCliente={sigCliente} sigRecep={sigRecep} />
      </section>

      <ActionsBar guardando={guardando} onGuardar={onGuardar} />
    </>
  );
}
