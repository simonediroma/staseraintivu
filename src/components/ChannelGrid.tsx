import ChannelRow from './ChannelRow';
import type { Programme } from './ProgrammeCard';

export default function ChannelGrid({ programmes }: { programmes: Programme[] }) {
  if (programmes.length === 0) {
    return (
      <p className="py-16 text-center text-gray-400 dark:text-gray-500">
        Nessun programma disponibile per stasera.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {programmes.map((p) => (
        <ChannelRow key={p.channelId} programme={p} />
      ))}
    </div>
  );
}
