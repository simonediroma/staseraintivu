import CategoryChip from './CategoryChip';

export interface TimelineEntry {
  channelId: string;
  startAt: string;
  stopAt: string | null;
  title: string;
  subTitle: string | null;
  description: string | null;
  categories: string[];
  isNow: boolean;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
  });
}

export default function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-sm">Nessun programma disponibile.</p>;
  }

  return (
    <ol className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
      {entries.map((e) => (
        <li
          key={e.startAt}
          className={`py-3 flex gap-4 ${e.isNow ? 'bg-blue-50 dark:bg-blue-950 -mx-4 px-4 rounded' : ''}`}
        >
          <time
            dateTime={e.startAt}
            className="w-12 shrink-0 text-sm font-mono text-gray-500 dark:text-gray-400 pt-0.5"
          >
            {fmtTime(e.startAt)}
          </time>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 dark:text-white">{e.title}</span>
              {e.isNow && (
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  In corso
                </span>
              )}
              {e.categories.slice(0, 2).map((c) => <CategoryChip key={c} category={c} />)}
            </div>
            {e.subTitle && (
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{e.subTitle}</p>
            )}
            {e.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{e.description}</p>
            )}
            {e.stopAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                fino alle {fmtTime(e.stopAt)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
