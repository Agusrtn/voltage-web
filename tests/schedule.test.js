import { describe, expect, it } from 'vitest'
import { getChannelSchedule, getEventStatus, hasScheduleConflict, isValidInterval } from '../src/lib/schedule'

const programs = [
  { id: 'a', channel_id: 'one', starts_at: '2026-01-01T10:00:00Z', ends_at: '2026-01-01T11:00:00Z' },
  { id: 'b', channel_id: 'one', starts_at: '2026-01-01T11:00:00Z', ends_at: '2026-01-01T12:00:00Z' },
]

describe('programación', () => {
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
