import type { UnsplashImage } from "@/lib/types";

/** Photographer + Unsplash credit, required by the Unsplash API guidelines wherever a photo is shown. */
export default function Attribution({ image, className }: { image: UnsplashImage; className?: string }) {
  return (
    <p className={className}>
      Photo by{" "}
      <a href={image.photographer.profileUrl} target="_blank" rel="noopener noreferrer" className="underline">
        {image.photographer.name}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>{" "}
      on{" "}
      <a href={image.unsplashUrl} target="_blank" rel="noopener noreferrer" className="underline">
        Unsplash
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
