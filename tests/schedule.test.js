import { describe, expect, it } from 'vitest'
import { buildBroadcastSchedule, getChannelSchedule, getEventStatus, hasScheduleConflict, isValidInterval } from '../src/lib/schedule'

const programs = [
  { id: 'a', channel_id: 'one', starts_at: '2026-01-01T10:00:00Z', ends_at: '2026-01-01T11:00:00Z' },
  { id: 'b', channel_id: 'one', starts_at: '2026-01-01T11:00:00Z', ends_at: '2026-01-01T12:00:00Z' },
]

describe('programación', () => {
  it('genera continuidad diaria en los huecos sin solapar la programación real', () => {
    const channel = { id: 'vte', name: 'VTE1', fallback_video_source: '/assets/voltagevd1.webm' }
    const scheduled = [{ id: 'real', channel_id: 'vte', title: 'Especial', video_source: 'https://example.com/show.mp4', starts_at: '2026-01-02T10:00:00Z', ends_at: '2026-01-02T11:00:00Z' }]
    const broadcast = buildBroadcastSchedule([channel], scheduled, new Date('2026-01-02T10:30:00Z'), 0, 0)
    const current = getChannelSchedule('vte', broadcast, new Date('2026-01-02T09:00:00Z')).current
    const duringShow = getChannelSchedule('vte', broadcast, new Date('2026-01-02T10:30:00Z')).current
    const afterShow = getChannelSchedule('vte', broadcast, new Date('2026-01-02T11:30:00Z')).current
    expect(current.is_fallback).toBe(true)
    expect(current.ends_at).toBe(scheduled[0].starts_at)
    expect(duringShow.id).toBe('real')
    expect(afterShow.is_fallback).toBe(true)
    expect(afterShow.video_source).toBe(channel.fallback_video_source)
  })

  it('valida intervalos estrictamente ascendentes', () => {
    expect(isValidInterval('2026-01-01T10:00:00Z', '2026-01-01T11:00:00Z')).toBe(true)
    expect(isValidInterval('2026-01-01T11:00:00Z', '2026-01-01T11:00:00Z')).toBe(false)
  })

  it('encuentra el programa actual y el siguiente', () => {
    const result = getChannelSchedule('one', programs, new Date('2026-01-01T10:30:00Z'))
    expect(result.current.id).toBe('a')
    expect(result.next.id).toBe('b')
  })

  it('rechaza solapes en el mismo canal y admite canales distintos', () => {
    expect(hasScheduleConflict({ channel_id: 'one', starts_at: '2026-01-01T10:30:00Z', ends_at: '2026-01-01T11:30:00Z' }, programs)).toBe(true)
    expect(hasScheduleConflict({ channel_id: 'two', starts_at: '2026-01-01T10:30:00Z', ends_at: '2026-01-01T11:30:00Z' }, programs)).toBe(false)
  })

  it('calcula los estados de eventos sin inventar directos', () => {
    expect(getEventStatus({ status: 'scheduled', starts_at: '2026-01-01T10:00:00Z', ends_at: '2026-01-01T11:00:00Z' }, new Date('2026-01-01T10:30:00Z'))).toBe('live')
    expect(getEventStatus({ status: 'cancelled', starts_at: '2026-01-01T10:00:00Z' }, new Date('2026-01-01T09:00:00Z'))).toBe('cancelled')
  })
})
