import pg from 'pg';
import type { ProgrammeRecord } from './parse-xmltv.js';

const { Pool } = pg;

/**
 * Schema dei programmi. channel_id è ora il CANONICAL id: la risoluzione
 * avviene nell'ingest, qui arrivano già canali normalizzati.
 * La chiave (channel_id, start) rende l'ingest idempotente.
 */
export const SCHEMA_SQL = `
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
  PRIMARY KEY (channel_id, start_at)
);

-- indice per la query "stasera": filtro per finestra temporale
CREATE INDEX IF NOT EXISTS idx_programmes_start ON programmes (start_at);
`;

export class EpgStore {
  private pool: pg.Pool;

  constructor(connectionString = process.env.DATABASE_URL) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  /**
   * Upsert in batch via UNNEST: una sola query per N programmi.
   * Molto più veloce di N insert separati su file EPG grandi.
   */
  async upsertProgrammes(batch: ProgrammeRecord[]): Promise<void> {
    if (batch.length === 0) return;
    await this.pool.query(
      `INSERT INTO programmes
         (channel_id, start_at, stop_at, title, sub_title, descr, categories, icon_url, episode_num)
       SELECT * FROM UNNEST(
         $1::text[], $2::timestamptz[], $3::timestamptz[], $4::text[],
         $5::text[], $6::text[], $7::text[][], $8::text[], $9::text[]
       )
       ON CONFLICT (channel_id, start_at) DO UPDATE
         SET stop_at     = EXCLUDED.stop_at,
             title       = EXCLUDED.title,
             sub_title   = EXCLUDED.sub_title,
             descr       = EXCLUDED.descr,
             categories  = EXCLUDED.categories,
             icon_url    = EXCLUDED.icon_url,
             episode_num = EXCLUDED.episode_num`,
      [
        batch.map((p) => p.channelId),
        batch.map((p) => p.start.toISOString()),
        batch.map((p) => p.stop?.toISOString() ?? null),
        batch.map((p) => p.title),
        batch.map((p) => p.subTitle),
        batch.map((p) => p.desc),
        batch.map((p) => p.categories),
        batch.map((p) => p.iconUrl),
        batch.map((p) => p.episodeNum),
      ]
    );
  }

  /**
   * "Stasera in TV": per ogni canale il primo programma nella finestra.
   * DISTINCT ON è il modo idiomatico in Postgres per il "primo per gruppo".
   */
  async tonight(fromUtc: Date, toUtc: Date) {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT ON (p.channel_id)
              p.channel_id, c.name AS channel_name, c.lcn, c.logo_url AS channel_logo,
              p.start_at, p.stop_at, p.title, p.sub_title, p.descr, p.categories
       FROM programmes p
       JOIN canonical_channels c ON c.id = p.channel_id
       WHERE p.start_at >= $1 AND p.start_at < $2
       ORDER BY p.channel_id, p.start_at ASC`,
      [fromUtc.toISOString(), toUtc.toISOString()]
    );
    return rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
