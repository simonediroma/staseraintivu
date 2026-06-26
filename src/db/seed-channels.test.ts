import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { SEED_CHANNELS } from './seed-channels';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

describe('SEED_CHANNELS', () => {
  it('contiene almeno 25 canali', () => {
    expect(SEED_CHANNELS.length).toBeGreaterThanOrEqual(25);
  });

  it('ha id univoci', () => {
    const ids = SEED_CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ha LCN univoci e positivi', () => {
    const lcns = SEED_CHANNELS.map((c) => c.lcn);
    expect(new Set(lcns).size).toBe(lcns.length);
    expect(lcns.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
  });

  it('usa sort_order = lcn', () => {
    expect(SEED_CHANNELS.every((c) => c.sortOrder === c.lcn)).toBe(true);
  });

  it('ha id in formato slug e name non vuoto', () => {
    for (const c of SEED_CHANNELS) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/);
      expect(c.name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('schema.sql', () => {
  it('crea le 4 tabelle in modo idempotente (IF NOT EXISTS)', () => {
    for (const t of [
      'canonical_channels',
      'channel_aliases',
      'unresolved_channels',
      'programmes',
    ]) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`));
    }
  });

  it('crea i 3 indici in modo idempotente (IF NOT EXISTS)', () => {
    for (const idx of [
      'idx_programmes_start',
      'idx_programmes_channel',
      'idx_programmes_search',
    ]) {
      expect(schema).toMatch(new RegExp(`CREATE INDEX IF NOT EXISTS ${idx}\\b`));
    }
  });

  it('definisce search_vec come colonna GENERATED', () => {
    expect(schema).toMatch(/search_vec\s+TSVECTOR GENERATED ALWAYS AS/);
  });
});
