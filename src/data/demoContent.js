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
  VTE1: 'voltagevd1',
  'VTE MUSIC': 'voltagevd2',
}

export const demoChannels = [
  {
    id: 'demo-vte1', name: 'VTE1', description: 'VOLTAGE RBX · RTN Events',
    logo_url: '', video_source: '', is_active: true, display_order: 1, is_demo: true,
    youtube_channels: defaultYoutubeChannels.VTE1, youtube_fallback_user: defaultLoopFallbacks.VTE1,
  },
  {
    id: 'demo-vte-music', name: 'VTE MUSIC', description: 'RTN Music · Badvyx',
    logo_url: '', video_source: '', is_active: true, display_order: 2, is_demo: true,
    youtube_channels: defaultYoutubeChannels['VTE MUSIC'], youtube_fallback_user: defaultLoopFallbacks['VTE MUSIC'],
  },
]

export const demoPrograms = []
export const demoEvents = []
