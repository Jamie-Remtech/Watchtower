#!/usr/bin/env sh
# Watchtower ADS-B feeder — sends what your receiver hears to Watchtower.
# Works with readsb, dump1090-fa and tar1090 (any of them writes aircraft.json).
#
#   WATCHTOWER_KEY=<your link key> sh adsb-feeder.sh
#
# Optional: AIRCRAFT_JSON=/path/or/url  INTERVAL=2
# Runs until stopped. To run at boot, see the instructions in Watchtower
# (Settings → Air links) for the one-line systemd install.
set -u
: "${WATCHTOWER_KEY:?set WATCHTOWER_KEY to the key Watchtower showed you}"
ENDPOINT="${WATCHTOWER_ENDPOINT:-https://lamezbfkdnzztpmwimoz.supabase.co/functions/v1/air-ingest}"
ANON="${WATCHTOWER_ANON:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbWV6YmZrZG56enRwbXdpbW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTcyNzUsImV4cCI6MjEwMTU5MzI3NX0.n79p2rk0w_TQUU2QTLnM5s3sJvpAHExNz4rkPCo6D20}"
INTERVAL="${INTERVAL:-2}"

find_source() {
  for f in /run/readsb/aircraft.json /run/dump1090-fa/aircraft.json /run/dump1090/aircraft.json \
           /run/adsbexchange-feed/aircraft.json /usr/share/dump1090-fa/html/data/aircraft.json; do
    [ -r "$f" ] && { echo "$f"; return; }
  done
  for u in http://127.0.0.1/tar1090/data/aircraft.json http://127.0.0.1:8080/data/aircraft.json http://127.0.0.1/dump1090/data/aircraft.json; do
    curl -fsS -m 2 "$u" >/dev/null 2>&1 && { echo "$u"; return; }
  done
}
SRC="${AIRCRAFT_JSON:-$(find_source)}"
[ -n "$SRC" ] || { echo "No aircraft.json found — is readsb / dump1090 running? Set AIRCRAFT_JSON."; exit 1; }
echo "Watchtower feeder: reading $SRC every ${INTERVAL}s"

while :; do
  case "$SRC" in
    http*) DATA="$(curl -fsS -m 3 "$SRC")" ;;
    *)     DATA="$(cat "$SRC" 2>/dev/null)" ;;
  esac
  if [ -n "${DATA:-}" ]; then
    printf '%s' "$DATA" | curl -fsS -m 8 -X POST "$ENDPOINT" \
      -H "Content-Type: application/json" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
      -H "x-watchtower-key: $WATCHTOWER_KEY" --data-binary @- >/dev/null 2>&1 \
      || echo "$(date -u +%H:%M:%S) send failed (will retry)"
  fi
  sleep "$INTERVAL"
done
