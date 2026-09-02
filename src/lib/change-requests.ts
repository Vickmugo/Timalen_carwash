/**
 * =====================================================================
 * STAGED CONTENT-CHANGE REQUESTS — SUBJECTS AND HAND-OFF TEXT
 * ---------------------------------------------------------------------
 * The staff view lets the yard DRAFT a request to change what the site
 * says. It does not let them change it. Prices and products are compiled
 * into the build from src/data/services.ts and src/data/products.ts, and
 * the only thing that moves one is a developer editing that file.
 *
 * This module supplies the two halves the staff view needs:
 *
 *   washSubjectsFor()  one vehicle column of the wash board, and
 *   otherSubjectGroups()
 *                      everything not priced by vehicle — both derived from
 *                      the real catalogue, so a request can never name an
 *                      item that does not exist or quote a price nobody
 *                      charges
 *
 *   requestText()      the request as plain text a person can paste into a
 *                      chat, which is the whole delivery mechanism
 *
 * WHY THE SUBJECT LIST IS DERIVED, NOT TYPED. A free-text "which item?"
 * field would let somebody write "the small slabs" and leave the developer
 * guessing which of five products and three price columns that is. Reading
 * the catalogue means the request arrives already unambiguous, and it
 * stays correct when the catalogue changes without anybody remembering
 * this file exists.
 * =====================================================================
 */

import { productCategories, products } from "@/data/products";
import { flatPriceGroups, vehicleTypes, washPriceRows } from "@/data/services";
import { formatKes, formatTimestamp } from "@/lib/format";
import type {
  ChangeRequest,
  ChangeRequestKind,
  ChangeRequestStatus,
  VehicleTypeId,
} from "@/types";

/* ------------------------------------------------------------------ */
/* The wording that keeps this honest                                  */
/* ------------------------------------------------------------------ */

/**
 * SAID IN THREE PLACES, AND THAT IS THE POINT.
 *
 * The long version heads the section; the short version is repeated on
 * every card and again at the bottom of every copied message. That is
 * deliberate duplication, not an oversight.
 *
 * A notice at the top of a list is read once, on the first visit, and is
 * then scrolled past forever — and the specific mistake this is guarding
 * against is somebody drafting "Slabs: 550 -> 600", seeing it sit in a
 * list looking exactly like the bookings and orders above it (which ARE
 * real records of real things), and going home believing the price
 * changed. That belief costs a customer the wrong price at the counter.
 *
 * The copy in `requestText` carries it too, because the message outlives
 * this screen: it lands in a chat thread where none of the surrounding
 * wording is there to explain it.
 */
export const NOT_LIVE_BANNER =
  "These are requests, not live changes — nothing here updates the site until sent to the developer and applied.";

/** The same fact, short enough to sit on every card without becoming noise. */
export const NOT_LIVE_CARD = "Request only. Nothing on the site has changed.";

/* ------------------------------------------------------------------ */
/* What there is to ask about                                          */
/* ------------------------------------------------------------------ */

export interface ChangeSubject {
  /** Opaque and stable: "product:slab", "wash:body-wash:saloon". */
  id: string;
  /** What the select shows and what gets stored on the request. */
  label: string;
  /** `null` where the board cell has never been read. */
  currentPriceKes: number | null;
  /** e.g. "per piece". Empty for wash services, which are priced per job. */
  unitLabel: string;
  /**
   * The name WITHOUT the vehicle column — "Body Wash" where `label` reads
   * "Body Wash - Saloon".
   *
   * Both exist because they are read in two different places. Once the
   * vehicle has been picked in step one, repeating it on all eleven options
   * underneath is noise. But `label` is what gets STORED on the request and
   * sent to the developer, who has no chips on screen and for whom "Body
   * Wash" alone is the ambiguity this whole subject list exists to remove.
   *
   * Identical to `label` for anything not priced by vehicle.
   */
  shortLabel: string;
}

export interface ChangeSubjectGroup {
  label: string;
  subjects: ChangeSubject[];
}

/**
 * ONE VEHICLE COLUMN OF THE WASH BOARD.
 *
 * On this board a service does not have "a price" — Body Wash is 200 for a
 * saloon and 300 for a pick-up — so a subject is a CELL, not a row, and the
 * vehicle has to be settled before the price is.
 *
 * That used to be done by flattening all eleven services against all three
 * columns into one thirty-three-option dropdown. It was correct and it was
 * unusable: a scrolling list where every item appears three times, on a
 * phone, in a yard. The customer-facing booking flow had already solved the
 * identical problem — pick the vehicle, then see that column's prices — and
 * having two different answers to one question in one codebase is worse
 * than either answer. See src/app/book/BookingFlow.tsx.
 *
 * UNREAD CELLS ARE INCLUDED, priced `null` and labelled as not listed.
 * They are the three services whose figures nobody could read off the
 * photographed board, which makes them the single most likely thing the
 * client will want to supply. Filtering them out would hide the exact rows
 * this tool exists to fix. (BookingFlow greys them out instead, because a
 * customer cannot book a price that does not exist — here, supplying that
 * price is the entire point of the request.)
 */
export function washSubjectsFor(vehicleTypeId: VehicleTypeId): ChangeSubject[] {
  const vehicle = vehicleTypes.find((type) => type.id === vehicleTypeId);
  if (!vehicle) return [];

  return washPriceRows.map((row) => ({
    id: `wash:${row.id}:${vehicle.id}`,
    label: `${row.name} - ${vehicle.name}`,
    shortLabel: row.name,
    currentPriceKes: row.prices[vehicle.id],
    unitLabel: "",
  }));
}

/**
 * Everything whose price does NOT depend on a vehicle column, grouped
 * exactly as it always was.
 *
 * Carpets, lorries, buses and motorbikes are one flat price each whatever
 * turns up, and a slab costs what a slab costs. Neither has a column to
 * pick first, so neither gained a step — these two groups are unchanged,
 * and together they are about ten options rather than thirty-three.
 */
export function otherSubjectGroups(): ChangeSubjectGroup[] {
  const flat: ChangeSubject[] = flatPriceGroups.flatMap((group) =>
    group.rows.map((row) => ({
      id: `flat:${group.id}:${row.id}`,
      label: `${group.name} - ${row.name}`,
      shortLabel: `${group.name} - ${row.name}`,
      currentPriceKes: row.priceKes,
      unitLabel: "",
    })),
  );

  const catalogue: ChangeSubject[] = products.map((product) => ({
    id: `product:${product.id}`,
    label: product.name,
    shortLabel: product.name,
    currentPriceKes: product.priceKes,
    unitLabel: product.unitLabel,
  }));

  return [
    { label: "Other wash work", subjects: flat },
    { label: "Concrete products", subjects: catalogue },
  ];
}

/**
 * The stock question is a PRODUCTS question only.
 *
 * A wash service is not stocked: the bay either runs or it does not, and
 * that is an opening-hours matter handled in src/data/business.ts. Offering
 * "mark Body Wash out of stock" would invite a request nobody can action.
 */
export function stockSubjects(): ChangeSubject[] {
  return products.map((product) => ({
    id: product.id,
    label: product.name,
    shortLabel: product.name,
    currentPriceKes: product.priceKes,
    unitLabel: product.unitLabel,
  }));
}

/**
 * Looks a subject up wherever it lives. Undefined if the id is stale.
 *
 * Searches every vehicle column as well as the two flat groups, so it does
 * not depend on which step the caller happens to be on — and so an id saved
 * before this form was split in two still resolves. Subject ids did not
 * change when it was: a "wash:body-wash:saloon" written by the old flat
 * dropdown is the same string this one produces.
 */
export function findSubject(id: string): ChangeSubject | undefined {
  for (const vehicle of vehicleTypes) {
    const hit = washSubjectsFor(vehicle.id).find(
      (subject) => subject.id === id,
    );
    if (hit) return hit;
  }
  for (const group of otherSubjectGroups()) {
    const hit = group.subjects.find((subject) => subject.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Labels                                                             */
/* ------------------------------------------------------------------ */

const kindLabels: Record<ChangeRequestKind, string> = {
  price: "Price change",
  new_item: "New product or service",
  stock: "Stock",
};

export function kindLabel(kind: ChangeRequestKind): string {
  return kindLabels[kind];
}

const statusLabels: Record<ChangeRequestStatus, string> = {
  draft: "Draft",
  sent: "Sent",
};

/**
 * Exported so the badge, the filter buttons and the copied text all spell
 * these the same way — the same reason `quoteLabel` exists in Badge.tsx.
 */
export function changeStatusLabel(status: ChangeRequestStatus): string {
  return statusLabels[status];
}

/** The category as a person reads it, including the free-text escape. */
export function categoryLabel(
  categoryId: string,
  otherCategory: string,
): string {
  const known = productCategories.find(
    (category) => category.id === categoryId,
  );
  if (known) return known.name;
  return otherCategory.trim()
    ? `${otherCategory.trim()} (new category)`
    : "New category, not described";
}

/** "KES 550 per piece", or an honest blank. */
function priceWithUnit(price: number | null, unitLabel: string): string {
  if (price === null) return "not listed";
  return unitLabel ? `${formatKes(price)} ${unitLabel}` : formatKes(price);
}

/* ------------------------------------------------------------------ */
/* The hand-off                                                        */
/* ------------------------------------------------------------------ */

/**
 * ONE REQUEST AS A PLAIN-TEXT MESSAGE.
 *
 * This is not a debug dump with a label glued to the front — it is the
 * entire delivery mechanism. It gets pasted into a WhatsApp thread and read
 * on a phone by somebody who is not looking at this screen, so:
 *
 *   - every value is labelled, because "550 -> 600" a week later is a
 *     riddle about which of five products it was
 *   - no markdown, no box drawing, no emoji. WhatsApp renders none of it
 *     and a plain line break survives every client there is
 *   - the current value travels WITH the proposed one. A request saying
 *     only "make it 600" cannot be sanity-checked by the person applying
 *     it, and a typo'd extra zero looks exactly like a real instruction
 *   - the reference is included so a reply can name the request rather
 *     than describe it
 *   - the not-live line is last, where it is the thing still on screen
 *     when the reader stops
 *
 * Blank optional fields are OMITTED rather than printed empty: "Note:"
 * with nothing after it reads as a message that got truncated.
 */
export function requestText(request: ChangeRequest): string {
  const lines: string[] = [
    `${kindLabel(request.kind).toUpperCase()} REQUEST`,
    `Reference: ${request.ref}`,
    `Raised by: ${request.by}, ${formatTimestamp(request.createdAt)}`,
    "",
  ];

  switch (request.kind) {
    case "price": {
      lines.push(
        `Item: ${request.subjectLabel}`,
        `Current price: ${
          request.currentPriceKes === null
            ? "not listed on the site"
            : formatKes(request.currentPriceKes)
        }`,
        `Proposed price: ${formatKes(request.proposedPriceKes)}`,
      );
      break;
    }
    case "new_item": {
      lines.push(
        `Item: ${request.name}`,
        `Category: ${categoryLabel(request.categoryId, request.otherCategory)}`,
        `Proposed price: ${formatKes(request.proposedPriceKes)}`,
      );
      if (request.description.trim()) {
        lines.push(`Description: ${request.description.trim()}`);
      }
      if (request.photoNeeded) {
        lines.push("Photo: still needed — none supplied yet.");
      }
      break;
    }
    /*
      NO "CURRENT VALUE" LINE HERE, unlike the other two kinds — because
      there is nothing true to put in it. `Product` in src/types/index.ts
      has a `status` field, but it holds "in the yard" vs "made to order",
      which is a LEAD TIME and not a stock level. The catalogue has no
      concept of out-of-stock at all today.

      So the message states only what is being asked for. Printing
      "Currently: available" would be this app inventing a fact about the
      yard from the absence of a field, which is exactly the habit the
      price-board work was done to break.
    */
    case "stock": {
      lines.push(
        `Item: ${request.subjectLabel}`,
        `Change to: ${
          request.intent === "out_of_stock" ? "OUT OF STOCK" : "BACK IN STOCK"
        }`,
      );
      break;
    }
  }

  if (request.note.trim()) {
    lines.push("", `Note: ${request.note.trim()}`);
  }

  lines.push(
    "",
    "This is a request, not a change. Nothing on the site is different until it is applied.",
  );

  return lines.join("\n");
}

/**
 * The wa.me click-to-chat URL with NO RECIPIENT.
 *
 * Deliberately no phone number in the path. Dropping the developer's number
 * in here would hardcode one person into the build — wrong the day the work
 * changes hands, and wrong right now for a yard that might send this to a
 * colleague first. With no number, WhatsApp opens on the contact picker and
 * whoever is holding the phone chooses.
 *
 * `encodeURIComponent` rather than URLSearchParams: the latter encodes a
 * space as "+", which wa.me passes through literally into the message body.
 */
export function whatsappDraftUrl(request: ChangeRequest): string {
  return `https://wa.me/?text=${encodeURIComponent(requestText(request))}`;
}

/**
 * One line of the staff view's subject dropdown: the name, then what it
 * costs today.
 *
 * The current price is on the option itself and not somewhere below it,
 * because the commonest request of all is "put this up a bit" — and without
 * the figure in front of them the person drafting it is doing arithmetic
 * from memory against a board in another building.
 *
 * `short` drops the vehicle column from the name. Pass it when the list has
 * already been narrowed to one column by the step above; see `shortLabel`.
 */
export function subjectOptionLabel(
  subject: ChangeSubject,
  short = false,
): string {
  const name = short ? subject.shortLabel : subject.label;
  return `${name} — ${priceWithUnit(subject.currentPriceKes, subject.unitLabel)}`;
}
