import { hasScheduleConflict } from './schedule.js'
import { youtubeVideoId } from './media.js'

export function youtubeDurationSeconds(duration) {
  if (typeof duration !== 'string') return null
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return null
  const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)
  return seconds > 0 ? seconds : null
}

export function buildAutoProgramPlan(channels, programs, catalogByChannel, now = new Date()) {
  const plan = []
  const skipped = []
  const cursorByChannel = new Map()
  const nowTime = new Date(now).getTime()

  for (const channel of channels) {
    const catalog = catalogByChannel[channel.id] || []
    const existing = programs.filter((program) => program.channel_id === channel.id)
    const alreadyScheduledVideoIds = new Set(existing.map((program) => youtubeVideoId(program.video_source)).filter(Boolean))
    const cursor = Math.max(nowTime, ...existing
      .map((program) => new Date(program.ends_at).getTime())
      .filter((end) => Number.isFinite(end) && end > nowTime))
    cursorByChannel.set(channel.id, cursor)

    const seen = new Set()
    for (const video of catalog) {
      if (!video.videoId || seen.has(video.videoId)) continue
      seen.add(video.videoId)
      if (alreadyScheduledVideoIds.has(video.videoId)) continue
      const durationSeconds = youtubeDurationSeconds(video.duration)
      if (!durationSeconds || ['live', 'upcoming'].includes(video.liveBroadcastContent)) {
        skipped.push({ channel: channel.name, title: video.title, reason: 'Sin duración verificable o emisión en directo.' })
        continue
      }
      const start = cursorByChannel.get(channel.id)
      const end = start + durationSeconds * 1000
      const program = {
        channel_id: channel.id,
        title: (video.title || 'Vídeo de YouTube').slice(0, 140),
        description: (video.description || '').slice(0, 1000),
        video_source: video.videoSource || `https://www.youtube.com/watch?v=${video.videoId}`,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
      }
      if (hasScheduleConflict(program, [...existing, ...plan])) {
        skipped.push({ channel: channel.name, title: video.title, reason: 'Conflicto con otro horario.' })
        continue
      }
      plan.push(program)
      cursorByChannel.set(channel.id, end)
    }
  }

  return { programs: plan, skipped }
}
