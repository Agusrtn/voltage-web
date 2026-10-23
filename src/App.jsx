import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useMediaData } from './hooks/useMediaData'
import { configMessage } from './lib/supabase'
import { getChannelSchedule, getEventStatus, formatDateTime, hasScheduleConflict } from './lib/schedule'
import { youtubeVideoId } from './lib/media'
import { adminAccessState } from './lib/access'
import { ChannelMark, EmptyState, LoadingGrid, Notice, Status } from './components/ui'
import { VideoPlayer } from './components/VideoPlayer'
import './styles.css'

const timezone = import.meta.env.VITE_APP_TIMEZONE || 'Europe/Madrid'

function Header({ auth }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return <header className="site-header">
    <Link className="brand" to="/" onClick={close}><span className="brand-wordmark">VOLTAGE<span>®</span></span></Link>
    <button className="menu-button" aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'} aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}><span /><span /><span /></button>
    <nav id="primary-navigation" className={`site-nav ${open ? 'open' : ''}`} aria-label="Navegación principal">
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
    <footer><span>VOLTAGE®</span><small>Televisión, música y cultura en movimiento.</small></footer>
  </div>
}

function HomePage({ auth, media }) {
  const [channelId, setChannelId] = useState(null)
  const channel = media.channels.find((item) => item.id === channelId) || media.channels.find((item) => item.is_active) || media.channels[0]
  const liveEvent = media.events.find((event) => event.channel_id === channel?.id && getEventStatus(event, media.serverNow) === 'live')
    return <>
    <section className="hero"><div className="hero-copy"><span className="eyebrow">UNA NUEVA SEÑAL · VOLTAGE®</span><h1>Esto es <span>VOLTAGE.</span></h1><p>Un espacio para descubrir música, artistas y cultura. Entra en directo y encuentra lo que viene.</p><div className="hero-actions"><Link className="button primary" to="/tv">Ver televisión <span>↗</span></Link><Link className="button quiet" to="/guia">Explorar guía</Link></div></div><div className="hero-art" aria-label="VOLTAGE, señal en movimiento"><span>VOLTAGE</span><i>TELEVISIÓN · MÚSICA · CULTURA</i><div className="signal a" /><div className="signal b" /><div className="signal c" /></div></section>
    <section className="home-player section-block"><div className="section-heading"><div><span className="eyebrow">EN PANTALLA</span><h2>Televisión en directo</h2></div><Link to="/tv">Abrir reproductor →</Link></div><VideoPlayer channel={channel} programs={media.broadcastPrograms} activeEvent={liveEvent} timezone={timezone} serverNow={media.serverNow} serverClockSynced={media.serverClockSynced} /></section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">SEÑAL</span><h2>Canales disponibles</h2></div><Link to="/canales">Todos los canales →</Link></div>{media.loading ? <LoadingGrid /> : <div className="channel-rail">{media.channels.slice(0, 4).map((item) => <button className={`channel-card ${channel?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setChannelId(item.id)}><ChannelMark channel={item} /><div><Status tone={item.is_active ? 'live' : 'muted'}>{item.is_active ? 'Disponible' : 'Pausado'}</Status><strong>{item.name}</strong><p>{item.description}</p></div><span className="card-arrow">↗</span></button>)}</div>}</section>
    <section className="section-block split-overview"><ProgramSnapshot channels={media.channels} programs={media.broadcastPrograms} now={media.serverNow} /><EventSnapshot events={media.events} now={media.serverNow} /></section>
    <section className="member-cta"><div><span className="eyebrow">TU ESPACIO</span><h2>Guarda lo que quieres volver a ver.</h2><p>Mi lista se sincroniza de forma segura entre dispositivos cuando inicias sesión.</p></div><Link className="button primary" to={auth.user ? '/mi-lista' : '/acceso'}>{auth.user ? 'Ir a Mi lista' : 'Crear cuenta'}</Link></section>
  </>
}

function ProgramSnapshot({ channels, programs, now }) {
  const active = channels.filter((channel) => channel.is_active).slice(0, 3)
  return <section className="overview-card"><div className="section-heading"><div><span className="eyebrow">AHORA Y DESPUÉS</span><h2>Programación</h2></div><Link to="/guia">Guía completa →</Link></div>{active.length ? active.map((channel) => <ProgramLine key={channel.id} channel={channel} programs={programs} now={now} />) : <p className="muted-copy">Aún no hay canales publicados.</p>}</section>
}

function ProgramLine({ channel, programs, now }) {
  const { current, next } = getChannelSchedule(channel.id, programs, now)
  return <div className="program-line"><ChannelMark channel={channel} compact /><div><strong>{current?.title || 'Sin emisión programada'}</strong><small>{next ? `Después · ${next.title}` : 'No hay siguiente emisión'}</small></div><Status tone={current ? 'live' : 'muted'}>{current ? 'Ahora' : 'Sin guía'}</Status></div>
}

function EventSnapshot({ events, now }) {
  const upcoming = events.filter((event) => getEventStatus(event, now) !== 'finished').slice(0, 3)
  return <section className="overview-card"><div className="section-heading"><div><span className="eyebrow">AGENDA</span><h2>Eventos</h2></div><Link to="/eventos">Ver agenda →</Link></div>{upcoming.length ? upcoming.map((event) => <EventRow key={event.id} event={event} now={now} />) : <div className="compact-empty"><span>◇</span><p>No hay eventos publicados todavía.</p></div>}</section>
}

function EventRow({ event, now }) {
  const status = getEventStatus(event, now)
  return <div className="event-row"><div className="date-chip"><b>{new Intl.DateTimeFormat('es-ES', { day: '2-digit', timeZone: timezone }).format(new Date(event.starts_at))}</b><small>{new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: timezone }).format(new Date(event.starts_at))}</small></div><div><strong>{event.title}</strong><small>{new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(event.starts_at))}</small></div><Status tone={status === 'live' ? 'live' : 'violet'}>{status === 'live' ? 'Directo' : 'Próximamente'}</Status></div>
}

function TelevisionPage({ media }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const channelId = searchParams.get('channel')
  const [message, setMessage] = useState(null)
  const [panel, setPanel] = useState('guide')
  const [search, setSearch] = useState('')
  const [timeShift, setTimeShift] = useState(0)
  const channels = media.channels
  const channel = channels.find((item) => item.id === channelId) || channels.find((item) => item.is_active) || channels[0]
  const channelNumber = Math.max(1, channels.findIndex((item) => item.id === channel?.id) + 1)
  const { current, next, schedule } = getChannelSchedule(channel?.id, media.broadcastPrograms, media.serverNow)
  const liveEvent = media.events.find((event) => event.channel_id === channel?.id && getEventStatus(event, media.serverNow) === 'live')
  const dayStart = media.serverNow.getTime() + timeShift * 12 * 60 * 60 * 1000
  const timeWindowPrograms = schedule.filter((item) => new Date(item.ends_at).getTime() > dayStart && new Date(item.starts_at).getTime() < dayStart + 12 * 60 * 60 * 1000)
  const filteredPrograms = timeWindowPrograms.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()))
  const tune = (id) => {
    setSearchParams({ channel: id })
    setMessage(null)
  }
  const mode = searchParams.get('view') === 'mosaic' ? 'mosaic' : 'tv'
  const setMode = (nextMode) => setSearchParams({ ...(channel ? { channel: channel.id } : {}), ...(nextMode === 'mosaic' ? { view: 'mosaic' } : {}) })

  if (mode === 'mosaic') return <div className="page page-tv tv-page">
    <PageIntro eyebrow="VOLTAGE · MULTICANAL" title="Mosaico de señales" detail="Vista rápida de los canales y su programación. Selecciona una señal para sintonizarla; los mosaicos usan metadatos y miniaturas para no cargar varios reproductores." />
    <div className="tv-mode-switch"><button onClick={() => setMode('tv')}>Canal &amp; guía</button><button className="active" aria-current="page">Mosaico</button></div>
    <MosaicGrid channels={channels} programs={media.programs} serverNow={media.serverNow} onTune={tune} />
  </div>

  return <div className="page page-tv tv-page">
    <div className="tv-page-heading"><PageIntro eyebrow="VTE MEDIA · SEÑAL EN CONTINUIDAD" title="Televisión" detail="Sintoniza una señal y consulta la programación sincronizada con la hora del servidor." /><div className="tv-mode-switch"><button className="active" aria-current="page">Canal &amp; guía</button><button onClick={() => setMode('mosaic')}>Mosaico</button></div></div>
    {message && <Notice tone="error">{message}</Notice>}
    {media.error && <Notice tone="error">{media.error}</Notice>}
    <div className="tv-console">
      <div className="tv-main">
        {channel ? <VideoPlayer channel={channel} channelNumber={channelNumber} programs={media.broadcastPrograms} activeEvent={liveEvent} timezone={timezone} serverNow={media.serverNow} serverClockSynced={media.serverClockSynced} onPlayError={() => setMessage('No se pudo cargar la fuente. Comprueba el enlace y que permita reproducción insertada.')} /> : <EmptyState title="No hay canales" detail="Añade canales desde Administración para empezar a emitir." />}
        <section className="tv-now-playing">
          <div className="tv-program-heading"><div><span className="eyebrow">AHORA EN {channel?.name || 'VTE'}</span><h2>{liveEvent?.title || current?.title || 'Sin programa en emisión'}</h2><p>{liveEvent?.description || current?.description || 'La programación aparecerá aquí cuando se publique desde Administración.'}</p></div><Status tone={liveEvent || current ? 'live' : 'muted'}>{liveEvent ? 'Evento en directo' : current ? 'En emisión' : 'En espera'}</Status></div>
          {current && <ProgramProgress program={current} now={media.serverNow} timezone={timezone} />}
          <div className="tv-next-strip"><span>PRÓXIMO</span><strong>{next?.title || 'Sin próxima emisión programada'}</strong>{next && <time>{formatDateTime(next.starts_at, timezone, false)} · {formatDateTime(next.ends_at, timezone, false)}</time>}</div>
        </section>
      </div>
      <aside className="tv-side-panel" aria-label="Guía y selector de canales">
        <div className="tv-panel-tabs" role="tablist" aria-label="Panel de televisión">
          <button role="tab" aria-selected={panel === 'guide'} className={panel === 'guide' ? 'active' : ''} onClick={() => setPanel('guide')}>Guía &amp; programas</button>
          <button role="tab" aria-selected={panel === 'channels'} className={panel === 'channels' ? 'active' : ''} onClick={() => setPanel('channels')}>Canales</button>
        </div>
        {panel === 'guide' ? <>
          <div className="epg-controls"><label className="epg-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar programas" placeholder="Buscar en la guía" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="epg-time-nav"><button aria-label="Mostrar horario anterior" onClick={() => setTimeShift((value) => value - 1)}>←</button><button onClick={() => setTimeShift(0)}>Ahora</button><button aria-label="Mostrar horario siguiente" onClick={() => setTimeShift((value) => value + 1)}>→</button></div></div>
          <div className="epg-window-label">{timeShift === 0 ? 'AHORA · PRÓXIMAS 12 H' : formatDateTime(new Date(dayStart), timezone, true)}</div>
          <div className="epg-program-list">{filteredPrograms.length ? filteredPrograms.map((program) => <EpgProgram key={program.id} program={program} now={media.serverNow} timezone={timezone} currentChannelId={channel?.id} onTune={tune} />) : <div className="epg-empty">{search ? 'No hay programas con ese nombre.' : 'No hay programas en este intervalo.'}</div>}</div>
        </> : <>
          <div className="dial-heading"><span className="eyebrow">SINTONIZADOR</span><span>{channels.length} SEÑALES</span></div>
          <div className="tv-dial-list">{channels.map((item, index) => {
            const scheduleState = getChannelSchedule(item.id, media.broadcastPrograms, media.serverNow)
            const airing = media.events.some((event) => event.channel_id === item.id && getEventStatus(event, media.serverNow) === 'live') || Boolean(scheduleState.current)
            return <button type="button" key={item.id} className={`tv-dial-item ${channel?.id === item.id ? 'selected' : ''}`} onClick={() => tune(item.id)} aria-pressed={channel?.id === item.id}>
              <span className="dial-number">{String(index + 1).padStart(2, '0')}</span><ChannelMark channel={item} compact /><span className="dial-copy"><b>{item.name}</b><small>{channelCategory(item)} · {scheduleState.current?.title || scheduleState.next?.title || 'Sin guía'}</small></span><Status tone={airing ? 'live' : item.is_active ? 'violet' : 'muted'}>{airing ? 'Aire' : item.is_active ? 'Lista' : 'Pausa'}</Status>
            </button>
          })}</div>
        </>}
      </aside>
    </div>
  </div>
}

function GuidePage({ media }) {
  const [search, setSearch] = useState('')
  const [timeShift, setTimeShift] = useState(0)
  const now = media.serverNow
  const windowStart = now.getTime() + timeShift * 12 * 60 * 60 * 1000
  const windowEnd = windowStart + 12 * 60 * 60 * 1000
  const visibleChannels = media.channels.filter((channel) => media.broadcastPrograms.some((program) => program.channel_id === channel.id && new Date(program.ends_at).getTime() > windowStart && new Date(program.starts_at).getTime() < windowEnd && `${program.title} ${program.description} ${channel.name}`.toLowerCase().includes(search.toLowerCase())))
  return <div className="page epg-page"><div className="epg-page-top"><PageIntro eyebrow="VTE MEDIA · EPG" title="Guía de programación" detail={`Horarios sincronizados con Supabase · ${formatDateTime(now, timezone, true)}`} /><div className="epg-page-tools"><label className="epg-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar programas o canales" placeholder="Buscar programas o canales" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="epg-time-nav"><button onClick={() => setTimeShift((value) => value - 1)}>← 12 h</button><button onClick={() => setTimeShift(0)}>Ahora</button><button onClick={() => setTimeShift((value) => value + 1)}>12 h →</button></div></div></div>{!media.serverClockSynced && media.isDemo && <Notice>Modo de muestra: la guía usa el reloj de este dispositivo porque Supabase aún no está configurado.</Notice>}{media.error && <Notice tone="error">{media.error}</Notice>}{media.loading ? <LoadingGrid /> : visibleChannels.length ? <div className="guide-list">{visibleChannels.map((channel) => <GuideChannel key={channel.id} channel={channel} programs={media.broadcastPrograms} now={now} timezone={timezone} windowStart={windowStart} windowEnd={windowEnd} />)}</div> : <EmptyState title={search ? 'No se encontraron programas' : 'La guía está vacía'} detail={search ? 'Prueba con otro título o canal.' : 'Publica programas desde Administración para completar la guía.'} />}</div>
}

function GuideChannel({ channel, programs, now, timezone, windowStart, windowEnd }) {
  const items = programs.filter((item) => item.channel_id === channel.id).filter((item) => new Date(item.ends_at).getTime() > windowStart && new Date(item.starts_at).getTime() < windowEnd)
  return <section className="guide-channel"><header><ChannelMark channel={channel} compact /><div><h2>{channel.name}</h2><p>{channel.is_active ? 'Señal disponible' : 'Canal pausado'} · {channelCategory(channel)}</p></div><Link className="guide-tune-link" to={`/tv?channel=${channel.id}`}>Sintonizar ↗</Link></header><div className="guide-timeline">{items.length ? items.map((program) => { const starts = new Date(program.starts_at).getTime(); const ends = new Date(program.ends_at).getTime(); const current = starts <= now.getTime() && ends > now.getTime(); return <article className={current ? 'current' : ''} key={program.id}><time>{formatDateTime(program.starts_at, timezone, false)}<small>{formatDateTime(program.ends_at, timezone, false)}</small></time><div className="guide-program-copy"><Status tone={current ? 'live' : 'muted'}>{current ? 'En emisión' : starts > now.getTime() ? 'Próximo' : 'Finaliza'}</Status><h3>{program.title}</h3>{program.description && <p>{program.description}</p>}{current && <ProgramProgress program={program} now={now} timezone={timezone} />}</div></article> }) : <p className="no-schedule">No hay programación en este intervalo.</p>}</div></section>
}

function ProgramProgress({ program, now, timezone }) {
  const start = new Date(program.starts_at).getTime()
  const end = new Date(program.ends_at).getTime()
  const progress = Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100))
  return <div className="program-progress" aria-label={`Programa al ${Math.round(progress)} por ciento`}><div><span>PROGRESO</span><time>{formatDateTime(program.ends_at, timezone, false)}</time></div><span className="progress-track"><i style={{ width: `${progress}%` }} /></span></div>
}

function EpgProgram({ program, now, timezone, currentChannelId, onTune }) {
  const starts = new Date(program.starts_at).getTime()
  const ends = new Date(program.ends_at).getTime()
  const current = starts <= now.getTime() && ends > now.getTime()
  return <article className={`epg-program ${current ? 'current' : ''}`}>
    <div className="epg-time"><time>{formatDateTime(program.starts_at, timezone, false)}</time><span>{formatDateTime(program.ends_at, timezone, false)}</span></div>
    <div className="epg-program-info"><div className="epg-program-state"><Status tone={current ? 'live' : 'muted'}>{current ? 'Ahora' : starts > now.getTime() ? 'Próximo' : 'En curso'}</Status>{current && <span>EN EMISIÓN</span>}</div><h3>{program.title}</h3>{program.description && <p>{program.description}</p>}{current && <ProgramProgress program={program} now={now} timezone={timezone} />}</div>
    {program.channel_id !== currentChannelId && <button className="epg-tune-button" onClick={() => onTune(program.channel_id)}>Ver canal</button>}
  </article>
}

function MosaicGrid({ channels, programs, serverNow, onTune }) {
  return <div className="mosaic-grid">{channels.map((channel, index) => {
    const { current, next } = getChannelSchedule(channel.id, programs, serverNow)
    const videoId = youtubeVideoId(current?.video_source || channel.video_source)
    const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''
    return <button type="button" className="mosaic-tile" key={channel.id} onClick={() => onTune(channel.id)}>
      <span className="mosaic-visual" style={thumbnail ? { backgroundImage: `linear-gradient(180deg, transparent 32%, rgba(5,9,15,.88)), url("${thumbnail}")` } : undefined}><span className="mosaic-number">{String(index + 1).padStart(2, '0')}</span><Status tone={current || channel.is_active ? 'live' : 'muted'}>{current ? 'En emisión' : channel.is_active ? 'Disponible' : 'Pausado'}</Status><ChannelMark channel={channel} /></span>
      <span className="mosaic-details"><b>{channel.name} · {channelCategory(channel)}</b><strong>{current?.title || 'Sin programa en emisión'}</strong><small>{next ? `Después · ${next.title}` : 'Sin próxima emisión'}</small></span><span className="mosaic-tune">Sintonizar ↗</span>
    </button>
  })}</div>
}

function channelCategory(channel) {
  const name = channel?.name?.toLowerCase() || ''
  if (name.includes('music')) return 'Música'
  if (name.includes('vte1') || name.includes('voltage')) return 'Entretenimiento'
  return 'Canal VTE'
}

function ChannelsPage({ media }) {
  return <div className="page"><PageIntro eyebrow="SEÑALES" title="Canales" detail="Explora las señales activas y su información de emisión." />{media.isDemo && <Notice>Estas tarjetas son placeholders de diseño, no señales reales. Configura sus fuentes y metadatos desde Administración.</Notice>}{media.loading ? <LoadingGrid /> : <div className="channels-page-grid">{media.channels.map((channel) => <article className="channel-detail-card" key={channel.id}><ChannelMark channel={channel} /><Status tone={channel.is_active ? 'live' : 'muted'}>{channel.is_active ? 'Disponible' : 'No disponible'}</Status><h2>{channel.name}</h2><p>{channel.description || 'Sin descripción.'}</p><div className="card-bottom"><small>{channel.video_source ? 'Fuente configurada' : 'Fuente por configurar'}</small><Link to={`/tv?channel=${channel.id}`}>Ver canal →</Link></div></article>)}</div>}</div>
}

function EventsPage({ media }) {
  return <div className="page"><PageIntro eyebrow="AGENDA" title="Eventos" detail="Retransmisiones y sesiones especiales, con su estado y horario publicado." />{media.loading ? <LoadingGrid /> : media.events.length ? <div className="events-grid">{media.events.map((event) => <EventCard key={event.id} event={event} media={media} />)}</div> : <EmptyState title="Aún no hay eventos" detail="Cuando se publique una retransmisión o sesión especial, aparecerá aquí con su horario." />}</div>
}

function EventCard({ event, media }) {
  const status = getEventStatus(event, media.serverNow)
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
  return <div className="access-page"><section className="access-intro"><span className="eyebrow">VOLTAGE®</span><h1>Tu espacio dentro de VOLTAGE.</h1><p>Accede a tu perfil y mantén Mi lista contigo en cada dispositivo.</p><div className="access-decoration">ϟ</div></section><section className="auth-card"><div className="auth-tabs">{mode !== 'reset' && <><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Entrar</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Crear cuenta</button></>}</div><h2>{mode === 'signup' ? 'Crea tu cuenta' : mode === 'reset' ? 'Recupera el acceso' : 'Bienvenido de nuevo'}</h2>{error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}<form onSubmit={submit}>{mode === 'signup' && <label>Nombre público<input required minLength="2" maxLength="48" name="username" value={form.username} onChange={change} autoComplete="nickname" /></label>}<label>Correo electrónico<input required type="email" name="email" value={form.email} onChange={change} autoComplete="email" /></label>{mode !== 'reset' && <label>Contraseña<input required minLength="6" type="password" name="password" value={form.password} onChange={change} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>}<button className="button primary full" disabled={submitting}>{submitting ? 'Procesando…' : mode === 'signup' ? 'Crear cuenta' : mode === 'reset' ? 'Enviar instrucciones' : 'Iniciar sesión'}</button></form>{mode === 'signin' && <button className="forgot-button" onClick={() => { setMode('reset'); setError(null); setMessage(null) }}>¿Has olvidado tu contraseña?</button>}{mode === 'reset' && <button className="forgot-button" onClick={() => { setMode('signin'); setError(null); setMessage(null) }}>Volver a iniciar sesión</button>}<div className="oauth-separator"><span>o continúa con</span></div><button className="google-button" onClick={async () => { try { await auth.signInWithGoogle() } catch (err) { setError(translateAuthError(err.message)) } }}><b>G</b> Google</button>{!auth.configured && <p className="auth-help">El acceso estará disponible después de configurar las variables públicas de Supabase.</p>}</section></div>
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
  const sections = [
    { key: 'channels', count: media.channels.length, label: 'Canales' },
    { key: 'youtube', count: 'YT', label: 'Catálogo YouTube' },
    { key: 'programs', count: media.programs.length, label: 'Programas' },
    { key: 'events', count: media.events.length, label: 'Eventos' },
  ]
  return <div className="page admin-page"><PageIntro eyebrow="OPERACIONES" title="Administración" detail="Control de señales, catálogo, programación y eventos. Los cambios se guardan en Supabase y se validan mediante RLS." /><div className="admin-metrics">{sections.map(({ key, count, label }) => <button className={section === key ? 'active' : ''} key={key} onClick={() => setSection(key)}><b>{count}</b><span>{label}</span></button>)}</div>{media.error && <Notice tone="error">{media.error}</Notice>}{section === 'channels' && <ChannelAdmin media={media} />}{section === 'youtube' && <YoutubeCatalogAdmin media={media} />}{section === 'programs' && <ProgramAdmin media={media} />}{section === 'events' && <EventAdmin media={media} />}</div>
}

function YoutubeCatalogAdmin({ media }) {
  const sources = media.channels.flatMap((channel) => (channel.youtube_channels || []).map((source) => ({
    ...source,
    channelId: channel.id,
    channelName: channel.name,
    handle: source.url.match(/youtube\.com\/@([^/?#]+)/i)?.[1] || '',
  }))).filter((source) => source.handle)
  const [sourceIndex, setSourceIndex] = useState('0')
  const [search, setSearch] = useState('')
  const [videos, setVideos] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [startsAt, setStartsAt] = useState(() => toEditInput(media.serverNow))
  const [endsAt, setEndsAt] = useState(() => toEditInput(new Date(media.serverNow.getTime() + 60 * 60 * 1000)))
  const source = sources[Number(sourceIndex)]
  const visibleVideos = videos.filter((video) => `${video.title} ${video.description}`.toLowerCase().includes(search.trim().toLowerCase()))

  const loadCatalog = async () => {
    if (!source) return
    setLoading(true); setError(null); setNotice(null); setSelectedVideo(null)
    try {
      const result = await media.loadYoutubeCatalog(source.handle)
      setVideos(result.videos || [])
      setNotice(`${result.videos?.length || 0} vídeos públicos cargados de ${result.channel?.title || source.label}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const scheduleVideo = async (event) => {
    event.preventDefault()
    if (!source || !selectedVideo) return
    setSaving(true); setError(null); setNotice(null)
    try {
      const start = new Date(startsAt)
      const end = new Date(endsAt)
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error('El horario de fin debe ser posterior al inicio.')
      const program = {
        channel_id: source.channelId,
        title: selectedVideo.title.slice(0, 140),
        description: selectedVideo.description.slice(0, 1000),
        video_source: selectedVideo.videoSource,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      }
      if (hasScheduleConflict(program, media.programs)) throw new Error('Ese horario se solapa con otro programa del canal.')
      await media.saveEntity('programs', program)
      setNotice(`“${program.title}” se añadió a la programación de ${source.channelName}.`)
      setSelectedVideo(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <section className="youtube-admin">
    <div className="youtube-admin-intro"><div><span className="eyebrow">YOUTUBE DATA API · CATALOGO</span><h2>Elige vídeos para emitir</h2><p>Consulta las subidas públicas de los canales VTE y añádelas al horario del canal correspondiente. Las claves permanecen en los secretos de Supabase.</p></div></div>
    {!sources.length ? <Notice>Primero crea VTE1 y VTE MUSIC o configura sus enlaces de YouTube.</Notice> : <>
      <div className="youtube-catalog-toolbar"><label>Canal de YouTube<select value={sourceIndex} onChange={(event) => { setSourceIndex(event.target.value); setVideos([]); setSelectedVideo(null); setNotice(null); setError(null) }}>{sources.map((item, index) => <option key={`${item.handle}-${item.channelId}`} value={index}>{item.channelName} · {item.label}</option>)}</select></label><button className="button primary" type="button" onClick={loadCatalog} disabled={loading}>{loading ? 'Cargando vídeos…' : 'Cargar vídeos'}</button></div>
      {error && <Notice tone="error">{error}</Notice>}{notice && <Notice tone="success">{notice}</Notice>}
      {videos.length > 0 && <label className="catalog-search">Buscar en los vídeos cargados<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Título del vídeo" /></label>}
      {videos.length > 0 && <div className="youtube-video-grid">{visibleVideos.map((video) => <button type="button" key={video.videoId} className={`youtube-video-option ${selectedVideo?.videoId === video.videoId ? 'selected' : ''}`} onClick={() => setSelectedVideo(video)} aria-pressed={selectedVideo?.videoId === video.videoId}>
        <span className="youtube-video-thumb">{video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" />}<span>{video.liveBroadcastContent === 'live' ? 'EN DIRECTO' : video.duration ? formatYoutubeDuration(video.duration) : 'YOUTUBE'}</span></span><span className="youtube-video-copy"><b>{video.title}</b><small>{video.publishedAt ? formatDateTime(video.publishedAt, timezone, true) : 'Fecha no disponible'}</small></span>
      </button>)}</div>}
      {videos.length > 0 && visibleVideos.length === 0 && <div className="catalog-empty">No hay vídeos que coincidan con la búsqueda.</div>}
      {videos.length === 0 && !loading && !error && <div className="catalog-empty">Selecciona un canal y pulsa “Cargar vídeos” para consultar sus subidas públicas.</div>}
      {selectedVideo && <form className="youtube-schedule-form" onSubmit={scheduleVideo}><div className="form-title"><span className="eyebrow">PROGRAMAR EN {source.channelName.toUpperCase()}</span><h2>{selectedVideo.title}</h2></div><div className="form-pair"><label>Inicio<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><label>Fin<input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label></div><button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Añadir a programas'}</button></form>}
    </>}
  </section>
}

function formatYoutubeDuration(duration) {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return 'YOUTUBE'
  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
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
