import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useMediaData } from './hooks/useMediaData'
import { configMessage } from './lib/supabase'
import { getEventStatus } from './lib/schedule'
import { adminAccessState } from './lib/access'
import { ChannelMark, EmptyState, LoadingGrid, Notice, Status } from './components/ui'
import { VideoPlayer } from './components/VideoPlayer'
import './styles.css'

const timezone = import.meta.env.VITE_APP_TIMEZONE || 'Europe/Madrid'

function Header({ auth }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return <header className="site-header">
    <Link className="brand" to="/" onClick={close}><span className="brand-bolt">ϟ</span><span>VTE <b>MEDIA</b><small>VOLTAGE</small></span></Link>
    <button className="menu-button" aria-label="Abrir navegación" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
    <nav className={open ? 'open' : ''} aria-label="Navegación principal">
      <NavLink to="/tv" onClick={close}>Televisión</NavLink>
      <NavLink to="/guia" onClick={close}>Guía TV</NavLink>
      <NavLink to="/canales" onClick={close}>Canales</NavLink>
      <NavLink to="/eventos" onClick={close}>Eventos</NavLink>
      <NavLink to="/mi-lista" onClick={close}>Mi lista</NavLink>
      {auth.isAdmin && <NavLink to="/admin" onClick={close}>Administración</NavLink>}
    </nav>
    <Link className="account-link" to={auth.user ? '/perfil' : '/acceso'} onClick={close} aria-label={auth.user ? 'Ir a mi perfil' : 'Iniciar sesión'}>
      {auth.profile?.avatar_url ? <img src={auth.profile.avatar_url} alt="" /> : <span>{auth.profile?.username?.slice(0, 1).toUpperCase() || '◌'}</span>}
      <em>{auth.user ? auth.profile?.username || 'Mi perfil' : 'Acceder'}</em>
    </Link>
  </header>
}

function AppShell() {
  const auth = useAuth()
  const media = useMediaData(auth.user)
  return <div className="app-shell">
    <Header auth={auth} />
    {!auth.configured && <div className="config-banner">Modo de muestra: {configMessage()} <Link to="/acceso">Ver acceso</Link></div>}
    <main>
      <Routes>
        <Route path="/" element={<HomePage auth={auth} media={media} />} />
        <Route path="/tv" element={<TelevisionPage media={media} />} />
        <Route path="/guia" element={<GuidePage media={media} />} />
        <Route path="/canales" element={<ChannelsPage media={media} />} />
        <Route path="/eventos" element={<EventsPage media={media} />} />
        <Route path="/mi-lista" element={<SavedPage auth={auth} media={media} />} />
        <Route path="/perfil" element={<ProfilePage auth={auth} />} />
        <Route path="/acceso" element={auth.user ? <Navigate to="/perfil" replace /> : <AccessPage auth={auth} />} />
        <Route path="/admin" element={<AdminGate auth={auth} media={media} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <footer><span>VTE MEDIA</span> · VOLTAGE <small>Contenido, emisión y programación gestionados por su equipo.</small></footer>
  </div>
}

function HomePage({ auth, media }) {
  const [channelId, setChannelId] = useState(null)
  const channel = media.channels.find((item) => item.id === channelId) || media.channels.find((item) => item.is_active) || media.channels[0]
  const liveEvent = media.events.find((event) => event.channel_id === channel?.id && getEventStatus(event) === 'live')
  return <>
    <section className="hero"><div className="hero-copy"><span className="eyebrow">VOLTAGE PRESENTA</span><h1>Televisión que mantiene el pulso.</h1><p>Canales, programación y eventos reunidos en una experiencia audiovisual clara y continua.</p><div className="hero-actions"><Link className="button primary" to="/tv">Ver televisión <span>→</span></Link><Link className="button quiet" to="/guia">Explorar guía</Link></div></div><div className="hero-art"><span>VTE</span><i>MEDIA</i><div className="signal a" /><div className="signal b" /><div className="signal c" /></div></section>
    <section className="home-player section-block"><div className="section-heading"><div><span className="eyebrow">EN PANTALLA</span><h2>Televisión en directo</h2></div><Link to="/tv">Abrir reproductor →</Link></div><VideoPlayer channel={channel} programs={media.programs} activeEvent={liveEvent} timezone={timezone} /></section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">SEÑAL</span><h2>Canales disponibles</h2></div><Link to="/canales">Todos los canales →</Link></div>{media.loading ? <LoadingGrid /> : <div className="channel-rail">{media.channels.slice(0, 4).map((item) => <button className={`channel-card ${channel?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setChannelId(item.id)}><ChannelMark channel={item} /><div><Status tone={item.is_active ? 'live' : 'muted'}>{item.is_active ? 'Disponible' : 'Pausado'}</Status><strong>{item.name}</strong><p>{item.description}</p></div><span className="card-arrow">↗</span></button>)}</div>}</section>
    <section className="section-block split-overview"><ProgramSnapshot channels={media.channels} programs={media.programs} /><EventSnapshot events={media.events} /></section>
    <section className="member-cta"><div><span className="eyebrow">TU ESPACIO</span><h2>Guarda lo que quieres volver a ver.</h2><p>Mi lista se sincroniza de forma segura entre dispositivos cuando inicias sesión.</p></div><Link className="button primary" to={auth.user ? '/mi-lista' : '/acceso'}>{auth.user ? 'Ir a Mi lista' : 'Crear cuenta'}</Link></section>
  </>
}

function ProgramSnapshot({ channels, programs }) {
  const active = channels.filter((channel) => channel.is_active).slice(0, 3)
  return <section className="overview-card"><div className="section-heading"><div><span className="eyebrow">AHORA Y DESPUÉS</span><h2>Programación</h2></div><Link to="/guia">Guía completa →</Link></div>{active.length ? active.map((channel) => <ProgramLine key={channel.id} channel={channel} programs={programs} />) : <p className="muted-copy">Aún no hay canales publicados.</p>}</section>
}

function ProgramLine({ channel, programs }) {
  const now = new Date()
  const current = programs.find((program) => program.channel_id === channel.id && new Date(program.starts_at) <= now && new Date(program.ends_at) > now)
  const next = programs.filter((program) => program.channel_id === channel.id && new Date(program.starts_at) > now).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0]
  return <div className="program-line"><ChannelMark channel={channel} compact /><div><strong>{current?.title || 'Sin emisión programada'}</strong><small>{next ? `Después · ${next.title}` : 'No hay siguiente emisión'}</small></div><Status tone={current ? 'live' : 'muted'}>{current ? 'Ahora' : 'Sin guía'}</Status></div>
}

function EventSnapshot({ events }) {
  const upcoming = events.filter((event) => getEventStatus(event) !== 'finished').slice(0, 3)
  return <section className="overview-card"><div className="section-heading"><div><span className="eyebrow">AGENDA</span><h2>Eventos</h2></div><Link to="/eventos">Ver agenda →</Link></div>{upcoming.length ? upcoming.map((event) => <EventRow key={event.id} event={event} />) : <div className="compact-empty"><span>◇</span><p>No hay eventos publicados todavía.</p></div>}</section>
}

function EventRow({ event }) {
  const status = getEventStatus(event)
  return <div className="event-row"><div className="date-chip"><b>{new Intl.DateTimeFormat('es-ES', { day: '2-digit', timeZone: timezone }).format(new Date(event.starts_at))}</b><small>{new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: timezone }).format(new Date(event.starts_at))}</small></div><div><strong>{event.title}</strong><small>{new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(event.starts_at))}</small></div><Status tone={status === 'live' ? 'live' : 'violet'}>{status === 'live' ? 'Directo' : 'Próximamente'}</Status></div>
}

function TelevisionPage({ media }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const channelId = searchParams.get('channel')
  const [message, setMessage] = useState(null)
  const channel = media.channels.find((item) => item.id === channelId) || media.channels.find((item) => item.is_active) || media.channels[0]
  const liveEvent = media.events.find((event) => event.channel_id === channel?.id && getEventStatus(event) === 'live')
  return <div className="page page-tv"><PageIntro eyebrow="REPRODUCTOR" title="Televisión" detail="La programación se ajusta a la hora actual de la zona configurada." />{message && <Notice tone="error">{message}</Notice>}<VideoPlayer channel={channel} programs={media.programs} activeEvent={liveEvent} timezone={timezone} onPlayError={() => setMessage('La fuente no se ha podido reproducir. Comprueba que permite inserción y que su URL sea válida.')} /><section className="section-block"><div className="section-heading"><div><span className="eyebrow">CAMBIA DE SEÑAL</span><h2>Elige un canal</h2></div></div><div className="channel-selector">{media.channels.map((item) => <button key={item.id} onClick={() => { setSearchParams({ channel: item.id }); setMessage(null) }} className={channel?.id === item.id ? 'active' : ''} aria-pressed={channel?.id === item.id}><ChannelMark channel={item} compact /><span><b>{item.name}</b><small>{item.is_active ? 'Disponible' : 'Pausado'}</small></span></button>)}</div></section></div>
}

function GuidePage({ media }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(id) }, [])
  return <div className="page"><PageIntro eyebrow="EN HORA" title="Guía TV" detail={`Actualizada automáticamente · ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(now)}`} />{media.error && <Notice tone="error">{media.error}</Notice>}{media.loading ? <LoadingGrid /> : media.channels.length ? <div className="guide-list">{media.channels.map((channel) => <GuideChannel key={channel.id} channel={channel} programs={media.programs} now={now} />)}</div> : <EmptyState title="La guía está vacía" detail="Publica canales y programas desde el panel de administración." />}</div>
}

function GuideChannel({ channel, programs, now }) {
  const items = programs.filter((item) => item.channel_id === channel.id).filter((item) => new Date(item.ends_at) > now).slice(0, 6)
  return <section className="guide-channel"><header><ChannelMark channel={channel} compact /><div><h2>{channel.name}</h2><p>{channel.is_active ? 'Señal disponible' : 'Canal pausado'}</p></div></header><div className="guide-timeline">{items.length ? items.map((program) => { const current = new Date(program.starts_at) <= now && new Date(program.ends_at) > now; return <article className={current ? 'current' : ''} key={program.id}><time>{new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(program.starts_at))}</time><div><Status tone={current ? 'live' : 'muted'}>{current ? 'Ahora' : 'Programado'}</Status><h3>{program.title}</h3>{program.description && <p>{program.description}</p>}</div></article> }) : <p className="no-schedule">No hay programación futura publicada.</p>}</div></section>
}

function ChannelsPage({ media }) {
  return <div className="page"><PageIntro eyebrow="SEÑALES" title="Canales" detail="Explora las señales activas y su información de emisión." />{media.isDemo && <Notice>Estas tarjetas son placeholders de diseño, no señales reales. Configura sus fuentes y metadatos desde Administración.</Notice>}{media.loading ? <LoadingGrid /> : <div className="channels-page-grid">{media.channels.map((channel) => <article className="channel-detail-card" key={channel.id}><ChannelMark channel={channel} /><Status tone={channel.is_active ? 'live' : 'muted'}>{channel.is_active ? 'Disponible' : 'No disponible'}</Status><h2>{channel.name}</h2><p>{channel.description || 'Sin descripción.'}</p><div className="card-bottom"><small>{channel.video_source ? 'Fuente configurada' : 'Fuente por configurar'}</small><Link to={`/tv?channel=${channel.id}`}>Ver canal →</Link></div></article>)}</div>}</div>
}

function EventsPage({ media }) {
  return <div className="page"><PageIntro eyebrow="AGENDA" title="Eventos" detail="Retransmisiones y sesiones especiales, con su estado y horario publicado." />{media.loading ? <LoadingGrid /> : media.events.length ? <div className="events-grid">{media.events.map((event) => <EventCard key={event.id} event={event} media={media} />)}</div> : <EmptyState title="Aún no hay eventos" detail="Cuando se publique una retransmisión o sesión especial, aparecerá aquí con su horario." />}</div>
}

function EventCard({ event, media }) {
  const status = getEventStatus(event)
  const isSaved = media.savedVideos.some((item) => item.content_key === `event:${event.id}`)
  const save = async () => { try { await media.toggleSavedVideo({ content_key: `event:${event.id}`, title: event.title, thumbnail_url: '', video_source: event.video_source || '' }) } catch (error) { window.alert(error.message) } }
  return <article className="event-card"><div className="event-visual"><span>VTE</span><Status tone={status === 'live' ? 'live' : status === 'cancelled' ? 'error' : 'violet'}>{status === 'live' ? 'En directo' : status === 'cancelled' ? 'Cancelado' : status === 'finished' ? 'Finalizado' : 'Programado'}</Status></div><div className="event-content"><small>{new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: timezone }).format(new Date(event.starts_at))}</small><h2>{event.title}</h2><p>{event.description || 'Sin descripción adicional.'}</p><div className="card-actions"><Link className="text-link" to="/tv">Ir a televisión →</Link><button className="icon-action" onClick={save} aria-label={isSaved ? 'Quitar de Mi lista' : 'Guardar en Mi lista'}>{isSaved ? '★' : '☆'}</button></div></div></article>
}

function SavedPage({ auth, media }) {
  if (!auth.user) return <div className="page"><EmptyState title="Tu lista te espera" detail="Inicia sesión para guardar contenidos y encontrarlos en cualquiera de tus dispositivos." action="Iniciar sesión" to="/acceso" /></div>
  const remove = async (item) => { try { await media.toggleSavedVideo(item) } catch (error) { window.alert(error.message) } }
  return <div className="page"><PageIntro eyebrow="COLECCIÓN PERSONAL" title="Mi lista" detail="Tus guardados se almacenan en tu cuenta, no en el navegador." />{media.loading ? <LoadingGrid /> : media.savedVideos.length ? <div className="saved-grid">{media.savedVideos.map((item) => <article className="saved-card" key={item.id}><div className="saved-art"><span>VTE</span></div><div><h2>{item.title}</h2><p>{new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: timezone }).format(new Date(item.created_at))}</p></div><div className="card-actions"><Link className="text-link" to="/tv">Reproducir →</Link><button className="icon-action filled" onClick={() => remove(item)} aria-label={`Quitar ${item.title} de Mi lista`}>★</button></div></article>)}</div> : <EmptyState title="Todavía no has guardado nada" detail="Usa la estrella en un evento para añadirlo a esta lista. Tus favoritos se sincronizarán al iniciar sesión en otro dispositivo." to="/eventos" action="Ver eventos" />}</div>
}

function AccessPage({ auth }) {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = async (event) => {
    event.preventDefault(); setError(null); setMessage(null); setSubmitting(true)
    try {
      if (mode === 'signup') { await auth.signUp(form.email, form.password, form.username); setMessage('Revisa tu correo para verificar la cuenta antes de iniciar sesión, si la confirmación está activada.') }
      if (mode === 'signin') await auth.signIn(form.email, form.password)
      if (mode === 'reset') { await auth.resetPassword(form.email); setMessage('Hemos enviado instrucciones para recuperar tu contraseña.') }
    } catch (err) { setError(translateAuthError(err.message)) } finally { setSubmitting(false) }
  }
  return <div className="access-page"><section className="access-intro"><span className="eyebrow">VTE MEDIA</span><h1>Tu espacio dentro de VOLTAGE.</h1><p>Accede a tu perfil y mantén Mi lista contigo en cada dispositivo.</p><div className="access-decoration">ϟ</div></section><section className="auth-card"><div className="auth-tabs">{mode !== 'reset' && <><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Entrar</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Crear cuenta</button></>}</div><h2>{mode === 'signup' ? 'Crea tu cuenta' : mode === 'reset' ? 'Recupera el acceso' : 'Bienvenido de nuevo'}</h2>{error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}<form onSubmit={submit}>{mode === 'signup' && <label>Nombre público<input required minLength="2" maxLength="48" name="username" value={form.username} onChange={change} autoComplete="nickname" /></label>}<label>Correo electrónico<input required type="email" name="email" value={form.email} onChange={change} autoComplete="email" /></label>{mode !== 'reset' && <label>Contraseña<input required minLength="6" type="password" name="password" value={form.password} onChange={change} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>}<button className="button primary full" disabled={submitting}>{submitting ? 'Procesando…' : mode === 'signup' ? 'Crear cuenta' : mode === 'reset' ? 'Enviar instrucciones' : 'Iniciar sesión'}</button></form>{mode === 'signin' && <button className="forgot-button" onClick={() => { setMode('reset'); setError(null); setMessage(null) }}>¿Has olvidado tu contraseña?</button>}{mode === 'reset' && <button className="forgot-button" onClick={() => { setMode('signin'); setError(null); setMessage(null) }}>Volver a iniciar sesión</button>}<div className="oauth-separator"><span>o continúa con</span></div><button className="google-button" onClick={async () => { try { await auth.signInWithGoogle() } catch (err) { setError(translateAuthError(err.message)) } }}><b>G</b> Google</button>{!auth.configured && <p className="auth-help">El acceso estará disponible después de configurar las variables públicas de Supabase.</p>}</section></div>
}

function ProfilePage({ auth }) {
  const [form, setForm] = useState({ username: '', avatar_url: '' })
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => setForm({ username: auth.profile?.username || '', avatar_url: auth.profile?.avatar_url || '' }), [auth.profile])
  if (!auth.user) return <Navigate to="/acceso" replace />
  const save = async (event) => { event.preventDefault(); setError(null); try { await auth.updateProfile(form); setMessage('Perfil actualizado correctamente.') } catch (err) { setError(err.message) } }
  return <div className="page profile-page"><PageIntro eyebrow="CUENTA" title="Mi perfil" detail="Gestiona los datos públicos de tu cuenta." /><div className="profile-layout"><section className="profile-card"><div className="profile-avatar">{form.avatar_url ? <img src={form.avatar_url} alt="Avatar" /> : (form.username || auth.user.email).slice(0, 1).toUpperCase()}</div><div><Status tone={auth.isAdmin ? 'violet' : 'muted'}>{auth.isAdmin ? 'Administrador' : 'Miembro'}</Status><h2>{auth.profile?.username || 'Sin nombre público'}</h2><p>{auth.user.email}</p></div></section><form className="profile-form" onSubmit={save}>{error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}<label>Nombre público<input required minLength="2" maxLength="48" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><label>URL del avatar <small>Opcional, debe ser una URL HTTPS que controles.</small><input type="url" placeholder="https://…" value={form.avatar_url} onChange={(event) => setForm({ ...form, avatar_url: event.target.value })} /></label><button className="button primary">Guardar cambios</button></form><section className="account-security"><h2>Sesión</h2><p>La autenticación y las contraseñas son gestionadas por Supabase Auth.</p><button className="button danger" onClick={async () => { try { await auth.signOut() } catch (err) { setError(err.message) } }}>Cerrar sesión</button></section></div></div>
}

function AdminGate({ auth, media }) {
  if (auth.loading) return <div className="page"><LoadingGrid /></div>
  const access = adminAccessState(auth.user, auth.isAdmin)
  if (access === 'unauthenticated') return <div className="page"><EmptyState title="Acceso restringido" detail="Inicia sesión con una cuenta autorizada para acceder a la administración." action="Iniciar sesión" to="/acceso" /></div>
  if (access === 'forbidden') return <div className="page"><EmptyState title="No tienes acceso al panel" detail="Tu cuenta no tiene el rol de administración. La protección también se aplica en las políticas RLS de Supabase." to="/" action="Volver al inicio" /></div>
  return <AdminPage media={media} />
}

function AdminPage({ media }) {
  const [section, setSection] = useState('channels')
  const totals = { channels: media.channels.length, programs: media.programs.length, events: media.events.length }
  return <div className="page admin-page"><PageIntro eyebrow="OPERACIONES" title="Administración" detail="Los cambios se validan en el navegador y vuelven a comprobarse por PostgreSQL y RLS." /><div className="admin-metrics">{Object.entries(totals).map(([key, value]) => <button className={section === key ? 'active' : ''} key={key} onClick={() => setSection(key)}><b>{value}</b><span>{key === 'channels' ? 'Canales' : key === 'programs' ? 'Programas' : 'Eventos'}</span></button>)}</div>{media.error && <Notice tone="error">{media.error}</Notice>}{section === 'channels' && <ChannelAdmin media={media} />}{section === 'programs' && <ProgramAdmin media={media} />}{section === 'events' && <EventAdmin media={media} />}</div>
}

function ChannelAdmin({ media }) {
  const blank = { name: '', description: '', logo_url: '', video_source: '', is_active: true, display_order: media.channels.length + 1 }
  return <EntityWorkspace title="Canales" detail="Las señales públicas necesitan nombre, orden y una fuente compatible si deben reproducirse." entities={media.channels} blank={blank} onSave={(entity) => media.saveEntity('channels', { ...entity, display_order: Number(entity.display_order) })} onDelete={(id) => media.deleteEntity('channels', id)} renderItem={(item, edit) => <div className="admin-row"><ChannelMark channel={item} compact /><div><strong>{item.name}</strong><small>{item.is_active ? 'Activo' : 'Pausado'} · {item.video_source ? 'Fuente configurada' : 'Sin fuente'}</small></div><button className="text-button" onClick={() => edit(item)}>Editar</button></div>} fields={(form, change) => <><label>Nombre<input name="name" required maxLength="80" value={form.name || ''} onChange={change} /></label><label>Descripción<textarea name="description" maxLength="500" value={form.description || ''} onChange={change} /></label><div className="form-pair"><label>URL del logo<input name="logo_url" type="url" value={form.logo_url || ''} onChange={change} /></label><label>Orden<input name="display_order" required type="number" min="0" value={form.display_order ?? ''} onChange={change} /></label></div><label>Fuente de vídeo <small>URL de YouTube, MP4 o HLS según el reproductor disponible.</small><input name="video_source" type="url" value={form.video_source || ''} onChange={change} /></label><label className="check-label"><input type="checkbox" name="is_active" checked={Boolean(form.is_active)} onChange={change} /> Canal disponible públicamente</label></>} />
}

function ProgramAdmin({ media }) {
  const blank = { channel_id: media.channels[0]?.id || '', title: '', description: '', video_source: '', starts_at: '', ends_at: '' }
  const save = async (entity) => {
    const normalized = { ...entity, starts_at: new Date(entity.starts_at).toISOString(), ends_at: new Date(entity.ends_at).toISOString() }
    const others = media.programs.filter((item) => item.id !== entity.id)
    const { hasScheduleConflict } = await import('./lib/schedule')
    if (hasScheduleConflict(normalized, others)) throw new Error('El intervalo no es válido o se solapa con otro programa del mismo canal.')
    return media.saveEntity('programs', normalized)
  }
  return <EntityWorkspace title="Programas" detail="La guía usa intervalos UTC y bloquea los solapes dentro de cada canal." entities={media.programs} blank={blank} onSave={save} onDelete={(id) => media.deleteEntity('programs', id)} renderItem={(item, edit) => <div className="admin-row"><div className="time-tag">{new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(item.starts_at))}</div><div><strong>{item.title}</strong><small>{media.channels.find((channel) => channel.id === item.channel_id)?.name || 'Canal eliminado'}</small></div><button className="text-button" onClick={() => edit(item)}>Editar</button></div>} fields={(form, change) => <><label>Canal<select name="channel_id" required value={form.channel_id || ''} onChange={change}><option value="" disabled>Selecciona un canal</option>{media.channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}</select></label><label>Título<input name="title" required maxLength="140" value={form.title || ''} onChange={change} /></label><label>Descripción<textarea name="description" maxLength="1000" value={form.description || ''} onChange={change} /></label><div className="form-pair"><label>Inicio<input name="starts_at" required type="datetime-local" value={toEditInput(form.starts_at)} onChange={change} /></label><label>Fin<input name="ends_at" required type="datetime-local" value={toEditInput(form.ends_at)} onChange={change} /></label></div><label>Fuente opcional del programa<input name="video_source" type="url" value={form.video_source || ''} onChange={change} /></label></>} />
}

function EventAdmin({ media }) {
  const blank = { channel_id: '', title: '', description: '', video_source: '', starts_at: '', ends_at: '', status: 'scheduled' }
  const save = async (entity) => {
    if (entity.ends_at && new Date(entity.ends_at) <= new Date(entity.starts_at)) throw new Error('La hora de fin debe ser posterior a la hora de inicio.')
    return media.saveEntity('events', { ...entity, channel_id: entity.channel_id || null, starts_at: new Date(entity.starts_at).toISOString(), ends_at: entity.ends_at ? new Date(entity.ends_at).toISOString() : null })
  }
  return <EntityWorkspace title="Eventos" detail="Un evento en directo tiene prioridad visual durante su intervalo. Publica solo fuentes cuya inserción hayas verificado." entities={media.events} blank={blank} onSave={save} onDelete={(id) => media.deleteEntity('events', id)} renderItem={(item, edit) => <div className="admin-row"><div className="time-tag">{new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(item.starts_at))}</div><div><strong>{item.title}</strong><small>{item.status}</small></div><button className="text-button" onClick={() => edit(item)}>Editar</button></div>} fields={(form, change) => <><label>Título<input name="title" required maxLength="140" value={form.title || ''} onChange={change} /></label><label>Descripción<textarea name="description" maxLength="1000" value={form.description || ''} onChange={change} /></label><div className="form-pair"><label>Inicio<input name="starts_at" required type="datetime-local" value={toEditInput(form.starts_at)} onChange={change} /></label><label>Fin <small>Opcional</small><input name="ends_at" type="datetime-local" value={toEditInput(form.ends_at)} onChange={change} /></label></div><div className="form-pair"><label>Canal asociado<select name="channel_id" value={form.channel_id || ''} onChange={change}><option value="">Sin canal asociado</option>{media.channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}</select></label><label>Estado<select name="status" value={form.status || 'scheduled'} onChange={change}><option value="scheduled">Programado</option><option value="cancelled">Cancelado</option></select></label></div><label>Fuente de emisión<input name="video_source" type="url" value={form.video_source || ''} onChange={change} /></label></>} />
}

function EntityWorkspace({ title, detail, entities, blank, onSave, onDelete, renderItem, fields }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const reset = () => { setEditing(null); setForm(blank); setError(null) }
  const edit = (entity) => { setEditing(entity); setForm(entity); setError(null) }
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })
  const submit = async (event) => { event.preventDefault(); setError(null); setSaving(true); try { await onSave({ ...form, ...(editing ? { id: editing.id } : {}) }); reset() } catch (err) { setError(err.message) } finally { setSaving(false) } }
  const remove = async () => { if (!editing || !window.confirm(`¿Eliminar “${editing.title || editing.name}”? Esta operación no se puede deshacer.`)) return; try { await onDelete(editing.id); reset() } catch (err) { setError(err.message) } }
  return <section className="entity-workspace"><div className="admin-list"><div className="section-heading"><div><span className="eyebrow">GESTIÓN</span><h2>{title}</h2><p>{detail}</p></div><button className="button quiet" onClick={reset}>+ Nuevo</button></div>{entities.length ? entities.map((item) => <div key={item.id} className={editing?.id === item.id ? 'selected-edit' : ''}>{renderItem(item, edit)}</div>) : <div className="compact-empty"><span>◇</span><p>Aún no hay elementos.</p></div>}</div><form className="admin-form" onSubmit={submit}><div className="form-title"><span className="eyebrow">{editing ? 'EDITAR' : 'NUEVO'}</span><h2>{editing ? `Editar ${editing.title || editing.name}` : `Nuevo ${title.slice(0, -1)}`}</h2></div>{error && <Notice tone="error">{error}</Notice>}{fields(form, change)}<div className="form-actions"><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{editing && <button className="button danger" type="button" onClick={remove}>Eliminar</button>}</div></form></section>
}

function PageIntro({ eyebrow, title, detail }) { return <header className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></header> }
function toEditInput(value) { if (!value) return ''; const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16) }
function translateAuthError(message) { const value = message?.toLowerCase() || ''; if (value.includes('invalid login')) return 'Correo o contraseña incorrectos.'; if (value.includes('email not confirmed')) return 'Debes verificar tu correo antes de iniciar sesión.'; if (value.includes('already registered')) return 'Ya existe una cuenta con este correo.'; if (value.includes('password')) return 'La contraseña no cumple los requisitos.'; return message || 'No se ha podido completar la operación.' }

export default function App() { return <BrowserRouter><AppShell /></BrowserRouter> }
