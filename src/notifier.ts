import type { MatchedDeal, NotifierConfig } from './types'

type FetchLike = typeof fetch

export interface Notifier {
  sendDealNotification(deal: MatchedDeal): Promise<void>
}

function formatDiscordMessage(deal: MatchedDeal): string {
  return [
    `Deal match: ${deal.rule.itemType}`,
    deal.post.title,
    `Reddit: ${deal.post.permalink}`,
    `Link: ${deal.post.url}`,
  ].join('\n')
}

interface DiscordErrorPayload {
  code?: number
  message?: string
}

async function assertDiscordResponse(
  response: Response,
  action: string,
): Promise<void> {
  if (response.ok) {
    return
  }

  const rawBody = await response.text()
  let parsedError: DiscordErrorPayload | null = null

  if (rawBody) {
    try {
      parsedError = JSON.parse(rawBody) as DiscordErrorPayload
    } catch {
      parsedError = null
    }
  }

  const discordCodePart =
    parsedError?.code !== undefined ? ` discordCode=${parsedError.code}` : ''
  const discordMessagePart = parsedError?.message
    ? ` discordMessage=${parsedError.message}`
    : ''
  const responseBodyPart =
    rawBody && !parsedError ? ` responseBody=${rawBody}` : ''

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Discord permission/auth error during ${action}: ${response.status} ${response.statusText}${discordCodePart}${discordMessagePart}${responseBodyPart}`,
    )
  }

  throw new Error(
    `Discord API error during ${action}: ${response.status} ${response.statusText}${discordCodePart}${discordMessagePart}${responseBodyPart}`,
  )
}

export class DiscordDmNotifier implements Notifier {
  constructor(
    private readonly botToken: string,
    private readonly userId: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async sendDealNotification(deal: MatchedDeal): Promise<void> {
    const dmResponse = await this.fetchImpl(
      'https://discord.com/api/v10/users/@me/channels',
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipient_id: this.userId }),
      },
    )

    await assertDiscordResponse(dmResponse, 'create DM channel')

    const dmPayload = (await dmResponse.json()) as { id?: string }

    if (!dmPayload.id) {
      throw new Error('Discord API did not return a DM channel id')
    }

    const sendResponse = await this.fetchImpl(
      `https://discord.com/api/v10/channels/${dmPayload.id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: formatDiscordMessage(deal) }),
      },
    )

    await assertDiscordResponse(sendResponse, 'send DM message')
  }
}

export function createNotifier(
  config: NotifierConfig,
  fetchImpl: FetchLike = fetch,
): Notifier {
  if (config.transport === 'discord-dm') {
    return new DiscordDmNotifier(config.botToken, config.userId, fetchImpl)
  }

  throw new Error(`Unsupported notifier transport: ${JSON.stringify(config)}`)
}
