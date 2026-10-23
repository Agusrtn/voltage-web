export function youtubeEmbedUrl(source, startSeconds = 0) {
  if (!source) return null
  try {
    const url = new URL(source)
    let videoId = null
    if (url.hostname.includes('youtu.be')) videoId = url.pathname.slice(1)
    if (url.hostname.includes('youtube.com')) {
      const pathParts = url.pathname.split('/').filter(Boolean)
      videoId = url.searchParams.get('v') || (['embed', 'live', 'shorts'].includes(pathParts[0]) ? pathParts[1] : null)
    }
    if (!videoId) return null
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`)
    embed.searchParams.set('rel', '0')
    embed.searchParams.set('modestbranding', '1')
    if (startSeconds > 0) embed.searchParams.set('start', String(Math.floor(startSeconds)))
    return embed.toString()
  } catch {
    return null
  }
}

export function isEmbeddableSource(source) {
  return Boolean(youtubeEmbedUrl(source)) || /^https:\/\/.*\.(m3u8|mp4)(\?.*)?$/i.test(source || '')
}
