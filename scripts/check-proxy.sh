#!/usr/bin/env bash
# Checks, on a throwaway Docker stack (docker/proxy-check/), two things about docker/nginx.conf:
#   1. which client address reaches the API's recovery rate limiter, with the realip stanza on (behind a
#      trusted front proxy) and off (as committed), including forged X-Forwarded-For and X-Real-IP;
#   2. that nginx's access and error logs never hold the GitHub callback's code or state, and that
#      ordinary /api/ upstream errors are still logged.
# The front proxy is a plain-HTTP stand-in for the production HTTPS terminator: TLS itself is not exercised.
# Usage: bash scripts/check-proxy.sh   (needs Docker; tears everything down on exit)
set -euo pipefail
cd "$(dirname "$0")/.."

P=jifunze-proxycheck
IMG=nginxinc/nginx-unprivileged:stable-alpine
dc() { docker compose -p "$P" -f docker/proxy-check/compose.yaml "$@"; }
fails=0
clients=()
cleanup() {
  for c in "${clients[@]}"; do docker rm -f "$c" >/dev/null 2>&1 || true; done
  dc down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

RECOVERY_PEPPER_V1=$(head -c 32 /dev/urandom | base64)
export RECOVERY_PEPPER_V1

# A learner: a long-lived curl container at a fixed address on one network.
client() { # client <name> <network> <ip>
  docker rm -f "$P-$1" >/dev/null 2>&1 || true
  docker run -d --name "$P-$1" --network "${P}_$2" --ip "$3" --entrypoint sleep "$IMG" infinity >/dev/null
  clients+=("$P-$1")
}
# The printed status is the result; curl's own exit code is ignored (000 means no response). Under Git Bash
# curl in docker exec can exit 23 after writing a correct status.
# Prints the HTTP status of one recovery attempt with a wrong code. Extra args go to curl (headers).
attempt() { # attempt <client> <host> [curl args...]
  local c=$1 host=$2
  shift 2
  docker exec "$P-$c" curl -s -o /dev/null -w '%{http_code}' -X POST \
    -H 'Origin: http://localhost:8080' -H 'X-Jifunze: 1' -H 'Content-Type: application/json' \
    --data '{"code":"ABCD-EFGH-IJKL-MNOP"}' "$@" "http://$host:8080/api/auth/recovery" || true
}
get() { # get <client> <url> [curl args...]
  local c=$1 url=$2
  shift 2
  docker exec "$P-$c" curl -s -o /dev/null -w '%{http_code}' "$@" "$url" || true
}
expect() { # expect <label> <want> <got>
  if [ "$2" = "$3" ]; then echo "  ok   $1 → $3"; else echo "  FAIL $1 → $3 (want $2)"; fails=$((fails + 1)); fi
}
up() { # up <realip.conf|no-realip.conf>: fresh API (empty rate-limit buckets) and web with that config
  REALIP_CONF=./$1 dc up -d --wait --force-recreate api web front >/dev/null
  docker exec "$P-a" sh -c 'for i in $(seq 60); do curl -sf -o /dev/null http://10.231.1.2:8080/api/health && exit 0; sleep 1; done; exit 1'
}

echo "Building and starting the stack…"
dc build -q api
dc up -d --wait postgres >/dev/null
REALIP_CONF=./no-realip.conf dc up -d --no-start web front >/dev/null # creates the networks
client a edge 10.231.1.10   # learner A
client b edge 10.231.1.11   # learner B, same /24 as A
client c edge2 10.231.3.10  # learner C, another network
client d mid 10.231.2.50    # reaches web directly, bypassing the front proxy (untrusted peer)
F=10.231.1.2  # front, as learners A and B see it
F2=10.231.3.2 # front, as learner C sees it
W=10.231.2.3  # web, directly

echo "1. realip on, trusting only the front proxy"
up realip.conf
for i in 1 2 3 4 5; do expect "A attempt $i" 401 "$(attempt a $F)"; done
expect "A attempt 6 (A's own limit)" 429 "$(attempt a $F)"
expect "B, same /24, different learner" 401 "$(attempt b $F)"
expect "C, another network" 401 "$(attempt c $F2)"
expect "B forging X-Forwarded-For as A" 401 "$(attempt b $F -H 'X-Forwarded-For: 10.231.1.10')"
expect "A forging X-Forwarded-For and X-Real-IP" 429 \
  "$(attempt a $F -H 'X-Forwarded-For: 10.231.1.99' -H 'X-Real-IP: 10.231.1.98')"
for i in 1 2 3 4 5; do _=$(attempt d $W -H 'X-Forwarded-For: 10.231.3.10'); done
expect "D (untrusted peer) forging X-Forwarded-For as C, 6th" 429 "$(attempt d $W -H 'X-Forwarded-For: 10.231.3.10')"
expect "C unaffected by D's forgery" 401 "$(attempt c $F2)"

echo "2. realip off (as committed) behind the same proxy: the hazard the deployment gate guards against"
up no-realip.conf
for i in 1 2 3 4 5; do _=$(attempt a $F); done
expect "A attempt 6" 429 "$(attempt a $F)"
expect "C, another network, now shares A's bucket" 429 "$(attempt c $F2)"
# A different forged address each time: if nginx passed them on, no attempt would ever reach a limit.
for i in 1 2 3 4 5; do _=$(attempt d $W -H "X-Real-IP: 10.231.9.$i"); done
expect "D forging a new X-Real-IP each time, 6th (nginx overwrites it)" 429 "$(attempt d $W -H 'X-Real-IP: 10.231.9.6')"

echo "3. logs (realip on)"
up realip.conf
expect "callback with code and state" 302 "$(get a "http://$F:8080/api/auth/github/callback?code=PCSECRETCODE1&state=PCSECRETSTATE1")"
expect "reauth callback" 302 "$(get a "http://$F:8080/api/auth/github/callback/reauth?code=PCSECRETCODE2&state=PCSECRETSTATE2")"
# The callbacks' own location inherits /api/'s headers: one Referrer-Policy (the API's is hidden) and the snippet.
hdrs=$(docker exec "$P-a" curl -s -o /dev/null -D - "http://$F:8080/api/auth/github/callback?code=x&state=y" || true)
expect "callback response has exactly one Referrer-Policy and the security headers" "1 1 1" \
  "$(printf '%s' "$hdrs" | grep -ci '^referrer-policy:') $(printf '%s' "$hdrs" | grep -ci '^x-content-type-options: nosniff') $(printf '%s' "$hdrs" | grep -ci "^content-security-policy: frame-ancestors 'none'")"
big=$(head -c 9000 /dev/zero | tr '\0' 'x')
# Sent straight to web: the front proxy would reject it first, and it logs nothing.
expect "callback rejected by nginx itself (oversized header)" 400 \
  "$(get d "http://$W:8080/api/auth/github/callback?code=PCSECRETCODE3&state=PCSECRETSTATE3" -H "X-Big: $big")"
dc stop api >/dev/null
sleep 11 # past the resolver's valid=10s, so nginx re-resolves "api" and fails fast instead of timing out
expect "callback while the API is down" 502 "$(get a "http://$F:8080/api/auth/github/callback/replace?code=PCSECRETCODE4&state=PCSECRETSTATE4")"
expect "another /api/ route while the API is down" 502 "$(get a "http://$F:8080/api/me?probe=pc-visible")"
web_logs=$(dc logs --no-log-prefix web 2>&1)
api_logs=$(dc logs --no-log-prefix api 2>&1)
if printf '%s\n%s' "$web_logs" "$api_logs" | grep -q PCSECRET; then
  expect "no code or state in nginx or API logs" "none" "found"
  printf '%s\n' "$web_logs" "$api_logs" | grep PCSECRET | sed 's/x\{20,\}/x…/; s/^/       /'
else
  expect "no code or state in nginx or API logs" "none" "none"
fi
expect "access log keeps the /24 only" "yes" \
  "$(printf '%s' "$web_logs" | grep -q '^10\.231\.1\.0 ' && ! printf '%s' "$web_logs" | grep -q '^10\.231\.1\.10 ' && echo yes || echo no)"
expect "upstream error for /api/me is in the error log" "yes" \
  "$(printf '%s' "$web_logs" | grep -q '\[error\].*/api/me' && echo yes || echo no)"
if [ -n "${CHECK_PROXY_DUMP:-}" ]; then
  echo "  web log lines for phase 3 (start-up and health checks left out):"
  printf '%s\n' "$web_logs" | grep -v '/api/health\|docker-entrypoint\|nginx/1\.\|start worker\|using the' | sed 's/x\{20,\}/x…/; s/^/       /'
fi
echo "  note: nginx error lines carry the full client address (client: …), which nginx cannot truncate:"
printf '%s\n' "$web_logs" | grep '\[error\]' | sed 's/^/       /' | head -3

echo
if [ "$fails" -eq 0 ]; then echo "check-proxy: all checks passed"; else echo "check-proxy: $fails check(s) failed"; exit 1; fi
