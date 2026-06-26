'use client';

import { useState } from 'react';

interface Suggestion {
  canonicalId: string;
  score: number;
}

interface UnresolvedChannel {
  source: string;
  sourceId: string;
  displayName: string;
  suggestions: Suggestion[];
}

interface Channel {
  id: string;
  name: string;
}

interface Props {
  rows: UnresolvedChannel[];
  channels: Channel[];
  adminKey: string;
  onApproved: (source: string, sourceId: string) => void;
}

export default function AdminTable({ rows, channels, adminKey, onApproved }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-12">
        Nessun canale da approvare 🎉
      </p>
    );
  }

  async function approve(source: string, sourceId: string, canonicalId: string) {
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify({ source, sourceId, canonicalId }),
    });
    if (res.ok) onApproved(source, sourceId);
    else alert(`Errore approvazione: ${res.status}`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-4">Source</th>
            <th className="py-2 pr-4">Source ID</th>
            <th className="py-2 pr-4">Display Name</th>
            <th className="py-2 pr-4">Suggerimenti</th>
            <th className="py-2">Azione</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const best = row.suggestions[0]?.canonicalId ?? '';
            return (
              <UnresolvedRow
                key={`${row.source}/${row.sourceId}`}
                row={row}
                channels={channels}
                best={best}
                onApprove={(canonicalId) => approve(row.source, row.sourceId, canonicalId)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UnresolvedRow({
  row,
  channels,
  best,
  onApprove,
}: {
  row: UnresolvedChannel;
  channels: Channel[];
  best: string;
  onApprove: (canonicalId: string) => void;
}) {
  const [selected, setSelected] = useState(best);

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 align-top">
      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{row.source}</td>
      <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
        {row.sourceId}
      </td>
      <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{row.displayName}</td>
      <td className="py-2 pr-4">
        {row.suggestions.length === 0 ? (
          <span className="text-gray-400">—</span>
        ) : (
          <ul className="space-y-0.5">
            {row.suggestions.slice(0, 3).map((s) => (
              <li key={s.canonicalId} className="text-xs text-gray-500 dark:text-gray-400">
                {s.canonicalId}{' '}
                <span className="text-gray-400">({(s.score * 100).toFixed(0)}%)</span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-2 min-w-40">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label={`Canonical per ${row.displayName}`}
            className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100"
          >
            <option value="">— scegli canale —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
          <button
            onClick={() => selected && onApprove(selected)}
            disabled={!selected}
            aria-label={`Approva ${row.displayName} come ${selected || 'canale non selezionato'}`}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold"
          >
            Approva
          </button>
        </div>
      </td>
    </tr>
  );
}
