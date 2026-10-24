import vte1FallbackVideo from '../../voltagevd1.webm'
import vteMusicFallbackVideo from '../../voltagevd2.webm'

export const defaultYoutubeChannels = {
  VTE1: [
    { label: 'VOLTAGE RBX', url: 'https://www.youtube.com/@voltagerbx' },
    { label: 'RTN Events', url: 'https://www.youtube.com/@RTN_Events' },
  ],
  'VTE MUSIC': [
    { label: 'RTN Music', url: 'https://www.youtube.com/@rtnmusicrbx' },
    { label: 'Badvyx', url: 'https://www.youtube.com/@badvyx' },
  ],
}

export const defaultLoopFallbacks = {
  VTE1: vte1FallbackVideo,
  'VTE MUSIC': vteMusicFallbackVideo,
}

export function normalizeVteChannelName(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function getDefaultYoutubeChannels(name) {
  const key = normalizeVteChannelName(name)
  if (key === 'vte1') return defaultYoutubeChannels.VTE1
  if (key === 'vtemusic') return defaultYoutubeChannels['VTE MUSIC']
  return []
}

export function getDefaultLoopFallback(name) {
  const key = normalizeVteChannelName(name)
  if (key === 'vte1') return defaultLoopFallbacks.VTE1
  if (key === 'vtemusic') return defaultLoopFallbacks['VTE MUSIC']
  return null
}

export const demoChannels = [
  {
    id: 'demo-vte1', name: 'VTE1', description: 'VOLTAGE RBX · RTN Events',
    logo_url: '', video_source: '', is_active: true, display_order: 1, is_demo: true,
    youtube_channels: defaultYoutubeChannels.VTE1, fallback_video_source: defaultLoopFallbacks.VTE1,
  },
  {
    id: 'demo-vte-music', name: 'VTE MUSIC', description: 'RTN Music · Badvyx',
    logo_url: '', video_source: '', is_active: true, display_order: 2, is_demo: true,
    youtube_channels: defaultYoutubeChannels['VTE MUSIC'], fallback_video_source: defaultLoopFallbacks['VTE MUSIC'],
  },
]

export const demoPrograms = []
export const demoEvents = []
