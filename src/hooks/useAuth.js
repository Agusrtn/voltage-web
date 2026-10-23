import { useCallback, useEffect, useState } from 'react'
import { configMessage, supabase, supabaseConfigured } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(supabaseConfigured)

  const loadIdentity = useCallback(async (activeSession) => {
    setSession(activeSession)
    if (!activeSession || !supabase) {
      setProfile(null)
      setIsAdmin(false)
      setLoading(false)
      return
    }
    const userId = activeSession.user.id
    const [{ data: profileData }, { data: roleData }] = await Promise.all([
      supabase.from('profiles').select('id, username, avatar_url, updated_at').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle(),
    ])
    setProfile(profileData)
    setIsAdmin(Boolean(roleData))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return undefined }
    supabase.auth.getSession().then(({ data }) => loadIdentity(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { loadIdentity(nextSession) })
    return () => listener.subscription.unsubscribe()
  }, [loadIdentity])

  const runAuth = useCallback(async (task) => {
    if (!supabase) throw new Error(configMessage())
    const { error, data } = await task()
    if (error) throw error
    return data
  }, [])

  const signIn = (email, password) => runAuth(() => supabase.auth.signInWithPassword({ email, password }))
  const signUp = (email, password, username) => runAuth(() => supabase.auth.signUp({ email, password, options: { data: { username } } }))
  const signInWithGoogle = () => runAuth(() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }))
  const resetPassword = (email) => runAuth(() => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/perfil` }))
  const signOut = () => runAuth(() => supabase.auth.signOut())
  const updateProfile = async ({ username, avatar_url }) => {
    if (!session) throw new Error('Debes iniciar sesión para editar tu perfil.')
    await runAuth(() => supabase.from('profiles').update({ username, avatar_url }).eq('id', session.user.id))
    await loadIdentity(session)
  }

  return { session, user: session?.user ?? null, profile, isAdmin, loading, configured: supabaseConfigured, signIn, signUp, signInWithGoogle, resetPassword, signOut, updateProfile }
}
