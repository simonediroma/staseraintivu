const CATEGORY_STYLES: Record<string, string> = {
  film: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  movie: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  serie: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  series: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  news: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  sport: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  sports: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intrattenimento: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  entertainment: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const DEFAULT = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

export default function CategoryChip({ category }: { category: string }) {
  const key = category.toLowerCase();
  const style = Object.entries(CATEGORY_STYLES).find(([k]) => key.includes(k))?.[1] ?? DEFAULT;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${style}`}>
      {category}
    </span>
  );
}
