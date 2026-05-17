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
  const response = await fetchImpl(redditUrl, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Reddit posts: ${response.status} ${response.statusText}`,
    )
  }

  const payload = (await response.json()) as RedditListingResponse
  const children = payload.data?.children ?? []

  return children
    .map((entry) => normalizePost(entry.data))
    .filter((post): post is RedditPost => post !== null)
}
