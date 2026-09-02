import { ImageCarousel } from "@/components/ImageCarousel";
import { propertyPhotos } from "@/data/property";
import type { ReactNode } from "react";

/**
 * PREMISES CAROUSEL — the home page hero.
 *
 * The real yard, full width, on a slow crossfade. This is the only looping
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
      label="Photographs of the yard"
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
        are set against — NOT the max-heights, which is where this was
        previously losing its presence.

        WHAT CHANGED. The svh fractions are close to where they were; the
        pixel CEILINGS have gone up hard (34/40/46rem -> 40/48/58rem). Those
        caps were the real problem. On any reasonably tall screen the cap
        bound before the viewport fraction did, so the hero stopped growing
        with the window and sat as a fixed band of photograph with page
        above and below it — which is precisely what "sitting in a bounded
        window" describes. A cap that binds on ordinary screens is not a
        safety rail, it is the layout.

        The fractions still govern the fold. 70svh plus a wrapped mobile
        header (~14svh) puts the buttons around 84svh — comfortably above
        the fold on the shortest phone this is likely to meet, which was the
        original reasoning and still holds. The caps now only catch the
        genuinely extreme case they were meant for: a very tall or rotated
        desktop window, where 86svh of photograph would bury the page.
      */
      frameClassName="h-[70svh] min-h-[24rem] max-h-[40rem] sm:h-[74svh] sm:max-h-[48rem] lg:h-[82svh] lg:max-h-[58rem]"
      /*
        The shared focal point that makes one frame work for both
        orientations in the set — see the framing note in
        src/data/property.ts before changing it.
      */
      objectPositionClassName="object-[50%_30%]"
      crossfadeClassName="duration-700 ease-in-out motion-reduce:transition-none"
      // Full-bleed, edge to edge, at every width.
      sizes="100vw"
      preloadFirst
      overlay={children}
    />
  );
}
