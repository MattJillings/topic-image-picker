"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TopicForm from "@/components/TopicForm";
import ImageReview, { type ReviewStatus } from "@/components/ImageReview";
import ProfileCard from "@/components/ProfileCard";
import type { ApiError, ImagePage, UnsplashImage, UserDetails } from "@/lib/types";

type View = "form" | "review" | "card";

const TITLES: Record<View, string> = {
  form: "Tell us about yourself",
  review: "Do you like this image?",
  card: "Your card",
};

const REJECTED_KEY = "topic-image-picker:rejected";

/** Per-topic paging state, so "Reject" walks through results instead of re-requesting the same ones. */
interface Feed {
  topic: string;
  queue: UnsplashImage[];
  nextPage: number;
  totalPages: number | null;
  total: number | null;
}

function loadRejected(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(REJECTED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveRejected(ids: Set<string>) {
  try {
    sessionStorage.setItem(REJECTED_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable (e.g. private mode): the in-memory set still works for this page session.
  }
}

export default function Home() {
  const [view, setView] = useState<View>("form");
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [image, setImage] = useState<UnsplashImage | null>(null);
  const [status, setStatus] = useState<ReviewStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const feedRef = useRef<Feed | null>(null);
  const rejectedRef = useRef<Set<string> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  // Focus management: on every view change, move focus to the new view's heading and update the page title.
  useEffect(() => {
    document.title = `${TITLES[view]} – Topic Image Picker`;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [view]);

  const rejected = () => (rejectedRef.current ??= loadRejected());

  /** Shows the next image for `topic` that hasn't been rejected this session, fetching more pages as needed. */
  const showNext = useCallback(async (topic: string) => {
    const id = ++requestId.current; // ignore stale responses if the user navigates or clicks quickly
    setStatus("loading");
    setError(null);

    if (feedRef.current?.topic !== topic) {
      feedRef.current = { topic, queue: [], nextPage: 1, totalPages: null, total: null };
    }
    const feed = feedRef.current;
    const seen = rejected();

    for (;;) {
      const next = feed.queue.shift();
      if (next) {
        if (seen.has(next.id)) continue;
        setImage(next);
        setStatus("ready");
        return;
      }

      if (feed.totalPages !== null && feed.nextPage > feed.totalPages) {
        setImage(null);
        setStatus(feed.total === 0 ? "empty" : "exhausted");
        return;
      }

      try {
        const params = new URLSearchParams({ topic, page: String(feed.nextPage) });
        const res = await fetch(`/api/image?${params}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as ImagePage | ApiError | null;
        if (id !== requestId.current) return;

        if (!res.ok || !data || "error" in data) {
          const apiError = data && "error" in data ? data : null;
          setImage(null);
          setStatus(apiError?.code === "rate_limited" || res.status === 429 ? "rate_limited" : "error");
          setError(apiError?.error ?? "We couldn't load images right now. Please try again.");
          return;
        }

        feed.queue.push(...data.images);
        feed.totalPages = data.totalPages;
        feed.total = data.total;
        feed.nextPage += 1;
        // An empty page means there's nothing more to fetch, even if total_pages claims otherwise.
        if (data.images.length === 0) feed.totalPages = Math.min(feed.totalPages, feed.nextPage - 1);
      } catch {
        if (id !== requestId.current) return;
        setImage(null);
        setStatus("error");
        setError("Network error. Please check your connection and try again.");
        return;
      }
    }
  }, []);

  function handleSubmit(next: UserDetails) {
    setDetails(next);
    setImage(null);
    setView("review");
    void showNext(next.topic);
  }

  function handleReject() {
    if (!details) return;
    if (image) {
      const ids = rejected();
      ids.add(image.id);
      saveRejected(ids);
    }
    void showNext(details.topic);
  }

  function handleRetry() {
    if (details) void showNext(details.topic);
  }

  function handleImageError() {
    // The CDN failed to deliver this photo: skip to the next one rather than leaving a broken image.
    if (details) void showNext(details.topic);
  }

  function handleAccept() {
    if (!image) return;
    // Fire-and-forget: required by Unsplash's API guidelines, but shouldn't block the UI.
    void fetch("/api/image/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: image.id }),
    }).catch(() => {});
    setView("card");
  }

  function handleStartOver() {
    requestId.current++;
    setDetails(null);
    setImage(null);
    setError(null);
    setView("form");
  }

  function handleBack() {
    requestId.current++;
    setView("form");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 px-4 py-10">
      <section
        aria-labelledby="view-title"
        className="w-full max-w-xl rounded-2xl bg-white/90 p-6 shadow-xl ring-1 ring-slate-200 sm:p-8"
      >
        <h1
          id="view-title"
          ref={headingRef}
          tabIndex={-1}
          className="mb-6 text-2xl font-bold tracking-tight text-slate-900 focus:outline-none"
        >
          {TITLES[view]}
        </h1>

        {view === "form" && <TopicForm initialValues={details} onSubmit={handleSubmit} />}

        {view === "review" && details && (
          <ImageReview
            topic={details.topic}
            image={image}
            status={status}
            error={error}
            onAccept={handleAccept}
            onReject={handleReject}
            onRetry={handleRetry}
            onBack={handleBack}
            onImageError={handleImageError}
          />
        )}

        {view === "card" && details && image && (
          <ProfileCard details={details} image={image} onStartOver={handleStartOver} />
        )}
      </section>
    </main>
  );
}
