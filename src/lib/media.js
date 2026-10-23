export function youtubeVideoId(source) {
  if (!source) return null
  try {
    const url = new URL(source)
    let videoId = null
    if (url.hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0]
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      const pathParts = url.pathname.split('/').filter(Boolean)
      videoId = url.searchParams.get('v') || (['embed', 'live', 'shorts'].includes(pathParts[0]) ? pathParts[1] : null)
    }
    return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null
  } catch {
    return null
  }
}

export function isYoutubeLiveSource(source) {
  try {
    const url = new URL(source)
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)
      && url.pathname.split('/').filter(Boolean)[0] === 'live'
  } catch {
    return false
  }
}

export const youtubeCleanPlayerVars = {
  autoplay: 1,
  cc_load_policy: 0,
  controls: 0,
  disablekb: 1,
  fs: 0,
  iv_load_policy: 3,
  modestbranding: 1,
  playsinline: 1,
  rel: 0,
}

export function youtubeEmbedUrl(source, startSeconds = 0) {
  const videoId = youtubeVideoId(source)
  if (!videoId) return null
  try {
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`)
    Object.entries(youtubeCleanPlayerVars).forEach(([key, value]) => embed.searchParams.set(key, String(value)))
    embed.searchParams.set('mute', '1')
    if (startSeconds > 0) embed.searchParams.set('start', String(Math.floor(startSeconds)))
    return embed.toString()
  } catch {
    return null
  }
}

export function isEmbeddableSource(source) {
  return Boolean(youtubeEmbedUrl(source)) || /^https:\/\/.*\.(m3u8|mp4)(\?.*)?$/i.test(source || '')
}
