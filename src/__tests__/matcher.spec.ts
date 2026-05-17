import { describe, expect, it } from 'vitest'

import { matchPostToRules } from '../matcher'
import type { RedditPost, Rule } from '../types'

const post: RedditPost = {
  id: 'abc',
  title: '[Mouse] Logitech G Pro X Superlight',
  permalink: 'https://www.reddit.com/r/bapcsalescanada/abc',
  url: 'https://example.com/deal',
  createdUtc: 123,
}

const rules: Rule[] = [
  { itemType: 'Mouse', keywords: ['logitech'] },
  { itemType: 'GPU', keywords: ['rtx', 'geforce'] },
]

describe('matchPostToRules', () => {
  it('matches title keywords case-insensitively', () => {
    const matches = matchPostToRules(post, rules)

    expect(matches).toHaveLength(1)
    expect(matches[0]?.rule.itemType).toBe('Mouse')
  })

  it('returns empty array when no rule matches', () => {
    const matches = matchPostToRules(post, [
      { itemType: 'Keyboard', keywords: ['keychron'] },
    ])

    expect(matches).toEqual([])
  })
})
