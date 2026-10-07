# Bloqueos de ordenes de trabajo

## Funcionamiento
- Taller: abrir una OT asignada, Registrar bloqueo, seleccionar solamente el motivo. El detalle es opcional; la OT, el mecanico y su area se registran automaticamente. Los dos motivos crean registros independientes. Se conservan los registros antiguos vinculados a trabajos.
- Cobranza: Bloqueos por gestionar muestra tambien trabajos aun no finalizados ni facturados. Registra responsable, proxima accion, proveedor/llegada o contacto/respuesta. No envia mensajes.
- Disponible resuelve solamente repuestos. Aprobado resuelve solamente autorizacion. Rechazado conserva el bloqueo; una gestion posterior puede aprobarlo o cerrarlo explicitamente sin ejecutar el trabajo, indicando la decision. Cerrar sin ejecutar no equivale a aprobar.
- Actualizar respuestas en la OT consulta los avances. Seguimiento permite filtrar por Bloqueadas y por motivo. Los contadores deduplican por OT incluso si tiene varias areas o trabajos.
- Cobranza puede activar Incluir resueltos e historial. Cada registro permite consultar usuario, fecha, estado anterior y nuevo, observaciones y resolucion.
- Las acciones de inicio/finalizacion verifican bloqueos del area correspondiente. Pago y salida requieren que no haya bloqueos activos. Los bloqueos no cambian automaticamente el estado del trabajo ni la asignacion.

## Permisos
Los endpoints nuevos verifican la firma de la sesion y consultan el usuario vigente en UsuariosSistema; no confian en el rol o mecanico enviado por el navegador. Un usuario inactivo no puede acceder. Mecanicos registran solo en sus areas asignadas; se contemplan JOSELOS/cambio de aceite y FERNANDOS/alineacion. Cobranza y admin gestionan; jefe de taller consulta. Admin puede registrar en cualquier area asignada.

## Datos y migracion compatible
No hace falta un script masivo ni eliminar o reescribir OT antiguas. La ausencia de BloqueosActivos equivale a cero bloqueos. El primer registro agrega BloqueosVersion: 1 y BloqueosActivos a su OT dentro de la misma transaccion que crea los bloqueos.

Se crea automaticamente la coleccion `<FIRESTORE_OT_COLLECTION>_bloqueos` (por defecto OT_Ordenes_bloqueos; en produccion ordenes_trabajo_bloqueos). Cada documento contiene OT, trabajo, area, motivo, datos de seguimiento y version. Su subcoleccion historial es acumulativa. Las consultas usan indices simples automaticos de Firestore, sin indices compuestos adicionales.

Los registros e historiales resueltos se conservan incluso al eliminar una OT. No se permite eliminar una OT con bloqueos activos. La bandeja con historial permite consultar registros de OT eliminadas por su numero, aunque los datos del cliente/vehiculo ya no esten disponibles.

Dos registros simultaneos del mismo trabajo y motivo se serializan por la OT y devuelven conflicto 409. La gestion utiliza version para impedir sobrescribir cambios de otro usuario. Un conflicto exige actualizar antes de guardar.

## Verificacion y puesta en funcionamiento
Desde server:
```
npm test
node --check index.js
node --check bloqueos.js
```
Desde web:
```
npm run build
npx eslint src/components/BloqueosOTPanel.jsx src/components/BloqueosGestionView.jsx src/utils/bloqueos.js
```
Las pruebas usan HTTP real local y una base en memoria con transacciones serializadas; no modifican Firestore ni clientes reales. Falta la validacion operativa contra una base de testing con usuarios reales antes de publicar.

Para testing, reiniciar backend (`npm start`) y frontend (`npm run dev`), iniciar sesion como mecanico, registrar Ambos, gestionar cada motivo como Cobranza y actualizar Taller/Seguimiento. Repetir con rechazo y cierre sin ejecutar, usuario sin permisos y doble registro.

Publicar backend y frontend juntos con el mecanismo existente de Render/main. No se agregan variables de entorno ni dependencias. Desplegar el backend primero o ambos en el mismo commit. El despliegue se realiza publicando este cambio en main, segun la configuracion existente de Render.

## Alcance
El estado del trabajo sigue siendo por area (mecanica, alineacion o aceite), como en la app existente. Por eso un bloqueo de un trabajo impide finalizar esa area, no las otras areas independientes. Cerrar un rechazo sin ejecutar requiere que el operador excluya ese trabajo del detalle final; no genera un trabajo aprobado.
Seguimiento consulta las OT sin el antiguo limite de 800 para no ocultar bloqueos antiguos. Si el volumen crece, conviene paginar y mantener contadores agregados; las consultas actuales favorecen la exactitud sobre el limite anterior.
