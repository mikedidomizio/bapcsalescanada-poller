import { exec } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execAsync = promisify(exec)

async function listFilesRecursively(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        return listFilesRecursively(fullPath)
      }

      return [fullPath]
    }),
  )

  return nested.flat()
}

describe('production TypeScript build', () => {
  it('emits JavaScript files without declaration files', async () => {
    await execAsync('npm run build', { cwd: process.cwd() })

    const distPath = resolve(process.cwd(), 'dist')
    const emittedFiles = await listFilesRecursively(distPath)

    expect(emittedFiles.some((filePath) => filePath.endsWith('.js'))).toBe(true)
    expect(emittedFiles.some((filePath) => filePath.endsWith('.d.ts'))).toBe(
      false,
    )
  })
})
