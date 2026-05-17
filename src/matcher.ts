import type { MatchedDeal, RedditPost, Rule } from './types'

function postTitleMatchesKeyword(title: string, keyword: string): boolean {
  return title.toLowerCase().includes(keyword.toLowerCase())
}

export function matchPostToRules(
  post: RedditPost,
  rules: Rule[],
): MatchedDeal[] {
  return rules
    .filter((rule) =>
      rule.keywords.some((keyword) =>
        postTitleMatchesKeyword(post.title, keyword),
      ),
    )
    .map((rule) => ({ post, rule }))
}
