export function isValidInterval(startsAt, endsAt) {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  return Number.isFinite(start) && Number.isFinite(end) && end > start
}

export function hasScheduleConflict(candidate, programs) {
  if (!isValidInterval(candidate.starts_at, candidate.ends_at)) return true
  const candidateStart = new Date(candidate.starts_at).getTime()
  const candidateEnd = new Date(candidate.ends_at).getTime()
  return programs.some((program) => {
    if (program.id === candidate.id || program.channel_id !== candidate.channel_id) return false
    return candidateStart < new Date(program.ends_at).getTime() && candidateEnd > new Date(program.starts_at).getTime()
  })
}

export function getChannelSchedule(channelId, programs, now = new Date()) {
  const nowTime = new Date(now).getTime()
  const schedule = programs
    .filter((item) => item.channel_id === channelId)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  const current = schedule.find((item) => new Date(item.starts_at).getTime() <= nowTime && new Date(item.ends_at).getTime() > nowTime) ?? null
  const next = schedule.find((item) => new Date(item.starts_at).getTime() > nowTime) ?? null
  return { current, next, schedule }
}

export function getEventStatus(event, now = new Date()) {
  if (event.status === 'cancelled') return 'cancelled'
  const current = new Date(now).getTime()
  const start = new Date(event.starts_at).getTime()
  const end = event.ends_at ? new Date(event.ends_at).getTime() : null
  if (Number.isFinite(end) && current >= end) return 'finished'
  if (current >= start && (!end || current < end)) return 'live'
  return 'scheduled'
}

export function formatDateTime(value, timezone = 'Europe/Madrid', withDate = true) {
  if (!value) return 'Por definir'
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: withDate ? 'medium' : undefined,
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

export function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
