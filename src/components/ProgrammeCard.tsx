import CategoryChip from './CategoryChip';

export interface Programme {
  channelId: string;
  channelName: string;
  channelLogo: string | null;
  lcn: number;
  startAt: string;
  stopAt: string | null;
  title: string;
  subTitle: string | null;
  description: string | null;
  categories: string[];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
}

export default function ProgrammeCard({ programme }: { programme: Programme }) {
  const { startAt, stopAt, title, subTitle, description, categories } = programme;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>{fmtTime(startAt)}{stopAt ? ` – ${fmtTime(stopAt)}` : ''}</span>
        {categories.slice(0, 2).map((c) => <CategoryChip key={c} category={c} />)}
      </div>
      <p className="font-bold text-gray-900 dark:text-white truncate">{title}</p>
      {subTitle && <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{subTitle}</p>}
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{description}</p>
      )}
    </div>
  );
}
