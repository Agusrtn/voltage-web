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

export function buildBroadcastSchedule(channels, programs, now = new Date(), daysBefore = 2, daysAfter = 14) {
  const from = new Date(now)
  from.setUTCHours(0, 0, 0, 0)
  from.setUTCDate(from.getUTCDate() - daysBefore)
  const until = new Date(now)
  until.setUTCHours(0, 0, 0, 0)
  until.setUTCDate(until.getUTCDate() + daysAfter + 1)

  const continuityPrograms = []
  for (const channel of channels) {
    if (!channel.fallback_video_source) continue
    const channelPrograms = programs
      .filter((program) => program.channel_id === channel.id)
      .map((program) => ({ start: new Date(program.starts_at).getTime(), end: new Date(program.ends_at).getTime() }))
      .filter((program) => Number.isFinite(program.start) && Number.isFinite(program.end) && program.end > from.getTime() && program.start < until.getTime())
      .sort((a, b) => a.start - b.start)

    for (let dayStart = from.getTime(); dayStart < until.getTime(); dayStart += 86400000) {
      const dayEnd = dayStart + 86400000
      const dayPrograms = channelPrograms.filter((program) => program.start < dayEnd && program.end > dayStart)
      let cursor = dayStart
      const addContinuity = (start, end) => {
        if (end <= start) return
        continuityPrograms.push({
          id: `continuity:${channel.id}:${start}`,
          channel_id: channel.id,
          title: `Emisión continua · ${channel.name}`,
          description: 'Señal de continuidad en bucle entre programas.',
          video_source: channel.fallback_video_source,
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(end).toISOString(),
          is_fallback: true,
        })
      }

      for (const program of dayPrograms) {
        const programStart = Math.max(dayStart, program.start)
        const programEnd = Math.min(dayEnd, program.end)
        if (programStart > cursor) addContinuity(cursor, programStart)
        cursor = Math.max(cursor, programEnd)
      }
      if (cursor < dayEnd) addContinuity(cursor, dayEnd)
    }
  }

  return [...programs, ...continuityPrograms].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
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
