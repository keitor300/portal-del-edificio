# Operacion del portal

## Estado de puesta en marcha

La version publica de Vercel sigue siendo una demo. La base real de Cloudflare ya tiene las migraciones 0001-0006, pero el Worker aun no esta publicado. No distribuir el QR ni pedir datos reales a vecinos hasta completar la verificacion de produccion.

Pendiente: definir el administrador real, verificar el plan/CPU de Workers, completar la revision de produccion, cargar contactos y reglamento reales, publicar y probar la URL definitiva. No usar admin/admin en produccion. No crear cuentas administrativas con un correo supuesto.

## Alta de propietarios

1. El vecino solicita acceso con nombre, DNI, unidad, email y contrasena.
2. La solicitud queda pendiente; no permite acceder a informacion privada.
3. Administracion comprueba identidad y vinculacion con la unidad por un medio conocido, fuera del portal. Declarar un DNI no prueba identidad por si solo.
4. Desde Accesos de propietarios, aprueba o rechaza la solicitud.
5. El vecino ingresa con su unidad y contrasena. El sistema permite una cuenta aprobada por unidad, no cuentas independientes para cada conviviente.

Suspender una cuenta revoca sus sesiones. Antes de cambiar de titular, resolver el acceso anterior y verificar al nuevo responsable. No compartir la cuenta administradora con propietarios.

## Recuperar acceso

El propietario usa Olvide mi contrasena y solicita ayuda con unidad y email registrado. El mensaje publico no revela si existe esa cuenta.

Administracion debe verificar la identidad por un canal conocido, abrir la solicitud de recuperacion, confirmar esa verificacion y volver a ingresar su propia contrasena. El portal genera un enlace de un solo uso, valido durante 30 minutos. Compartirlo solo con el titular por el email registrado u otro canal previamente verificado. Nunca publicarlo en grupos o carteleras.

No se envia email automaticamente. Generar otro enlace invalida el anterior. Al cambiar la contrasena se cierran las sesiones anteriores. El procedimiento inicial y de recuperacion de la cuenta administradora aun debe completarse antes de la apertura.

## Reservas del SUM

Administracion debe cargar el reglamento real antes de habilitar reservas. Sin reglamento no se acepta ninguna reserva.

Se eligen inicio y fin desde las 08:30, con opciones en punto o media hora. Domingo a jueves se permite terminar a la 01:00 del dia siguiente; viernes y sabados, a las 03:00. Esto no limita la duracion a bloques de 30 o 60 minutos.

Todos los propietarios ven unidad, fecha y horario de las reservas. Solo pueden cancelar las de su unidad antes de comenzar; administracion puede intervenir. Las superposiciones se rechazan en la base incluso si dos vecinos reservan simultaneamente. No bloquear una fecha con reservas vigentes: primero resolverlas con los afectados.

## Avisos, archivos y cuentas

- Los avisos son privados salvo que administracion habilite expresamente su publicacion en la pagina publica. No incluir datos personales en un aviso publico.
- Publicar expensas exige unidad, periodo, importe, vencimiento y PDF. Una unidad no puede abrir el PDF de otra. Un borrador no debe estar disponible para propietarios.
- Un documento sin archivo no ofrece un PDF ficticio. Adjuntar el archivo correcto antes de anunciar su disponibilidad.
- Los adjuntos admiten PDF, JPG, PNG, WebP o TXT hasta 1 MB; las liquidaciones solo PDF. No hay antivirus configurado: usar archivos de origen conocido.
- Los archivos se conservan en almacenamiento privado. Eliminar una publicacion retira el acceso de los propietarios al adjunto si ya no tiene otra referencia visible. No implica borrado fisico del archivo ni de su historial; la politica de retencion y limpieza debe definirse antes de la operacion sostenida.
- Si aparece un conflicto de edicion, actualizar y revisar el cambio de otra persona antes de volver a guardar. No asumir que el primer intento se guardo.
- Las importaciones de caja conservan un identificador de operacion para poder reintentarse sin duplicar movimientos. Revisar siempre el resultado y los importes.

## Copias y mantenimiento

Repositorio operativo: `C:/Users/Nicolas/Projects/portal-del-edificio`. La base remota se llama `portal-edificio-produccion`; los archivos privados estan en `portal-edificio-archivos`.

Antes de una migracion, exportar D1 a una ubicacion privada y con nombre unico. Ejemplo de comando (reemplazar la ruta por una nueva):

```powershell
npx.cmd wrangler d1 export portal-edificio-produccion --remote --output RUTA_PRIVADA_NUEVA.sql
```

La exportacion puede afectar temporalmente la disponibilidad: realizarla en una ventana acordada. No subir copias, enlaces temporales, hashes de contrasenas, DNI ni tokens a Git o a carpetas publicas. Una copia D1 no contiene los objetos R2: incluir los archivos en la estrategia de recuperacion.

Hay un comando de respaldo combinado que exporta D1, restaura el SQL en SQLite en memoria para comprobar integridad y referencias, y descarga los objetos R2 registrados en esa instantanea:

```powershell
node scripts/backup-portal.mjs --remote
node scripts/backup-portal.mjs --verify RUTA_DE_LA_COPIA
```

Crea un directorio nuevo bajo `.wrangler/backups`, excluido de Git, sin sobrescribir copias anteriores. El manifiesto se escribe al terminar y conserva las huellas SHA-256 del SQL y los archivos; una descarga incompleta o un archivo alterado hacen fallar la verificacion. No recupera objetos huerfanos que no figuren en D1. Este procedimiento depende de que los adjuntos sean inmutables y no se borren fisicamente durante la copia; si se agrega limpieza, coordinarla con los respaldos.

La copia contiene datos personales y credenciales derivadas. NO esta cifrada por el script: guardarla en un disco protegido y no compartirla ni publicarla. Las huellas detectan cambios accidentales, no autentican una copia frente a alguien que tambien pueda modificar el manifiesto. No ejecutar SQL de copias de origen desconocido.

La copia remota del 23/11/2026 paso la restauracion local y la integridad; tenia cero adjuntos. Las pruebas con adjuntos son fixtures locales, no una restauracion R2 real. No se ha probado una restauracion remota completa ni configurado un respaldo automatico de D1 y R2; siguen pendientes. Si se incorpora un proveedor externo de autenticacion, este respaldo no incluira sus cuentas: documentar por separado su recuperacion y la correspondencia de identidades.

Wrangler ejecuta `scripts/build-production.mjs` antes del despliegue para no publicar assets demo. Un build exitoso no habilita la apertura: verificar tambien migraciones, cuenta administradora, reglas, permisos, login y reservas en navegadores separados desde la URL publica. No debilitar el hash de contrasenas para ajustarlo a un plan de CPU insuficiente.
