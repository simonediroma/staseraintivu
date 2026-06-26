import pg from 'pg';
import {
  ChannelResolver,
  CANONICAL_SEED,
  ALIAS_SEED,
  type CanonicalChannel,
  type ChannelAlias,
  type ResolveResult,
} from './channel-alias.js';

const { Pool } = pg;

export const CHANNEL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS canonical_channels (
  id       TEXT PRIMARY KEY,
  lcn      INTEGER UNIQUE,
  name     TEXT NOT NULL,
  logo_url TEXT
);

CREATE TABLE IF NOT EXISTS channel_aliases (
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  canonical_id TEXT NOT NULL REFERENCES canonical_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (source, source_id)
);

-- Coda di revisione: canali che il risolutore non ha mappato con certezza.
-- Un umano li approva (→ diventano alias) oppure crea un nuovo canonical.
CREATE TABLE IF NOT EXISTS unresolved_channels (
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  display_name TEXT NOT NULL,
  suggestions  JSONB NOT NULL DEFAULT '[]',
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_id)
);
`;

export class ChannelStore {
  private pool: pg.Pool;

  constructor(connectionString = process.env.DATABASE_URL) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(CHANNEL_SCHEMA_SQL);
  }

  /** Carica il seed solo se le tabelle sono vuote (idempotente). */
  async seedIfEmpty(): Promise<void> {
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS n FROM canonical_channels');
    if (rows[0].n > 0) return;

    for (const c of CANONICAL_SEED) {
      await this.pool.query(
        `INSERT INTO canonical_channels (id, lcn, name, logo_url)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.lcn, c.name, c.logoUrl ?? null]
      );
    }
    for (const a of ALIAS_SEED) {
      await this.pool.query(
        `INSERT INTO channel_aliases (source, source_id, canonical_id)
         VALUES ($1, $2, $3) ON CONFLICT (source, source_id) DO NOTHING`,
        [a.source, a.sourceId, a.canonicalId]
      );
    }
  }

  /** Costruisce un risolutore in memoria a partire dallo stato del DB. */
  async buildResolver(): Promise<ChannelResolver> {
    const canon = await this.pool.query<CanonicalChannel & { logo_url: string | null }>(
      'SELECT id, lcn, name, logo_url FROM canonical_channels'
    );
    const aliases = await this.pool.query<ChannelAlias>(
      'SELECT source, source_id AS "sourceId", canonical_id AS "canonicalId" FROM channel_aliases'
    );
    const canonicals = canon.rows.map((c) => ({
      id: c.id, lcn: c.lcn, name: c.name, logoUrl: c.logo_url ?? undefined,
    }));
    return new ChannelResolver(canonicals, aliases.rows);
  }

  /** Registra/aggiorna un canale irrisolto nella coda di revisione. */
  async queueUnresolved(
    source: string,
    sourceId: string,
    displayName: string,
    suggestions: unknown
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO unresolved_channels (source, source_id, display_name, suggestions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source, source_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             suggestions  = EXCLUDED.suggestions,
             last_seen    = now()`,
      [source, sourceId, displayName, JSON.stringify(suggestions)]
    );
  }

  /** Approva un irrisolto: crea l'alias e lo toglie dalla coda. */
  async approveAlias(source: string, sourceId: string, canonicalId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO channel_aliases (source, source_id, canonical_id)
         VALUES ($1, $2, $3) ON CONFLICT (source, source_id)
         DO UPDATE SET canonical_id = EXCLUDED.canonical_id`,
        [source, sourceId, canonicalId]
      );
      await client.query(
        'DELETE FROM unresolved_channels WHERE source = $1 AND source_id = $2',
        [source, sourceId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async listUnresolved() {
    const { rows } = await this.pool.query(
      `SELECT source, source_id, display_name, suggestions, first_seen, last_seen
       FROM unresolved_channels ORDER BY last_seen DESC`
    );
    return rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export type { ResolveResult };
