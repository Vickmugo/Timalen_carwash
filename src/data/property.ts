/**
 * PREMISES PHOTOGRAPHY — the home page hero
 *
 * Real photographs of the yard, shown in the order they appear below.
 * To add, remove or reorder a photo: drop the file in
 * /public/images/property/ and edit this array. PropertyCarousel reads the
 * array as it finds it and needs no change.
 *
 * ORDER — the first entry is the hero's LCP image and the one most visitors
 * will see. It is the wide entrance shot on purpose: it is the only frame
 * that shows BOTH trades at once (the auto cleaners' banner and the green
 * suppliers' container with the concrete range painted on it), which is the
 * whole pitch of the page in one photograph. The rotation then alternates
 * between the wash bay and the concrete side rather than grouping them, so
 * a visitor who watches two or three slides sees both.
 *
 * FRAMING — read this before adding a photo.
 * The hero is sized against the viewport, not to a fixed ratio: roughly
 * 4:5 upright on a phone, and much wider than 2:1 on a desktop. So each of
 * these files is cropped hard, and differently, depending on the screen.
 * The one thing that makes a single frame work across all of that is the
 * focal point set 30% down (`object-[50%_30%]` in PropertyCarousel): the
 * set deliberately mixes 4:3 landscape and 3:4 portrait originals, and in
 * every photo here the subject sits in the upper two thirds while the
 * bottom third is open ground. A top-weighted crop keeps the subject and
 * throws away dirt at every screen width.
 *
 * A photo with its subject low in the frame — or one that needs its full
 * height or its full width to read — will be cropped badly. Crop it
 * yourself first.
 *
 * SCRIM — the headline and both buttons sit on a gradient over the bottom
 * of these photos. That gradient is sized for the brightest photo in the
 * set, not for whichever one you happen to be looking at. If you add a
 * photo that is paler at the bottom than the entrance shot, re-check the
 * text contrast over it before shipping.
 *
 * `alt` is what the photo actually shows. It is read aloud by screen
 * readers and it is what a customer sees if the image fails on a weak
 * connection, so it describes the scene rather than naming a file.
 *
 * NOT IN THE ROTATION:
 * property-washbay-04.jpg is a real photo of the bay and is kept in the
 * repo, but it is held back from the hero: the number plate on it has been
 * blacked out with a solid rectangle, and at hero size that redaction reads
 * as a rendering fault rather than as privacy. It is fine at thumbnail size
 * if a gallery is ever added.
 */

export interface PropertyPhoto {
  /** Public path, from /public. */
  src: string;
  /** What is in the shot. Never a placeholder like "photo 1". */
  alt: string;
}

export const propertyPhotos: PropertyPhoto[] = [
  {
    src: "/images/property/property-entrance-wide.jpg",
    alt: "The whole roadside premises seen from the verge: a timber-post canopy carrying the Timalen Auto Cleaners banner over two parked cars, and beside it the green iron-sheet Timalen General Suppliers office with the concrete range hand-painted along its wall and sample spindles standing out front.",
  },
  {
    src: "/images/property/property-washbay-01.jpg",
    alt: "Cars parked on the gravel forecourt under the open iron-sheet canopy, with the green shop wall advertising concrete posts on the right.",
  },
  {
    src: "/images/property/property-signage-supplies.jpg",
    alt: "The green iron-sheet wall of Timalen General Suppliers, hand-painted with the concrete range — posts, air vents, road kerbs, spindles, channels, slabs, cabros and culverts — with sample cast slabs leaning against it.",
  },
  {
    src: "/images/property/property-action-wash.jpg",
    alt: "A worker leaning over the front of a dark red saloon car, cleaning it on the open forecourt with a forested hillside behind.",
  },
  {
    src: "/images/property/property-washbay-03.jpg",
    alt: "A washed dark red saloon standing on the wet gravel under the canopy, still beaded with water, with the main road and the shops opposite visible past it.",
  },
  {
    src: "/images/property/property-signage-autocleaners.jpg",
    alt: "The Timalen Auto Cleaners banner fixed under the canopy roof, listing bodywash, interior cleaning, buffing, carpet cleaning, motorbikes and underwash.",
  },
  {
    src: "/images/property/property-washbay-02.jpg",
    alt: "A wider view of the wash bay, with several vehicles standing under the long iron-sheet canopy on the gravel yard.",
  },
  {
    src: "/images/property/property-signpost.jpg",
    alt: "Hand-painted metal signs on rebar posts at the roadside, reading TIMALEN above and CAR WASH below with an arrow pointing off the main road towards the yard.",
  },
];
