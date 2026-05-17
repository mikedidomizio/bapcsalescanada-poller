import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { PollerState } from './types'

export async function loadLastSeenUtc(stateFilePath: string): Promise<number> {
  try {
    const content = await readFile(stateFilePath, 'utf8')
    const parsed = JSON.parse(content) as Partial<PollerState>

    if (typeof parsed.lastSeenUtc !== 'number' || parsed.lastSeenUtc < 0) {
      throw new Error('State file is missing a valid lastSeenUtc value')
    }

    return parsed.lastSeenUtc
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0
    }

    throw error
  }
}

export async function saveLastSeenUtc(
  stateFilePath: string,
  lastSeenUtc: number,
): Promise<void> {
  if (!Number.isFinite(lastSeenUtc) || lastSeenUtc < 0) {
    throw new Error('lastSeenUtc must be a non-negative finite number')
  }

  await mkdir(dirname(stateFilePath), { recursive: true })
  const nextState: PollerState = { lastSeenUtc }
  await writeFile(stateFilePath, JSON.stringify(nextState, null, 2), 'utf8')
}
