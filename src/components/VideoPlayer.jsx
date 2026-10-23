import { useEffect, useMemo, useRef, useState } from 'react'
import { isYoutubeLiveSource, youtubeVideoId } from '../lib/media'
import { formatDateTime, getChannelSchedule, getEventStatus } from '../lib/schedule'
import { ChannelMark, Status } from './ui'

let youtubeApiPromise

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const previousCallback = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.()
        resolve(window.YT)
      }
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
    })
  }
  return youtubeApiPromise
}

function YoutubeBroadcast({ videoId, title, syncStartAt, serverClockOffsetMs, liveLabel, onError }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const onErrorRef = useRef(onError)
  const clockOffsetRef = useRef(serverClockOffsetMs)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(true)
  onErrorRef.current = onError
  clockOffsetRef.current = serverClockOffsetMs

  useEffect(() => {
    let disposed = false
    let syncTimer
    loadYoutubeApi().then((YT) => {
      if (disposed || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          playsinline: 1,
          rel: 0,
          start: syncStartAt ? Math.max(0, Math.floor((Date.now() + clockOffsetRef.current - new Date(syncStartAt).getTime()) / 1000)) : 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            event.target.mute()
            event.target.playVideo()
            setReady(true)
            const iframe = event.target.getIframe()
            iframe.title = `Emisión de ${title} en YouTube`
          },
          onError: (event) => onErrorRef.current?.(event),
        },
      })

      if (syncStartAt) {
        syncTimer = window.setInterval(() => {
          const player = playerRef.current
          if (!player || player.getPlayerState?.() !== YT.PlayerState.PLAYING) return
          const expectedSeconds = Math.max(0, (Date.now() + clockOffsetRef.current - new Date(syncStartAt).getTime()) / 1000)
          const actualSeconds = player.getCurrentTime?.() || 0
          if (Math.abs(expectedSeconds - actualSeconds) > 3) player.seekTo(expectedSeconds, true)
        }, 15000)
      }
    }).catch((error) => onErrorRef.current?.(error))

    return () => {
      disposed = true
      window.clearInterval(syncTimer)
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [syncStartAt, title, videoId])

  const toggleMute = () => {
    const player = playerRef.current
    if (!ready || !player) return
    if (muted) {
      player.unMute()
      player.setVolume(100)
    } else {
      player.mute()
    }
    setMuted(!muted)
  }

  return <>
    <div className="youtube-iframe-host" ref={hostRef} />
    <span className="broadcast-live-badge"><i /> {liveLabel}</span>
    <button className="broadcast-sound" type="button" onClick={toggleMute} disabled={!ready} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
      {muted ? 'Activar sonido' : 'Silenciar'}
    </button>
  </>
}

export function VideoPlayer({ channel, programs = [], activeEvent, timezone, onPlayError, serverNow = new Date(), serverClockSynced = false, channelNumber }) {
  const [fullscreen, setFullscreen] = useState(false)
  const playerAreaRef = useRef(null)
  const clockOffsetMs = serverNow.getTime() - Date.now()
  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === playerAreaRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])
  const { current, next } = useMemo(() => getChannelSchedule(channel?.id, programs, serverNow), [channel?.id, programs, serverNow])
  const eventStatus = activeEvent ? getEventStatus(activeEvent) : null
  const source = activeEvent?.video_source || current?.video_source || channel?.video_source
  const videoId = youtubeVideoId(source)
  const scheduledVideo = current && source === current.video_source && !isYoutubeLiveSource(source)
  const syncStartAt = scheduledVideo ? current.starts_at : null
  const isMp4 = /\.(mp4)(\?.*)?$/i.test(source || '')
  const canRender = Boolean(videoId || isMp4)
  const broadcastIsLive = Boolean(eventStatus === 'live' || (current && source === current.video_source) || (channel?.is_active && isYoutubeLiveSource(source)))
  const liveLabel = broadcastIsLive ? 'EN EMISIÓN' : canRender ? 'FUENTE LISTA' : 'SEÑAL VTE'
  const eventIsLive = activeEvent && eventStatus === 'live'
  const tuneFullscreen = async () => {
    if (!playerAreaRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await playerAreaRef.current.requestFullscreen?.()
  }

  if (!channel) return <div className="player empty-player"><span>Selecciona un canal para empezar</span></div>
  return <section className="player-shell">
    <div className="player" ref={playerAreaRef}>
      {videoId ? (
        <YoutubeBroadcast key={`${videoId}:${syncStartAt || 'live'}`} videoId={videoId} title={channel.name} syncStartAt={syncStartAt} serverClockOffsetMs={clockOffsetMs} liveLabel={liveLabel} onError={onPlayError} />
      ) : source && isMp4 ? (
        <video controls src={source} onError={onPlayError}>Tu navegador no puede reproducir esta fuente.</video>
      ) : (
        <div className="player-placeholder">
          <span className="play-symbol">▶</span>
          <strong>{source ? 'Fuente pendiente de compatibilidad' : 'Fuente de emisión pendiente'}</strong>
          <p>{source ? 'La fuente está guardada, pero no puede reproducirse con el reproductor actual. Comprueba su formato, permisos e inserción.' : 'Los enlaces a canales de YouTube no se pueden insertar como vídeo. Añade la URL de un vídeo o directo desde Administración para reproducirlo aquí.'}</p>
          {channel.youtube_channels?.length > 0 && <div className="youtube-sources" aria-label={`Canales de YouTube de ${channel.name}`}>
            {channel.youtube_channels.map((sourceItem) => <a key={sourceItem.url} href={sourceItem.url} target="_blank" rel="noreferrer">{sourceItem.label}<span>↗</span></a>)}
          </div>}
        </div>
      )}
      <div className="broadcast-ident">
        <span className="broadcast-channel-number">{String(channelNumber || channel.display_order || '01').padStart(2, '0')}</span>
        <span className="broadcast-channel-name">{channel.name}</span>
        <Status tone={broadcastIsLive ? 'live' : canRender ? 'violet' : 'muted'}>{eventIsLive ? 'En directo' : broadcastIsLive ? 'En emisión' : canRender ? 'Fuente lista' : source ? 'Fuente no compatible' : 'Sin señal'}</Status>
      </div>
      <div className="broadcast-controls">
        <span className="clock-indicator" title={serverClockSynced ? 'Hora sincronizada con Supabase' : 'Usando reloj local'}>{serverClockSynced ? 'RELOJ OFICIAL' : 'RELOJ LOCAL'}</span>
        <button type="button" className="broadcast-fullscreen" onClick={tuneFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}>{fullscreen ? 'Salir' : 'Pantalla completa'}</button>
      </div>
    </div>
    <div className="player-meta">
      <ChannelMark channel={channel} compact />
      <div className="player-title"><span>{channel.name} · {channel.category || 'VTE MEDIA'}</span><h2>{activeEvent?.title || current?.title || 'Sin programa en emisión'}</h2></div>
      {activeEvent && <Status tone={eventStatus === 'live' ? 'live' : 'violet'}>{eventStatus === 'live' ? 'Evento en directo' : 'Evento programado'}</Status>}
    </div>
    <div className="now-next">
      <div><span>AHORA</span><strong>{current?.title || 'Sin programación publicada'}</strong>{current && <small>Hasta las {formatDateTime(current.ends_at, timezone, false)}</small>}</div>
      <div><span>PRÓXIMO PROGRAMA</span><strong>{next?.title || 'No hay siguiente emisión'}</strong>{next && <small>{formatDateTime(next.starts_at, timezone, false)} – {formatDateTime(next.ends_at, timezone, false)}</small>}</div>
    </div>
  </section>
}
