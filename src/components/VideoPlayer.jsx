import vteLogo from '../../vte.png'
import './VideoPlayer.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isYoutubeLiveSource, youtubeCleanPlayerVars, youtubeVideoId } from '../lib/media'
import { formatDateTime, getChannelSchedule, getEventStatus } from '../lib/schedule'

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

function startAtSeconds(startAt, clockOffsetMs) {
  if (!startAt) return 0
  return Math.max(0, Math.floor((Date.now() + clockOffsetMs - new Date(startAt).getTime()) / 1000))
}

function playbackKey(videoId, syncStartAt, requestId) {
  return videoId + ':' + (syncStartAt || 'live') + ':' + (requestId || '')
}

function YoutubeBroadcast({ videoId, title, syncStartAt, requestId, serverClockOffsetMs, audioEnabled, playerApiRef, onEnded, onError }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const requestRef = useRef({ videoId, title, syncStartAt, requestId })
  const loadedKeyRef = useRef('')
  const audioRef = useRef(audioEnabled)
  const onErrorRef = useRef(onError)
  const onEndedRef = useRef(onEnded)
  const clockOffsetRef = useRef(serverClockOffsetMs)
  const [ready, setReady] = useState(false)

  requestRef.current = { videoId, title, syncStartAt, requestId }
  audioRef.current = audioEnabled
  onErrorRef.current = onError
  onEndedRef.current = onEnded
  clockOffsetRef.current = serverClockOffsetMs

  useEffect(() => {
    let disposed = false
    let syncTimer
    const loadLatestRequest = (player) => {
      const request = requestRef.current
      if (!player || !request.videoId) return
      const key = playbackKey(request.videoId, request.syncStartAt, request.requestId)
      if (key === loadedKeyRef.current) return
      loadedKeyRef.current = key
      const startSeconds = startAtSeconds(request.syncStartAt, clockOffsetRef.current)
      player.loadVideoById(request.syncStartAt ? { videoId: request.videoId, startSeconds } : request.videoId)
      const iframe = player.getIframe?.()
      if (iframe) iframe.title = 'Emisión de ' + request.title + ' en YouTube'
    }

    loadYoutubeApi().then((YT) => {
      if (disposed || !hostRef.current) return
      const initialRequest = requestRef.current
      const initialKey = playbackKey(initialRequest.videoId, initialRequest.syncStartAt, initialRequest.requestId)
      const playerVars = { ...youtubeCleanPlayerVars, enablejsapi: 1, origin: window.location.origin }
      if (initialRequest.syncStartAt) playerVars.start = startAtSeconds(initialRequest.syncStartAt, clockOffsetRef.current)

      playerRef.current = new YT.Player(hostRef.current, {
        width: '100%',
        height: '100%',
        videoId: initialRequest.videoId,
        playerVars,
        events: {
          onReady: (event) => {
            if (disposed) return
            const player = event.target
            playerRef.current = player
            if (playerApiRef) playerApiRef.current = player
            loadedKeyRef.current = initialKey
            player.mute()
            player.playVideo()
            if (audioRef.current) {
              player.unMute()
              player.setVolume(100)
            }
            player.getIframe().title = 'Emisión de ' + requestRef.current.title + ' en YouTube'
            setReady(true)
            loadLatestRequest(player)
          },
          onError: (event) => onErrorRef.current?.(event),
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PAUSED) event.target.playVideo()
            if (event.data === YT.PlayerState.ENDED) onEndedRef.current?.()
          },
        },
      })

      syncTimer = window.setInterval(() => {
        const player = playerRef.current
        const request = requestRef.current
        if (!request.syncStartAt || !player || player.getPlayerState?.() !== YT.PlayerState.PLAYING) return
        const expectedSeconds = Math.max(0, (Date.now() + clockOffsetRef.current - new Date(request.syncStartAt).getTime()) / 1000)
        const actualSeconds = player.getCurrentTime?.() || 0
        if (Math.abs(expectedSeconds - actualSeconds) > 3) player.seekTo(expectedSeconds, true)
      }, 15000)
    }).catch((error) => onErrorRef.current?.(error))

    return () => {
      disposed = true
      window.clearInterval(syncTimer)
      if (playerApiRef?.current === playerRef.current) playerApiRef.current = null
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const player = playerRef.current
    if (audioEnabled) {
      player?.unMute?.()
      player?.setVolume?.(100)
    } else player?.mute?.()
    const request = requestRef.current
    const key = playbackKey(request.videoId, request.syncStartAt, request.requestId)
    if (key !== loadedKeyRef.current) {
      loadedKeyRef.current = key
      const startSeconds = startAtSeconds(request.syncStartAt, clockOffsetRef.current)
      player?.loadVideoById(request.syncStartAt ? { videoId: request.videoId, startSeconds } : request.videoId)
    }
  }, [audioEnabled, ready, requestId, syncStartAt, videoId])

  useEffect(() => {
    const iframe = playerRef.current?.getIframe?.()
    if (iframe) iframe.title = 'Emisión de ' + title + ' en YouTube'
  }, [title])

  return <div className="youtube-iframe-host" ref={hostRef} />
}

function LocalScheduledVideo({ source, title, syncStartAt, requestId, serverClockOffsetMs, audioEnabled, mediaApiRef, onError, onDimensions, onEnded, loop = false }) {
  const videoRef = useRef(null)
  const offsetRef = useRef(serverClockOffsetMs)
  const errorRef = useRef(onError)
  const endedRef = useRef(onEnded)
  const previousRequestRef = useRef(requestId)
  offsetRef.current = serverClockOffsetMs
  errorRef.current = onError
  endedRef.current = onEnded

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    let syncTimer
    if (mediaApiRef) mediaApiRef.current = video
    const isNewRequest = previousRequestRef.current !== requestId
    previousRequestRef.current = requestId
    const synchronize = () => {
      if (!syncStartAt && isNewRequest) video.currentTime = 0
      if (syncStartAt && video.duration && Number.isFinite(video.duration)) {
        const elapsed = Math.max(0, (Date.now() + offsetRef.current - new Date(syncStartAt).getTime()) / 1000)
        const expectedTime = elapsed % video.duration
        if (Math.abs(video.currentTime - expectedTime) > 2) video.currentTime = expectedTime
      } else if (video.ended) video.currentTime = 0
      video.muted = !audioEnabled
      video.play().catch(() => {})
    }
    video.muted = !audioEnabled
    video.addEventListener('loadedmetadata', synchronize)
    if (syncStartAt) syncTimer = window.setInterval(synchronize, 15000)
    synchronize()
    return () => {
      window.clearInterval(syncTimer)
      video.removeEventListener('loadedmetadata', synchronize)
      if (mediaApiRef?.current === video) mediaApiRef.current = null
    }
  }, [audioEnabled, mediaApiRef, requestId, source, syncStartAt])

  return <video
    ref={videoRef}
    className="local-loop-video"
    src={source}
    autoPlay
    loop={loop}
    muted={!audioEnabled}
    playsInline
    preload="auto"
    aria-label={title + ', programa sincronizado'}
    onLoadedMetadata={(event) => onDimensions?.(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
    onEnded={() => { if (!loop) endedRef.current?.() }}
    onError={(event) => errorRef.current?.(event)}
  />
}

function LocalLoopBroadcast({ source, title, audioEnabled, mediaApiRef, onError, onDimensions }) {
  const videoRef = useRef(null)
  const onErrorRef = useRef(onError)
  const [failed, setFailed] = useState(false)
  onErrorRef.current = onError

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    if (mediaApiRef) mediaApiRef.current = video
    video.muted = !audioEnabled
    video.play()?.catch(() => {})
    return () => {
      if (mediaApiRef?.current === video) mediaApiRef.current = null
    }
  }, [audioEnabled, mediaApiRef, source])

  useEffect(() => setFailed(false), [source])

  return <>
    <video
      ref={videoRef}
      className="local-loop-video"
      src={source}
      autoPlay
      loop
      muted={!audioEnabled}
      playsInline
      preload="auto"
      aria-label={title + ', señal continua'}
      onLoadedMetadata={(event) => {
        const { videoWidth, videoHeight } = event.currentTarget
        if (videoWidth && videoHeight) onDimensions?.(videoWidth, videoHeight)
      }}
      onError={(event) => { setFailed(true); onErrorRef.current?.(event) }}
    />
    {failed && <div className="loop-fallback-error" role="status"><strong>No se pudo cargar la señal continua</strong><span>Comprueba que el archivo WEBM está incluido en el despliegue.</span></div>}
  </>
}

export function VideoPlayer({ channel, programs = [], activeEvent, timezone, onPlayError, serverNow = new Date(), serverClockSynced = false, channelNumber }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [playbackOverride, setPlaybackOverride] = useState(null)
  const [endedEventKey, setEndedEventKey] = useState(null)
  const [videoAspectRatio, setVideoAspectRatio] = useState(null)
  const playerShellRef = useRef(null)
  const youtubePlayerRef = useRef(null)
  const localVideoRef = useRef(null)
  const clockOffsetMs = serverNow.getTime() - Date.now()

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === playerShellRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => setPlaybackOverride(null), [channel?.id])
  useEffect(() => { if (!activeEvent) setEndedEventKey(null) }, [activeEvent])

  const { current, next, schedule } = useMemo(() => getChannelSchedule(channel?.id, programs, serverNow), [channel?.id, programs, serverNow])
  const forcedProgram = playbackOverride?.channelId === channel?.id
    ? schedule.find((program) => program.id === playbackOverride.programId) || null
    : null
  const playbackCurrent = forcedProgram || current
  const playbackIndex = schedule.findIndex((program) => program.id === playbackCurrent?.id)
  const playbackNext = playbackIndex >= 0 ? schedule[playbackIndex + 1] || null : next
  const eventStatus = activeEvent ? getEventStatus(activeEvent) : null
  const eventKey = activeEvent ? activeEvent.id || activeEvent.video_source : null
  const eventSourceActive = Boolean(activeEvent?.video_source && eventKey !== endedEventKey)
  const eventIsLive = eventSourceActive && eventStatus === 'live'
  const source = (eventSourceActive ? activeEvent.video_source : null) || playbackCurrent?.video_source || channel?.video_source || ''
  const videoId = youtubeVideoId(source)
  const fallbackVideoSource = channel?.fallback_video_source && (!source || source === channel.fallback_video_source)
    ? channel.fallback_video_source
    : null
  const isLocalVideo = /\.(mp4|webm)(\?.*)?$/i.test(source)
  const scheduledVideo = playbackCurrent && source === playbackCurrent.video_source && !isYoutubeLiveSource(source)
  const isEarlyPlayback = Boolean(forcedProgram && current?.id !== forcedProgram.id)
  const syncStartAt = scheduledVideo && !isEarlyPlayback ? playbackCurrent.starts_at : null
  const canRender = Boolean(videoId || isLocalVideo || fallbackVideoSource)
  const broadcastIsLive = Boolean((eventSourceActive && eventStatus === 'live') || (playbackCurrent && source === playbackCurrent.video_source) || (channel?.is_active && isYoutubeLiveSource(source)))
  const requestId = eventSourceActive ? eventKey : playbackCurrent?.id || channel?.id || source
  const statusLabel = eventIsLive ? 'EN DIRECTO' : fallbackVideoSource ? 'CONTINUIDAD' : broadcastIsLive ? 'EN EMISIÓN' : canRender ? 'FUENTE LISTA' : 'SIN SEÑAL'

  useEffect(() => {
    if (playbackOverride && playbackOverride.channelId === channel?.id && current?.id === playbackOverride.programId) {
      setPlaybackOverride(null)
    }
  }, [channel?.id, current?.id, playbackOverride])

  const advancePlayback = () => {
    if (eventSourceActive) {
      setEndedEventKey(eventKey)
      return
    }
    if (!channel) return
    if (!playbackCurrent) {
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.seekTo(0, true)
        youtubePlayerRef.current.playVideo()
      } else if (localVideoRef.current) {
        localVideoRef.current.currentTime = 0
        localVideoRef.current.play()?.catch(() => {})
      }
      return
    }
    const index = schedule.findIndex((program) => program.id === playbackCurrent.id)
    const following = index >= 0 ? schedule.slice(index + 1).find((program) => program.video_source) : null
    if (following) {
      setPlaybackOverride({ channelId: channel.id, programId: following.id })
      return
    }
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(0, true)
      youtubePlayerRef.current.playVideo()
    } else if (localVideoRef.current) {
      localVideoRef.current.currentTime = 0
      localVideoRef.current.play()?.catch(() => {})
    }
  }

  const toggleAudio = () => {
    const nextEnabled = !audioEnabled
    const youtubePlayer = youtubePlayerRef.current
    const localVideo = localVideoRef.current
    if (nextEnabled) {
      youtubePlayer?.unMute?.()
      youtubePlayer?.setVolume?.(100)
      if (localVideo) {
        localVideo.muted = false
        localVideo.play()?.catch(() => {})
      }
    } else {
      youtubePlayer?.mute?.()
      if (localVideo) localVideo.muted = true
    }
    setAudioEnabled(nextEnabled)
  }

  const resyncPlayback = () => {
    const expectedSeconds = startAtSeconds(syncStartAt, clockOffsetMs)
    const youtubePlayer = youtubePlayerRef.current
    const localVideo = localVideoRef.current
    if (youtubePlayer) {
      youtubePlayer.seekTo(syncStartAt ? expectedSeconds : 0, true)
      youtubePlayer.playVideo()
    } else if (localVideo) {
      localVideo.currentTime = syncStartAt ? expectedSeconds % (localVideo.duration || Number.MAX_SAFE_INTEGER) : 0
      localVideo.play()?.catch(() => {})
    }
  }

  const tuneFullscreen = async () => {
    if (!playerShellRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await playerShellRef.current.requestFullscreen?.()
  }

  if (!channel) return <div className="player empty-player"><span>Selecciona un canal para empezar</span></div>
  const channelNumberLabel = String(channelNumber || channel.display_order || '01').padStart(2, '0')
  const currentRange = playbackCurrent
    ? formatDateTime(playbackCurrent.starts_at, timezone, false) + ' – ' + formatDateTime(playbackCurrent.ends_at, timezone, false)
    : serverClockSynced ? 'RELOJ OFICIAL' : 'RELOJ LOCAL'

  return <section className="player-shell" ref={playerShellRef}>
    <div className="player" style={videoAspectRatio ? { aspectRatio: videoAspectRatio } : undefined}>
      {videoId ? (
        <YoutubeBroadcast videoId={videoId} title={playbackCurrent?.title || channel.name} syncStartAt={syncStartAt} requestId={requestId} serverClockOffsetMs={clockOffsetMs} audioEnabled={audioEnabled} playerApiRef={youtubePlayerRef} onEnded={advancePlayback} onError={onPlayError} />
      ) : isLocalVideo && scheduledVideo ? (
        <LocalScheduledVideo source={source} title={playbackCurrent?.title || channel.name} syncStartAt={syncStartAt} requestId={requestId} serverClockOffsetMs={clockOffsetMs} audioEnabled={audioEnabled} mediaApiRef={localVideoRef} onEnded={advancePlayback} loop={Boolean(playbackCurrent?.is_fallback)} onError={onPlayError} onDimensions={(width, height) => { if (width && height) setVideoAspectRatio(width + ' / ' + height) }} />
      ) : fallbackVideoSource ? (
        <LocalLoopBroadcast source={fallbackVideoSource} title={channel.name} audioEnabled={audioEnabled} mediaApiRef={localVideoRef} onError={onPlayError} onDimensions={(width, height) => setVideoAspectRatio(width + ' / ' + height)} />
      ) : isLocalVideo ? (
        <LocalLoopBroadcast source={source} title={channel.name} audioEnabled={audioEnabled} mediaApiRef={localVideoRef} onError={onPlayError} onDimensions={(width, height) => { if (width && height) setVideoAspectRatio(width + ' / ' + height) }} />
      ) : (
        <div className="player-placeholder">
          <span className="play-symbol">▶</span>
          <strong>{source ? 'Fuente pendiente de compatibilidad' : 'Fuente de emisión pendiente'}</strong>
          <p>{source ? 'La fuente está guardada, pero no puede reproducirse con el reproductor actual. Comprueba su formato, permisos e inserción.' : 'Los enlaces a canales de YouTube no se pueden insertar como vídeo. Añade la URL de un vídeo o directo desde Administración para reproducirlo aquí.'}</p>
          {channel.youtube_channels?.length > 0 && <div className="youtube-sources" aria-label={'Canales de YouTube de ' + channel.name}>
            {channel.youtube_channels.map((sourceItem) => <a key={sourceItem.url} href={sourceItem.url} target="_blank" rel="noreferrer">{sourceItem.label}<span>↗</span></a>)}
          </div>}
        </div>
      )}
    </div>
    <div className="broadcast-hud" role="group" aria-label="Controles de emisión">
      <div className="hud-channel">
        {channel.name?.toLowerCase().includes('vte') && <span className="logo-crop hud-vte-logo"><img src={vteLogo} alt="" /></span>}<span className="hud-channel-number">{channelNumberLabel}</span>
        <strong>{channel.name}</strong>
        <span className={'hud-status ' + (broadcastIsLive ? 'is-live' : '')}><i />{statusLabel}</span>
      </div>
      <div className="hud-program hud-current">
        <span>AHORA</span>
        <strong>{eventSourceActive ? activeEvent.title : playbackCurrent?.title || 'Sin programación publicada'}</strong>
        <small>{currentRange}</small>
      </div>
      <button className="hud-control hud-sound" type="button" onClick={toggleAudio} aria-label={audioEnabled ? 'Silenciar' : 'Activar sonido'} aria-pressed={audioEnabled} title={audioEnabled ? 'Silenciar' : 'Activar sonido'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" />{audioEnabled ? <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a9 9 0 0 1 0 11" /></> : <path d="m17 9 5 6m0-6-5 6" />}</svg>
      </button>
      <button className="hud-control hud-resync" type="button" onClick={resyncPlayback} aria-label="Sincronizar con la emisión" title="Sincronizar con la emisión">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.7-4L3 10" /><path d="M3 4v6h6" /><path d="M4 13a8 8 0 0 0 14.7 4L21 14" /><path d="M21 20v-6h-6" /></svg>
      </button>
      <div className="hud-program hud-next">
        <span>A CONTINUACIÓN</span>
        <strong>{playbackNext?.title || 'No hay siguiente emisión'}</strong>
        <small>{playbackNext ? formatDateTime(playbackNext.starts_at, timezone, false) + ' – ' + formatDateTime(playbackNext.ends_at, timezone, false) : 'Horario del canal'}</small>
      </div>
      {videoId && <a className="hud-source" href={source} target="_blank" rel="noreferrer">Contenido de YouTube ↗</a>}
      <button className="hud-control hud-fullscreen" type="button" onClick={tuneFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'} title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" /></svg>
      </button>
    </div>
  </section>
}

