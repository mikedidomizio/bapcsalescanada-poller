import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { loadLastSeenUtc, saveLastSeenUtc } from '../state'

describe('state file io', () => {
  it('returns zero when state file does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'state-empty-'))
    const result = await loadLastSeenUtc(join(dir, 'state.json'))

    expect(result).toBe(0)
  })

  it('saves and loads lastSeenUtc', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'state-save-'))
    const filePath = join(dir, 'state.json')

    await saveLastSeenUtc(filePath, 456)
    const loaded = await loadLastSeenUtc(filePath)
    const content = await readFile(filePath, 'utf8')

    expect(loaded).toBe(456)
    expect(content).toContain('lastSeenUtc')
  })
})
