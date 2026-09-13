"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * IMAGE CAROUSEL — the one carousel primitive in this app.
 *
 * Two callers, one implementation:
 *   PropertyCarousel  home page hero, auto-advancing, dots, text overlaid
 *   ProductGallery    product photos, manual only, prev/next + counter
 *
 * What they genuinely share is the awkward part — index state, the
 * crossfade between stacked images, drip-loading so a six-photo stack does
 * not cost six requests on a phone, and the reduced-motion behaviour. What
 * differs is only the trigger (a timer vs a button) and the chrome. So the
 * trigger is a prop, not a second component.
 *
 * Deliberately hand-rolled. A crossfade between stacked absolutely-
 * positioned images is one opacity class and a timer; no carousel library
 * in package.json would earn its transfer size on a mid-range Android.
 *
 * REDUCED MOTION: callers pass `motion-reduce:transition-none` in
 * `crossfadeClassName`, which drops the crossfade to an instant swap. Where
 * auto-advance is on, rotation continues — the request is for less
 * movement, not for a still photo. (globals.css also neutralises
 * transitions globally; the class means this component does not depend on
 * that.)
 *
 * STACKING: the frame is `relative` but deliberately NOT `isolate`. On the
 * product cards the whole card is made clickable by a stretched overlay on
 * the product-name link, and that overlay has to sit ABOVE the photos (so
 * the photo is clickable) but BELOW the prev/next buttons (so paging does
 * not navigate). That only works while the frame leaves its children in the
 * card's stacking context: photos at auto, card overlay at z-10, controls
 * at z-20. Adding `isolate` here would trap the controls under the overlay
 * and silently break paging on the listing page.
 */

export interface CarouselSlide {
  /** Public path, from /public. */
  src: string;
  /** What is in the shot. Never a placeholder like "photo 1". */
  alt: string;
}

interface ImageCarouselProps {
  slides: CarouselSlide[];
  /** Names the carousel for screen readers, e.g. "Photographs of the yard". */
  label: string;
  /**
   * next/image `sizes`. Required, with no default: every caller frames these
   * photos at a different width, and a wrong `sizes` silently ships a
   * desktop-width crop to a phone.
   */
  sizes: string;
  /**
   * Hold time between automatic advances, in ms. Omit for a manual-only
   * carousel — the difference between the hero and the product gallery.
   */
  autoAdvanceMs?: number;
  /**
   * "dots"   position marks, top right, for a carousel that moves by itself
   * "arrows" prev/next buttons plus an "n / total" counter
   * "none"   no chrome (a single slide never gets controls either way)
   */
  controls?: "dots" | "arrows" | "none";
  /**
   * Whatever sizes the frame: an aspect utility for the product cards,
   * explicit heights for the hero, which is sized against the viewport so
   * the buttons on its scrim stay above the fold.
   */
  frameClassName?: string;
  /** Focal point of the crop, e.g. "object-[50%_30%]". */
  objectPositionClassName?: string;
  /**
   * How each frame meets the box: "object-cover" to fill and crop,
   * "object-contain" to letterbox and show the whole image.
   *
   * A prop rather than a constant because the two callers genuinely need
   * different answers. The product galleries are yard photographs where the
   * subject is central and the edges are gravel, so cropping them to a tidy
   * ratio costs nothing. The hero now carries printed banners with the
   * phone numbers baked into the corners, and any crop cuts them off — see
   * the framing note in src/data/property.ts.
   *
   * Written out in full at each call site rather than composed, because
   * Tailwind scans for literal class strings.
   *
   * `objectPositionClassName` is close to meaningless under contain: with
   * the whole image inside the box there is nothing to choose a focal point
   * from, only which side the bars fall on. Callers passing contain should
   * leave the position at its centred default.
   */
  objectFitClassName?: string;
  /**
   * The crossfade. Passed in as a literal class string because Tailwind
   * needs to see `duration-700` written out to generate it.
   */
  crossfadeClassName?: string;
  /** Text rendered over the photos, on a scrim. Hero only. */
  overlay?: ReactNode;
  /** First slide is the page's LCP element. */
  preloadFirst?: boolean;
  className?: string;
}

/** After a manual interaction, how long before auto-advance resumes. */
const RESUME_MS = 8000;

export function ImageCarousel({
  slides,
  label,
  sizes,
  autoAdvanceMs,
  controls = "none",
  frameClassName = "aspect-3/2",
  objectPositionClassName = "object-center",
  objectFitClassName = "object-cover",
  crossfadeClassName = "duration-500 ease-in-out motion-reduce:transition-none",
  overlay,
  preloadFirst = false,
  className = "",
}: ImageCarouselProps) {
  const count = slides.length;
  const [index, setIndex] = useState(0);

  /*
    Three independent reasons to hold still, kept apart on purpose. A dot
    press starts a timed hold, but if the pointer is still over the photos
    that timer must not hand control back — hovering wins until the pointer
    actually leaves.
  */
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [held, setHeld] = useState(false);
  const paused = hovering || focused || held;

  const resumeRef = useRef<number | null>(null);

  /*
    Drip-load. Every slide is stacked inside the viewport, so `loading="lazy"`
    would still fetch the whole set at once on a page that is meant to be
    cheap on mobile data. Instead only the current slide and the next one
    exist in the DOM, and the set grows as the carousel advances. Pressing a
    control means someone is deliberately browsing, so at that point fetch
    the rest.
  */
  const [reach, setReach] = useState(1);
  const [loadAll, setLoadAll] = useState(false);

  useEffect(() => {
    if (autoAdvanceMs === undefined || paused || count < 2) return;
    const id = window.setTimeout(() => {
      const next = (index + 1) % count;
      setIndex(next);
      // Advancing is strictly sequential, so the slide worth having ready is
      // always the one after this.
      setReach((r) => Math.max(r, next + 1));
    }, autoAdvanceMs);
    return () => window.clearTimeout(id);
  }, [autoAdvanceMs, paused, index, count]);

  // Clear the resume timer on unmount so it cannot fire into a dead component.
  useEffect(() => {
    return () => {
      if (resumeRef.current !== null) window.clearTimeout(resumeRef.current);
    };
  }, []);

  /** Hold still for a while. Used by touch and by the control buttons, which
   *  get no pointer-leave event to tell us the interaction is over. */
  function hold() {
    if (autoAdvanceMs === undefined) return;
    setHeld(true);
    if (resumeRef.current !== null) window.clearTimeout(resumeRef.current);
    resumeRef.current = window.setTimeout(() => setHeld(false), RESUME_MS);
  }

  function goTo(next: number) {
    setIndex(((next % count) + count) % count);
    setLoadAll(true);
    hold();
  }

  const showControls = count > 1 && controls !== "none";

  return (
    <div
      /*
        onFocus/onBlur are React's delegated focusin/focusout, so they fire
        for the buttons inside too — this is focus-within behaviour.
      */
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onTouchStart={hold}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      className={`relative w-full overflow-hidden bg-slab-800 ${frameClassName} ${className}`}
    >
      {slides.map((slide, i) => {
        if (!loadAll && i > reach) return null;
        const current = i === index;
        return (
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            fill
            preload={preloadFirst && i === 0}
            sizes={sizes}
            // Only the visible photo is exposed; the stack underneath is not
            // a pile of images to a screen reader.
            aria-hidden={!current}
            className={`${objectFitClassName} ${objectPositionClassName} transition-opacity ${crossfadeClassName} ${
              current ? "opacity-100" : "opacity-0"
            }`}
          />
        );
      })}

      {/*
        Position, announced rather than only drawn. The dots and the counter
        are visual; this is what a screen reader gets when the slide changes.
      */}
      {count > 1 ? (
        <span aria-live="polite" className="sr-only">
          Photo {index + 1} of {count}
        </span>
      ) : null}

      {overlay ? (
        /*
          Contrast floor for the text, and the reason it is a background on
          the text block rather than a fixed fraction of the frame: this block
          reflows — the strapline appears at sm, the headline sets at
          different sizes, the address is a placeholder that will get longer.
          A scrim pinned to a fraction of the frame leaves the top line
          stranded in the faded end of the gradient as soon as the text grows,
          which is exactly where the photographs are brightest. Anchored to
          the text instead, the strong part of the gradient lands under the
          words whatever they reflow to, and the top padding keeps the fade
          itself clear of them.

          THIS SCRIM NEVER REACHES FULL OPACITY, and that is the point.

          It used to: `from-slab-900` is alpha 1.0, so the bottom 40% of
          this block was solid #1a1d1e. With the dark header above it, every
          photograph was bounded top and bottom by flat chrome and read as a
          strip in a window rather than as the page's own ground. For a
          roadside business with no brand the photographs ARE the pitch, so
          burying the bottom of each one was the most expensive decision on
          the page.

          The stops are now the LIGHTEST that still clear WCAG, rather than
          an opaque bar with a fade sitting on top of it. Alpha holds at
          0.90 through the bottom of the block, eases to 0.85 across the
          text, and only then falls away to nothing across the top padding,
          where no text sits. The photo now shows through everywhere it is
          covered.

          HOW THE FLOOR WAS SET. Alpha was solved against the actual files
          rather than against one screenshot. Every photo in the rotation
          was measured over the band this scrim covers (the bottom 28% of
          the source), and the two ends of the set are a long way apart:

            brightest  property-signage-supplies.jpg   p95 luminance 0.579
            darkest    property-entrance-wide.jpg      p95 luminance 0.243
                       ...which also carries a blown highlight of 0.976 —
                       effectively white — inside that same band

          Because one photo in the set really does reach near-white where
          text lands, the floor is still solved against pure white. That
          original decision was right; it was only being met far more
          heavily than it needed to be. Amber eyebrow on slab-900 over pure
          white:

            alpha 0.80   4.29:1   FAILS
            alpha 0.83   4.77:1
            alpha 0.85   5.12:1   <- the stop across the text
            alpha 1.00   8.17:1   <- what this used to be, for no gain

          At 0.85 the other two lines have room to spare: headline 9.81:1,
          strapline 7.39:1. Over the DARKEST photo the same stop measures
          7.07:1 / 13.55:1 / 10.21:1, so the whole range of the set passes,
          not just the one frame that happens to load first.

          The EYEBROW is still the binding constraint and the only line
          worth re-checking if a stop moves: at 12px bold WCAG counts it as
          normal text, so it needs 4.5:1 where the headline needs 3:1 and
          will sail through a change that has already broken the line above
          it. Do not take alpha below 0.85 where the eyebrow sits.
        */
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slab-900/90 from-20% via-slab-900/85 via-80% to-transparent px-4 pt-16 pb-4 sm:px-6 sm:pt-20 sm:pb-6">
          {overlay}
        </div>
      ) : null}

      {showControls && controls === "dots" ? (
        /*
          Top right, over the photo rather than inside the scrim: the hero
          text block is already carrying a headline and two buttons, and a
          row of dots underneath them costs photograph on a phone.
        */
        <div className="absolute right-1 top-1 z-20 flex items-center rounded-slab bg-slab-900/45 px-0.5 backdrop-blur-none sm:right-2 sm:top-2">
          {slides.map((slide, i) => {
            const current = i === index;
            return (
              <button
                key={slide.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={current ? "true" : undefined}
                // 32x40 hit area around an 8px mark — thumb-sized without a
                // row of dots wide enough to crowd the frame.
                className="flex h-10 w-8 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-slab transition-colors duration-150 ease-plain ${
                    current ? "bg-hivis" : "bg-slab-50/50 hover:bg-slab-50/90"
                  }`}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      {showControls && controls === "arrows" ? (
        <>
          <CarouselArrow
            direction="prev"
            onClick={() => goTo(index - 1)}
            label={`Previous photo, ${index + 1} of ${count}`}
          />
          <CarouselArrow
            direction="next"
            onClick={() => goTo(index + 1)}
            label={`Next photo, ${index + 1} of ${count}`}
          />
          {/*
            The counter, not a row of dots: these sets run to three photos in
            a card that is already carrying a name, a badge, a price and a
            status. A "2 / 3" is one small block instead of a control that
            has to be aimed at.
          */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1.5 right-1.5 z-20 rounded-slab bg-slab-900/70 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slab-50 tabular-nums"
          >
            {index + 1} / {count}
          </span>
        </>
      ) : null}
    </div>
  );
}

function CarouselArrow({
  direction,
  onClick,
  label,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-slab border-2 border-slab-900/20 bg-slab-900/65 text-lg font-bold text-slab-50 transition-colors duration-150 ease-plain hover:bg-slab-900 ${
        isPrev ? "left-1.5" : "right-1.5"
      }`}
    >
      <span aria-hidden="true">{isPrev ? "‹" : "›"}</span>
    </button>
  );
}
