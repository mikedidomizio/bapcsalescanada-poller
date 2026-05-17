import { describe, expect, it, vi } from 'vitest'

import { DiscordDmNotifier } from '../notifier'
import type { MatchedDeal } from '../types'

const deal: MatchedDeal = {
  post: {
    id: 'abc',
    title: '[Mouse] Test deal',
    permalink: 'https://www.reddit.com/r/bapcsalescanada/comments/abc/test',
    url: 'https://example.com/deal',
    createdUtc: 111,
  },
  rule: {
    itemType: 'Mouse',
    keywords: ['mouse'],
  },
}

describe('DiscordDmNotifier', () => {
  it('creates DM channel and sends a message', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'dm-channel-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'message-id' }), { status: 200 }),
      )

    const notifier = new DiscordDmNotifier('bot-token', 'user-id', fetchMock)
    await notifier.sendDealNotification(deal)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstCallUrl = fetchMock.mock.calls[0]?.[0]
    const secondCallUrl = fetchMock.mock.calls[1]?.[0]
    expect(firstCallUrl).toBe('https://discord.com/api/v10/users/@me/channels')
    expect(secondCallUrl).toBe(
      'https://discord.com/api/v10/channels/dm-channel-id/messages',
    )
  })

  it('throws immediately on discord permission/auth errors', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 50278,
          message:
            'Cannot send messages to this user due to having no mutual guilds',
        }),
        {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const notifier = new DiscordDmNotifier('bot-token', 'user-id', fetchMock)

    let thrownError: unknown

    try {
      await notifier.sendDealNotification(deal)
    } catch (error) {
      thrownError = error
    }

    expect(thrownError).toBeInstanceOf(Error)
    const message = (thrownError as Error).message
    expect(message).toMatch(/permission\/auth error/i)
    expect(message).toMatch(/discordCode=50278/)
    expect(message).toMatch(/no mutual guilds/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
