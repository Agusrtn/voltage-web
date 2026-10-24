import { describe, expect, it } from 'vitest'
import { isYoutubeLiveSource, youtubeCleanPlayerVars, youtubeContentEmbedUrl, youtubeEmbedUrl } from '../src/lib/media'

describe('fuentes de reproducción', () => {
  it('convierte URLs de vídeo de YouTube a embeds de privacidad mejorada', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ', 30)).toContain('start=30')
    expect(youtubeEmbedUrl('https://www.youtube.com/live/dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ')
    expect(youtubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ')
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('controls=0')
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('autoplay=1')
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('disablekb=1')
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('fs=0')
  })

  it('usa ajustes de emisión sin controles ni interfaz auxiliar de YouTube', () => {
    expect(youtubeCleanPlayerVars).toMatchObject({
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
    })
  })

  it('rechaza enlaces que no identifican un vídeo de YouTube', () => {
    expect(youtubeEmbedUrl('https://example.com/video')).toBeNull()
    expect(youtubeEmbedUrl('https://www.youtube.com/@voltagerbx')).toBeNull()
  })

  it('prepara fichas con controles oficiales de YouTube y autoplay desactivado', () => {
    const embed = new URL(youtubeContentEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
    expect(embed.hostname).toBe('www.youtube-nocookie.com')
    expect(embed.pathname).toBe('/embed/dQw4w9WgXcQ')
    expect(embed.searchParams.get('autoplay')).toBe('0')
    expect(embed.searchParams.get('controls')).toBe('1')
    expect(youtubeContentEmbedUrl('https://www.youtube.com/@voltagerbx')).toBeNull()
  })

  it('identifica enlaces directos a emisiones en vivo', () => {
    expect(isYoutubeLiveSource('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe(true)
    expect(isYoutubeLiveSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
  })
})
