export function adminAccessState(user, isAdmin) {
  if (!user) return 'unauthenticated'
  return isAdmin ? 'authorized' : 'forbidden'
}
