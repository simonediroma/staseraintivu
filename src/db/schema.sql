-- staseraintivu — Schema PostgreSQL (Neon)
--
-- Eseguito da scripts/migrate.ts. Idempotente: tutto IF NOT EXISTS,
-- sicuro da rieseguire su un DB già popolato.
-- Deve corrispondere esattamente a docs/architecture.md.

CREATE TABLE IF NOT EXISTS canonical_channels (
  id          TEXT PRIMARY KEY,           -- slug: "rai-1"
  lcn         INTEGER UNIQUE,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS channel_aliases (
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  canonical_id TEXT NOT NULL REFERENCES canonical_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (source, source_id)
);

CREATE TABLE IF NOT EXISTS unresolved_channels (
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  display_name TEXT NOT NULL,
  suggestions  JSONB NOT NULL DEFAULT '[]',
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_id)
);

CREATE TABLE IF NOT EXISTS programmes (
  channel_id   TEXT NOT NULL REFERENCES canonical_channels(id) ON DELETE CASCADE,
  start_at     TIMESTAMPTZ NOT NULL,
  stop_at      TIMESTAMPTZ,
  title        TEXT NOT NULL,
  sub_title    TEXT,
  descr        TEXT,
  categories   TEXT[] NOT NULL DEFAULT '{}',
  icon_url     TEXT,
  episode_num  TEXT,
  search_vec   TSVECTOR GENERATED ALWAYS AS (
                 to_tsvector('italian', coalesce(title,'') || ' ' || coalesce(descr,''))
               ) STORED,
  PRIMARY KEY (channel_id, start_at)
);

CREATE INDEX IF NOT EXISTS idx_programmes_start   ON programmes (start_at);
CREATE INDEX IF NOT EXISTS idx_programmes_channel ON programmes (channel_id, start_at);
CREATE INDEX IF NOT EXISTS idx_programmes_search  ON programmes USING GIN (search_vec);
