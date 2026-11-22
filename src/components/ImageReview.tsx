"use client";

import { useState } from "react";
import Attribution from "@/components/Attribution";
import type { UnsplashImage } from "@/lib/types";

export type ReviewStatus = "loading" | "ready" | "error" | "rate_limited" | "empty" | "exhausted";

interface ImageReviewProps {
  topic: string;
  image: UnsplashImage | null;
  status: ReviewStatus;
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
  onBack: () => void;
  onImageError: () => void;
}

const buttonBase =
  "rounded-lg px-4 py-2.5 font-semibold shadow-sm transition aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export default function ImageReview({
  topic,
  image,
  status,
  error,
  onAccept,
  onReject,
  onRetry,
  onBack,
  onImageError,
}: ImageReviewProps) {
  // Tracks which image has finished downloading from the Unsplash CDN, so we can show a spinner until then.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const isLoading = status === "loading";
  const isFailure = status === "error" || status === "rate_limited";
  const isEmpty = status === "empty" || status === "exhausted";
  const showSpinner = isLoading || (status === "ready" && !!image && loadedId !== image.id);
  const canAccept = status === "ready" && !!image;

  // The secondary button keeps the same DOM node across states so keyboard focus is never lost.
  const secondary = isFailure
    ? { label: "Try again", onClick: onRetry, disabled: false }
    : isEmpty
      ? { label: "Change topic", onClick: onBack, disabled: false }
      : { label: "Reject", onClick: onReject, disabled: isLoading };

  const statusMessage = isLoading
    ? "Loading image…"
    : status === "ready" && image
      ? `Showing image: ${image.alt}. Photo by ${image.photographer.name}.`
      : "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Image for <span className="text-indigo-700">{topic}</span>
        </h2>
        <button
          type="button"
          onClick={onBack}
          className="rounded px-2 py-1 text-sm text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          <span aria-hidden="true">← </span>Edit details
        </button>
      </div>

      {/* Polite live region: always mounted so screen readers reliably announce changes. */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-slate-100" aria-busy={showSpinner}>
        {image && !isFailure && !isEmpty && (
          // Plain <img> on purpose: Unsplash requires hotlinking its CDN URLs (no proxying/optimising).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={image.id}
            src={image.urls.regular}
            alt={image.alt}
            onLoad={() => setLoadedId(image.id)}
            onError={onImageError}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${
              showSpinner ? "opacity-40" : "opacity-100"
            }`}
          />
        )}

        {showSpinner && (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700 motion-reduce:animate-none" />
          </div>
        )}

        {isFailure && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <p className="font-semibold text-red-800">
              {status === "rate_limited" ? "Too many requests" : "Something went wrong"}
            </p>
            <p className="text-sm text-slate-800">{error}</p>
          </div>
        )}

        {isEmpty && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <p className="font-semibold text-slate-900">
              {status === "empty" ? "No images found" : "No more new images"}
            </p>
            <p className="text-sm text-slate-800">
              {status === "empty"
                ? `We couldn't find any images for "${topic}". Try a different topic.`
                : `You've seen every image we have for "${topic}". Try a different topic.`}
            </p>
          </div>
        )}
      </div>

      {image && status === "ready" && <Attribution image={image} className="text-sm text-slate-700" />}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => !secondary.disabled && secondary.onClick()}
          aria-disabled={secondary.disabled || undefined}
          className={`${buttonBase} border border-slate-500 bg-white text-slate-800 hover:bg-slate-50`}
        >
          {secondary.label}
        </button>
        <button
          type="button"
          onClick={() => canAccept && onAccept()}
          aria-disabled={!canAccept || undefined}
          className={`${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800`}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
