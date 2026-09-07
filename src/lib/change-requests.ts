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
import { formatKes, formatTimestamp } from "@/lib/format";
import type {
  ChangeRequest,
  ChangeRequestKind,
  ChangeRequestStatus,
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
  /**
   * e.g. "per piece".
   *
   * No `currentPriceKes` any more: a subject is only ever a product now,
   * and the request kinds that remain do not quote a current price. The
   * price editor reads live figures from the price book instead.
   */
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
 * THE PRICE SUBJECTS ARE GONE — `washSubjectsFor`, `otherSubjectGroups`
 * and `findSubject` with them.
 *
 * They existed to name a cell of the price board so a request could be
 * raised against it. Prices are now edited directly in the staff view and
 * take effect immediately, so there is nothing left to raise a request
 * about; the two-step vehicle-then-service picker those functions fed was
 * carried over to the price editor itself, which is where that interaction
 * now belongs.
 *
 * `stockSubjects` below survives because the stock question survives: the
 * catalogue still has no out-of-stock field, and only a developer can add
 * one.
 */

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
    unitLabel: product.unitLabel,
  }));
}

/* ------------------------------------------------------------------ */
/* Labels                                                             */
/* ------------------------------------------------------------------ */

const kindLabels: Record<ChangeRequestKind, string> = {
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
  return subject.unitLabel ? `${name} — ${subject.unitLabel}` : name;
}
