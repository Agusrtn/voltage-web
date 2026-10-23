import { describe, expect, it } from 'vitest'
import { buildAutoProgramPlan, youtubeDurationSeconds } from '../src/lib/autoprogram'

const channel = { id: 'vte1', name: 'VTE1' }

const video = (id, duration, title = id) => ({
  videoId: id,
  duration,
  title,
  description: '',
  videoSource: `https://www.youtube.com/watch?v=${id}`,
  liveBroadcastContent: 'none',
})

describe('autoprogramación', () => {
  it('convierte duraciones ISO de YouTube a segundos', () => {
    expect(youtubeDurationSeconds('PT1H2M3S')).toBe(3723)
    expect(youtubeDurationSeconds('PT8M12S')).toBe(492)
    expect(youtubeDurationSeconds('P1D')).toBeNull()
  })

  it('programa por canal después del contenido existente y omite directos sin duración', () => {
    const channels = [channel, { id: 'music', name: 'VTE MUSIC' }]
    const existing = [{ id: 'existing', channel_id: 'vte1', title: 'Ya programado', starts_at: '2026-10-24T10:00:00.000Z', ends_at: '2026-10-24T11:00:00.000Z' }]
    const catalogs = {
      vte1: [video('video000001', 'PT10M', 'Vídeo A'), video('video000002', 'PT5M', 'Vídeo B'), { ...video('video000003', null), liveBroadcastContent: 'live' }],
      music: [video('music000001', 'PT20M', 'Vídeo música')],
    }
    const { programs, skipped } = buildAutoProgramPlan(channels, existing, catalogs, new Date('2026-10-24T09:00:00Z'))
    expect(programs).toHaveLength(3)
    expect(programs[0].starts_at).toBe('2026-10-24T11:00:00.000Z')
    expect(programs[0].ends_at).toBe('2026-10-24T11:10:00.000Z')
    expect(programs[1].starts_at).toBe(programs[0].ends_at)
    expect(programs[2].channel_id).toBe('music')
    expect(skipped).toHaveLength(1)
  })
})
