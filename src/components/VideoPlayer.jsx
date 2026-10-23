import { useMemo } from 'react'
import { youtubeEmbedUrl } from '../lib/media'
import { formatDateTime, getChannelSchedule, getEventStatus } from '../lib/schedule'
import { ChannelMark, Status } from './ui'

export function VideoPlayer({ channel, programs = [], activeEvent, timezone, onPlayError }) {
  const { current, next } = useMemo(() => getChannelSchedule(channel?.id, programs), [channel?.id, programs])
  const eventStatus = activeEvent ? getEventStatus(activeEvent) : null
  const source = activeEvent?.video_source || current?.video_source || channel?.video_source
  const embedUrl = youtubeEmbedUrl(source)
  const startOffset = current && source === current.video_source ? Math.max(0, Math.floor((Date.now() - new Date(current.starts_at).getTime()) / 1000)) : 0
  const timedEmbedUrl = embedUrl ? youtubeEmbedUrl(source, startOffset) : null
  const isMp4 = /\.(mp4)(\?.*)?$/i.test(source || '')
  const canRender = Boolean(timedEmbedUrl || isMp4)

  if (!channel) return <div className="player empty-player"><span>Selecciona un canal para empezar</span></div>
  return <section className="player-shell">
    <div className="player">
      {timedEmbedUrl ? (
        <iframe title={`Reproductor de ${channel.name}`} src={timedEmbedUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen onError={onPlayError} />
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
      <div className="player-live"><Status tone={canRender ? 'live' : 'muted'}>{canRender ? 'Emisión configurada' : source ? 'Fuente no compatible' : 'Sin fuente'}</Status></div>
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
