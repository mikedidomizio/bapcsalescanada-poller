# bapcsalescanada Poller

Polls `https://www.reddit.com/r/bapcsalescanada/new.json` every 15 minutes, 
matches post titles against keyword rules, and sends Discord DM alerts to a target user ID.

## How it works

- Pulls latest posts from Reddit `/new.json`
- Tracks `created_utc` in `state.json` so only newer posts are scanned next cycle
- Loads title keyword rules from a JSON file (`rules.json`)
- Sends a Discord DM for each matching rule/post
- Throws an error immediately on Discord auth/permission failures (no retry)

## Rules file format

`data/rules.json`:

```json
{
  "rules": [
	{
	  "itemType": "Mouse",
	  "keywords": ["mouse", "logitech", "razer"]
	}
  ]
}
```

Matching is case-insensitive and checks keywords against the Reddit post title.

## Discord bot setup (DM)

1. Create a Discord application and bot in the Discord Developer Portal.
2. Copy the bot token and set `DISCORD_BOT_TOKEN`.
3. Get your user ID (Discord Developer Mode) and set `DISCORD_USER_ID`.
4. Ensure the bot can DM your account (privacy settings and mutual server as needed).

## Local run

```bash
npm install
cp .env.example .env
npm run build
npm run start
```

`npm run start` auto-loads values from `.env` (if the file exists).

Environment variables:

- `DISCORD_BOT_TOKEN` (required)
- `DISCORD_USER_ID` (required)
- `POLL_INTERVAL_MINUTES` (optional, default `15`)
- `REDDIT_URL` (optional, default subreddit URL)
- `REDDIT_USER_AGENT` (optional)
- `RULES_FILE_PATH` (optional, default `./data/rules.json`)
- `STATE_FILE_PATH` (optional, default `./data/state.json`)

For Docker runs, `docker-compose.yml` sets these to `/data/rules.json` and `/data/state.json` in-container.

For non-container local runs, the defaults already point to the project `data` folder. You can still override them if needed:

- `RULES_FILE_PATH=./data/rules.json`
- `STATE_FILE_PATH=./data/state.json`

## Docker run

```bash
cp .env.example .env
docker compose up --build -d
docker compose logs -f
```

`docker-compose.yml` mounts `./data` to `/data`, so rule and state files persist and are editable without rebuilding.

## Docker docs

- Docker Hub image page: https://hub.docker.com/r/mikedidomizio/bapcsalescanada-poller
- User-facing Docker Hub overview: `DOCKERHUB_OVERVIEW.md`
- Maintainer publishing notes: `DOCKERHUB_PUBLISHING.md`

## Tests

```bash
npm test
```
