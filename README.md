# VTE MEDIA · VOLTAGE

Plataforma React para televisión online, guía de programación, eventos, favoritos sincronizados y administración protegida. La interfaz está en español y está preparada para Vercel y Supabase.

> Estado de la fuente original: el directorio de trabajo recibido estaba vacío; no se encontró el HTML `voltage_vte_media_estilo_mstplay(1).html` ni otro archivo original que conservar. Por ello no se han inventado canales, vídeos, audiencias ni emisiones reales. La aplicación muestra únicamente placeholders identificados hasta que el equipo publique contenido desde la administración.

## Incluye

- Inicio audiovisual responsive, reproductor, canales, guía con hora real y agenda de eventos.
- Programación mediante intervalos UTC: programa actual, siguiente, actualización cada 30 segundos y exclusión de solapes por canal.
- Reproductor de YouTube con `youtube-nocookie`, MP4 y estados explícitos si una fuente falta o falla. Las URL de HLS se conservan como dato configurable, pero requieren integrar un reproductor HLS compatible antes de emitirlas en navegadores sin soporte nativo.
- Supabase Auth: registro, correo/contraseña, recuperación, sesión persistente y proveedor Google.
- Perfil, avatar por URL HTTPS y Mi lista sincronizada en `saved_videos`.
- Panel de canales, programas y eventos, protegido tanto en React como por RLS.
- Migración PostgreSQL, índices, trigger de perfiles, permisos por columna y políticas RLS.

## Requisitos

- Node.js 20.19+ o 22.12+ (requisito de Vite 7).
- Un proyecto de Supabase. La URL prevista es `https://ofhnlzrfgeuhgbpxrqbz.supabase.co`, pero debe confirmarse desde el panel del propietario.
- Una clave **publishable/anon** pública de Supabase. Nunca uses `service_role` ni otros secretos en esta app.

## Instalación

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

Abre la URL que indique Vite. Para producción:

```bash
npm run lint
npm test
npm run build
npm run preview
```

## Variables de entorno

Completa `.env` a partir de `.env.example`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_TU_CLAVE_PUBLICA
VITE_APP_TIMEZONE=Europe/Madrid
```

Las variables `VITE_*` se integran en el navegador. Solo la URL, la publishable key/anon key y preferencias no sensibles pueden ir ahí. No subas `.env` al repositorio.

Sin variables válidas, la aplicación inicia en modo de muestra: las tarjetas no representan emisiones reales y no se simula ningún guardado, inicio de sesión o carga remota.

## Configurar Supabase

1. Crea o confirma el proyecto de Supabase y copia su URL y clave publicable desde **Connect** / **API Keys**.
2. Antes de ejecutar cambios, inspecciona las tablas y políticas existentes en el SQL Editor. Esta primera migración crea tablas mediante `if not exists`, pero una base ya utilizada requiere revisar conflictos de nombres y datos antes de aplicarla.
3. Ejecuta [`supabase/migrations/001_vte_media_schema.sql`](supabase/migrations/001_vte_media_schema.sql) desde el SQL Editor, o aplícala con Supabase CLI en un proyecto enlazado:

   ```bash
   supabase link --project-ref TU_PROJECT_REF
   supabase db push
   ```

4. Ejecuta también [`supabase/migrations/002_broadcast_server_clock.sql`](supabase/migrations/002_broadcast_server_clock.sql). Expone solo la hora oficial de PostgreSQL para alinear estados de guía y offsets de reproducción; no lee ni modifica tablas.
5. Comprueba en **Database > Policies** que RLS esté activado para las seis tablas y que las políticas se hayan creado.
6. Añade las variables reales al archivo `.env` y reinicia Vite.

### Seguridad implementada

- El trigger `handle_new_user` crea un perfil al registrarse; no guarda contraseñas.
- `user_roles` no da permisos de inserción, actualización ni eliminación a usuarios web.
- `is_admin()` es `SECURITY DEFINER`, define un `search_path` fijo y se usa para evitar recursión de RLS sin exponer la tabla de roles.
- Usuarios autenticados solo pueden leer/editar su propio perfil. Los permisos SQL limitan la actualización a `username` y `avatar_url`.
- Cada usuario solo puede leer, insertar y borrar sus propios favoritos; la clave única evita duplicados.
- Los anónimos leen únicamente canales activos, su programación y eventos publicados. La escritura de contenido exige el rol `admin` tanto para `USING` como para `WITH CHECK`.
- La base impide programas solapados mediante una exclusión `gist` y prohíbe intervalos inválidos.

### Primer administrador (tarea manual del propietario)

No se asigna ningún administrador automáticamente.

1. Registra la cuenta propietaria usando la pantalla **Crear cuenta**.
2. En el panel de Supabase entra en **Authentication > Users** y copia el UUID de esa cuenta después de verificarlo visualmente.
3. Abre [`supabase/manual/promote_first_admin.sql`](supabase/manual/promote_first_admin.sql) exclusivamente en el SQL Editor del propietario.
4. Sustituye el placeholder por ese UUID verificado y ejecuta el script.
5. Cierra y vuelve a iniciar sesión. Aparecerá **Administración** en la navegación.

No distribuyas este script con un UUID ya rellenado y no crees una interfaz pública de promoción de roles.

## Google y redirecciones de Auth

1. En Google Cloud crea un OAuth Client de tipo web y añade la callback URL que muestra Supabase en **Authentication > Providers > Google**.
2. Activa Google en ese apartado de Supabase e introduce el Client ID y Client Secret **solo en Supabase**, nunca en `.env` de Vite.
3. En **Authentication > URL Configuration**, añade en *Site URL* tu URL de producción y en *Redirect URLs* las URL de desarrollo/preview necesarias, por ejemplo `http://localhost:5173` y `https://tu-dominio.vercel.app`.
4. Comprueba un login real en cada dominio autorizado.

## Gestionar contenido

Tras obtener el rol admin:

1. Para cargar los canales iniciales **VTE1** y **VTE MUSIC**, ejecuta una vez [`supabase/manual/seed_default_channels.sql`](supabase/manual/seed_default_channels.sql) en el SQL Editor. Si Supabase no está configurado, ambos aparecen igualmente en el modo de muestra. Los enlaces a los canales de YouTube se ofrecen como accesos externos.
2. En **Administración > Canales**, crea el canal, orden, logotipo HTTPS, descripción y fuente. Marca *disponible públicamente* solo cuando deba publicarse.
3. En **Programas**, selecciona un canal y define inicio/fin. Pega la URL compartible de un vídeo o directo de YouTube (o MP4 HTTPS) en la fuente opcional. El reproductor inserta vídeos concretos; una página de canal como `youtube.com/@voltagerbx` no es una fuente de vídeo insertable. El formulario y PostgreSQL rechazan solapes dentro de ese canal. Los valores se convierten a UTC; se muestran con `VITE_APP_TIMEZONE`.
4. En **Eventos**, añade el intervalo y, opcionalmente, un canal asociado. `scheduled` se vuelve “En directo” únicamente cuando la hora actual está dentro de su intervalo; `cancelled` nunca se reproduce. Para evitar interrupciones simultáneas de un mismo canal, los eventos asociados con fecha de fin no pueden solaparse en PostgreSQL.

Un evento vivo tiene prioridad visual y de fuente sobre el programa regular de su canal. Al terminar, el reproductor vuelve al programa actual. La sección **Televisión** incluye sintonizador numerado, EPG con búsqueda y salto de 12 horas, progreso del programa y una vista mosaico de miniaturas (sin abrir muchos reproductores simultáneos). La guía y los estados consultan la hora oficial de PostgreSQL; si falta la migración 002 o no hay conexión, la interfaz usa el reloj local. Los horarios no se reinician al navegar: se evalúan contra marcas de tiempo absolutas.

Los programas de vídeo bajo demanda comienzan en el punto correspondiente a su hora de inicio y el reproductor corrige desfases periódicamente. Una emisión real de YouTube (`/live/`) reproduce desde el directo sin aplicar ese desplazamiento. YouTube controla la disponibilidad de inserción, autoplay, calidad y búsqueda; no se puede prometer sincronía al fotograma ni quitar su marca.

Cuando no hay una fuente de vídeo efectiva (ni evento, ni programa en emisión, ni vídeo predeterminado del canal), VTE1 reproduce en bucle el archivo local `voltagevd1.webm` y VTE MUSIC `voltagevd2.webm`. Arrancan silenciados para cumplir las reglas de autoplay del navegador; el espectador puede activar el sonido. Al entrar en un programa o evento con fuente configurada, esa fuente tiene prioridad sobre el bucle. Los archivos se importan como assets de Vite y se incluyen en el build de producción.

## Fuentes de vídeo

- YouTube: introduce una URL de vídeo (`youtube.com/watch?v=...` o `youtu.be/...`) que haya sido comprobada por su propietario para inserción. La app usa el iframe oficial de privacidad mejorada.
- MP4 HTTPS: se reproduce con la etiqueta `video` nativa.
- HLS (`.m3u8`): queda validada como fuente administrable, pero no se fuerza a reproducir con una librería no configurada. Si se necesita soporte HLS transversal, instala e integra `hls.js` y confirma CORS, codecs y derechos de la señal.
- Las URL de canales, páginas de YouTube, playlists sin duración conocida y directos programados no equivalen necesariamente a una emisión reproducible. Verifica cada fuente publicada.

La aplicación no requiere YouTube Data API para operar. Si se decide añadirla para comprobar estado o metadatos, debe ejecutarse detrás de un servicio seguro o con una clave con restricciones de referrer y cuota; no expongas una clave privada en el bundle.

## Catálogo de YouTube en Administración

La Edge Function [`supabase/functions/youtube-catalog/index.ts`](supabase/functions/youtube-catalog/index.ts) consulta hasta 50 vídeos públicos recientes de los cuatro canales autorizados para VOLTAGE. Comprueba la sesión Supabase y el rol `admin` antes de usar YouTube Data API; la clave nunca llega al navegador. En Administración → **Catálogo YouTube**, se puede elegir un vídeo y guardarlo como programa con inicio/fin en la tabla existente `programs`.

Para activar el catálogo en Supabase:

1. En Google Cloud, revoca cualquier API key que se haya publicado en un chat, crea una nueva, habilita **YouTube Data API v3** y restringe la clave a esa API.
2. En la raíz del proyecto, enlaza Supabase CLI con el proyecto correcto si todavía no está enlazado: `supabase link --project-ref TU_PROJECT_REF`.
3. Guarda la clave nueva como secreto, sin incluirla en `.env`, el frontend ni Git: `supabase secrets set YOUTUBE_API_KEY=TU_CLAVE_NUEVA`.
4. Despliega la función: `supabase functions deploy youtube-catalog`.
5. Verifica que JWT esté habilitado para la función (es el valor predeterminado). Solo las cuentas con rol admin pueden obtener el catálogo; la función además limita las consultas a los cuatro handles VTE autorizados.

Si la clave ya se guardó con otro nombre, vuelve a registrarla exactamente como `YOUTUBE_API_KEY`. No compartas la clave aquí ni la pongas en una variable `VITE_*`.

## Despliegue en Vercel

1. Sube este proyecto a un repositorio GitHub sin `.env`, `node_modules` ni archivos de compilación.
2. Importa el repositorio desde Vercel. El preset Vite detecta `npm run build` y publica `dist`.
3. Configura `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y, si procede, `VITE_APP_TIMEZONE` en **Settings > Environment Variables** para Production/Preview.
4. Ejecuta un despliegue nuevo para que Vite incorpore esas variables.
5. Añade la URL final a las Redirect URLs de Supabase/Google.

`vercel.json` reescribe rutas a `index.html`, por lo que `/tv`, `/guia` y el resto de rutas React no dan 404 al recargar.

## Pruebas y diagnóstico

`npm test` comprueba el cálculo actual/siguiente, intervalos inválidos, solapes por canal, estados de eventos, normalización de enlaces de YouTube, estados de sesión/administración y transición de favoritos. `npm run lint` revisa los imports, hooks y errores estáticos; `npm run build` comprueba la compilación de producción.

Consulta [`docs/VERIFICATION.md`](docs/VERIFICATION.md) para el estado de cada comprobación en el paquete final.

Problemas frecuentes:

- **“La conexión a Supabase aún no está configurada”**: confirma que `.env` existe, no contiene placeholders y reinicia Vite.
- **No aparece Administración**: verifica que se aplicó la migración, que el UUID de `user_roles` coincide con `auth.users.id` y vuelve a iniciar sesión.
- **Error de políticas o tabla ausente**: aplica/revisa la migración; no abras las políticas a `USING (true)` para “arreglarlo”.
- **Un iframe no reproduce**: la fuente puede bloquear embedding, requerir autenticación, estar restringida por región o no ser una URL de vídeo. Reemplázala por una fuente autorizada.
- **Un programa no se guarda**: corrige las fechas; no puede terminar antes de empezar ni superponerse con otro programa del canal.

## Estructura

```text
src/
  components/       # reproductor y elementos de interfaz reutilizables
  data/             # placeholders explícitos para el modo sin configuración
  hooks/            # sesión y lecturas/escrituras de Supabase
  lib/              # cliente, formatos y lógica de programación
  App.jsx           # rutas y vistas de producto
supabase/
  migrations/       # esquema, índices, RLS y triggers
  manual/           # promoción controlada del primer administrador
tests/              # pruebas de la lógica temporal
docs/               # informe de comprobaciones
```
#   v o l t a g e - w e b 
 
 