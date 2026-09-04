import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toggleLike,
  toggleSave,
  toggleRepost,
  addComment,
  addReply,
  toggleCommentLike,
  requestDelete,
  pruneDeletedPosts,
  getFeedByTab,
  isPostActive,
  buildOutfitGeneratorHref,
  toggleFollow,
  updatePostInState,
  loadCommunityState,
  saveCommunityState,
  buildDemoSeedPosts,
  buildCurrentUserSeedPost,
  migrateCommunityState,
  buildInitialCommunityPosts,
} from '@/lib/community-feed'
import type { SocialPost, PostComment } from '@/lib/community-feed'

// Factory function for creating test posts
function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'post-1',
    creatorUsername: 'test.user',
    creatorName: 'Test User',
    image: 'gradient:#fff,#000',
    caption: 'Test caption',
    postedAt: '1h',
    type: 'outfit_photo',
    tags: [],
    productLinks: [],
    feedViews: ['for-you'],
    likeCount: 10,
    comments: [],
    likedByCurrentUser: false,
    savedByCurrentUser: false,
    repostedByCurrentUser: false,
    lifecycleState: 'active',
    ...overrides,
  }
}

function makeComment(overrides: Partial<PostComment> = {}): PostComment {
  return {
    id: 'comment-1',
    authorName: 'Commenter',
    authorHandle: 'commenter',
    copy: 'Nice post!',
    createdLabel: '2h',
    replies: [],
    ...overrides,
  }
}

describe('toggleLike', () => {
  it('increments likeCount and sets likedByCurrentUser to true when not liked', () => {
    const post = makePost({ likeCount: 10, likedByCurrentUser: false })
    const result = toggleLike(post)
    expect(result.likedByCurrentUser).toBe(true)
    expect(result.likeCount).toBe(11)
  })

  it('decrements likeCount and sets likedByCurrentUser to false when already liked', () => {
    const post = makePost({ likeCount: 10, likedByCurrentUser: true })
    const result = toggleLike(post)
    expect(result.likedByCurrentUser).toBe(false)
    expect(result.likeCount).toBe(9)
  })

  it('does not mutate the original post', () => {
    const post = makePost({ likeCount: 10, likedByCurrentUser: false })
    const originalLikeCount = post.likeCount
    toggleLike(post)
    expect(post.likeCount).toBe(originalLikeCount)
    expect(post.likedByCurrentUser).toBe(false)
  })
})

describe('toggleSave', () => {
  it('sets savedByCurrentUser to true when not saved', () => {
    const post = makePost({ savedByCurrentUser: false })
    const result = toggleSave(post)
    expect(result.savedByCurrentUser).toBe(true)
  })

  it('sets savedByCurrentUser to false when already saved', () => {
    const post = makePost({ savedByCurrentUser: true })
    const result = toggleSave(post)
    expect(result.savedByCurrentUser).toBe(false)
  })

  it('does not mutate the original post', () => {
    const post = makePost({ savedByCurrentUser: false })
    toggleSave(post)
    expect(post.savedByCurrentUser).toBe(false)
  })
})

describe('toggleRepost', () => {
  it('sets repostedByCurrentUser to true when not reposted', () => {
    const post = makePost({ repostedByCurrentUser: false })
    const result = toggleRepost(post)
    expect(result.repostedByCurrentUser).toBe(true)
  })

  it('sets repostedByCurrentUser to false when already reposted', () => {
    const post = makePost({ repostedByCurrentUser: true })
    const result = toggleRepost(post)
    expect(result.repostedByCurrentUser).toBe(false)
  })

  it('does not mutate the original post', () => {
    const post = makePost({ repostedByCurrentUser: false })
    toggleRepost(post)
    expect(post.repostedByCurrentUser).toBe(false)
  })
})

describe('addComment', () => {
  it('adds new comment to the beginning of comments array', () => {
    const existingComment = makeComment({ id: 'comment-existing' })
    const post = makePost({ comments: [existingComment] })
    const result = addComment(post, 'Jane', 'jane', 'Great look!')
    expect(result.comments).toHaveLength(2)
    expect(result.comments[0].authorName).toBe('Jane')
    expect(result.comments[0].authorHandle).toBe('jane')
    expect(result.comments[0].copy).toBe('Great look!')
    expect(result.comments[1].id).toBe('comment-existing')
  })

  it('new comment has correct structure', () => {
    const post = makePost()
    const result = addComment(post, 'Alice', 'alice', 'Love it!')
    const comment = result.comments[0]
    expect(comment).toHaveProperty('id')
    expect(comment.authorName).toBe('Alice')
    expect(comment.authorHandle).toBe('alice')
    expect(comment.copy).toBe('Love it!')
    expect(comment.createdLabel).toBe('Just now')
    expect(comment.replies).toEqual([])
  })

  it('does not mutate the original post', () => {
    const post = makePost({ comments: [] })
    addComment(post, 'Bob', 'bob', 'Nice!')
    expect(post.comments).toHaveLength(0)
  })
})

describe('addReply', () => {
  it('appends reply to the specified comment', () => {
    const comment = makeComment({ id: 'comment-1', replies: [] })
    const post = makePost({ comments: [comment] })
    const result = addReply(post, 'comment-1', 'Alice', 'alice', 'Thanks!')
    expect(result.comments[0].replies).toHaveLength(1)
    expect(result.comments[0].replies[0].authorName).toBe('Alice')
    expect(result.comments[0].replies[0].authorHandle).toBe('alice')
    expect(result.comments[0].replies[0].copy).toBe('Thanks!')
    expect(result.comments[0].replies[0].createdLabel).toBe('Just now')
  })

  it('does not affect other comments', () => {
    const comment1 = makeComment({ id: 'comment-1', replies: [] })
    const comment2 = makeComment({ id: 'comment-2', replies: [] })
    const post = makePost({ comments: [comment1, comment2] })
    const result = addReply(post, 'comment-1', 'Alice', 'alice', 'Reply!')
    expect(result.comments[0].replies).toHaveLength(1)
    expect(result.comments[1].replies).toHaveLength(0)
  })

  it('does not mutate the original post', () => {
    const comment = makeComment({ id: 'comment-1', replies: [] })
    const post = makePost({ comments: [comment] })
    addReply(post, 'comment-1', 'Alice', 'alice', 'Reply!')
    expect(post.comments[0].replies).toHaveLength(0)
  })
})

describe('toggleCommentLike', () => {
  it('sets likedByCurrentUser to true on comment when not liked', () => {
    const comment = makeComment({ id: 'comment-1', likedByCurrentUser: false })
    const post = makePost({ comments: [comment] })
    const result = toggleCommentLike(post, 'comment-1')
    expect(result.comments[0].likedByCurrentUser).toBe(true)
  })

  it('sets likedByCurrentUser to false on comment when already liked', () => {
    const comment = makeComment({ id: 'comment-1', likedByCurrentUser: true })
    const post = makePost({ comments: [comment] })
    const result = toggleCommentLike(post, 'comment-1')
    expect(result.comments[0].likedByCurrentUser).toBe(false)
  })

  it('only affects the specified comment', () => {
    const comment1 = makeComment({ id: 'comment-1', likedByCurrentUser: false })
    const comment2 = makeComment({ id: 'comment-2', likedByCurrentUser: false })
    const post = makePost({ comments: [comment1, comment2] })
    const result = toggleCommentLike(post, 'comment-1')
    expect(result.comments[0].likedByCurrentUser).toBe(true)
    expect(result.comments[1].likedByCurrentUser).toBe(false)
  })
})

describe('requestDelete', () => {
  it('sets lifecycleState to pending_delete', () => {
    vi.useFakeTimers()
    const post = makePost({ lifecycleState: 'active' })
    const result = requestDelete(post)
    expect(result.lifecycleState).toBe('pending_delete')
    vi.useRealTimers()
  })

  it('sets deleteRequestedAt to a non-null ISO date string', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00Z'))
    const post = makePost()
    const result = requestDelete(post)
    expect(result.deleteRequestedAt).toBe('2026-05-26T12:00:00.000Z')
    vi.useRealTimers()
  })

  it('does not mutate the original post', () => {
    const post = makePost({ lifecycleState: 'active' })
    requestDelete(post)
    expect(post.lifecycleState).toBe('active')
  })
})

describe('pruneDeletedPosts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps pending_delete posts within 30 days', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    vi.setSystemTime(now)
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const post = makePost({
      lifecycleState: 'pending_delete',
      deleteRequestedAt: tenDaysAgo,
    })
    const result = pruneDeletedPosts([post])
    expect(result).toHaveLength(1)
  })

  it('removes pending_delete posts older than 30 days', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    vi.setSystemTime(now)
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const post = makePost({
      lifecycleState: 'pending_delete',
      deleteRequestedAt: thirtyOneDaysAgo,
    })
    const result = pruneDeletedPosts([post])
    expect(result).toHaveLength(0)
  })

  it('keeps active posts regardless of time', () => {
    const post = makePost({ lifecycleState: 'active' })
    const result = pruneDeletedPosts([post])
    expect(result).toHaveLength(1)
  })

  it('keeps pending_delete posts with no deleteRequestedAt', () => {
    const post = makePost({
      lifecycleState: 'pending_delete',
      deleteRequestedAt: null,
    })
    const result = pruneDeletedPosts([post])
    expect(result).toHaveLength(1)
  })
})

describe('getFeedByTab', () => {
  const forYouPost = makePost({ id: 'p1', feedViews: ['for-you'], lifecycleState: 'active' })
  const followingPost = makePost({
    id: 'p2',
    feedViews: ['for-you', 'following'],
    creatorUsername: 'followed.user',
    lifecycleState: 'active',
  })
  const savedPost = makePost({ id: 'p3', savedByCurrentUser: true, lifecycleState: 'active' })
  const repostedPost = makePost({ id: 'p4', repostedByCurrentUser: true, lifecycleState: 'active' })
  const deletedPost = makePost({ id: 'p5', feedViews: ['for-you'], lifecycleState: 'pending_delete' })

  const allPosts = [forYouPost, followingPost, savedPost, repostedPost, deletedPost]

  it('returns posts with for-you feedView for for-you tab', () => {
    const result = getFeedByTab('for-you', allPosts, [])
    const ids = result.map((p) => p.id)
    expect(ids).toContain('p1')
    expect(ids).toContain('p2')
    expect(ids).not.toContain('p5')
  })

  it('returns posts by followed users for following tab', () => {
    const result = getFeedByTab('following', allPosts, ['followed.user'])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p2')
  })

  it('returns saved posts for saved tab', () => {
    const result = getFeedByTab('saved', allPosts, [])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p3')
  })

  it('returns reposted posts for reposted tab', () => {
    const result = getFeedByTab('reposted', allPosts, [])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p4')
  })

  it('excludes non-active posts from all tabs', () => {
    const result = getFeedByTab('for-you', allPosts, [])
    const ids = result.map((p) => p.id)
    expect(ids).not.toContain('p5')
  })
})

describe('isPostActive', () => {
  it('returns true for active lifecycle state', () => {
    const post = makePost({ lifecycleState: 'active' })
    expect(isPostActive(post)).toBe(true)
  })

  it('returns false for pending_delete lifecycle state', () => {
    const post = makePost({ lifecycleState: 'pending_delete' })
    expect(isPostActive(post)).toBe(false)
  })

  it('returns false for archived lifecycle state', () => {
    const post = makePost({ lifecycleState: 'archived' })
    expect(isPostActive(post)).toBe(false)
  })

  it('returns true when lifecycleState is undefined (defaults to active)', () => {
    const post = makePost({ lifecycleState: undefined })
    expect(isPostActive(post)).toBe(true)
  })
})

describe('buildOutfitGeneratorHref', () => {
  it('generates shop mode URL with event tag', () => {
    const post = makePost({ tags: ['Date nights', 'Minimalist'], productLinks: [] })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).toContain('/outfits?')
    expect(href).toContain('event=Date+nights')
    expect(href).toContain('source=shop')
    expect(href).not.toContain('autogenerate')
  })

  it('generates similar mode URL with autogenerate flag', () => {
    const post = makePost({ tags: ['School'] })
    const href = buildOutfitGeneratorHref(post, 'similar')
    expect(href).toContain('source=similar')
    expect(href).toContain('autogenerate=1')
  })

  it('includes style tag when present', () => {
    const post = makePost({ tags: ['Minimalist', 'Everyday'] })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).toContain('style=Minimalist')
  })

  it('omits style param when no style tag present', () => {
    const post = makePost({ tags: ['Everyday'] })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).not.toContain('style=')
  })

  it('defaults event to Everyday when no matching event tag', () => {
    const post = makePost({ tags: ['SomeUnknownTag'] })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).toContain('event=Everyday')
  })

  it('includes seedProductIds when productLinks are present', () => {
    const post = makePost({
      tags: [],
      productLinks: [
        { id: 'pl-1', label: 'Blouse', href: '/products/1' },
        { id: 'pl-2', label: 'Pants', href: '/products/2' },
      ],
    })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).toContain('seedProductIds=pl-1%2Cpl-2')
  })

  it('omits seedProductIds when no productLinks', () => {
    const post = makePost({ productLinks: [] })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).not.toContain('seedProductIds')
  })

  it('includes colors param when productLinks have colors', () => {
    const post = makePost({
      tags: ['Date nights', 'Minimalist'],
      productLinks: [
        { id: 'pl-1', label: 'Shop this jacket', href: '/products/1', slot: 'Outerwear', productId: 1, colors: ['Silver', 'Black'] },
        { id: 'pl-2', label: 'Shop these pants', href: '/products/2', slot: 'Pants', productId: 2 },
      ],
    })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).toContain('colors=')
    expect(href).toContain('Silver')
  })

  it('includes seedProductId from first productLink', () => {
    const post = makePost({
      tags: ['Date nights', 'Minimalist'],
      productLinks: [
        { id: 'pl-1', label: 'Shop', href: '/products/1', productId: 1 },
      ],
    })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).toContain('seedProductId=1')
  })

  it('includes seedSlots from all productLinks with slots', () => {
    const post = makePost({
      tags: ['Date nights', 'Minimalist'],
      productLinks: [
        { id: 'pl-1', label: 'Shop', href: '/products/1', slot: 'Outerwear' },
        { id: 'pl-2', label: 'Shop', href: '/products/2', slot: 'Pants' },
      ],
    })
    const href = buildOutfitGeneratorHref(post, 'shop')
    expect(href).toContain('seedSlots=')
    expect(href).toContain('Outerwear')
    expect(href).toContain('Pants')
  })
})

describe('toggleFollow', () => {
  const baseState = {
    followedUsernames: ['user-a', 'user-b'],
    posts: [],
  }

  it('adds username when not already following', () => {
    const result = toggleFollow(baseState, 'user-c')
    expect(result.followedUsernames).toContain('user-c')
    expect(result.followedUsernames).toHaveLength(3)
  })

  it('removes username when already following', () => {
    const result = toggleFollow(baseState, 'user-a')
    expect(result.followedUsernames).not.toContain('user-a')
    expect(result.followedUsernames).toHaveLength(1)
  })

  it('does not mutate the original state', () => {
    toggleFollow(baseState, 'user-c')
    expect(baseState.followedUsernames).toHaveLength(2)
  })
})

describe('updatePostInState', () => {
  it('replaces the post matching the updated post ID', () => {
    const post1 = makePost({ id: 'post-1', likeCount: 5 })
    const post2 = makePost({ id: 'post-2', likeCount: 10 })
    const state = { followedUsernames: [], posts: [post1, post2] }
    const updatedPost = { ...post1, likeCount: 99 }
    const result = updatePostInState(state, updatedPost)
    expect(result.posts[0].likeCount).toBe(99)
    expect(result.posts[1].likeCount).toBe(10)
  })

  it('leaves posts with non-matching IDs unchanged', () => {
    const post1 = makePost({ id: 'post-1' })
    const post2 = makePost({ id: 'post-2', caption: 'original' })
    const state = { followedUsernames: [], posts: [post1, post2] }
    const updatedPost = { ...post1, caption: 'updated' }
    const result = updatePostInState(state, updatedPost)
    expect(result.posts[1].caption).toBe('original')
  })

  it('does not mutate the original state', () => {
    const post1 = makePost({ id: 'post-1', likeCount: 5 })
    const state = { followedUsernames: [], posts: [post1] }
    const updatedPost = { ...post1, likeCount: 99 }
    updatePostInState(state, updatedPost)
    expect(state.posts[0].likeCount).toBe(5)
  })
})

describe('loadCommunityState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes initial state to localStorage on first load', () => {
    loadCommunityState('user-1', 'Alice', 'alice', 'Minimalist')
    const stored = localStorage.getItem('clossette-community-state-user-1')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed).toHaveProperty('followedUsernames')
    expect(parsed).toHaveProperty('posts')
  })

  it('returns initial state with empty followed usernames on first load', () => {
    const state = loadCommunityState('user-1', 'Alice', 'alice', 'Minimalist')
    expect(state.followedUsernames).toEqual([])
  })

  it('loads existing state from localStorage when data is present', () => {
    const existingState = {
      followedUsernames: ['custom.user'],
      posts: [makePost({ id: 'stored-post' })],
    }
    localStorage.setItem('clossette-community-state-user-2', JSON.stringify(existingState))
    const state = loadCommunityState('user-2', 'Bob', 'bob', 'Streetwear')
    expect(state.followedUsernames).toEqual(['custom.user'])
    expect(state.posts[0].id).toBe('stored-post')
  })

  it('builds initial posts using provided displayName, username, aesthetic', () => {
    const state = loadCommunityState('user-3', 'Carol', 'carol', 'Y2K')
    const userPost = state.posts.find((p) => p.creatorUsername === 'carol')
    expect(userPost).toBeDefined()
    expect(userPost?.creatorName).toBe('Carol')
    expect(userPost?.tags).toContain('Y2K')
  })
})

describe('saveCommunityState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes state to localStorage under the correct key', () => {
    const state = { followedUsernames: ['user-a'], posts: [makePost()] }
    saveCommunityState('user-99', state)
    const stored = localStorage.getItem('clossette-community-state-user-99')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.followedUsernames).toEqual(['user-a'])
  })

  it('overwrites existing localStorage entry', () => {
    const state1 = { followedUsernames: ['old-user'], posts: [] }
    saveCommunityState('user-99', state1)
    const state2 = { followedUsernames: ['new-user'], posts: [] }
    saveCommunityState('user-99', state2)
    const stored = localStorage.getItem('clossette-community-state-user-99')
    const parsed = JSON.parse(stored!)
    expect(parsed.followedUsernames).toEqual(['new-user'])
  })
})

describe('buildDemoSeedPosts', () => {
  it('returns 3 canonical demo posts', () => {
    const posts = buildDemoSeedPosts()
    expect(posts).toHaveLength(3)
  })

  it('includes correct creator usernames', () => {
    const posts = buildDemoSeedPosts()
    const usernames = posts.map((p) => p.creatorUsername)
    expect(usernames).toContain('mila.rue')
    expect(usernames).toContain('studio.iris')
    expect(usernames).toContain('kai.mercer')
  })

  it('uses real image paths instead of gradients', () => {
    const posts = buildDemoSeedPosts()
    for (const post of posts) {
      expect(post.image).toMatch(/^\/assets\/images\/community\/post-\d+\.svg$/)
      expect(post.image).not.toContain('gradient:')
    }
  })

  it('includes pre-populated comments where expected', () => {
    const posts = buildDemoSeedPosts()
    const mila = posts.find((p) => p.creatorUsername === 'mila.rue')!
    expect(mila.comments).toHaveLength(1)
    expect(mila.comments[0].authorHandle).toBe('sarahdu')

    const kai = posts.find((p) => p.creatorUsername === 'kai.mercer')!
    expect(kai.comments).toHaveLength(0)
  })
})

describe('buildCurrentUserSeedPost', () => {
  it('creates a post owned by the current user', () => {
    const post = buildCurrentUserSeedPost('Test User', 'testuser', 'Minimalist')
    expect(post.ownedByCurrentUser).toBe(true)
    expect(post.creatorUsername).toBe('testuser')
    expect(post.creatorName).toBe('Test User')
  })

  it('includes the aesthetic in tags', () => {
    const post = buildCurrentUserSeedPost('Test', 'test', 'Streetwear')
    expect(post.tags).toContain('Streetwear')
  })
})

describe('migrateCommunityState', () => {
  it('passes through state that is already current version', () => {
    const currentState = {
      followedUsernames: ['mila.rue'],
      posts: buildInitialCommunityPosts('User', 'user', 'Everyday'),
      version: 4,
    }
    const result = migrateCommunityState(currentState, 'User', 'user', 'Everyday')
    expect(result).toBe(currentState) // same reference — no migration
  })

  it('migrates old version state by replacing system seeds', () => {
    const oldState = {
      followedUsernames: ['mila.rue', 'studio.iris'],
      posts: [
        {
          id: 'community-1',
          creatorUsername: 'mila.rue',
          creatorName: 'Mila Rue',
          image: 'gradient:#f4d1dc,#e7d6ff',
          caption: 'old caption',
          postedAt: '2h',
          type: 'outfit_photo' as const,
          tags: ['Minimalist'],
          productLinks: [],
          feedViews: ['for-you' as const],
          likeCount: 342,
          comments: [],
          likedByCurrentUser: true,
          savedByCurrentUser: true,
          repostedByCurrentUser: false,
          lifecycleState: 'active' as const,
        },
      ],
      // no version field = old version
    }

    const result = migrateCommunityState(oldState, 'User', 'user', 'Everyday')

    // Should have new canonical seeds
    expect(result.version).toBe(4)

    // Mila's post should be updated but preserve interaction flags
    const mila = result.posts.find((p) => p.creatorUsername === 'mila.rue')
    expect(mila).toBeDefined()
    expect(mila!.image).toContain('/assets/images/community/')
    expect(mila!.likedByCurrentUser).toBe(true) // preserved
    expect(mila!.savedByCurrentUser).toBe(true) // preserved

    // followedUsernames should be preserved
    expect(result.followedUsernames).toEqual(['mila.rue', 'studio.iris'])
  })

  it('preserves non-seed user posts during migration', () => {
    const customPost: SocialPost = {
      id: 'user-custom-post',
      creatorUsername: 'user',
      creatorName: 'User',
      image: 'gradient:#aaa,#bbb',
      caption: 'my custom post',
      postedAt: '5h',
      type: 'outfit_photo',
      tags: [],
      productLinks: [],
      feedViews: ['for-you'],
      likeCount: 10,
      comments: [],
      lifecycleState: 'active',
    }

    const oldState = {
      followedUsernames: [],
      posts: [customPost],
      // no version = needs migration
    }

    const result = migrateCommunityState(oldState, 'User', 'user', 'Everyday')

    // Custom post (non community- prefix) should be kept
    const kept = result.posts.find((p) => p.id === 'user-custom-post')
    expect(kept).toBeDefined()
    expect(kept!.caption).toBe('my custom post')
  })
})
