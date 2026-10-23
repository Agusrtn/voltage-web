import { describe, expect, it } from 'vitest'
import { adminAccessState } from '../src/lib/access'
import { favoriteTransition } from '../src/lib/favorites'

describe('sesión y permisos de administración', () => {
  it('deniega una sesión ausente y un usuario no autorizado', () => {
    expect(adminAccessState(null, false)).toBe('unauthenticated')
    expect(adminAccessState({ id: 'member' }, false)).toBe('forbidden')
  })

  it('admite solo una sesión con rol de administrador', () => {
    expect(adminAccessState({ id: 'admin' }, true)).toBe('authorized')
  })
})

describe('favoritos', () => {
  it('decide insertar o eliminar usando la clave estable del contenido', () => {
    expect(favoriteTransition([], 'event:abc')).toEqual({ action: 'add' })
    expect(favoriteTransition([{ id: 'save-1', content_key: 'event:abc' }], 'event:abc')).toEqual({ action: 'remove', id: 'save-1' })
  })
})
