import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { loadConfig, loadEnvFile, loadRulesFromFile } from '../config'

describe('loadConfig', () => {
  it('loads defaults and required discord variables', () => {
    const config = loadConfig({
      DISCORD_BOT_TOKEN: 'token',
      DISCORD_USER_ID: 'user',
    })

    expect(config.pollIntervalMs).toBe(900_000)
    expect(config.redditUrl).toBe(
      'https://www.reddit.com/r/bapcsalescanada/new.json',
    )
    expect(config.rulesFilePath).toBe('./data/rules.json')
    expect(config.stateFilePath).toBe('./data/state.json')
    expect(config.notifier.transport).toBe('discord-dm')
  })

  it('throws when required discord env vars are missing', () => {
    expect(() => loadConfig({ DISCORD_BOT_TOKEN: 'token' })).toThrow(
      /DISCORD_USER_ID/,
    )
  })

  it('throws for invalid poll interval', () => {
    expect(() =>
      loadConfig({
        DISCORD_BOT_TOKEN: 'token',
        DISCORD_USER_ID: 'user',
        POLL_INTERVAL_MINUTES: '0',
      }),
    ).toThrow(/POLL_INTERVAL_MINUTES/)
  })
})

describe('loadRulesFromFile', () => {
  it('loads and validates rules from json file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rules-'))
    const filePath = join(dir, 'rules.json')

    await writeFile(
      filePath,
      JSON.stringify({
        rules: [{ itemType: 'Mouse', keywords: ['razer', 'logitech'] }],
      }),
      'utf8',
    )

    const rules = await loadRulesFromFile(filePath)
    expect(rules).toEqual([
      { itemType: 'Mouse', keywords: ['razer', 'logitech'] },
    ])
  })

  it('throws on invalid rules schema', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rules-invalid-'))
    const filePath = join(dir, 'rules.json')

    await writeFile(
      filePath,
      JSON.stringify({ rules: [{ itemType: 'Mouse' }] }),
      'utf8',
    )

    await expect(loadRulesFromFile(filePath)).rejects.toThrow(/keywords/)
  })
})

describe('loadEnvFile', () => {
  it('loads env vars from a .env file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'env-file-'))
    const filePath = join(dir, '.env')
    const env: NodeJS.ProcessEnv = {}

    await writeFile(
      filePath,
      [
        '# comment',
        'DISCORD_BOT_TOKEN=test-token',
        'DISCORD_USER_ID="1234"',
        'POLL_INTERVAL_MINUTES=15',
      ].join('\n'),
      'utf8',
    )

    await loadEnvFile(filePath, env)

    expect(env.DISCORD_BOT_TOKEN).toBe('test-token')
    expect(env.DISCORD_USER_ID).toBe('1234')
    expect(env.POLL_INTERVAL_MINUTES).toBe('15')
  })

  it('does not overwrite an env var that is already set', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'env-file-existing-'))
    const filePath = join(dir, '.env')
    const env: NodeJS.ProcessEnv = { DISCORD_BOT_TOKEN: 'already-set' }

    await writeFile(filePath, 'DISCORD_BOT_TOKEN=from-file', 'utf8')
    await loadEnvFile(filePath, env)

    expect(env.DISCORD_BOT_TOKEN).toBe('already-set')
  })
})
