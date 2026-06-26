import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import DarkModeToggle from '@/components/DarkModeToggle';

export const metadata: Metadata = {
  title: 'staseraintivu — Palinsesto TV italiana',
  description: 'Cosa c\'è stasera in TV: palinsesto aggiornato per tutti i canali DTT.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              staseraintivu
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
              <Link href="/" className="hover:text-gray-900 dark:hover:text-white">Stasera</Link>
              <Link href="/cerca" className="hover:text-gray-900 dark:hover:text-white">Cerca</Link>
              <DarkModeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
