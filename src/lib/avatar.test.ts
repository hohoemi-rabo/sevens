import { describe, it, expect } from 'vitest'
import { avatarSrcForSeat, AVATAR_COUNT } from './avatar'

describe('avatarSrcForSeat', () => {
  it('席0..3 はそれぞれ a0..a3 に対応する', () => {
    expect(avatarSrcForSeat(0)).toBe('/avatars/a0.svg')
    expect(avatarSrcForSeat(1)).toBe('/avatars/a1.svg')
    expect(avatarSrcForSeat(2)).toBe('/avatars/a2.svg')
    expect(avatarSrcForSeat(3)).toBe('/avatars/a3.svg')
  })

  it('範囲外の席は剰余で安全に丸める（決定論的）', () => {
    expect(avatarSrcForSeat(AVATAR_COUNT)).toBe('/avatars/a0.svg')
    expect(avatarSrcForSeat(-1)).toBe(`/avatars/a${AVATAR_COUNT - 1}.svg`)
  })
})
