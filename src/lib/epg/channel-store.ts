import pool from '@/lib/db';
import {
  ChannelResolver,
  type CanonicalChannel,
  type ChannelAlias,
  type ResolveResult,
} from './channel-alias';

/**
 * Accesso DB ai canali. Usa il singleton `@/lib/db` — nessun Pool proprio.
 * Schema e seed sono di competenza di M1 (scripts/migrate.ts): qui solo letture
 * e mutazioni della coda di revisione, nessun DDL.
 */
export class ChannelStore {
  /** Costruisce un risolutore in memoria a partire dallo stato del DB. */
  async buildResolver(): Promise<ChannelResolver> {
    const canon = await pool.query<{
      id: string;
      lcn: number;
      name: string;
      logo_url: string | null;
    }>('SELECT id, lcn, name, logo_url FROM canonical_channels');

    const aliases = await pool.query<ChannelAlias>(
      'SELECT source, source_id AS "sourceId", canonical_id AS "canonicalId" FROM channel_aliases'
    );

    const canonicals: CanonicalChannel[] = canon.rows.map((c) => ({
      id: c.id,
      lcn: c.lcn,
      name: c.name,
      logoUrl: c.logo_url ?? undefined,
    }));

    return new ChannelResolver(canonicals, aliases.rows);
  }

  /** Canali attivi per la lista pubblica, ordinati per posizione (LCN). */
  async listActiveChannels() {
    const { rows } = await pool.query(
      `SELECT id, name, lcn, logo_url AS "logoUrl"
       FROM canonical_channels
       WHERE is_active = true
       ORDER BY sort_order ASC`
    );
    return rows;
  }

  /** Registra/aggiorna un canale irrisolto nella coda di revisione. */
  async queueUnresolved(
    source: string,
    sourceId: string,
    displayName: string,
    suggestions: unknown
  ): Promise<void> {
    await pool.query(
      `INSERT INTO unresolved_channels (source, source_id, display_name, suggestions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source, source_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             suggestions  = EXCLUDED.suggestions,
             last_seen    = now()`,
      [source, sourceId, displayName, JSON.stringify(suggestions)]
    );
  }

  /** Approva un irrisolto: crea l'alias e lo toglie dalla coda (transazione). */
  async approveAlias(source: string, sourceId: string, canonicalId: string): Promise<void> {
    const client = await pool.connect();
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

  /** Lista della coda di revisione, dai più recenti. */
  async listUnresolved() {
    const { rows } = await pool.query(
      `SELECT source, source_id, display_name, suggestions, first_seen, last_seen
       FROM unresolved_channels ORDER BY last_seen DESC`
    );
    return rows;
  }
}

export type { ResolveResult };
