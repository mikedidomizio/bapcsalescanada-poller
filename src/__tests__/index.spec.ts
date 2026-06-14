import { describe, expect, it, vi } from 'vitest'

import {
  buildRedditSourceOrder,
  calculateJitteredIntervalMs,
  formatStartupLog,
  rotateSourcesAfterSuccessfulCycle,
  rotateRedditSources,
  runPollCycle,
} from '../index'
import {
  fetchNewPostsWithFallback,
  type FetchPostsWithFallbackResult,
} from '../reddit'
import type { PollerDeps } from '../index'
import type { AppConfig, RedditPost, Rule } from '../types'

const samplePosts: RedditPost[] = [
  {
    id: 'a',
    title: '[Mouse] Razer deal',
    permalink: 'https://www.reddit.com/r/bapcsalescanada/a',
    url: 'https://example.com/a',
    createdUtc: 100,
  },
  {
    id: 'b',
    title: '[Keyboard] Keychron deal',
    permalink: 'https://www.reddit.com/r/bapcsalescanada/b',
    url: 'https://example.com/b',
    createdUtc: 110,
  },
]

const sampleRules: Rule[] = [
  { itemType: 'Mouse', keywords: ['razer', 'logitech'] },
  { itemType: 'Keyboard', keywords: ['keychron'] },
]

function createDeps(overrides?: Partial<PollerDeps>): PollerDeps {
  return {
    fetchPosts: async () => samplePosts,
    loadRules: async () => sampleRules,
    loadLastSeenUtc: async () => 90,
    saveLastSeenUtc: async () => undefined,
    notifier: {
      sendDealNotification: async () => undefined,
    },
    ...overrides,
  }
}

const sampleConfig: AppConfig = {
  redditUrl: 'https://www.reddit.com/r/bapcsalescanada/new.json',
  redditFallbackUrls: ['https://old.reddit.com/r/bapcsalescanada/new.json'],
  redditUserAgent: 'bapcsalescanada-poller/1.0',
  pollIntervalMs: 900_000,
  pollJitterPercent: 10,
  rulesFilePath: './data/rules.json',
  stateFilePath: './data/state.json',
  notifier: {
    transport: 'discord-dm',
    botToken: 'secret-token-value',
    userId: '123456789',
  },
}

describe('runPollCycle', () => {
  it('sends notifications for matching new posts and stores latest createdUtc', async () => {
    const sendDealNotification = vi.fn(async () => undefined)
    const saveLastSeenUtc = vi.fn(async () => undefined)

    const result = await runPollCycle(
      createDeps({
        notifier: { sendDealNotification },
        saveLastSeenUtc,
      }),
    )

    expect(sendDealNotification).toHaveBeenCalledTimes(2)
    expect(saveLastSeenUtc).toHaveBeenCalledWith(110)
    expect(result).toEqual({
      scannedPosts: 2,
      matchedDeals: 2,
      lastSeenUtc: 110,
    })
  })

  it('does nothing when there are no posts newer than lastSeenUtc', async () => {
    const loadRules = vi.fn(async () => sampleRules)
    const saveLastSeenUtc = vi.fn(async () => undefined)

    const result = await runPollCycle(
      createDeps({
        fetchPosts: async () => [samplePosts[0]],
        loadLastSeenUtc: async () => 150,
        loadRules,
        saveLastSeenUtc,
      }),
    )

    expect(loadRules).not.toHaveBeenCalled()
    expect(saveLastSeenUtc).not.toHaveBeenCalled()
    expect(result).toEqual({
      scannedPosts: 0,
      matchedDeals: 0,
      lastSeenUtc: 150,
    })
  })
})

describe('formatStartupLog', () => {
  it('includes sanitized config and both UTC and ISO last scan times', () => {
    const output = formatStartupLog(sampleConfig, 1_700_000_000)

    expect(output).toContain('[startup] config=')
    expect(output).toContain('lastScanUtc=1700000000')
    expect(output).toContain('lastScanIso=2023-11-14T22:13:20.000Z')
    expect(output).toContain('"botToken":"[redacted]"')
    expect(output).not.toContain('secret-token-value')
  })

  it('reports never when no prior scan has been stored', () => {
    const output = formatStartupLog(sampleConfig, 0)

    expect(output).toContain('lastScanUtc=0')
    expect(output).toContain('lastScanIso=never')
  })
})

describe('reddit source helpers', () => {
  it('builds source order with deduped urls', () => {
    expect(
      buildRedditSourceOrder('https://a.example/new.json', [
        'https://b.example/new.json',
        'https://a.example/new.json',
        '  ',
      ]),
    ).toEqual(['https://a.example/new.json', 'https://b.example/new.json'])
  })

  it('rotates source order by one position', () => {
    expect(
      rotateRedditSources([
        'https://a.example/new.json',
        'https://b.example/new.json',
        'https://c.example/new.json',
      ]),
    ).toEqual([
      'https://b.example/new.json',
      'https://c.example/new.json',
      'https://a.example/new.json',
    ])
  })

  it('calculates symmetric jitter around base interval', () => {
    expect(calculateJitteredIntervalMs(1000, 10, 0)).toBe(900)
    expect(calculateJitteredIntervalMs(1000, 10, 0.5)).toBe(1000)
    expect(calculateJitteredIntervalMs(1000, 10, 1)).toBe(1100)
  })

  it('rotates only when primary failed and fallback was used', () => {
    const sourceOrder = [
      'https://a.example/new.json',
      'https://b.example/new.json',
    ]

    expect(
      rotateSourcesAfterSuccessfulCycle(sourceOrder, {
        posts: [],
        usedUrl: sourceOrder[0],
        attempts: [],
        primaryFailed: false,
      }),
    ).toEqual({
      sourceOrder,
      rotated: false,
    })

    expect(
      rotateSourcesAfterSuccessfulCycle(sourceOrder, {
        posts: [],
        usedUrl: sourceOrder[1],
        attempts: [
          { url: sourceOrder[0], status: 403, statusText: 'Forbidden' },
        ],
        primaryFailed: true,
      }),
    ).toEqual({
      sourceOrder: ['https://b.example/new.json', 'https://a.example/new.json'],
      rotated: true,
    })
  })
})

describe('poll orchestration rotation flow', () => {
  it('uses rotated primary on next cycle only after primary non-success', async () => {
    let sourceOrder = buildRedditSourceOrder(
      'https://www.reddit.com/r/bapcsalescanada/new.json',
      ['https://old.reddit.com/r/bapcsalescanada/new.json'],
    )
    let fetchResult: FetchPostsWithFallbackResult | null = null

    const fakeFetch = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url.includes('www.reddit.com')) {
        return new Response('blocked', { status: 403 })
      }

      return new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  id: 'cycle-post',
                  title: '[Mouse] Cycle test deal',
                  permalink: '/r/bapcsalescanada/comments/cycle/test',
                  url: 'https://example.com/cycle',
                  created_utc: 250,
                },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })

    const deps = createDeps({
      fetchPosts: async () => {
        fetchResult = await fetchNewPostsWithFallback(
          sourceOrder,
          'test-agent',
          fakeFetch,
        )
        return fetchResult.posts
      },
      loadRules: async () => [],
      loadLastSeenUtc: async () => 0,
    })

    await runPollCycle(deps)
    const firstCycleRotation = rotateSourcesAfterSuccessfulCycle(
      sourceOrder,
      fetchResult,
    )
    sourceOrder = firstCycleRotation.sourceOrder

    await runPollCycle(deps)
    const secondCycleRotation = rotateSourcesAfterSuccessfulCycle(
      sourceOrder,
      fetchResult,
    )

    const calledUrls = fakeFetch.mock.calls.map(([input]) => String(input))

    expect(firstCycleRotation.rotated).toBe(true)
    expect(sourceOrder[0]).toBe(
      'https://old.reddit.com/r/bapcsalescanada/new.json',
    )
    expect(secondCycleRotation.rotated).toBe(false)
    expect(calledUrls).toEqual([
      'https://www.reddit.com/r/bapcsalescanada/new.json',
      'https://old.reddit.com/r/bapcsalescanada/new.json',
      'https://old.reddit.com/r/bapcsalescanada/new.json',
    ])
  })
})
