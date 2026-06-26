import sax from 'sax';
import { Readable } from 'node:stream';
import { parseXmltvDate } from './datetime.js';

export interface ChannelRecord {
  id: string;              // xmltv id, es. "Rai1.it"
  displayName: string;
  iconUrl: string | null;
}

export interface ProgrammeRecord {
  channelId: string;
  start: Date;             // istante UTC
  stop: Date | null;
  title: string;
  subTitle: string | null;
  desc: string | null;
  categories: string[];
  iconUrl: string | null;
  episodeNum: string | null;
}

export interface ParseHandlers {
  onChannel?: (c: ChannelRecord) => void | Promise<void>;
  onProgramme?: (p: ProgrammeRecord) => void | Promise<void>;
  /** offset di fallback in minuti se il feed omette il fuso (default 0 = UTC) */
  defaultOffsetMinutes?: number;
  /** lingua preferita per title/desc/category quando ce ne sono più d'una */
  preferLang?: string;
}

/**
 * Parser XMLTV in streaming. Non carica l'intero DOM: tiene in memoria solo
 * l'elemento <channel> o <programme> corrente. Adatto a file da decine di MB.
 *
 * Restituisce una Promise che si risolve a fine documento. Gli handler possono
 * essere async: lo stream viene messo in pausa finché non completano (back-pressure),
 * così puoi scrivere su DB senza saturare la memoria.
 */
export function parseXmltv(
  input: Readable | string,
  handlers: ParseHandlers
): Promise<{ channels: number; programmes: number }> {
  const preferLang = handlers.preferLang ?? 'it';
  const defaultOffset = handlers.defaultOffsetMinutes ?? 0;

  return new Promise((resolve, reject) => {
    const stream = sax.createStream(true, {
      trim: true,
      lowercase: true,
    });

    let channels = 0;
    let programmes = 0;

    // Riferimento alla sorgente: è qui che applichiamo il back-pressure.
    const src = typeof input === 'string' ? Readable.from([input]) : input;

    // Stato dell'elemento corrente
    type Mode = 'channel' | 'programme' | null;
    let mode: Mode = null;
    let curTag = '';
    let curLang: string | null = null;

    // buffer per channel
    let chId = '';
    let chNames: { lang: string | null; text: string }[] = [];
    let chIcon: string | null = null;

    // buffer per programme
    let pgChannel = '';
    let pgStart: Date | null = null;
    let pgStop: Date | null = null;
    let pgTitles: { lang: string | null; text: string }[] = [];
    let pgSubTitles: { lang: string | null; text: string }[] = [];
    let pgDescs: { lang: string | null; text: string }[] = [];
    let pgCategories: string[] = [];
    let pgIcon: string | null = null;
    let pgEpisode: string | null = null;

    // Coda per gestire handler async senza perdere l'ordine
    let chain: Promise<void> = Promise.resolve();
    const queue = (fn: () => void | Promise<void>) => {
      chain = chain.then(fn).catch(reject);
    };

    const pickLang = (arr: { lang: string | null; text: string }[]) => {
      if (arr.length === 0) return null;
      const preferred = arr.find((x) => x.lang === preferLang);
      return (preferred ?? arr[0]).text || null;
    };

    stream.on('opentag', (node) => {
      const name = node.name;
      const attr = node.attributes as Record<string, string>;

      if (name === 'channel') {
        mode = 'channel';
        chId = attr.id ?? '';
        chNames = [];
        chIcon = null;
        return;
      }
      if (name === 'programme') {
        mode = 'programme';
        pgChannel = attr.channel ?? '';
        pgStart = attr.start ? parseXmltvDate(attr.start, defaultOffset) : null;
        pgStop = attr.stop ? parseXmltvDate(attr.stop, defaultOffset) : null;
        pgTitles = [];
        pgSubTitles = [];
        pgDescs = [];
        pgCategories = [];
        pgIcon = null;
        pgEpisode = null;
        return;
      }

      curTag = name;
      curLang = attr.lang ?? null;

      // icon è self-closing con attributo src
      if (name === 'icon' && attr.src) {
        if (mode === 'channel') chIcon = attr.src;
        else if (mode === 'programme') pgIcon = attr.src;
      }
    });

    stream.on('text', (text) => {
      if (!mode || !curTag) return;
      const t = text;
      if (!t) return;

      if (mode === 'channel') {
        if (curTag === 'display-name') chNames.push({ lang: curLang, text: t });
      } else if (mode === 'programme') {
        switch (curTag) {
          case 'title':
            pgTitles.push({ lang: curLang, text: t });
            break;
          case 'sub-title':
            pgSubTitles.push({ lang: curLang, text: t });
            break;
          case 'desc':
            pgDescs.push({ lang: curLang, text: t });
            break;
          case 'category':
            pgCategories.push(t);
            break;
          case 'episode-num':
            pgEpisode = t;
            break;
        }
      }
    });

    stream.on('closetag', (name) => {
      if (name === 'channel' && mode === 'channel') {
        const rec: ChannelRecord = {
          id: chId,
          displayName: pickLang(chNames) ?? chId,
          iconUrl: chIcon,
        };
        mode = null;
        curTag = '';
        if (rec.id && handlers.onChannel) {
          channels++;
          src.pause();
          queue(async () => {
            await handlers.onChannel!(rec);
            src.resume();
          });
        }
        return;
      }

      if (name === 'programme' && mode === 'programme') {
        if (pgChannel && pgStart) {
          const rec: ProgrammeRecord = {
            channelId: pgChannel,
            start: pgStart,
            stop: pgStop,
            title: pickLang(pgTitles) ?? '(senza titolo)',
            subTitle: pickLang(pgSubTitles),
            desc: pickLang(pgDescs),
            categories: pgCategories,
            iconUrl: pgIcon,
            episodeNum: pgEpisode,
          };
          mode = null;
          curTag = '';
          if (handlers.onProgramme) {
            programmes++;
            src.pause();
            queue(async () => {
              await handlers.onProgramme!(rec);
              src.resume();
            });
          }
        } else {
          mode = null;
          curTag = '';
        }
        return;
      }

      // chiusura di un tag figlio: reset del tag corrente
      if (name === curTag) curTag = '';
    });

    stream.on('error', (err) => reject(err));
    stream.on('end', () => {
      chain.then(() => resolve({ channels, programmes })).catch(reject);
    });

    src.on('error', reject);
    src.pipe(stream);
  });
}
