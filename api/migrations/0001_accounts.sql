create table accounts (
  id uuid primary key default gen_random_uuid(),
  preferred_lang text not null default 'sw' check (preferred_lang in ('sw','en')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  recovery_codes_issued_at timestamptz   -- null until the initial codes are shown
);

create table identities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  provider text not null check (provider in ('github','nostr')),
  provider_uid text not null,          -- GitHub numeric user id (stable) | Nostr hex pubkey
  handle text,                         -- GitHub login (can change; refreshed) | null for Nostr
  avatar_url text,                     -- GitHub only (avatars.githubusercontent.com)
  linked_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  revoked_at timestamptz,              -- GitHub app authorization revoked (webhook)
  unique (provider, provider_uid),     -- one identity can belong to one account only
  unique (account_id, provider)        -- one GitHub and one Nostr per account (Phase 3)
);

create table sessions (
  token_hash bytea primary key,        -- sha256 of a 32-byte random token; the token lives only in the cookie
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,     -- absolute 30 days; idle timeout 14 days
  reauth_at timestamptz not null default now(),  -- for sensitive actions (unlink, delete)
  user_agent text,
  revoked_at timestamptz,
  scope text not null check (scope in ('full','recovery'))
);

create table auth_challenges (         -- single-use OAuth state and Nostr challenges
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('signin','link','reauth','replace')),
  provider text not null check (provider in ('github','nostr')),
  secret_hash bytea not null,          -- OAuth state or Nostr nonce, hashed
  pkce_verifier text,                  -- GitHub only; server-side, never sent to the browser
  account_id uuid references accounts(id) on delete cascade,  -- set for 'link', 'reauth' and 'replace'
  binding_hash bytea not null,         -- sha256 of the pre-auth cookie value: ties the flow to one browser
  lang text not null check (lang in ('sw','en')),
  return_to text not null,             -- validated relative path under /sw/ or /en/
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,     -- 10 minutes (GitHub) | 5 minutes (Nostr)
  used_at timestamptz,
  session_token_hash bytea,            -- initiating session; required for every purpose except 'signin'
  check ((purpose = 'signin') = (session_token_hash is null))
);

create unique index auth_challenges_secret_hash_key on auth_challenges (secret_hash);

create table security_events (         -- sign-in, link, unlink, delete; kept 90 days
  id bigserial primary key,
  account_id uuid references accounts(id) on delete set null,  -- null after deletion
  event text not null,
  at timestamptz not null default now(),
  detail jsonb not null default '{}'   -- no tokens, no IPs beyond a /24 prefix
);

create table recovery_codes (
  code_hash bytea primary key,                  -- HMAC-SHA256(pepper_vN, normalised code); globally unique
  pepper_version smallint not null,
  account_id uuid not null references accounts(id) on delete cascade,
  set_id uuid not null,                         -- regenerating replaces the whole set
  created_at timestamptz not null default now(),
  used_at timestamptz
);
