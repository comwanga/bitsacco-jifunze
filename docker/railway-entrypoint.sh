#!/bin/sh
# Railway-only adaptation of the reviewed Compose config. The ordinary Compose image is unchanged.
set -eu
[ "${JIFUNZE_HOSTING:-}" = railway ] || exit 0

fail() { echo "Railway nginx configuration: $1" >&2; exit 1; }
port() {
  case "$1" in ''|*[!0-9]*) return 1 ;; esac
  [ "$1" -gt 0 ] && [ "$1" -le 65535 ]
}
port "${PORT:-8080}" || fail 'invalid PORT'
port "${API_PORT:-3001}" || fail 'invalid API_PORT'
printf '%s\n' "${API_HOST:-}" | grep -Eq '^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.railway\.internal$' || fail 'API_HOST must be a Railway private domain'
# The base image's 15-local-resolvers.envsh reads the actual /etc/resolv.conf, including IPv6.
[ -n "${NGINX_LOCAL_RESOLVERS:-}" ] || fail 'set NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1'
case "${STAGING_AUTH_ENABLED:-0}" in 0|1) ;; *) fail 'invalid STAGING_AUTH_ENABLED' ;; esac
[ -z "${TRUSTED_PROXY_CIDRS:-}" ] || fail 'Railway has no verified ingress CIDRs; remove TRUSTED_PROXY_CIDRS'
# Validated before use: the hostname goes into the nginx configuration below.
printf '%s\n' "${SITE_ORIGIN:-}" | grep -Eq '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?$' || fail 'SITE_ORIGIN must be an exact HTTPS origin'
canonical_host=${SITE_ORIGIN#https://}
case "${RAILWAY_TRUST_MODEL:-}" in
  '') [ "${STAGING_AUTH_ENABLED:-0}" = 0 ] || fail 'explicit isolated-staging trust model required' ;;
  isolated-staging)
    [ "${RAILWAY_ENVIRONMENT_NAME:-}" = staging ] || fail 'trust model is restricted to staging'
    ;;
  *) fail 'unknown RAILWAY_TRUST_MODEL' ;;
esac

security=/tmp/jifunze-security-headers.conf
cat /etc/nginx/snippets/security-headers.conf > "$security"
# This host only and short-lived: no includeSubDomains or preload, which would outlast staging.
printf '\nadd_header X-Robots-Tag "noindex, nofollow" always;\nadd_header Strict-Transport-Security "max-age=86400" always;\n' >> "$security"

extra=/tmp/jifunze-railway-server.conf
: > "$extra"
printf '%s\n' "include $security;" 'add_header Cache-Control "no-store" always;' 'absolute_redirect off;' >> "$extra"
cat >> "$extra" <<'NGINX'
# Authentication exists only on the canonical origin. The generated hostname keeps public pages and health; the
# rewrite drops the query string, so a callback's code and state are not logged either.
if ($railway_api_wrong_host) { rewrite ^ /api/internal/wrong-host? last; }
set $railway_client_valid $railway_header_shape;
# realip runs before server rewrite. An unchanged socket address means parsing
# failed (or is unverifiable); never fall back to one shared rate-limit bucket.
if ($remote_addr = $realip_remote_addr) { set $railway_client_valid 0; }
if ($http_x_forwarded_proto != https) { set $railway_client_valid 0; }
NGINX
if [ "${STAGING_AUTH_ENABLED:-0}" = 0 ]; then
  # Static learning and health remain available before edge/header/logging acceptance.
  printf '%s\n' 'if ($uri ~ "^/api/(?!health$|internal/)") { return 503; }' >> "$extra"
else
  printf '%s\n' 'if ($railway_api_invalid) { return 403; }' >> "$extra"
fi

conf=/tmp/jifunze-railway.conf
{
  # These are deliberately ALL peers, not an exclusive Railway edge allowlist.
  # The operator explicitly trusts every private co-tenant in this staging env.
  # Header validation does not authenticate the edge; see the deployment decision.
  if [ "${RAILWAY_TRUST_MODEL:-}" = isolated-staging ]; then
    printf '%s\n' 'set_real_ip_from 0.0.0.0/0;' 'set_real_ip_from ::/0;' 'real_ip_header X-Real-IP;' 'real_ip_recursive off;'
  fi
  printf 'map $host $railway_canonical_host {\n  default 0;\n  "%s" 1;\n}\n' "$canonical_host"
  cat <<'NGINX'
map "$railway_canonical_host:$uri" $railway_api_wrong_host {
  default 0;
  "~^0:/api/(?!health$|internal/)" 1;
}
map $http_x_real_ip $railway_header_shape {
  default 0;
  "~^(?:0|[1-9][0-9]{0,2})(?:[.](?:0|[1-9][0-9]{0,2})){3}$" 1;
  "~^[0-9A-Fa-f:]*:[0-9A-Fa-f:]*$" 1;
  "~^[0-9A-Fa-f:]+:(?:0|[1-9][0-9]{0,2})(?:[.](?:0|[1-9][0-9]{0,2})){3}$" 1;
}
map "$railway_client_valid:$uri" $railway_api_invalid {
  default 0;
  "~^0:/api/(?!health$|internal/)" 1;
}
NGINX
  sed \
    -e "s/listen 8080;/listen ${PORT:-8080};\n  listen [::]:${PORT:-8080};/" \
    -e "s/resolver 127.0.0.11 valid=10s ipv6=off;/resolver ${NGINX_LOCAL_RESOLVERS} valid=10s ipv4=off;/" \
    -e "s|set \$api http://api:3001;|set \$api http://${API_HOST}:${API_PORT:-3001};|" \
    -e "s|/etc/nginx/snippets/security-headers.conf|$security|g" \
    -e '/server_tokens off;/a\  include /tmp/jifunze-railway-server.conf;' \
    -e '/access_log \/var\/log\/nginx\/access.log api_redacted;/a\    add_header Cache-Control "no-store" always;' \
    -e '/proxy_set_header X-Real-IP \$remote_addr;/a\    proxy_set_header X-Forwarded-For "";\n    proxy_set_header Forwarded "";\n    proxy_set_header X-Forwarded-Proto https;\n    proxy_hide_header Cache-Control;\n    proxy_connect_timeout 3s;' \
    /etc/nginx/jifunze-base.conf
} > "$conf"
cat "$conf" > /etc/nginx/conf.d/default.conf
nginx -t
