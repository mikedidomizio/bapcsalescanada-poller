# AGENTS

## Development Rules

- Every code change must include or update automated tests.
- New features require unit tests for each new module and at least one integration-style flow test when orchestration is involved.
- Bug fixes require a failing test first (or in the same change) that proves the bug and prevents regressions.
- Do not merge changes if `npm test` fails.
- Run `npm run lint` after making changes to ensure code quality and consistency.