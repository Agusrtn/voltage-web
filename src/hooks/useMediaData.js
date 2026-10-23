import { useCallback, useEffect, useState } from 'react'
import { defaultYoutubeChannels, demoChannels, demoEvents, demoPrograms } from '../data/demoContent'
import { configMessage, supabase, supabaseConfigured } from '../lib/supabase'
import { favoriteTransition } from '../lib/favorites'

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
  }))
}

export function useMediaData(user) {
  const [channels, setChannels] = useState(demoChannels)
  const [programs, setPrograms] = useState(demoPrograms)
  const [events, setEvents] = useState(demoEvents)
  const [savedVideos, setSavedVideos] = useState([])
  const [loading, setLoading] = useState(supabaseConfigured)
  const [error, setError] = useState(null)

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
      setChannels(addYoutubeChannelLinks(channelsResult.data)); setPrograms(programsResult.data); setEvents(eventsResult.data); setSavedVideos(savesResult.data)
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const saveEntity = async (table, entity) => {
    if (!supabase) throw new Error(configMessage())
    const query = entity.id
      ? supabase.from(table).update(entity).eq('id', entity.id).select(tableColumns[table]).single()
      : supabase.from(table).insert(entity).select(tableColumns[table]).single()
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

  return { channels, programs, events, savedVideos, loading, error, isDemo: !supabaseConfigured, refresh, saveEntity, deleteEntity, toggleSavedVideo }
}
