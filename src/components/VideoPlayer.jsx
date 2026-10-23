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

function YoutubeBroadcast({ videoId, title, syncStartAt, onError }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const onErrorRef = useRef(onError)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(true)
  onErrorRef.current = onError

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
          start: syncStartAt ? Math.max(0, Math.floor((Date.now() - new Date(syncStartAt).getTime()) / 1000)) : 0,
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
          const expectedSeconds = Math.max(0, (Date.now() - new Date(syncStartAt).getTime()) / 1000)
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
    <span className="broadcast-live-badge"><i /> EN EMISIÓN</span>
    <button className="broadcast-sound" type="button" onClick={toggleMute} disabled={!ready} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
      {muted ? 'Activar sonido' : 'Silenciar'}
    </button>
  </>
}

export function VideoPlayer({ channel, programs = [], activeEvent, timezone, onPlayError }) {
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 15000)
    return () => window.clearInterval(timer)
  }, [])
  const { current, next } = useMemo(() => getChannelSchedule(channel?.id, programs, clock), [channel?.id, clock, programs])
  const eventStatus = activeEvent ? getEventStatus(activeEvent) : null
  const source = activeEvent?.video_source || current?.video_source || channel?.video_source
  const videoId = youtubeVideoId(source)
  const scheduledVideo = current && source === current.video_source && !isYoutubeLiveSource(source)
  const syncStartAt = scheduledVideo ? current.starts_at : null
  const isMp4 = /\.(mp4)(\?.*)?$/i.test(source || '')
  const canRender = Boolean(videoId || isMp4)

  if (!channel) return <div className="player empty-player"><span>Selecciona un canal para empezar</span></div>
  return <section className="player-shell">
    <div className="player">
      {videoId ? (
        <YoutubeBroadcast key={`${videoId}:${syncStartAt || 'live'}`} videoId={videoId} title={channel.name} syncStartAt={syncStartAt} onError={onPlayError} />
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
      {!videoId && <div className="player-live"><Status tone={canRender ? 'live' : 'muted'}>{canRender ? 'Emisión configurada' : source ? 'Fuente no compatible' : 'Sin fuente'}</Status></div>}
    </div>
    <div className="player-meta">
      <ChannelMark channel={channel} compact />
      <div className="player-title"><span>{channel.name}</span><h2>{activeEvent?.title || current?.title || 'Sin programa en emisión'}</h2></div>
      {activeEvent && <Status tone={eventStatus === 'live' ? 'live' : 'violet'}>{eventStatus === 'live' ? 'Evento en directo' : 'Evento programado'}</Status>}
    </div>
    <div className="now-next">
      <div><span>AHORA</span><strong>{current?.title || 'Sin programación publicada'}</strong>{current && <small>Hasta las {formatDateTime(current.ends_at, timezone, false)}</small>}</div>
      <div><span>DESPUÉS</span><strong>{next?.title || 'No hay siguiente emisión'}</strong>{next && <small>{formatDateTime(next.starts_at, timezone, false)}</small>}</div>
    </div>
  </section>
}
