import { useCallback, useEffect, useMemo, useState } from 'react'
import { defaultLoopFallbacks, defaultYoutubeChannels, demoChannels, demoEvents, demoPrograms } from '../data/demoContent'
import { configMessage, supabase, supabaseConfigured } from '../lib/supabase'
import { favoriteTransition } from '../lib/favorites'
import { buildBroadcastSchedule } from '../lib/schedule'

const tableColumns = {
  channels: 'id, name, description, logo_url, video_source, is_active, display_order, created_at, updated_at',
  programs: 'id, channel_id, title, description, video_source, starts_at, ends_at, created_at, updated_at',
  events: 'id, channel_id, title, description, video_source, starts_at, ends_at, status, created_at, updated_at',
  saved_videos: 'id, content_key, title, thumbnail_url, video_source, created_at',
}

function addYoutubeChannelLinks(channels) {
  return channels.map((channel) => ({
    ...channel,
    youtube_channels: defaultYoutubeChannels[channel.name] || channel.youtube_channels || [],
    fallback_video_source: defaultLoopFallbacks[channel.name] || channel.fallback_video_source || null,
  }))
}

export function useMediaData(user) {
  const [channels, setChannels] = useState(demoChannels)
  const [programs, setPrograms] = useState(demoPrograms)
  const [events, setEvents] = useState(demoEvents)
  const [savedVideos, setSavedVideos] = useState([])
  const [loading, setLoading] = useState(supabaseConfigured)
  const [error, setError] = useState(null)
  const [clockOffset, setClockOffset] = useState(null)
  const [clockTick, setClockTick] = useState(Date.now())

  const syncServerClock = useCallback(async () => {
    if (!supabase) return
    const requestStartedAt = Date.now()
    const { data, error: clockError } = await supabase.rpc('broadcast_server_time')
    const requestFinishedAt = Date.now()
    if (clockError || !data) return
    const serverTime = new Date(data).getTime()
    if (!Number.isFinite(serverTime)) return
    const midpoint = requestStartedAt + (requestFinishedAt - requestStartedAt) / 2
    setClockOffset(serverTime - midpoint)
  }, [])

  const refresh = useCallback(async () => {
    if (!supabase) {
      setChannels(demoChannels); setPrograms(demoPrograms); setEvents(demoEvents); setSavedVideos([])
      setError(null); setLoading(false); return
    }
    setLoading(true)
    const requests = [
      supabase.from('channels').select(tableColumns.channels).order('display_order'),
      supabase.from('programs').select(tableColumns.programs).order('starts_at'),
      supabase.from('events').select(tableColumns.events).order('starts_at'),
      user ? supabase.from('saved_videos').select(tableColumns.saved_videos).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]
    const [channelsResult, programsResult, eventsResult, savesResult] = await Promise.all(requests)
    const firstError = [channelsResult, programsResult, eventsResult, savesResult].find((result) => result.error)?.error
    if (firstError) {
      setError(`No se ha podido cargar el contenido: ${firstError.message}`)
    } else {
      const remoteChannels = channelsResult.data?.length ? channelsResult.data : demoChannels
      setChannels(addYoutubeChannelLinks(remoteChannels)); setPrograms(programsResult.data); setEvents(eventsResult.data); setSavedVideos(savesResult.data)
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!supabase) return undefined
    const subscription = supabase.channel('vte-broadcast-schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refresh)
      .subscribe()
    const fallback = window.setInterval(refresh, 60000)
    return () => {
      window.clearInterval(fallback)
      supabase.removeChannel(subscription)
    }
  }, [refresh])

  useEffect(() => {
    syncServerClock()
    const syncTimer = window.setInterval(syncServerClock, 60000)
    const tickTimer = window.setInterval(() => setClockTick(Date.now()), 1000)
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') syncServerClock() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(syncTimer)
      window.clearInterval(tickTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [syncServerClock])

  const saveEntity = async (table, entity) => {
    if (!supabase) throw new Error(configMessage())
    const persistedEntity = { ...entity }
    delete persistedEntity.youtube_channels
    delete persistedEntity.fallback_video_source
    const query = persistedEntity.id
      ? supabase.from(table).update(persistedEntity).eq('id', persistedEntity.id).select(tableColumns[table]).single()
      : supabase.from(table).insert(persistedEntity).select(tableColumns[table]).single()
    const { error: writeError } = await query
    if (writeError) throw writeError
    await refresh()
  }

  const deleteEntity = async (table, id) => {
    if (!supabase) throw new Error(configMessage())
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) throw deleteError
    await refresh()
  }

  const loadYoutubeCatalog = async (handle) => {
    if (!supabase) throw new Error(configMessage())
    const { data, error: invokeError } = await supabase.functions.invoke('youtube-catalog', { body: { handle } })
    if (invokeError) {
      try {
        const body = await invokeError.context?.json()
        if (body?.error) throw new Error(body.error)
      } catch (error) {
        if (error instanceof Error && error.message !== invokeError.message) throw error
      }
      throw new Error(invokeError.message || 'No se pudo consultar el catálogo de YouTube.')
    }
    if (data?.error) throw new Error(data.error)
    return data
  }

  const toggleSavedVideo = async (item) => {
    if (!user) throw new Error('Inicia sesión para guardar contenido en Mi lista.')
    if (!supabase) throw new Error(configMessage())
    const transition = favoriteTransition(savedVideos, item.content_key)
    const result = transition.action === 'remove'
      ? await supabase.from('saved_videos').delete().eq('id', transition.id)
      : await supabase.from('saved_videos').insert({ ...item, user_id: user.id })
    if (result.error) throw result.error
    await refresh()
  }

  const serverNow = new Date(clockTick + (clockOffset ?? 0))
  const serverDay = Math.floor(serverNow.getTime() / 86400000)
  const broadcastPrograms = useMemo(
    () => buildBroadcastSchedule(channels, programs, new Date(serverDay * 86400000)),
    [channels, programs, serverDay],
  )
  return { channels, programs, broadcastPrograms, events, savedVideos, loading, error, isDemo: !supabaseConfigured, serverNow, serverClockSynced: clockOffset !== null, refresh, saveEntity, deleteEntity, loadYoutubeCatalog, toggleSavedVideo }
}
