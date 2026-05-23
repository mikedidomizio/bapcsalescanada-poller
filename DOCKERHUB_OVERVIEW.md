# bapcsalescanada-poller

Polls `r/bapcsalescanada/new` on a schedule, matches post titles against keyword rules, and sends Discord DM alerts for matched deals.

GitHub repository: https://github.com/mikedidomizio/bapcsalescanada-poller

## What this container does

- Polls Reddit `/new.json` every `POLL_INTERVAL_MINUTES` (default: `15`)
- Loads matching rules from `/data/rules.json`
- Persists last processed timestamp to `/data/state.json`
- Sends Discord DMs using your bot token + target user ID

## Required environment variables

- `DISCORD_BOT_TOKEN` (required)
- `DISCORD_USER_ID` (required)

## Optional environment variables

- `POLL_INTERVAL_MINUTES` (default: `15`)
- `REDDIT_URL` (default: `https://www.reddit.com/r/bapcsalescanada/new.json`)
- `REDDIT_USER_AGENT` (default: `bapcsalescanada-poller/1.0`)
- `RULES_FILE_PATH` (default in container usage: `/data/rules.json`)
- `STATE_FILE_PATH` (default in container usage: `/data/state.json`)

## Prepare local data files

Create a local `data/` folder with:

- `rules.json` (your keyword rules)
- `state.json` (initial state; use `{"lastSeenUtc":0}`)

Example `rules.json`:

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

## Run from Docker Hub image

```bash
docker pull mikedidomizio/bapcsalescanada-poller:latest
docker run -d \
  --name bapcsalescanada-poller \
  --restart unless-stopped \
  -e DISCORD_BOT_TOKEN="your_bot_token" \
  -e DISCORD_USER_ID="your_discord_user_id" \
  -e POLL_INTERVAL_MINUTES="15" \
  -e REDDIT_URL="https://www.reddit.com/r/bapcsalescanada/new.json" \
  -e REDDIT_USER_AGENT="bapcsalescanada-poller/1.0" \
  -e RULES_FILE_PATH="/data/rules.json" \
  -e STATE_FILE_PATH="/data/state.json" \
  -v "$(pwd)/data:/data" \
  mikedidomizio/bapcsalescanada-poller:latest
docker logs -f bapcsalescanada-poller
```

Maintainer publishing commands are documented in `DOCKERHUB_PUBLISHING.md`.

## Optional: run with Docker Compose

```bash
docker compose up --build -d
docker compose logs -f
```

This expects a compose file that mounts `./data` to `/data` and sets required env vars.


