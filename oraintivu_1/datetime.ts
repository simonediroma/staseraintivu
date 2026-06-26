/**
 * Parsing dei timestamp XMLTV.
 *
 * Formato: "YYYYMMDDHHMMSS ±HHMM"  (es. "20260614210000 +0200")
 * L'offset è opzionale; alcuni feed lo omettono. In quel caso usiamo
 * `defaultOffsetMinutes` (default 0 = UTC) per non sbagliare l'istante.
 *
 * Restituisce un Date che rappresenta l'ISTANTE corretto (UTC interno).
 * La conversione al fuso "Europe/Rome" per la UI la fai a valle, in lettura.
 */
export function parseXmltvDate(
  raw: string,
  defaultOffsetMinutes = 0
): Date {
  const s = raw.trim();
  // 14 cifre obbligatorie + eventuale offset
  const m = s.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?$/
  );
  if (!m) {
    throw new Error(`Timestamp XMLTV non valido: "${raw}"`);
  }

  const [, y, mo, d, h, mi, se, off] = m;

  let offsetMinutes = defaultOffsetMinutes;
  if (off) {
    const sign = off[0] === '-' ? -1 : 1;
    const oh = Number(off.slice(1, 3));
    const om = Number(off.slice(3, 5));
    offsetMinutes = sign * (oh * 60 + om);
  }

  // Costruiamo l'istante come se i componenti fossero UTC,
  // poi sottraiamo l'offset dichiarato per ottenere l'UTC reale.
  const asIfUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    se ? Number(se) : 0
  );

  return new Date(asIfUtc - offsetMinutes * 60_000);
}
