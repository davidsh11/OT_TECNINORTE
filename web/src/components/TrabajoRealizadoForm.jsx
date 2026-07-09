const preCompraSections = [
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

const statusOptions = [
  ["bueno", "Buen estado"],
  ["regular", "Regular"],
  ["malo", "Mal estado"]
];

export { preCompraSections };

export default function TrabajoRealizadoForm({ cabecera, onChange, lockMechanic = false }) {
  const informePreCompra = cabecera.InformePreCompra || {};
  const reportItems = informePreCompra.items || {};

  const updateInformePreCompra = (patch) => {
    onChange("InformePreCompra", {
      ...informePreCompra,
      ...patch
    });
  };

  const updatePreCompraItem = (itemId, patch) => {
    onChange("InformePreCompra", {
      ...informePreCompra,
      items: {
        ...reportItems,
        [itemId]: {
          ...(reportItems[itemId] || {}),
          ...patch
        }
      }
    });
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Entrega</p>
          <h2>Trabajo realizado</h2>
        </div>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Mecánico responsable</span>
          <input
            value={cabecera.MecanicoResponsable}
            readOnly={lockMechanic}
            aria-readonly={lockMechanic}
            onChange={(event) => onChange("MecanicoResponsable", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Fecha y hora de entrega</span>
          <input
            type="datetime-local"
            required
            value={cabecera.FechaEntrega}
            onChange={(event) => onChange("FechaEntrega", event.target.value)}
          />
        </label>
      </div>

      <div className="form-grid textarea-grid">
        <label className="field">
          <span>Repuestos usados</span>
          <textarea
            rows="5"
            value={cabecera.RepuestosUsados}
            onChange={(event) => onChange("RepuestosUsados", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Detalle completo del trabajo</span>
          <textarea
            rows="5"
            required
            value={cabecera.TrabajoRealizado}
            onChange={(event) => onChange("TrabajoRealizado", event.target.value)}
          />
        </label>
      </div>

      {cabecera.RequiereChequeoPreCompra ? (
        <section className="prepurchase-report-panel">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Informe técnico</p>
              <h2>Chequeo pre compra</h2>
            </div>
          </div>
          {cabecera.ObservacionPreCompra ? (
            <p className="notes-preview">Solicitud inicial: {cabecera.ObservacionPreCompra}</p>
          ) : null}

          {preCompraSections.map((section) => (
            <div className="prepurchase-section" key={section.title}>
              <h4>{section.title}</h4>
              <div className="prepurchase-table-wrap">
                <table className="prepurchase-checklist">
                  <thead>
                    <tr>
                      <th>Detalle</th>
                      {statusOptions.map(([, label]) => (
                        <th key={label}>{label}</th>
                      ))}
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map(([itemId, label], index) => {
                      const item = reportItems[itemId] || {};

                      return (
                        <tr key={itemId}>
                          <td>{index + 1}. {label}</td>
                          {statusOptions.map(([value, labelOption]) => (
                            <td className="check-cell" key={value}>
                              <input
                                type="radio"
                                aria-label={`${label} - ${labelOption}`}
                                checked={item.estado === value}
                                onChange={() => updatePreCompraItem(itemId, { estado: value })}
                              />
                            </td>
                          ))}
                          <td>
                            <input
                              value={item.observacion || ""}
                              placeholder="Observación"
                              onChange={(event) => updatePreCompraItem(itemId, { observacion: event.target.value })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="form-grid textarea-grid prepurchase-summary-fields">
            <label className="field">
              <span>Observación prueba de ruta</span>
              <textarea
                rows="4"
                value={informePreCompra.observacionRuta || ""}
                placeholder="Detalle lo que se pudo probar en ruta y el comportamiento del vehículo."
                onChange={(event) => updateInformePreCompra({ observacionRuta: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Conclusión para el cliente</span>
              <textarea
                rows="4"
                required
                value={informePreCompra.conclusionCliente || ""}
                placeholder="Conclusión clara para enviar al cliente."
                onChange={(event) => updateInformePreCompra({ conclusionCliente: event.target.value })}
              />
            </label>
          </div>
        </section>
      ) : null}
    </section>
  );
}