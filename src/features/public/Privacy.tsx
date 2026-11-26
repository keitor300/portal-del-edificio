import { Link } from 'react-router-dom';
import { PublicLayout } from './Public';
import './privacy.css';

export function PrivacyPage() {
  return <PublicLayout><article className="public-inner-page privacy-page" aria-labelledby="privacy-title">
    <span className="public-kicker">Edificio 13 y 34</span>
    <h1 id="privacy-title">Privacidad y tus datos</h1>
    <p className="privacy-updated">Actualizado el 26 de noviembre de 2026.</p>
    <p className="privacy-intro">Usamos tus datos para verificar tu acceso, gestionar las reservas y facilitar la comunicación con Administración. El registro no pide DNI. Acá podés consultar qué se guarda y quién puede verlo.</p>

    <section aria-labelledby="privacy-responsible">
      <h2 id="privacy-responsible">Quién gestiona la información</h2>
      <p>El portal está destinado a la gestión del Edificio 13 y 34. La empresa administradora es <strong>Juarez Ocampo</strong>, con oficina en <strong>calle 13 N.º 99, piso 1</strong>. La información se registra en una base de datos del portal y en los servicios de acceso y archivos indicados más abajo.</p>
      <p className="privacy-pending">Aviso informativo pendiente de validación por Administración: falta completar la identificación legal del consorcio responsable y el correo de privacidad antes de la apertura general del portal.</p>
    </section>

    <section aria-labelledby="privacy-data">
      <h2 id="privacy-data">Qué datos se guardan y para qué</h2>
      <ul>
        <li><strong>Tu cuenta:</strong> nombre, unidad, correo, identificador y estado de aprobación, para verificar el acceso y ayudarte a recuperarlo. La contraseña se verifica mediante Firebase Authentication; no se muestra a Administración.</li>
        <li><strong>Tu actividad:</strong> reservas, reclamos, consultas, archivos que adjuntes y participaciones en reuniones, propuestas o encuestas, para atender esas gestiones.</li>
        <li><strong>Lecturas y seguridad:</strong> avisos leídos, alertas, sesiones, fechas de operaciones y registros técnicos, incluida la dirección IP en controles de intentos de acceso, para mantener el portal y prevenir abusos.</li>
      </ul>
      <p>Los campos del registro son necesarios para solicitar acceso; sin ellos no se puede crear la cuenta. La solicitud queda sujeta a aprobación. Podés visitar la información pública sin registrarte. Evitá incluir datos sensibles o información innecesaria de otras personas en mensajes y archivos.</p>
    </section>

    <section aria-labelledby="privacy-visibility">
      <h2 id="privacy-visibility">Quién puede ver la información</h2>
      <ul>
        <li><strong>Administración:</strong> puede revisar solicitudes de acceso y gestionar la información del edificio.</li>
        <li><strong>Propietarios con acceso:</strong> pueden ver la unidad, fecha, horario y estado de las reservas del SUM, además de las publicaciones y participaciones compartidas en la comunidad.</li>
        <li><strong>Consultas y reclamos:</strong> se muestran a la cuenta de la unidad correspondiente y a Administración, no al resto de las unidades. Las expensas individuales se restringen por unidad; los documentos y cuentas comunes se comparten dentro del portal.</li>
        <li><strong>Visitantes:</strong> pueden ver los avisos marcados como públicos y el estado publicado del edificio. No tienen acceso al listado de cuentas ni a los chats privados.</li>
      </ul>
      <p>Los votos se registran asociados a la unidad para evitar duplicados; no deben considerarse anónimos. En la vista compartida se muestran los resultados acumulados.</p>
    </section>

    <section aria-labelledby="privacy-providers">
      <h2 id="privacy-providers">Servicios que utiliza el portal</h2>
      <p>Cloudflare aloja el portal, su base de datos y los archivos. Google Firebase Authentication gestiona las credenciales de acceso. El enlace anterior de Vercel redirige al portal actual. Estos proveedores pueden procesar información técnica y datos fuera de Argentina; no se garantiza almacenamiento exclusivo en el país.</p>
      <p>El portal no incorpora publicidad ni herramientas de seguimiento publicitario. No usa la campanita para enviar notificaciones al teléfono: las alertas aparecen dentro del portal.</p>
    </section>

    <section aria-labelledby="privacy-session">
      <h2 id="privacy-session">Sesión y almacenamiento en tu navegador</h2>
      <p>Usamos una cookie necesaria para mantener el acceso. Si marcás “Mantener sesión”, puede durar hasta 30 días para propietarios y 7 días para administradores. Sin esa opción, el acceso vence como máximo en 12 horas y la cookie no tiene persistencia programada. Cerrar sesión invalida ese acceso.</p>
      <p>El espacio de prueba de la Unidad 7B guarda sus cambios en ese navegador y está separado de los datos reales. No ingreses información personal real en ese espacio.</p>
    </section>

    <section aria-labelledby="privacy-retention">
      <h2 id="privacy-retention">Conservación de la información</h2>
      <p>Actualmente no hay un borrado automático general de cuentas, gestiones e historiales. Administración debe revisar qué información sigue siendo necesaria y atender los pedidos de eliminación, considerando las obligaciones aplicables al consorcio. Cancelar una reserva o cerrar sesión no elimina el historial.</p>
    </section>

    <section aria-labelledby="privacy-rights">
      <h2 id="privacy-rights">Consultar, corregir o eliminar tus datos</h2>
      <p>Podés solicitar acceso a tus datos, su actualización, corrección o eliminación. Si ya tenés acceso, podés iniciar el pedido en <Link to="/login?next=%2Fdemo%2Fpropietario%2Fservicios%2Fchat">Hablar con Administración</Link>. No hay un botón de eliminación automática de cuenta.</p>
      <p>Si todavía no tenés acceso o ya lo perdiste, podés dirigir tu solicitud por escrito a Juarez Ocampo en la oficina indicada arriba. El correo específico para estas consultas está pendiente de confirmación. No hace falta crear otra cuenta para ejercer estos derechos.</p>
      <p>La Agencia de Acceso a la Información Pública (AAIP) recibe consultas y denuncias sobre protección de datos personales. Podés consultar <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noopener noreferrer">tus derechos y cómo ejercerlos</a>, y el texto de la <a href="https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion" target="_blank" rel="noopener noreferrer">Ley 25.326</a>.</p>
    </section>
    <Link className="privacy-link" to="/">Volver al inicio</Link>
  </article></PublicLayout>;
}
