export interface Rule {
  itemType: string
  keywords: string[]
}

export interface RedditPost {
  id: string
  title: string
  permalink: string
  url: string
  createdUtc: number
}

export interface PollerState {
  lastSeenUtc: number
}

export interface DiscordDmConfig {
  transport: 'discord-dm'
  botToken: string
  userId: string
}

export type NotifierConfig = DiscordDmConfig

export interface AppConfig {
  redditUrl: string
  redditUserAgent: string
  pollIntervalMs: number
  rulesFilePath: string
  stateFilePath: string
  notifier: NotifierConfig
}

export interface MatchedDeal {
  post: RedditPost
  rule: Rule
}
