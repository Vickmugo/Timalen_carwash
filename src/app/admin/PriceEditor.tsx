"use client";

/**
 * =====================================================================
 * THE PRICE EDITOR — live, immediate, and logged.
 * ---------------------------------------------------------------------
 * NOT A REQUEST FORM. This is the opposite of the change-request section
 * it replaced: there is no draft, no "mark as sent", no developer in the
 * loop. Typing a number here and pressing Save changes what the next
 * customer pays, within a second, on the public site.
 *
 * That is what the brief asked for, and it is worth being clear-eyed about
 * what it means. Anybody holding the shared staff password can reprice the
 * whole board. There is no approval step and no undo button — the only
 * safety net is the log at the bottom of this screen, which records what a
 * figure was before it moved and the name the editor typed at sign-in.
 * The server stamps that name from the session, but it is self-reported
 * (see src/lib/session.ts), so the log tells you what happened, not
 * provably who did it.
 *
 * THE TWO-STEP PICKER IS BORROWED, DELIBERATELY. Pick the vehicle column,
 * then edit that column's eleven services. It is the same shape as the
 * customer's booking flow and the same shape the price-change request form
 * used before it was removed — because it is the same question, and a
 * codebase that answers one question three different ways teaches nobody
 * anything. On this board Body Wash is 200 for a saloon and 300 for a
 * pick-up, so the column has to be settled before a figure means anything.
 *
 * NO DEFAULT COLUMN, for the reason BookingFlow gives: a column left on
 * whatever was selected first would let somebody edit the saloon price
 * believing they were editing the pick-up one.
 * =====================================================================
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { products } from "@/data/products";
import { flatPriceGroups, vehicleTypes, washPriceRows } from "@/data/services";
import { formatKes, formatTimestamp } from "@/lib/format";
import { flatPrice, productKey, productPrice, washPrice } from "@/lib/prices";
import type { PriceBook, PriceCell, VehicleTypeId } from "@/types";

/* ------------------------------------------------------------------ */
/* Data plumbing                                                       */
/* ------------------------------------------------------------------ */

interface PriceChangeEntry {
  id: string;
  /** Named on the server from the data files: "Fencing Posts, 7 ft". */
  item: string;
  oldPriceKes: PriceCell;
  newPriceKes: PriceCell;
  by: string;
  at: string;
}

type PriceSection = "wash" | "flat" | "product";

/** How the banner names a section the server could not read. */
const SECTION_NAMES: Record<PriceSection, string> = {
  wash: "wash board",
  flat: "other wash work",
  product: "concrete product",
};

/** What one cell needs to identify itself to the server. */
type CellKey =
  | { kind: "wash"; serviceId: string; vehicleTypeId: VehicleTypeId }
  | { kind: "flat"; id: string }
  /** `variantId` only for a product sold by height. */
  | { kind: "product"; id: string; variantId?: string };

/** A stable string per cell, for keying React state about it. */
function cellId(key: CellKey): string {
  if (key.kind === "wash") return `wash:${key.serviceId}:${key.vehicleTypeId}`;
  if (key.kind === "product") return `product:${productKey(key.id, key.variantId)}`;
  return `flat:${key.id}`;
}

const EMPTY_BOOK: PriceBook = { wash: {}, flat: {}, product: {} };

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

export function PriceEditor() {
  const [book, setBook] = useState<PriceBook>(EMPTY_BOOK);
  // Null when the log itself could not be read — not the same as empty.
  const [changes, setChanges] = useState<PriceChangeEntry[] | null>([]);
  const [unavailable, setUnavailable] = useState<PriceSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Which vehicle column is being edited. Null until chosen; see header.
  const [column, setColumn] = useState<VehicleTypeId | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/prices", { cache: "no-store" });
      if (response.status === 401) {
        setLoadError("Your session has expired. Reload to sign in again.");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as {
        priceBook: PriceBook;
        unavailable: PriceSection[];
        changes: PriceChangeEntry[] | null;
      };
      setBook(body.priceBook);
      setUnavailable(body.unavailable);
      setChanges(body.changes);
      setLoadError(null);
    } catch {
      setLoadError("Could not load prices. They may be out of date.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  /**
   * Saves one cell, then refetches the book and the log.
   *
   * Refetched rather than patched in place: what is on screen after a save
   * should be what the database holds, and the log entry the server just
   * wrote is part of that. It is one extra round trip on an action that
   * happens a few times a week.
   */
  const save = useCallback(
    async (key: CellKey, priceKes: PriceCell): Promise<boolean> => {
      const response = await fetch("/api/prices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: key.kind,
          ...(key.kind === "wash"
            ? { serviceId: key.serviceId, vehicleTypeId: key.vehicleTypeId }
            : key.kind === "product"
              ? { id: key.id, variantId: key.variantId }
              : { id: key.id }),
          priceKes,
        }),
      }).catch(() => null);

      if (!response || !response.ok) return false;
      await load();
      return true;
    },
    [load],
  );

  const column_ = column;
  const washRows = useMemo(() => washPriceRows, []);

  if (loading) {
    return <p className="p-4 text-sm text-slab-500">Loading prices...</p>;
  }

  return (
    <div className="p-3 md:p-4">
      {loadError ? (
        <p className="mb-4 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800">
          {loadError}
        </p>
      ) : null}

      {/*
        A SECTION THE SERVER COULD NOT READ shows every row as "not listed"
        below, and so does the public site. Said here in so many words,
        because otherwise the obvious fix — typing the prices back in — is
        the wrong one: the figures are still in the database, unread.
      */}
      {unavailable.length > 0 ? (
        <p
          role="alert"
          className="mb-4 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800"
        >
          <strong>
            Could not read the{" "}
            {unavailable.map((section) => SECTION_NAMES[section]).join(", ")}{" "}
            prices from the database.
          </strong>{" "}
          Those rows show &ldquo;not listed&rdquo; here and on the public site,
          but that is not what the database holds — do not re-enter them.
          Reload in a minute; if it persists, the database needs looking at.
        </p>
      ) : null}

      {/*
        THE LIVE WARNING. Amber, not dismissible, and phrased as what will
        happen rather than what might. The section it replaced carried the
        opposite warning — "nothing here changes the site" — and somebody
        who learned that habit needs telling, once, plainly, that this one
        is different.
      */}
      <p className="rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-2 text-sm font-semibold text-slab-800">
        These prices are live. Saving one changes what customers are charged
        immediately — there is no draft and no approval step.
      </p>

      {/* ---------------------- wash board ---------------------- */}
      <section className="mt-6" aria-labelledby="price-wash">
        <h3 id="price-wash" className="text-base">
          Wash board
        </h3>
        <p className="mt-1 text-sm text-slab-600">
          Priced per vehicle size. Pick the column first — the same service
          costs different amounts in each.
        </p>

        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Choose a vehicle column"
        >
          {vehicleTypes.map((type) => {
            const active = column_ === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setColumn(active ? null : type.id)}
                aria-pressed={active}
                className={`min-h-11 rounded-slab border-2 px-4 text-sm font-bold transition-colors duration-150 ease-plain ${
                  active
                    ? "border-slab-900 bg-slab-900 text-slab-50"
                    : "border-slab-200 bg-white hover:border-slab-500"
                }`}
              >
                {type.name}
              </button>
            );
          })}
        </div>

        {column_ === null ? (
          <p className="mt-4 rounded-slab border-2 border-slab-200 bg-slab-50 px-3 py-4 text-sm text-slab-600">
            Pick a vehicle column to edit its prices.
          </p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-slab-100 rounded-slab border-2 border-slab-200 bg-white">
            {washRows.map((row) => (
              <PriceRow
                key={row.id}
                label={row.name}
                current={washPrice(book, row.id, column_)}
                cell={{
                  kind: "wash",
                  serviceId: row.id,
                  vehicleTypeId: column_,
                }}
                onSave={save}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------- flat board ---------------------- */}
      <section className="mt-8" aria-labelledby="price-flat">
        <h3 id="price-flat" className="text-base">
          Other wash work
        </h3>
        <p className="mt-1 text-sm text-slab-600">
          One price each, whatever the vehicle. No column to pick.
        </p>

        {flatPriceGroups.map((group) => (
          <div key={group.id} className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slab-500">
              {group.name}
            </h4>
            <ul className="mt-1.5 divide-y-2 divide-slab-100 rounded-slab border-2 border-slab-200 bg-white">
              {group.rows.map((row) => (
                <PriceRow
                  key={row.id}
                  label={row.name}
                  current={flatPrice(book, row.id)}
                  cell={{ kind: "flat", id: row.id }}
                  onSave={save}
                />
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* ---------------------- products ---------------------- */}
      <section className="mt-8" aria-labelledby="price-products">
        <h3 id="price-products" className="text-base">
          Concrete products
        </h3>
        {/*
          This used to read "every one of these is still a placeholder".
          That stopped being true in the September batch — slab, wall caps,
          channels, cornices and cabros are the client's own figures now,
          and every height of fencing posts and spindles after the tiers
          stage. Saying it anyway would train staff to ignore the line, and
          the one that IS still a guess is the one worth naming.

          The paragraph that said this screen could not price a height is
          gone because it can: a product sold by height gets one row per
          height below, and there is no row for the product as a whole.
        */}
        <p className="mt-1 text-sm text-slab-600">
          Road kerbs is still a placeholder nobody has confirmed. Correcting
          it here is the point of this screen.
        </p>
        <p className="mt-1.5 text-sm text-slab-600">
          Fencing posts and spindles are priced per height, one row each.
        </p>

        <ul className="mt-3 divide-y-2 divide-slab-100 rounded-slab border-2 border-slab-200 bg-white">
          {products.flatMap((product) =>
            product.variants
              ? product.variants.map((variant) => (
                  <PriceRow
                    key={productKey(product.id, variant.id)}
                    label={`${product.name}, ${variant.label}`}
                    hint={product.unitLabel}
                    current={productPrice(book, product.id, variant.id)}
                    cell={{
                      kind: "product",
                      id: product.id,
                      variantId: variant.id,
                    }}
                    onSave={save}
                  />
                ))
              : [
                  <PriceRow
                    key={product.id}
                    label={product.name}
                    hint={product.unitLabel}
                    current={productPrice(book, product.id)}
                    cell={{ kind: "product", id: product.id }}
                    onSave={save}
                  />,
                ],
          )}
        </ul>
      </section>

      {/* ---------------------- the log ---------------------- */}
      <section className="mt-8" aria-labelledby="price-log">
        <h3 id="price-log" className="text-base">
          Recent price changes
        </h3>
        <p className="mt-1 text-sm text-slab-600">
          The last {!changes?.length ? "few" : changes.length} changes.
          Names are the ones typed at sign-in: self-reported, not
          verified.
        </p>

        {changes === null ? (
          <p className="mt-3 rounded-slab border-2 border-fail bg-fail-tint px-3 py-4 text-sm text-slab-800">
            Could not load the change log. Prices above are unaffected.
          </p>
        ) : changes.length === 0 ? (
          <p className="mt-3 rounded-slab border-2 border-slab-200 bg-slab-50 px-3 py-4 text-sm text-slab-600">
            No price has been changed yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y-2 divide-slab-100 rounded-slab border-2 border-slab-200 bg-white text-sm">
            {changes.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3 px-3 py-2">
                <span className="w-full font-semibold">{entry.item}</span>
                <span className="font-mono font-bold">
                  {priceText(entry.oldPriceKes)} &rarr;{" "}
                  {priceText(entry.newPriceKes)}
                </span>
                <span className="text-slab-600">
                  {entry.by} <span className="text-slab-500">(self-reported)</span>
                </span>
                <span className="text-slab-500">
                  {formatTimestamp(entry.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** "KES 200", or the honest word for a cell nobody has priced. */
function priceText(price: PriceCell): string {
  return price === null ? "not listed" : formatKes(price);
}

/* ------------------------------------------------------------------ */
/* One editable cell                                                   */
/* ------------------------------------------------------------------ */

/**
 * ONE ROW: the current figure, a box to change it, and a save.
 *
 * The confirmation is INLINE AND TRANSIENT — "was KES 200" appears beside
 * the row for a few seconds after a successful save and then goes. Not a
 * modal, because a modal after every edit would make repricing a column of
 * eleven services eleven dismissals; and not permanent, because a row that
 * accumulates its own history turns the list into a wall of text. The
 * permanent record is the log at the bottom of the screen, which is where
 * somebody looking for it will look.
 */
function PriceRow({
  label,
  hint,
  current,
  cell,
  onSave,
}: {
  label: string;
  hint?: string;
  current: PriceCell;
  cell: CellKey;
  onSave: (key: CellKey, priceKes: PriceCell) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState<PriceCell | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const inputId = `price-${cellId(cell)}`;

  /*
    The confirmation clears itself. `justSaved` holds what the price WAS,
    which is the useful half — the new figure is already displayed as the
    current one.
  */
  useEffect(() => {
    if (justSaved === undefined) return;
    const timer = setTimeout(() => setJustSaved(undefined), 6000);
    return () => clearTimeout(timer);
  }, [justSaved]);

  async function submit(next: PriceCell) {
    setSaving(true);
    setError(null);
    const previous = current;
    const ok = await onSave(cell, next);
    setSaving(false);
    if (!ok) {
      setError("Not saved. Try again.");
      return;
    }
    setDraft("");
    setJustSaved(previous);
  }

  function saveTyped() {
    const raw = draft.trim();
    if (raw === "") return;

    /*
      Whole shillings only. `formatKes` prints no decimals, so accepting
      549.50 would store a figure the site then shows as 550 — a price
      quietly different from the one that was typed. Rejected, not rounded.
    */
    const value = Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      setError("Whole shillings only.");
      return;
    }
    void submit(value);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <div className="min-w-40 flex-1">
        <span className="text-sm font-semibold">{label}</span>
        {hint ? (
          <span className="ml-1.5 text-xs text-slab-500">{hint}</span>
        ) : null}
      </div>

      <span
        className={`min-w-24 font-mono text-sm font-bold ${
          current === null ? "text-slab-400" : "text-slab-900"
        }`}
      >
        {priceText(current)}
      </span>

      <label htmlFor={inputId} className="sr-only">
        New price for {label}
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={draft}
        disabled={saving}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveTyped();
          }
        }}
        placeholder="new"
        className="min-h-11 w-24 rounded-slab border-2 border-slab-300 bg-white px-2 text-base font-semibold text-slab-900 focus:border-slab-900 focus:outline-none sm:text-sm"
      />

      <Button
        type="button"
        variant="outline"
        onClick={saveTyped}
        disabled={saving || draft.trim() === ""}
      >
        {saving ? "Saving..." : "Save"}
      </Button>

      {/*
        DEPRICING IS A REAL OPERATION, not a missing value. It puts the cell
        back to "not listed", which is the right thing to do with a figure
        nobody can stand behind — and for the nine unread board cells it is
        the state they are already in. Offered only where there is something
        to remove.
      */}
      {current !== null ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit(null)}
          className="text-xs font-bold uppercase tracking-wide text-slab-500 underline underline-offset-4 hover:text-slab-900"
        >
          Unlist
        </button>
      ) : null}

      {justSaved !== undefined ? (
        <span className="text-xs font-semibold text-ok">
          Saved — was {priceText(justSaved)}
        </span>
      ) : null}

      {error ? (
        <span className="text-xs font-semibold text-fail">{error}</span>
      ) : null}
    </li>
  );
}
