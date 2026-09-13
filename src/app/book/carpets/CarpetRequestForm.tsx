"use client";

/**
 * =====================================================================
 * THE CARPET REQUEST FORM — what is coming, how, and who to call.
 * ---------------------------------------------------------------------
 * Deliberately NOT the booking flow with the vehicle step removed. There
 * is no vehicle, so there is no plate; there is no bay time, so there is no
 * slot; nothing is charged, so there is no payment step. What is left is
 * one screen: the sizes, drop-off or collection, and a phone number.
 *
 * PRICES ARE SHOWN, AND SAID TO BE AN ESTIMATE. The three carpet sizes have
 * board figures; the sofa set does not and reads "price on request". The
 * running figure counts only what is priced and names what is not, so a
 * sofa set never quietly adds nothing to a total.
 *
 * Styling follows the picker conventions at the top of
 * src/app/book/BookingFlow.tsx — resting, selected and disabled look the
 * same here as there, and amber is the submit button only.
 * =====================================================================
 */

import { useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { TextAreaField, TextField } from "@/components/Field";
import { business, telHref } from "@/data/business";
import {
  CARPET_MAX_PER_ITEM,
  carpetEstimate,
  carpetRows,
  type CarpetPick,
} from "@/lib/carpet-request";
import { formatKes } from "@/lib/format";
import { flatPrice } from "@/lib/prices";
import { compactErrors, phoneError, requiredText } from "@/lib/validate";
import type { PriceBook } from "@/types";

type Handover = "dropoff" | "collect";

export function CarpetRequestForm({ priceBook }: { priceBook: PriceBook }) {
  const rows = carpetRows();

  // Nothing preselected: a quantity of zero everywhere until they say.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // No default either way — a collection nobody asked for is a wasted trip.
  const [handover, setHandover] = useState<Handover | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    collectFrom: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentRef, setSentRef] = useState<string | null>(null);

  const picks: CarpetPick[] = rows
    .map((row) => ({ id: row.id, quantity: quantities[row.id] ?? 0 }))
    .filter((pick) => pick.quantity > 0);
  const { pricedKes, unpricedPieces } = carpetEstimate(priceBook, picks);

  function setQuantity(id: string, next: number) {
    const bounded = Math.max(0, Math.min(CARPET_MAX_PER_ITEM, next));
    setQuantities((current) => ({ ...current, [id]: bounded }));
    clearError("items");
  }

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    clearError(field);
  }

  function clearError(field: string) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit() {
    const found = compactErrors({
      items: picks.length === 0 ? "Pick at least one item." : undefined,
      handover: handover ? undefined : "Say whether you will drop off or want collection.",
      collectFrom:
        handover === "collect"
          ? requiredText(form.collectFrom, "Collection address")
          : undefined,
      customerName: requiredText(form.customerName, "Name"),
      phone: phoneError(form.phone),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    let response: Response;
    try {
      response = await fetch("/api/carpet-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // What was chosen, not what it costs: the server reads the board.
        body: JSON.stringify({
          items: picks,
          handover,
          collectFrom: form.collectFrom.trim(),
          customerName: form.customerName.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        }),
      });
    } catch {
      setSubmitError("We could not reach the yard's system. Check your connection and try again.");
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      setSubmitError("We could not send your request. Nothing was saved — please try again.");
      setSubmitting(false);
      return;
    }

    const { ref } = (await response.json()) as { ref: string };
    setSentRef(ref);
    setSubmitting(false);
  }

  /* ---------------------------- sent ---------------------------- */
  if (sentRef) {
    return (
      <section className="mt-8 rounded-slab border-2 border-slab-900 bg-white" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slab-900 bg-slab-900 px-4 py-3 text-slab-50">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slab-400">
            Request sent
          </span>
          <span className="font-mono text-lg font-bold text-hivis">{sentRef}</span>
        </div>
        <div className="px-4 py-4 text-sm text-slab-700">
          <p>
            We will call {form.phone.trim()} to arrange{" "}
            {handover === "collect" ? "a collection" : "when to bring them in"}.
            Keep the reference handy in case you call us first.
          </p>
          <ul className="mt-3 divide-y-2 divide-slab-100 border-y-2 border-slab-100">
            {picks.map((pick) => {
              const price = flatPrice(priceBook, pick.id);
              return (
                <li key={pick.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold">
                    {rows.find((row) => row.id === pick.id)?.name} x {pick.quantity}
                  </span>
                  <span className="font-semibold">
                    {price === null ? "Price on request" : formatKes(price * pick.quantity)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3">
            Questions before then?{" "}
            <a href={telHref(business.phone)} className="font-semibold underline underline-offset-4">
              {business.phone}
            </a>
          </p>
          <ButtonLink href="/" variant="outline" size="md" className="mt-4">
            Back home
          </ButtonLink>
        </div>
      </section>
    );
  }

  /* ---------------------------- form ---------------------------- */
  return (
    <div className="mt-8">
      <section aria-labelledby="carpet-items">
        <h2 id="carpet-items" className="text-xl">
          What needs cleaning?
        </h2>
        <p className="mt-1 text-sm text-slab-600">
          Prices are from the board at the bay, per piece.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((row) => {
            const price = flatPrice(priceBook, row.id);
            const quantity = quantities[row.id] ?? 0;
            return (
              <li
                key={row.id}
                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-slab border-2 bg-white px-4 py-3 transition-colors duration-150 ease-plain ${
                  quantity > 0 ? "border-slab-900" : "border-slab-200"
                }`}
              >
                <span className="min-w-32">
                  <span className="block text-sm font-semibold">{row.name}</span>
                  {price === null ? (
                    <span className="text-xs font-bold uppercase tracking-wide text-slab-500">
                      Price on request
                    </span>
                  ) : (
                    <span className="text-sm font-bold">{formatKes(price)}</span>
                  )}
                </span>

                <span className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => setQuantity(row.id, quantity - 1)}
                    disabled={quantity === 0}
                    aria-label={`One fewer: ${row.name}`}
                    className="flex size-11 items-center justify-center rounded-l-slab border-2 border-r-0 border-slab-300 bg-white text-lg font-bold text-slab-700 hover:border-slab-900 disabled:cursor-not-allowed disabled:text-slab-300 disabled:hover:border-slab-300"
                  >
                    &minus;
                  </button>
                  <span
                    className="flex w-12 items-center justify-center border-y-2 border-slab-300 text-base font-bold"
                    aria-live="polite"
                    aria-label={`${row.name}: ${quantity}`}
                    data-quantity-for={row.id}
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(row.id, quantity + 1)}
                    disabled={quantity >= CARPET_MAX_PER_ITEM}
                    aria-label={`One more: ${row.name}`}
                    className="flex size-11 items-center justify-center rounded-r-slab border-2 border-l-0 border-slab-300 bg-white text-lg font-bold text-slab-700 hover:border-slab-900 disabled:cursor-not-allowed disabled:text-slab-300"
                  >
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        {/* THE ESTIMATE: priced pieces summed, unpriced ones named, not zeroed. */}
        <div className="mt-4 rounded-slab border-2 border-slab-900 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold uppercase tracking-wide text-slab-700">
              {picks.length === 0 ? "Nothing picked yet" : "Estimate"}
            </span>
            <span className="text-2xl font-extrabold">{formatKes(pricedKes)}</span>
          </div>
          {unpricedPieces > 0 ? (
            <p className="mt-1 text-sm text-slab-600">
              {pricedKes > 0 ? "Plus " : ""}
              {unpricedPieces} piece{unpricedPieces === 1 ? "" : "s"} at a price
              on request — we will tell you when we call.
            </p>
          ) : null}
        </div>

        {errors.items ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-alert">
            {errors.items}
          </p>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="carpet-handover">
        <h2 id="carpet-handover" className="text-xl">
          How will they reach us?
        </h2>
        <fieldset className="mt-3">
          <legend className="sr-only">Drop-off or collection</legend>
          <div className="flex flex-col gap-2">
            {(
              [
                ["dropoff", "I will drop them off at the yard"],
                ["collect", "Please collect them from me"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-slab border-2 bg-white px-4 py-3 transition-colors duration-150 ease-plain ${
                  handover === value ? "border-slab-900" : "border-slab-200 hover:border-slab-500"
                }`}
              >
                <input
                  type="radio"
                  name="handover"
                  value={value}
                  checked={handover === value}
                  onChange={() => {
                    setHandover(value);
                    clearError("handover");
                  }}
                  className="size-4 accent-hivis"
                />
                <span className="text-sm font-semibold">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {errors.handover ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-alert">
            {errors.handover}
          </p>
        ) : null}

        {handover === "collect" ? (
          <div className="mt-4">
            <TextField
              id="collectFrom"
              label="Where should we collect from?"
              required
              hint="Estate, street or a landmark we can find."
              value={form.collectFrom}
              error={errors.collectFrom}
              onChange={(event) => update("collectFrom", event.target.value)}
            />
          </div>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="carpet-details">
        <h2 id="carpet-details" className="text-xl">
          Your details
        </h2>
        <p className="mt-1 text-sm text-slab-600">We call this number to arrange the day.</p>
        <div className="mt-5 flex flex-col gap-5">
          <TextField
            id="customerName"
            label="Full name"
            required
            autoComplete="name"
            value={form.customerName}
            error={errors.customerName}
            onChange={(event) => update("customerName", event.target.value)}
          />
          <TextField
            id="phone"
            label="Phone number"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            value={form.phone}
            error={errors.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
          <TextAreaField
            id="notes"
            label="Anything we should know?"
            hint="Optional. Stains, pet hair, a carpet bigger than large."
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </div>
      </section>

      {submitError ? (
        <p
          role="alert"
          className="mt-6 rounded-slab border-2 border-alert bg-alert-tint px-3 py-2 text-sm font-semibold text-alert"
        >
          {submitError}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-end border-t-2 border-slab-200 pt-5">
        <Button size="lg" onClick={submit} disabled={submitting}>
          {submitting ? "Sending..." : "Send request"}
        </Button>
      </div>
    </div>
  );
}
