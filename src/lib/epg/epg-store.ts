import pool from '@/lib/db';
import type { ProgrammeRecord } from './parse-xmltv.js';

/** Serializza un array JS in letterale array PostgreSQL: {\"a\",\"b\"} */
function pgArrayLiteral(arr: string[]): string {
  if (arr.length === 0) return '{}';
  return '{' + arr.map((s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + '}';
}

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
    // categories è text[] per riga. UNNEST parallelo appiattisce text[][] → text,
    // quindi passiamo ogni array come letterale PostgreSQL (es. '{"news","film"}')
    // e lo castiamo a text[] nella SELECT.
    await pool.query(
      `INSERT INTO programmes
         (channel_id, start_at, stop_at, title, sub_title, descr, categories, icon_url, episode_num)
       SELECT channel_id, start_at, stop_at, title, sub_title, descr,
              categories::text[], icon_url, episode_num
       FROM UNNEST(
         $1::text[], $2::timestamptz[], $3::timestamptz[], $4::text[],
         $5::text[], $6::text[], $7::text[], $8::text[], $9::text[]
       ) AS t(channel_id, start_at, stop_at, title, sub_title, descr, categories, icon_url, episode_num)
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
        batch.map((p) => pgArrayLiteral(p.categories)),
        batch.map((p) => p.iconUrl),
        batch.map((p) => p.episodeNum),
      ]
    );
  }

  /**
   * Palinsesto di un giorno: tutti i programmi nella finestra [fromUtc, toUtc),
   * opzionalmente filtrati per canale. Ordine (channel_id, start_at) per la UI.
   */
  async schedule(fromUtc: Date, toUtc: Date, channelId?: string) {
    const params: unknown[] = [fromUtc.toISOString(), toUtc.toISOString()];
    let filter = '';
    if (channelId) {
      params.push(channelId);
      filter = ' AND p.channel_id = $3';
    }
    const { rows } = await pool.query(
      `SELECT p.channel_id, c.name AS channel_name, c.lcn, c.logo_url AS channel_logo,
              p.start_at, p.stop_at, p.title, p.sub_title, p.descr, p.categories
       FROM programmes p
       JOIN canonical_channels c ON c.id = p.channel_id
       WHERE p.start_at >= $1 AND p.start_at < $2${filter}
       ORDER BY p.channel_id, p.start_at ASC`,
      params
    );
    return rows;
  }

  /**
   * Ricerca full-text. `websearch_to_tsquery` accetta input utente grezzo senza
   * crashare (input parametrizzato → nessuna SQL injection possibile). Risultati
   * ordinati per rilevanza (`ts_rank`). LIMIT/OFFSET applicati nella subquery su
   * `programmes` PRIMA del JOIN col canale. `total` è il conteggio complessivo dei
   * match (per la paginazione), calcolato in una seconda query leggera.
   */
  async search(q: string, limit: number, offset: number) {
    const results = await pool.query(
      `SELECT p.channel_id, c.name AS channel_name,
              p.start_at, p.stop_at, p.title, p.descr, p.categories
       FROM (
         SELECT channel_id, start_at, stop_at, title, descr, categories,
                ts_rank(search_vec, websearch_to_tsquery('italian', $1)) AS rank
         FROM programmes
         WHERE search_vec @@ websearch_to_tsquery('italian', $1)
         ORDER BY rank DESC, start_at DESC
         LIMIT $2 OFFSET $3
       ) p
       JOIN canonical_channels c ON c.id = p.channel_id
       ORDER BY p.rank DESC, p.start_at DESC`,
      [q, limit, offset]
    );
    const count = await pool.query<{ total: string }>(
      `SELECT count(*) AS total FROM programmes
       WHERE search_vec @@ websearch_to_tsquery('italian', $1)`,
      [q]
    );
    return { rows: results.rows, total: Number(count.rows[0].total) };
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
