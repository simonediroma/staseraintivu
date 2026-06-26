import { Suspense } from 'react';
import SearchBar from '@/components/SearchBar';

export const metadata = { title: 'Cerca — staseraintivu' };

export default function CercaPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-8">
        Cerca programmi
      </h1>
      <Suspense>
        <SearchBar />
      </Suspense>
    </main>
  );
}
