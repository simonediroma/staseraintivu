import { describe, it, expect } from 'vitest';
import { isValidDate, isSlug, serializeProgramme } from './api';

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
