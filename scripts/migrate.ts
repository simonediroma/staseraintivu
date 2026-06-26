/**
 * Migration + seed per staseraintivu.
 *
 * Esegue lo schema SQL (idempotente, IF NOT EXISTS) e seeda i canali
 * canonici (ON CONFLICT DO NOTHING). Rieseguibile senza effetti collaterali.
 *
 * Uso (con DATABASE_URL in .env.local o env):
 *   npx tsx scripts/migrate.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pool from '../src/lib/db';
import { SEED_CHANNELS } from '../src/db/seed-channels';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '..', 'src', 'db', 'schema.sql');

async function migrate(): Promise<void> {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Schema (tabelle + indici, tutto IF NOT EXISTS)
    await client.query(schema);

    // 2. Seed canali canonici — idempotente su id
    for (const c of SEED_CHANNELS) {
      await client.query(
        `INSERT INTO canonical_channels (id, lcn, name, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.lcn, c.name, c.sortOrder]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  console.log(`Migration completata. ${SEED_CHANNELS.length} canali seedati (idempotente).`);
}

migrate()
  .then(() => pool.end())
  .catch((e) => {
    console.error('Migration fallita:', e);
    pool.end();
    process.exit(1);
  });
