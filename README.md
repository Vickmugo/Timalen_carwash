# Car wash + concrete works — demo (v1)

A clickable Next.js prototype for a business running a **car wash** and a
**concrete products / mould-making** operation on one premise in Kenya.

Two separate flows under one brand:

- **Book a Wash** — service → date/time slot → contact details → mock checkout → confirmation
- **Concrete Products** — category browse → product detail → cart → mock checkout,
  or **Request a Quote** for bulk and custom orders

```bash
npm install
npm run dev     # http://localhost:3000
```

## What this demo is NOT

Nothing here is production-ready, and several things are deliberately fake:

| Area | Status |
| --- | --- |
| Payments | **Stubbed.** `src/lib/payment.ts` waits 1.6s and reports success. No API is called, no money moves. |
| Storage | **Browser localStorage only** (`src/lib/store.ts`). One device, one browser. Clearing site data erases everything. |
| Admin auth | **None.** `/admin` is public. See the warning comment at the top of `src/app/admin/page.tsx`. |
| Accounts | None. No login anywhere. |
| Inventory | Not tracked, by design. Each product has a hand-set `ready_to_ship` / `made_to_order` flag instead of a stock count. |

## Where to edit business content

All editable content is typed and lives in `src/data/` — no need to touch any
component.

| File | Holds |
| --- | --- |
| `src/data/business.ts` | Trading name, phone, WhatsApp, email, location, **operating hours** |
| `src/data/services.ts` | Wash tiers, prices, and each tier's own `durationMinutes` |
| `src/data/products.ts` | Products, prices, specs, `status`, and image paths |
| `src/data/config.ts` | Slot grid, booking window, lead time, **quote threshold**, payment label |

## How slot booking works

One wash bay, so one booking per overlapping interval.

Each service declares its **own** `durationMinutes` (`src/data/services.ts`) —
only the 30-minute entry tier is confirmed, so a longer service can be given a
real duration later with no code change. Candidate start times step by
`bookingConfig.slotGridMinutes` (30), and a slot is offered only if the full
service duration fits before closing **and** does not overlap an existing
booking. A 90-minute wax booking at 09:30 therefore correctly blocks the 09:30,
10:00 and 10:30 slots for a 30-minute wash.

## How the quote threshold works

Evaluated in one place — `src/lib/quote.ts`, reading `quoteRules` from
`src/data/config.ts`. A cart is pushed to the quote form instead of checkout if
**any** of these are true:

- more than `maxUnitsPerLine` (50) of a single item
- cart subtotal above `maxOrderTotalKes` (KES 150,000)
- any product flagged `quoteOnly: true` (custom / decorative work)

Quote requests take no payment.

## Product photos

Drop files in `public/images/products/` and set the `image` field on that
product in `src/data/products.ts`. Until then a labelled placeholder block
renders at the same aspect ratio, so nothing shifts when the real photo lands.
See `public/images/products/README.md`.

## Design system — "Yard Signage"

Concrete greys with a faint cool cast, dark wet-concrete chrome, and **one**
accent: hi-vis site amber (always with dark text on it). Green and red are
reserved for status and errors only. Type is Archivo, self-hosted via
`next/font`. Shapes are 4px radii with 2px borders — slab edges, not pills.

Motion is entrances only, 150–300ms, ease-out, and fully disabled under
`prefers-reduced-motion`. No animation library, no infinite loops, no
glassmorphism — this is built for a mid-range Android phone on mobile data.

## Before this goes live

1. Put `/admin` behind real authentication (see the comment in that file).
2. Replace `processPayment()` with a server-side call to Pesapal / Flutterwave /
   IntaSend, and confirm payment from their webhook — not from the browser.
3. Replace `src/lib/store.ts` with real API routes and a database.
4. Confirm every value marked `TODO / CONFIRM WITH CLIENT` in `src/data/`.
