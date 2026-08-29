# Product photos

Drop real product photos in this folder, then point at them from
`src/data/products.ts`.

## How to add a photo

1. Save the image here, e.g. `round-planter.jpg`
2. Open `src/data/products.ts`, find that product, and change:

   ```ts
   image: null,
   ```

   to:

   ```ts
   image: "/images/products/round-planter.jpg",
   ```

No component code needs to change. Until `image` is set, the site renders a
labelled placeholder block at the same size, so the layout does not shift when
the real photo arrives.

## What to shoot

- Roughly **4:3 landscape**. Cards crop to 4:3, the detail page to 16:10 on
  wider screens, both centred.
- **1200 x 900 px is plenty.** Bigger files just cost your customers mobile
  data. Compress before uploading.
- One product per frame, in daylight, against a plain part of the yard.
