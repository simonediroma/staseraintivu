import pool from '@/lib/db';
import type { ProgrammeRecord } from './parse-xmltv.js';

/**
 * Accesso DB ai programmi. Usa il singleton `@/lib/db` — nessun Pool proprio.
 * Schema e indici sono di competenza di M1 (scripts/migrate.ts): qui solo query.
 * `channel_id` è già il CANONICAL id (la risoluzione avviene nell'ingest).
 * La chiave (channel_id, start_at) rende l'upsert idempotente.
 */
export class EpgStore {
  /**
   * Upsert in batch via UNNEST: una sola query per N programmi.
   * Molto più veloce di N insert separati su file EPG grandi.
   * `search_vec` è GENERATED: non va elencata tra le colonne di INSERT.
   */
  async upsertProgrammes(batch: ProgrammeRecord[]): Promise<void> {
    if (batch.length === 0) return;
    await pool.query(
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
    const { rows } = await pool.query(
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
}
