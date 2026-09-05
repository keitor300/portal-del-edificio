# Portal del Edificio

V1 demo funcional de un portal digital para un consorcio de 52 unidades.

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

## Demo

La app tiene dos vistas accesibles desde el selector superior: Propietario y Administración. Las modificaciones de avisos, reuniones, finanzas, encuestas, reclamos y reservas se guardan en `localStorage` y se reflejan en ambas vistas dentro del mismo navegador. Administración incluye “Restablecer datos demo”.

La importación de XLSX, XLS y CSV se procesa completamente en el navegador; el archivo no se sube a ningún servidor.

Esta versión no incluye autenticación real, roles seguros, padrón de propietarios, backend, pagos, notificaciones reales, votación legal ni contactos oficiales de emergencia. Todos los datos son ficticios.

## Deploy

La V1 está publicada en [Vercel](https://portal-del-edificio.vercel.app) y el código está en [GitHub](https://github.com/keitor300/portal-del-edificio). El frontend es una SPA Vite con rewrite para rutas internas y no depende de servicios específicos de Vercel, para conservar la posibilidad de migrar a Cloudflare más adelante.
