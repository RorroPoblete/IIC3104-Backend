#!/usr/bin/env sh
set -e

COMMAND=${1:-up}

case "$COMMAND" in
  up)
    docker compose up --build -d
    ;;
  down)
    docker compose down
    ;;
  clean)
    docker compose down -v --rmi local --remove-orphans
    ;;
  *)
    echo "Uso: $0 {up|down|clean}" >&2
    exit 1
    ;;
esac
