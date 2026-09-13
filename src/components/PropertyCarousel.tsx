import { ImageCarousel } from "@/components/ImageCarousel";
import { propertyPhotos } from "@/data/property";
import type { ReactNode } from "react";

/**
 * PREMISES CAROUSEL — the home page hero.
 *
 * The business's own two printed banners and the storefront they hang on,
 * full width, on a slow crossfade. This is the only looping
 * animation in the app (see the motion policy in globals.css) and it is
 * paced like a shopfront window, not like a UI control: a long hold, a long
 * dissolve.
 *
 * All of the carousel machinery lives in ImageCarousel, which the product
 * galleries share. What is left here is the configuration that makes this
 * one a hero rather than a gallery: it advances by itself, it carries text,
 * and it is the LCP image.
 *
 * This component is NOT a client component. ImageCarousel is, and it is the
 * only client boundary the home page crosses — the headline and the two
 * buttons that sit on top of the photos are passed through as `children`
 * and stay server-rendered.
 */

/**
 * How long a photo holds before the next begins to appear. Long, because
 * this is a window display; a visitor reading the two buttons should not
 * have the background changing under them every couple of seconds.
 */
const HOLD_MS = 6000;

export function PropertyCarousel({ children }: { children?: ReactNode }) {
  return (
    <ImageCarousel
      slides={propertyPhotos}
      label="Timalen's banners and premises"
      autoAdvanceMs={HOLD_MS}
      controls="dots"
      /*
        Sized against the viewport rather than to a ratio, and capped at both
        ends. The floor stops the frame collapsing on a short landscape
        phone; the ceiling stops a tall desktop window turning the hero into
        a full-screen takeover that buries everything below it.

        The upper bound matters more than it looks: the two buttons sit on
        this frame's scrim, so the hero's height IS the distance to the
        primary action. That is the constraint the viewport fractions below
        are set against.

        WHAT THE CONTAIN FIT CHANGED. Under `object-cover` the frame could
        be any shape it liked, because every photo filled it. Under contain
        the frame's shape decides how big each slide renders, so the numbers
        below are solved rather than chosen:

          - The WIDEST slide the frame must hold whole is the concrete
            banner at 1.80:1. At any frame width W it renders W / 1.80 tall.
            (The wash banner is 4.91:1 and renders far shorter than that; it
            is not the binding case.)
          - The scrim carrying the headline and both buttons needs roughly
            13rem of its own at the bottom of the frame, and with
            `object-top` above it that band is clear matting rather than
            covered artwork.

        So the frame wants to be about W / 1.80 + 13rem tall, which across
        the widths this page actually meets lands near the fractions below.
        The floor is what a phone needs (the banner plus a two-button stack
        that does not sit on top of it); the ceilings still only catch the
        genuinely extreme case of a very tall desktop window.

        Shortening this frame does NOT make the banners bigger — they are
        width-limited, not height-limited — it only slides the buttons up
        over the artwork. Widening the page is the only thing that makes
        them bigger.
      */
      frameClassName="h-[62svh] min-h-[27rem] max-h-[34rem] sm:h-[66svh] sm:min-h-[26rem] sm:max-h-[40rem] lg:h-[72svh] lg:max-h-[46rem]"
      /*
        WHOLE FRAMES, NOT CROPS. Two of the three slides are printed banners
        with the phone numbers and the product names baked into the pixels
        hard against the edges, so any crop at all cuts something a customer
        needs — see the framing note in src/data/property.ts, which also
        carries the aspect ratios the frame above is solved against.
      */
      objectFitClassName="object-contain"
      /*
        Top-aligned rather than centred, and this is the pair to the frame
        height above rather than a taste. Contain leaves spare height as
        bars; centring splits them top and bottom, which puts the scrim —
        and therefore the headline and both buttons — straight over the
        bottom of the artwork, i.e. over the phone numbers on the wash
        banner and the CALL US line on the concrete one. Pushed to the top,
        the whole of the spare height collects underneath as one band and
        the scrim lands on matting instead.

        A focal point (`object-[50%_30%]`, as this used to carry) means
        nothing under contain — there is no crop to choose the centre of.
      */
      objectPositionClassName="object-top"
      crossfadeClassName="duration-700 ease-in-out motion-reduce:transition-none"
      /*
        Still 100vw. Under contain a slide is never rendered WIDER than the
        frame, and the widest it gets is exactly the frame width (the two
        banners, both landscape). So the viewport width remains the correct
        upper bound to size the source against — contain makes this hint
        conservative, never wrong.
      */
      sizes="100vw"
      preloadFirst
      overlay={children}
    />
  );
}
