-- Server copy of a learner's progress: one row per account and lesson. Additive only.
-- The device copy stays the one the site reads; this table follows it through a merge that only ever adds.
-- No answers, discussion text, reading time, language or device data.
create table lesson_progress (
  account_id   uuid not null references accounts(id) on delete cascade,
  lesson_key   text not null check (lesson_key ~ '^(savers|builders|lightning)/[a-z0-9-]{1,80}$'),  -- roadmap/slug: language independent
  completed_at timestamptz,
  reflected_at timestamptz,            -- discussion self-confirmation; never the discussion itself
  quiz_correct smallint check (quiz_correct >= 0),
  quiz_total   smallint check (quiz_total <= 1000),
  quiz_at      timestamptz,
  lab_passed   text[] not null default '{}' check (cardinality(lab_passed) <= 100),
  updated_at   timestamptz not null default now(),
  primary key (account_id, lesson_key),
  check (quiz_correct <= quiz_total),
  check ((quiz_correct is null) = (quiz_total is null) and (quiz_correct is null) = (quiz_at is null))
);
