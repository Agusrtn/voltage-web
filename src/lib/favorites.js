export function favoriteTransition(savedVideos, contentKey) {
  const existing = savedVideos.find((item) => item.content_key === contentKey)
  return existing ? { action: 'remove', id: existing.id } : { action: 'add' }
}
