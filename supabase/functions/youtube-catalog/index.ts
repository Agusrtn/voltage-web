import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const allowedHandles = new Map([
  ['voltagerbx', 'VOLTAGE RBX'],
  ['rtn_events', 'RTN Events'],
  ['rtnmusicrbx', 'RTN Music'],
  ['badvyx', 'Badvyx'],
])

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function normalizeHandle(value: unknown) {
  if (typeof value !== 'string') return null
  const handle = value.trim().replace(/^@/, '').toLowerCase()
  return allowedHandles.has(handle) ? handle : null
}

async function youtubeRequest<T>(resource: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set('key', apiKey)
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    // Do not pass the upstream body or request URL back; they can contain the API key.
    throw new Error(response.status === 403 ? 'YouTube API denegó la consulta. Revisa cuota y permisos de YouTube Data API v3.' : 'YouTube no pudo completar la consulta del catálogo.')
  }
  return await response.json() as T
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond(405, { error: 'Método no permitido.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY')
  if (!supabaseUrl || !anonKey || !youtubeApiKey) return respond(500, { error: 'Faltan secretos de configuración de la función.' })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'Inicia sesión para acceder al catálogo.' })

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return respond(401, { error: 'La sesión no es válida. Vuelve a iniciar sesión.' })

  const { data: isAdmin, error: roleError } = await userClient.rpc('is_admin')
  if (roleError || isAdmin !== true) return respond(403, { error: 'Solo una cuenta administradora puede consultar el catálogo.' })

  let requestBody: { handle?: unknown }
  try {
    requestBody = await request.json()
  } catch {
    return respond(400, { error: 'La solicitud debe incluir un canal válido.' })
  }

  const handle = normalizeHandle(requestBody.handle)
  if (!handle) return respond(400, { error: 'El canal no está en la lista de canales VTE permitidos.' })

  try {
    const channelResponse = await youtubeRequest<{
      items?: Array<{ id: string; snippet?: { title?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }>
    }>('channels', { part: 'snippet,contentDetails', forHandle: handle, maxResults: '1' }, youtubeApiKey)
    const youtubeChannel = channelResponse.items?.[0]
    const uploadsPlaylistId = youtubeChannel?.contentDetails?.relatedPlaylists?.uploads
    if (!youtubeChannel || !uploadsPlaylistId) return respond(404, { error: 'No se encontró el canal público de YouTube.' })

    const playlistResponse = await youtubeRequest<{
      items?: Array<{ snippet?: { title?: string; description?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> }; contentDetails?: { videoId?: string } }>
    }>('playlistItems', { part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults: '50' }, youtubeApiKey)
    const candidates = (playlistResponse.items || []).flatMap((item) => {
      const videoId = item.contentDetails?.videoId
      if (!videoId) return []
      return [{
        videoId,
        title: item.snippet?.title || 'Vídeo sin título',
        description: item.snippet?.description || '',
        publishedAt: item.snippet?.publishedAt || null,
        thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      }]
    })

    const videoIds = candidates.map((video) => video.videoId)
    const detailsById = new Map<string, { privacyStatus?: string; duration?: string; liveBroadcastContent?: string }>()
    for (let index = 0; index < videoIds.length; index += 50) {
      const detailResponse = await youtubeRequest<{
        items?: Array<{ id: string; status?: { privacyStatus?: string }; contentDetails?: { duration?: string }; snippet?: { liveBroadcastContent?: string } }>
      }>('videos', { part: 'status,contentDetails,snippet', id: videoIds.slice(index, index + 50).join(','), maxResults: '50' }, youtubeApiKey)
      for (const video of detailResponse.items || []) {
        detailsById.set(video.id, {
          privacyStatus: video.status?.privacyStatus,
          duration: video.contentDetails?.duration,
          liveBroadcastContent: video.snippet?.liveBroadcastContent,
        })
      }
    }

    const videos = candidates.flatMap((video) => {
      const details = detailsById.get(video.videoId)
      if (!details || details.privacyStatus !== 'public') return []
      return [{
        ...video,
        duration: details.duration || null,
        liveBroadcastContent: details.liveBroadcastContent || 'none',
        videoSource: details.liveBroadcastContent === 'live' || details.liveBroadcastContent === 'upcoming'
          ? `https://www.youtube.com/live/${video.videoId}`
          : `https://www.youtube.com/watch?v=${video.videoId}`,
      }]
    })

    return respond(200, {
      channel: { handle, title: youtubeChannel.snippet?.title || allowedHandles.get(handle) },
      videos,
    })
  } catch (error) {
    const safeMessages = new Set([
      'YouTube API denegó la consulta. Revisa cuota y permisos de YouTube Data API v3.',
      'YouTube no pudo completar la consulta del catálogo.',
    ])
    const message = error instanceof Error && safeMessages.has(error.message)
      ? error.message
      : 'No se pudo conectar con YouTube. Comprueba la clave y vuelve a intentarlo.'
    return respond(502, { error: message })
  }
})
