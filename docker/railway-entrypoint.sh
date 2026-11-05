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
case "${TRUSTED_PROXY_CIDRS:-}" in *[!0-9a-fA-F:./\ ]*) fail 'invalid TRUSTED_PROXY_CIDRS characters' ;; esac
if [ "${STAGING_AUTH_ENABLED:-0}" = 1 ]; then
  [ -n "${TRUSTED_PROXY_CIDRS:-}" ] || fail 'verified TRUSTED_PROXY_CIDRS required before authentication'
fi

security=/tmp/jifunze-security-headers.conf
cat /etc/nginx/snippets/security-headers.conf > "$security"
printf '\nadd_header X-Robots-Tag "noindex, nofollow" always;\n' >> "$security"

extra=/tmp/jifunze-railway-server.conf
: > "$extra"
printf '%s\n' "include $security;" 'add_header Cache-Control "no-store" always;' 'absolute_redirect off;' >> "$extra"
if [ "${STAGING_AUTH_ENABLED:-0}" = 0 ]; then
  # Static learning and health remain available before edge/header/logging acceptance.
  printf '%s\n' 'if ($uri ~ "^/api/(?!health$|internal/)") { return 503; }' >> "$extra"
else
  printf '%s\n' 'if ($railway_api_untrusted) { return 403; }' >> "$extra"
fi

conf=/tmp/jifunze-railway.conf
{
  printf '%s\n' 'geo $realip_remote_addr $railway_trusted_peer {' '  default 0;'
  for cidr in ${TRUSTED_PROXY_CIDRS:-}; do
    case "$cidr" in */*)
      bits=${cidr##*/}
      case "$bits" in ''|*[!0-9]*) fail 'invalid proxy prefix length' ;; esac
      case "${cidr%/*}" in
        *:*) [ "$bits" -ge 64 ] && [ "$bits" -le 128 ] || fail 'proxy IPv6 ranges must be /64 or narrower' ;;
        *) [ "$bits" -ge 24 ] && [ "$bits" -le 32 ] || fail 'proxy IPv4 ranges must be /24 or narrower' ;;
      esac ;;
    esac
    printf '  %s 1;\n' "$cidr"
  done
  printf '%s\n' '}' 'real_ip_header X-Real-IP;' 'real_ip_recursive off;'
  for cidr in ${TRUSTED_PROXY_CIDRS:-}; do printf 'set_real_ip_from %s;\n' "$cidr"; done
  printf '%s\n' 'map "$railway_trusted_peer:$uri" $railway_api_untrusted {' '  default 0;' '  "~^0:/api/(?!health$|internal/)" 1;' '}'
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
