# Edificio 13 y 34

V1 demo funcional de la web institucional y portal operativo de un consorcio de 52 unidades.

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Otros comandos:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Estructura pública y demo

La portada pública vive en `/` y presenta novedades, edificio, contacto y fotografías reales. La experiencia operativa demo vive en `/demo/propietario` y `/demo/administracion`; no requiere login. Las modificaciones de avisos, reuniones, finanzas, encuestas, reclamos y reservas se guardan en `localStorage` y se reflejan en ambas vistas dentro del mismo navegador. Administración incluye “Restablecer datos demo”.

La importación de XLSX, XLS y CSV se procesa completamente en el navegador; el archivo no se sube a ningún servidor.

Esta versión no incluye autenticación real, roles seguros, padrón de propietarios, backend, pagos, notificaciones reales, votación legal ni contactos oficiales de emergencia. La portada marca las novedades y recorridos operativos como demo. Todos los datos son ficticios.

## Deploy

La V1 está publicada en [Vercel](https://portal-del-edificio.vercel.app) y el código está en [GitHub](https://github.com/keitor300/portal-del-edificio). El frontend es una SPA Vite con rewrite para rutas internas y no depende de servicios específicos de Vercel, para conservar la posibilidad de migrar a Cloudflare más adelante.
