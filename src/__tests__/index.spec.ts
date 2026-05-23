import { describe, expect, it, vi } from 'vitest'

import { formatStartupLog, runPollCycle } from '../index'
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
  redditUserAgent: 'bapcsalescanada-poller/1.0',
  pollIntervalMs: 900_000,
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
