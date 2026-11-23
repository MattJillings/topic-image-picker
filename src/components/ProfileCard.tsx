import Attribution from "@/components/Attribution";
import type { UnsplashImage, UserDetails } from "@/lib/types";

interface ProfileCardProps {
  details: UserDetails;
  image: UnsplashImage;
  onStartOver: () => void;
}

export default function ProfileCard({ details, image, onStartOver }: ProfileCardProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {/* Hotlinked Unsplash thumbnail, as required by the Unsplash API guidelines. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.urls.small} alt={image.alt} className="h-full w-full object-cover" />
          </div>
          <dl className="min-w-0 space-y-1 text-base font-normal">
            <div className="flex gap-2">
              <dt className="text-slate-600">Name:</dt>
              <dd className="truncate text-slate-900">{details.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-600">Surname:</dt>
              <dd className="truncate text-slate-900">{details.surname}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-600">Topic:</dt>
              <dd className="truncate text-slate-900">{details.topic}</dd>
            </div>
          </dl>
        </div>
        <Attribution image={image} className="mt-3 text-xs text-slate-700" />
      </div>

      <button
        type="button"
        onClick={onStartOver}
        className="w-full rounded-lg rounded-tr-none rounded-bl-none border border-slate-500 bg-white px-4 py-2.5 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
      >
        Start over
      </button>
    </div>
  );
}
