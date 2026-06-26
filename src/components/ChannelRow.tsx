import Image from 'next/image';
import ProgrammeCard from './ProgrammeCard';
import type { Programme } from './ProgrammeCard';

export default function ChannelRow({ programme }: { programme: Programme }) {
  const { channelName, channelLogo, lcn } = programme;
  return (
    <div className="flex items-start gap-4 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1">
        {channelLogo ? (
          <Image
            src={channelLogo}
            alt={channelName}
            width={48}
            height={48}
            className="h-10 w-10 rounded object-contain"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-500">
            {lcn}
          </div>
        )}
        <span className="text-xs text-gray-400">{lcn}</span>
      </div>
      <ProgrammeCard programme={programme} />
    </div>
  );
}
