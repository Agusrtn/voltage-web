import { describe, expect, it } from 'vitest'
import { youtubeEmbedUrl } from '../src/lib/media'

describe('fuentes de reproducción', () => {
  it('convierte URLs de vídeo de YouTube a embeds de privacidad mejorada', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ', 30)).toContain('start=30')
    expect(youtubeEmbedUrl('https://www.youtube.com/live/dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ')
    expect(youtubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ')
  })

  it('rechaza enlaces que no identifican un vídeo de YouTube', () => {
    expect(youtubeEmbedUrl('https://example.com/video')).toBeNull()
    expect(youtubeEmbedUrl('https://www.youtube.com/@voltagerbx')).toBeNull()
  })
})
