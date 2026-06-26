'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminTable from '@/components/AdminTable';

interface UnresolvedChannel {
  source: string;
  sourceId: string;
  displayName: string;
  suggestions: { canonicalId: string; score: number }[];
}

interface Channel {
  id: string;
  name: string;
}

const STORAGE_KEY = 'admin_key';

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [unresolved, setUnresolved] = useState<UnresolvedChannel[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Restore key from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY) ?? '';
    if (saved) setAdminKey(saved);
  }, []);

  const fetchData = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const [unresolvedRes, channelsRes] = await Promise.all([
        fetch('/api/admin/unresolved', { headers: { 'X-Admin-Key': key } }),
        fetch('/api/channels'),
      ]);

      if (unresolvedRes.status === 401) {
        setError('Chiave non valida (401). Riprova.');
        setAdminKey('');
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (!unresolvedRes.ok) throw new Error(`Errore ${unresolvedRes.status}`);

      const [unresolvedData, channelsData] = await Promise.all([
        unresolvedRes.json(),
        channelsRes.json(),
      ]);

      setUnresolved(unresolvedData);
      setChannels(channelsData);
      sessionStorage.setItem(STORAGE_KEY, key);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch when adminKey is set
  useEffect(() => {
    if (adminKey) fetchData(adminKey);
  }, [adminKey, fetchData]);

  function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setAdminKey(inputKey.trim());
  }

  function handleApproved(source: string, sourceId: string) {
    setUnresolved((prev) =>
      prev.filter((r) => !(r.source === source && r.sourceId === sourceId)),
    );
  }

  if (!adminKey) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
            Admin — accesso richiesto
          </h1>
          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}
          <form onSubmit={handleKeySubmit} className="flex flex-col gap-3">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Admin key"
              aria-label="Inserisci la chiave admin"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Accedi
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Admin — canali irrisolti
          </h1>
          <button
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              setAdminKey('');
              setInputKey('');
              setUnresolved([]);
            }}
            aria-label="Esci dalla sessione admin"
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Esci
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {loading ? (
          <p className="text-center text-gray-500 dark:text-gray-400">Caricamento…</p>
        ) : (
          <AdminTable
            rows={unresolved}
            channels={channels}
            adminKey={adminKey}
            onApproved={handleApproved}
          />
        )}
      </div>
    </main>
  );
}
