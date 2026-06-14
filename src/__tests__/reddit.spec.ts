import { describe, expect, it, vi } from 'vitest'

import { fetchNewPosts, fetchNewPostsWithFallback } from '../reddit'

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

  it('falls back to secondary url when primary returns 403', async () => {
    const fakeFetch = vi
      .fn()
      .mockImplementationOnce(
        async () => new Response('blocked', { status: 403 }),
      )
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                children: [
                  {
                    data: {
                      id: 'xyz',
                      title: '[SSD] Alternate source deal',
                      permalink: '/r/bapcsalescanada/comments/xyz/test',
                      url: 'https://example.com/ssd',
                      created_utc: 456,
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      )

    const result = await fetchNewPostsWithFallback(
      [
        'https://www.reddit.com/r/bapcsalescanada/new.json',
        'https://old.reddit.com/r/bapcsalescanada/new.json',
      ],
      'test-agent',
      fakeFetch,
    )

    expect(fakeFetch).toHaveBeenCalledTimes(2)
    expect(result.primaryFailed).toBe(true)
    expect(result.usedUrl).toBe(
      'https://old.reddit.com/r/bapcsalescanada/new.json',
    )
    expect(result.attempts).toEqual([
      {
        url: 'https://www.reddit.com/r/bapcsalescanada/new.json',
        status: 403,
        statusText: 'Unknown error',
      },
    ])
    expect(result.posts).toHaveLength(1)
  })

  it('throws with attempt trail when all sources fail', async () => {
    const fakeFetch = vi
      .fn()
      .mockImplementationOnce(async () => new Response('fail', { status: 429 }))
      .mockImplementationOnce(async () => new Response('fail', { status: 503 }))

    await expect(
      fetchNewPostsWithFallback(
        [
          'https://www.reddit.com/r/bapcsalescanada/new.json',
          'https://old.reddit.com/r/bapcsalescanada/new.json',
        ],
        'test-agent',
        fakeFetch,
      ),
    ).rejects.toThrow(/429|503/)
  })
})
