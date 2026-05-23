# Docker Hub Publishing (Maintainer Only)

This file contains owner/maintainer steps for publishing images to Docker Hub.

## Build and publish latest

```bash
docker build -t mikedidomizio/bapcsalescanada-poller:latest .
docker push mikedidomizio/bapcsalescanada-poller:latest
```

## Build and publish versioned + latest tags

```bash
docker build -t mikedidomizio/bapcsalescanada-poller:1.0.0 -t mikedidomizio/bapcsalescanada-poller:latest .
docker push mikedidomizio/bapcsalescanada-poller:1.0.0
docker push mikedidomizio/bapcsalescanada-poller:latest
```

