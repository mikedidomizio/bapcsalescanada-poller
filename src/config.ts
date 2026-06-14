import { readFile } from 'node:fs/promises'

import type { AppConfig, Rule } from './types'

const DEFAULT_REDDIT_URL = 'https://www.reddit.com/r/bapcsalescanada/new.json'
const DEFAULT_REDDIT_FALLBACK_URLS = [
  'https://old.reddit.com/r/bapcsalescanada/new.json',
]
const DEFAULT_USER_AGENT = 'bapcsalescanada-poller/1.0'
const DEFAULT_POLL_INTERVAL_MINUTES = 15
const DEFAULT_POLL_JITTER_PERCENT = 10
const DEFAULT_RULES_FILE_PATH = './data/rules.json'
const DEFAULT_STATE_FILE_PATH = './data/state.json'

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim()

  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }

  const separatorIndex = trimmed.indexOf('=')

  if (separatorIndex <= 0) {
    return null
  }

  const key = trimmed.slice(0, separatorIndex).trim()
  let value = trimmed.slice(separatorIndex + 1).trim()

  if (!key) {
    return null
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

export async function loadEnvFile(
  envFilePath = '.env',
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    const fileContent = await readFile(envFilePath, 'utf8')

    for (const line of fileContent.split(/\r?\n/)) {
      const parsed = parseEnvLine(line)

      if (!parsed) {
        continue
      }

      if (env[parsed.key] === undefined) {
        env[parsed.key] = parsed.value
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

function getRequiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

function parsePollIntervalMs(env: NodeJS.ProcessEnv): number {
  const rawValue = env.POLL_INTERVAL_MINUTES

  if (!rawValue) {
    return DEFAULT_POLL_INTERVAL_MINUTES * 60_000
  }

  const intervalMinutes = Number(rawValue)

  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error('POLL_INTERVAL_MINUTES must be a positive number')
  }

  return intervalMinutes * 60_000
}

function parseFallbackUrls(env: NodeJS.ProcessEnv): string[] {
  const rawValue = env.REDDIT_FALLBACK_URLS

  if (!rawValue) {
    return DEFAULT_REDDIT_FALLBACK_URLS
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function parsePollJitterPercent(env: NodeJS.ProcessEnv): number {
  const rawValue = env.POLL_JITTER_PERCENT

  if (!rawValue) {
    return DEFAULT_POLL_JITTER_PERCENT
  }

  const jitterPercent = Number(rawValue)

  if (
    !Number.isFinite(jitterPercent) ||
    jitterPercent < 0 ||
    jitterPercent > 100
  ) {
    throw new Error('POLL_JITTER_PERCENT must be a number between 0 and 100')
  }

  return jitterPercent
}

function validateRule(rule: unknown, index: number): Rule {
  if (!rule || typeof rule !== 'object') {
    throw new Error(`Rule at index ${index} must be an object`)
  }

  const maybeRule = rule as Partial<Rule>

  if (!maybeRule.itemType || typeof maybeRule.itemType !== 'string') {
    throw new Error(`Rule at index ${index} is missing a string itemType`)
  }

  if (!Array.isArray(maybeRule.keywords)) {
    throw new Error(`Rule at index ${index} is missing a keywords array`)
  }

  if (
    maybeRule.keywords.some(
      (keyword) => typeof keyword !== 'string' || !keyword.trim(),
    )
  ) {
    throw new Error(`Rule at index ${index} has invalid keywords`)
  }

  return {
    itemType: maybeRule.itemType,
    keywords: maybeRule.keywords.map((keyword) => keyword.trim()),
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    redditUrl: env.REDDIT_URL ?? DEFAULT_REDDIT_URL,
    redditFallbackUrls: parseFallbackUrls(env),
    redditUserAgent: env.REDDIT_USER_AGENT ?? DEFAULT_USER_AGENT,
    pollIntervalMs: parsePollIntervalMs(env),
    pollJitterPercent: parsePollJitterPercent(env),
    rulesFilePath: env.RULES_FILE_PATH ?? DEFAULT_RULES_FILE_PATH,
    stateFilePath: env.STATE_FILE_PATH ?? DEFAULT_STATE_FILE_PATH,
    notifier: {
      transport: 'discord-dm',
      botToken: getRequiredEnv(env, 'DISCORD_BOT_TOKEN'),
      userId: getRequiredEnv(env, 'DISCORD_USER_ID'),
    },
  }
}

export async function loadRulesFromFile(
  rulesFilePath: string,
): Promise<Rule[]> {
  const fileContent = await readFile(rulesFilePath, 'utf8')
  const parsedContent = JSON.parse(fileContent) as unknown

  if (!parsedContent || typeof parsedContent !== 'object') {
    throw new Error('Rules file must be a JSON object with a rules property')
  }

  const maybeRules = (parsedContent as { rules?: unknown }).rules

  if (!Array.isArray(maybeRules)) {
    throw new Error('Rules file must contain a rules array')
  }

  return maybeRules.map((rule, index) => validateRule(rule, index))
}
