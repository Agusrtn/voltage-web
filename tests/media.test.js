import { describe, expect, it } from 'vitest'
import { youtubeEmbedUrl } from '../src/lib/media'

describe('fuentes de reproducción', () => {
  it('convierte URLs de vídeo de YouTube a embeds de privacidad mejorada', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ', 30)).toContain('start=30')
  })

  it('rechaza enlaces que no identifican un vídeo de YouTube', () => {
    expect(youtubeEmbedUrl('https://example.com/video')).toBeNull()
  })
})
