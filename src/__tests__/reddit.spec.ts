import { describe, expect, it } from 'vitest'

import { fetchNewPosts } from '../reddit'

describe('fetchNewPosts', () => {
  it('returns normalized Reddit posts', async () => {
    const fakeFetch: typeof fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  id: 'abc',
                  title: '[Mouse] Test deal',
                  permalink: '/r/bapcsalescanada/comments/abc/test',
                  url: 'https://example.com',
                  created_utc: 123,
                },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch

    const posts = await fetchNewPosts(
      'https://www.reddit.com/r/bapcsalescanada/new.json',
      'test-agent',
      fakeFetch,
    )

    expect(posts).toEqual([
      {
        id: 'abc',
        title: '[Mouse] Test deal',
        permalink: 'https://www.reddit.com/r/bapcsalescanada/comments/abc/test',
        url: 'https://example.com',
        createdUtc: 123,
      },
    ])
  })

  it('throws when reddit request fails', async () => {
    const fakeFetch: typeof fetch = (async () =>
      new Response('fail', { status: 503 })) as typeof fetch

    await expect(
      fetchNewPosts('https://example.com', 'test-agent', fakeFetch),
    ).rejects.toThrow(/Failed to fetch Reddit posts/)
  })
})
