# Reduccion de lecturas de Firestore

Todas las escrituras se guardan directamente en Firebase. Cada peticion de OT consulta Firebase sin cache de snapshots en el servidor: los cambios desde otro dispositivo aparecen en la siguiente consulta.

- Mis OT filtra los campos de asignacion en Firebase.
- Seguimiento consulta solo el mes actual (Ecuador); el detalle excluye trabajos finalizados.
- Historial filtra CL/Placa antes de descargar documentos.
- Sin consultas periodicas de bloqueos. Se consultan al abrir la OT, guardar un bloqueo o seguimiento y pulsar Actualizar respuestas / Actualizar bloqueos. En otro dispositivo, pulsar Actualizar respuestas para ver cambios de Cobranza.
- Las consultas automaticas de bloqueos omiten los detalles de trabajos; conservan la validacion de permisos vigente.
- Las cuentas iniciales se inicializan una vez por proceso. Esto no almacena decisiones de permisos ni datos de OT.

No se garantiza quedar bajo 50.000 lecturas diarias. Inicio, reportes financieros y busquedas libres aun pueden consultar el historial completo. Para reducir ese coste se requieren agregados o busqueda indexada, preservando los resultados existentes. Comparar lecturas diarias en Firebase despues del despliegue.

Pruebas: npm test en server y npm run build en web. No requieren acceso a Firebase de produccion. Incluyen consultas de asignacion frescas entre peticiones, rango mensual, filtros y permisos de bloqueos.

No requiere migracion. Reiniciar backend y recargar frontend en desarrollo; publicar ambos para aplicar en produccion. 
