import { describe, expect, it, vi } from 'vitest'

import { runPollCycle } from '../index'
import type { PollerDeps } from '../index'
import type { RedditPost, Rule } from '../types'

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
