'use client';

import Link from 'next/link';

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export default function DayNav({ date, today }: { date: string; today: string }) {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const minDate = addDays(today, -1);
  const maxDate = addDays(today, 5);

  return (
    <nav aria-label="Navigazione giorno" className="flex items-center gap-3">
      {date > minDate ? (
        <Link
          href={`/${prev}`}
          aria-label="Giorno precedente"
          className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
        >
          ← Ieri
        </Link>
      ) : (
        <span className="px-3 py-1 rounded text-sm text-gray-400 cursor-not-allowed">← Ieri</span>
      )}

      {date < maxDate ? (
        <Link
          href={`/${next}`}
          aria-label="Giorno successivo"
          className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
        >
          Domani →
        </Link>
      ) : (
        <span className="px-3 py-1 rounded text-sm text-gray-400 cursor-not-allowed">Domani →</span>
      )}
    </nav>
  );
}
