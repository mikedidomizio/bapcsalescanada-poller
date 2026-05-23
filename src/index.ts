import { loadConfig, loadEnvFile, loadRulesFromFile } from './config'
import { matchPostToRules } from './matcher'
import { createNotifier, type Notifier } from './notifier'
import { fetchNewPosts } from './reddit'
import { loadLastSeenUtc, saveLastSeenUtc } from './state'
import type { AppConfig, RedditPost, Rule } from './types'

export interface PollerDeps {
  fetchPosts: () => Promise<RedditPost[]>
  loadRules: () => Promise<Rule[]>
  loadLastSeenUtc: () => Promise<number>
  saveLastSeenUtc: (lastSeenUtc: number) => Promise<void>
  notifier: Notifier
}

export interface PollCycleResult {
  scannedPosts: number
  matchedDeals: number
  lastSeenUtc: number
}

function formatLastScanIso(lastSeenUtc: number): string {
  if (!Number.isFinite(lastSeenUtc) || lastSeenUtc < 0) {
    return 'invalid'
  }

  if (lastSeenUtc === 0) {
    return 'never'
  }

  return new Date(lastSeenUtc * 1000).toISOString()
}

function sanitizeConfigForLog(config: AppConfig): AppConfig {
  return {
    ...config,
    notifier: {
      ...config.notifier,
      botToken: '[redacted]',
    },
  }
}

export function formatStartupLog(config: AppConfig, lastSeenUtc: number): string {
  const sanitizedConfig = sanitizeConfigForLog(config)
  const lastScanIso = formatLastScanIso(lastSeenUtc)

  return `[startup] config=${JSON.stringify(sanitizedConfig)} lastScanUtc=${lastSeenUtc} lastScanIso=${lastScanIso}`
}

export async function runPollCycle(deps: PollerDeps): Promise<PollCycleResult> {
  const lastSeenUtc = await deps.loadLastSeenUtc()
  const posts = await deps.fetchPosts()
  const newPosts = posts
    .filter((post) => post.createdUtc > lastSeenUtc)
    .sort((left, right) => left.createdUtc - right.createdUtc)

  if (newPosts.length === 0) {
    return {
      scannedPosts: 0,
      matchedDeals: 0,
      lastSeenUtc,
    }
  }

  const rules = await deps.loadRules()
  let matchedDeals = 0

  for (const post of newPosts) {
    const matches = matchPostToRules(post, rules)

    for (const deal of matches) {
      await deps.notifier.sendDealNotification(deal)
      matchedDeals += 1
    }
  }

  const nextLastSeenUtc = Math.max(...newPosts.map((post) => post.createdUtc))
  await deps.saveLastSeenUtc(nextLastSeenUtc)

  return {
    scannedPosts: newPosts.length,
    matchedDeals,
    lastSeenUtc: nextLastSeenUtc,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function runForever(): Promise<void> {
  await loadEnvFile()
  const config = loadConfig()
  const startupLastSeenUtc = await loadLastSeenUtc(config.stateFilePath)
  console.log(formatStartupLog(config, startupLastSeenUtc))
  const notifier = createNotifier(config.notifier)

  const deps: PollerDeps = {
    fetchPosts: () => fetchNewPosts(config.redditUrl, config.redditUserAgent),
    loadRules: () => loadRulesFromFile(config.rulesFilePath),
    loadLastSeenUtc: () => loadLastSeenUtc(config.stateFilePath),
    saveLastSeenUtc: (lastSeenUtc) =>
      saveLastSeenUtc(config.stateFilePath, lastSeenUtc),
    notifier,
  }

  // Run immediately on startup, then keep polling at the configured interval.
  while (true) {
    const result = await runPollCycle(deps)
    console.log(
      `[poll-cycle] scanned=${result.scannedPosts} matched=${result.matchedDeals} lastSeenUtc=${result.lastSeenUtc}`,
    )
    await sleep(config.pollIntervalMs)
  }
}

if (require.main === module) {
  runForever().catch((error) => {
    console.error('[fatal] poller exited with an error', error)
    process.exitCode = 1
  })
}
