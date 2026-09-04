import { describe, it, expect } from 'vitest'
import {
  getProfileTabPosts,
  getProfileStats,
  getBodyMeasurementCoverage,
} from '@/lib/profile-dashboard'
import type { PersistedCommunityState, SocialPost } from '@/lib/community-feed'

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'post-1',
    creatorUsername: 'alice',
    creatorName: 'Alice',
    image: 'gradient:#fff,#000',
    caption: 'Test',
    postedAt: '1h',
    type: 'outfit_photo',
    tags: [],
    productLinks: [],
    feedViews: ['for-you'],
    likeCount: 0,
    comments: [],
    likedByCurrentUser: false,
    savedByCurrentUser: false,
    repostedByCurrentUser: false,
    lifecycleState: 'active',
    ...overrides,
  }
}

function makeState(posts: SocialPost[], followedUsernames: string[] = []): PersistedCommunityState {
  return { posts, followedUsernames }
}

describe('getProfileTabPosts', () => {
  it('outfit-posts returns active posts by the given username', () => {
    const posts = [
      makePost({ id: '1', creatorUsername: 'alice', lifecycleState: 'active' }),
      makePost({ id: '2', creatorUsername: 'bob', lifecycleState: 'active' }),
      makePost({ id: '3', creatorUsername: 'alice', lifecycleState: 'archived' }),
    ]
    const result = getProfileTabPosts(makeState(posts), 'alice', 'outfit-posts')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('saved returns posts saved by current user', () => {
    const posts = [
      makePost({ id: '1', savedByCurrentUser: true, lifecycleState: 'active' }),
      makePost({ id: '2', savedByCurrentUser: false, lifecycleState: 'active' }),
    ]
    const result = getProfileTabPosts(makeState(posts), 'alice', 'saved')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('reposted returns posts reposted by current user', () => {
    const posts = [
      makePost({ id: '1', repostedByCurrentUser: true, lifecycleState: 'active' }),
      makePost({ id: '2', repostedByCurrentUser: false, lifecycleState: 'active' }),
    ]
    const result = getProfileTabPosts(makeState(posts), 'alice', 'reposted')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('tagged returns active posts that include the username in taggedUsernames', () => {
    const posts = [
      makePost({ id: '1', taggedUsernames: ['alice', 'bob'], lifecycleState: 'active' }),
      makePost({ id: '2', taggedUsernames: ['bob'], lifecycleState: 'active' }),
    ]
    const result = getProfileTabPosts(makeState(posts), 'alice', 'tagged')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('archives returns archived posts by the given username', () => {
    const posts = [
      makePost({ id: '1', creatorUsername: 'alice', lifecycleState: 'archived' }),
      makePost({ id: '2', creatorUsername: 'alice', lifecycleState: 'active' }),
      makePost({ id: '3', creatorUsername: 'bob', lifecycleState: 'archived' }),
    ]
    const result = getProfileTabPosts(makeState(posts), 'alice', 'archives')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('returns empty array for unknown tab', () => {
    const posts = [makePost()]
    // @ts-expect-error testing unknown tab
    const result = getProfileTabPosts(makeState(posts), 'alice', 'unknown-tab')
    expect(result).toHaveLength(0)
  })
})

describe('getProfileStats', () => {
  it('counts active posts by username', () => {
    const posts = [
      makePost({ id: '1', creatorUsername: 'alice', lifecycleState: 'active' }),
      makePost({ id: '2', creatorUsername: 'alice', lifecycleState: 'archived' }),
      makePost({ id: '3', creatorUsername: 'bob', lifecycleState: 'active' }),
    ]
    const { posts: count } = getProfileStats(makeState(posts), 'alice')
    expect(count).toBe(1)
  })

  it('counts following from followedUsernames array', () => {
    const { following } = getProfileStats(makeState([], ['bob', 'carol']), 'alice')
    expect(following).toBe(2)
  })

  it('returns zero following for empty followedUsernames', () => {
    const { following } = getProfileStats(makeState([]), 'alice')
    expect(following).toBe(0)
  })

  it('counts archived posts separately', () => {
    const posts = [
      makePost({ id: '1', creatorUsername: 'alice', lifecycleState: 'archived' }),
      makePost({ id: '2', creatorUsername: 'alice', lifecycleState: 'archived' }),
    ]
    const { archives } = getProfileStats(makeState(posts), 'alice')
    expect(archives).toBe(2)
  })

  it('followers defaults to zero for new accounts', () => {
    const { followers } = getProfileStats(makeState([]), 'alice')
    expect(followers).toBe(0)
  })
})

describe('getBodyMeasurementCoverage', () => {
  it('returns 0 when no fields are filled', () => {
    expect(getBodyMeasurementCoverage({})).toBe(0)
  })

  it('returns 100 when all fields are filled', () => {
    const user = {
      heightCm: 170,
      weightKg: 65,
      chestCm: 90,
      waistCm: 70,
      hipsCm: 95,
      shoulderWidthCm: 38,
      inseamCm: 76,
      shoeSize: 8,
      topSize: 'M',
      bottomSize: 'M',
      dressSize: '8',
      jacketSize: '40',
    }
    expect(getBodyMeasurementCoverage(user)).toBe(100)
  })

  it('returns correct percentage for partial fill', () => {
    const user = { heightCm: 170, weightKg: 65, chestCm: 90 } // 3 of 12
    expect(getBodyMeasurementCoverage(user)).toBe(25)
  })

  it('ignores null values', () => {
    const user = { heightCm: null, weightKg: 65 }
    expect(getBodyMeasurementCoverage(user)).toBe(Math.round((1 / 12) * 100))
  })

  it('ignores empty string values', () => {
    const user = { heightCm: '', weightKg: 65 }
    expect(getBodyMeasurementCoverage(user)).toBe(Math.round((1 / 12) * 100))
  })
})
