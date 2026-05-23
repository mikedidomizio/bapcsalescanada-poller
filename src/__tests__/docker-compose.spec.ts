import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('docker compose image tagging', () => {
  it('pins a single image name instead of the default project-service pattern', async () => {
    const composePath = resolve(process.cwd(), 'docker-compose.yml')
    const composeText = await readFile(composePath, 'utf8')

    expect(composeText).toContain('image: bapcsalescanada-poller:latest')
  })
})
