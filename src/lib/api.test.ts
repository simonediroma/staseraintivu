import { describe, it, expect, afterEach } from 'vitest';
import {
  isValidDate,
  isSlug,
  serializeProgramme,
  serializeSearchResult,
  serializeUnresolved,
  adminKeyValid,
} from './api';

describe('isValidDate', () => {
  it('accetta YYYY-MM-DD reale', () => {
    expect(isValidDate('2026-06-25')).toBe(true);
  });
  it('rifiuta formato errato', () => {
    expect(isValidDate('2026-6-5')).toBe(false);
    expect(isValidDate('25-06-2026')).toBe(false);
    expect(isValidDate('invalid')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
  it('rifiuta date inesistenti', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
  });
});

describe('isSlug', () => {
  it('accetta slug canale', () => {
    expect(isSlug('rai-1')).toBe(true);
  });
  it('rifiuta caratteri non slug', () => {
    expect(isSlug('Rai 1')).toBe(false);
    expect(isSlug("rai';drop")).toBe(false);
  });
});

describe('serializeProgramme', () => {
  it('mappa la riga DB nella shape documentata (camelCase, ISO)', () => {
    const row = {
      channel_id: 'rai-1',
      channel_name: 'Rai 1',
      lcn: 1,
      channel_logo: 'https://logo',
      start_at: new Date('2026-06-25T19:30:00Z'),
      stop_at: new Date('2026-06-25T21:15:00Z'),
      title: 'TG1',
      sub_title: null,
      descr: 'Notiziario',
      categories: ['news'],
    };
    expect(serializeProgramme(row)).toEqual({
      channelId: 'rai-1',
      channelName: 'Rai 1',
      channelLogo: 'https://logo',
      lcn: 1,
      startAt: '2026-06-25T19:30:00.000Z',
      stopAt: '2026-06-25T21:15:00.000Z',
      title: 'TG1',
      subTitle: null,
      description: 'Notiziario',
      categories: ['news'],
    });
  });

  it('stop_at null → stopAt null', () => {
    const row = {
      channel_id: 'rai-1',
      channel_name: 'Rai 1',
      lcn: 1,
      channel_logo: null,
      start_at: new Date('2026-06-25T19:30:00Z'),
      stop_at: null,
      title: 'TG1',
      sub_title: null,
      descr: null,
      categories: [],
    };
    expect(serializeProgramme(row).stopAt).toBeNull();
  });
});

describe('serializeSearchResult', () => {
  it('shape fissa: solo i campi documentati, nessun extra (Hyrum)', () => {
    const row = {
      channel_id: 'rai-1',
      channel_name: 'Rai 1',
      start_at: new Date('2026-06-25T19:30:00Z'),
      stop_at: new Date('2026-06-25T21:15:00Z'),
      title: 'Totò, Peppino e la malafemmina',
      descr: 'Film',
      categories: ['film'],
    };
    expect(serializeSearchResult(row)).toEqual({
      channelId: 'rai-1',
      channelName: 'Rai 1',
      startAt: '2026-06-25T19:30:00.000Z',
      stopAt: '2026-06-25T21:15:00.000Z',
      title: 'Totò, Peppino e la malafemmina',
      description: 'Film',
      categories: ['film'],
    });
  });

  it('stop_at null → stopAt null', () => {
    const row = {
      channel_id: 'rai-1',
      channel_name: 'Rai 1',
      start_at: new Date('2026-06-25T19:30:00Z'),
      stop_at: null,
      title: 'X',
      descr: null,
      categories: [],
    };
    expect(serializeSearchResult(row).stopAt).toBeNull();
  });
});

describe('serializeUnresolved', () => {
  it('mappa la riga DB in camelCase ISO, senza ID interni', () => {
    const row = {
      source: 'iptv-org',
      source_id: 'xyz.it',
      display_name: 'Tele XYZ',
      suggestions: [{ canonicalId: 'rai-4', name: 'Rai 4', score: 0.6 }],
      first_seen: new Date('2026-06-25T02:00:00Z'),
      last_seen: new Date('2026-06-26T02:00:00Z'),
    };
    expect(serializeUnresolved(row)).toEqual({
      source: 'iptv-org',
      sourceId: 'xyz.it',
      displayName: 'Tele XYZ',
      suggestions: [{ canonicalId: 'rai-4', name: 'Rai 4', score: 0.6 }],
      firstSeen: '2026-06-25T02:00:00.000Z',
      lastSeen: '2026-06-26T02:00:00.000Z',
    });
  });
});

describe('adminKeyValid', () => {
  const prev = process.env.ADMIN_KEY;
  afterEach(() => {
    process.env.ADMIN_KEY = prev;
  });

  it('chiave corretta → true', () => {
    process.env.ADMIN_KEY = 'super-secret-admin-key';
    expect(adminKeyValid('super-secret-admin-key')).toBe(true);
  });

  it('chiave errata o lunghezza diversa → false (no throw)', () => {
    process.env.ADMIN_KEY = 'super-secret-admin-key';
    expect(adminKeyValid('wrong')).toBe(false);
    expect(adminKeyValid('super-secret-admin-keyX')).toBe(false);
  });

  it('header assente → false', () => {
    process.env.ADMIN_KEY = 'super-secret-admin-key';
    expect(adminKeyValid(null)).toBe(false);
  });

  it('ADMIN_KEY non configurata → false', () => {
    delete process.env.ADMIN_KEY;
    expect(adminKeyValid('whatever')).toBe(false);
  });
});
