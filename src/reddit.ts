import type { RedditPost } from './types'

type FetchLike = typeof fetch

interface RedditListingResponse {
  data?: {
    children?: Array<{ data?: RedditRawPost }>
  }
}

interface RedditRawPost {
  id?: string
  title?: string
  permalink?: string
  url?: string
  created_utc?: number
}

export interface RedditFetchAttempt {
  url: string
  status: number
  statusText: string
}

export interface FetchPostsWithFallbackResult {
  posts: RedditPost[]
  usedUrl: string
  attempts: RedditFetchAttempt[]
  primaryFailed: boolean
}

function normalizePost(
  maybePost: RedditRawPost | undefined,
): RedditPost | null {
  if (!maybePost) {
    return null
  }

  const { id, title, permalink, url, created_utc: createdUtc } = maybePost

  if (!id || !title || !permalink || !url || typeof createdUtc !== 'number') {
    return null
  }

  return {
    id,
    title,
    permalink: `https://www.reddit.com${permalink}`,
    url,
    createdUtc,
  }
}

export async function fetchNewPosts(
  redditUrl: string,
  userAgent: string,
  fetchImpl: FetchLike = fetch,
): Promise<RedditPost[]> {
  const result = await fetchNewPostsWithFallback(
    [redditUrl],
    userAgent,
    fetchImpl,
  )
  return result.posts
}

export async function fetchNewPostsWithFallback(
  redditUrls: string[],
  userAgent: string,
  fetchImpl: FetchLike = fetch,
): Promise<FetchPostsWithFallbackResult> {
  const urls = redditUrls.filter((url) => url.trim().length > 0)

  if (urls.length === 0) {
    throw new Error('Failed to fetch Reddit posts: no Reddit URLs configured')
  }

  const attempts: RedditFetchAttempt[] = []

  for (const [index, redditUrl] of urls.entries()) {
    try {
      const response = await fetchImpl(redditUrl, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        attempts.push({
          url: redditUrl,
          status: response.status,
          statusText: response.statusText || 'Unknown error',
        })
        continue
      }

      const payload = (await response.json()) as RedditListingResponse
      const children = payload.data?.children ?? []
      const posts = children
        .map((entry) => normalizePost(entry.data))
        .filter((post): post is RedditPost => post !== null)

      return {
        posts,
        usedUrl: redditUrl,
        attempts,
        primaryFailed: index > 0,
      }
    } catch (error) {
      attempts.push({
        url: redditUrl,
        status: 0,
        statusText: (error as Error).message,
      })
    }
  }

  const attemptSummary = attempts
    .map(
      (attempt) => `${attempt.url} -> ${attempt.status} ${attempt.statusText}`,
    )
    .join('; ')

  throw new Error(`Failed to fetch Reddit posts: ${attemptSummary}`)
}
