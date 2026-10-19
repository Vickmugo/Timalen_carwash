"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { TextAreaField, TextField } from "@/components/Field";
import { getProduct } from "@/data/products";
import { clearCart, useCart } from "@/lib/cart";
import { cartLineKey, cartLineName } from "@/lib/cart-line";
import { formatKes } from "@/lib/format";
import { compactErrors, phoneError, requiredText } from "@/lib/validate";

/**
 * Three ways in:
 *   /quote                                  blank form
 *   /quote?product=slug&quantity=n          from a product page
 *   /quote?product=slug&variant=id&...      the same, one height of it
 *   /quote?from=cart                        cart tripped the quote threshold
 */
const BLANK = {
  customerName: "",
  phone: "",
  item: "",
  quantity: "",
  notes: "",
};

type FormValues = typeof BLANK;

export function QuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lines, hydrated, subtotalKes, evaluation } = useCart();

  const fromCart = searchParams.get("from") === "cart";
  const productSlug = searchParams.get("product");
  const presetQuantity = searchParams.get("quantity");
  const variantId = searchParams.get("variant");

  /**
   * Prefill is DERIVED, not copied into state by an effect. Whatever the
   * customer types wins; anything they have not touched falls back to the
   * value implied by how they arrived. That also means the cart-based
   * prefill simply appears once the cart is readable after hydration.
   */
  const defaults = useMemo<FormValues>(() => {
    if (fromCart && lines.length > 0) {
      return {
        ...BLANK,
        item: lines
          .map(
            (line) =>
              `${cartLineName(line)} x ${line.quantity} (${line.unitLabel})`,
          )
          .join("\n"),
        quantity: `${lines.reduce(
          (total, line) => total + line.quantity,
          0,
        )} units across ${lines.length} item(s)`,
      };
    }

    if (productSlug) {
      const product = getProduct(productSlug);
      if (product) {
        // An unknown variant id falls back to the bare product name rather
        // than printing an id nobody would recognise.
        const variant = product.variants?.find((entry) => entry.id === variantId);
        return {
          ...BLANK,
          item: cartLineName({ name: product.name, variantLabel: variant?.label }),
          quantity: presetQuantity ?? "",
        };
      }
    }

    return BLANK;
  }, [fromCart, lines, productSlug, presetQuantity, variantId]);

  const [edits, setEdits] = useState<Partial<FormValues>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useMemo<FormValues>(
    () => ({ ...defaults, ...edits }),
    [defaults, edits],
  );

  function update(field: keyof FormValues, value: string) {
    setEdits((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found = compactErrors({
      customerName: requiredText(form.customerName, "Name"),
      phone: phoneError(form.phone),
      item: requiredText(form.item, "What you need"),
      quantity: requiredText(form.quantity, "Quantity"),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    /*
      Sent to the yard (/api/quote-requests). It used to be saved only in
      this browser, which meant bulk requests never reached anyone. The
      server validates everything again and prices nothing for the
      customer; cart lines go along so staff can see what was in it.
    */
    let response: Response | null = null;
    try {
      response = await fetch("/api/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          phone: form.phone.trim(),
          item: form.item.trim(),
          quantity: form.quantity.trim(),
          notes: form.notes.trim(),
          lines: fromCart
            ? lines.map((line) => ({
                productId: line.productId,
                ...(line.variantId ? { variantId: line.variantId } : {}),
                quantity: line.quantity,
              }))
            : [],
        }),
      });
    } catch {
      response = null;
    }

    if (!response || !response.ok) {
      const failure = response
        ? ((await response.json().catch(() => ({}))) as { detail?: string })
        : {};
      setSubmitError(
        response && [400, 413, 429].includes(response.status) && failure.detail
          ? failure.detail
          : "We could not send your request. Nothing was saved — please try again.",
      );
      setSubmitting(false);
      return;
    }

    const { ref } = (await response.json()) as { ref: string };
    if (fromCart) clearCart();
    router.push(`/quote/submitted?ref=${encodeURIComponent(ref)}`);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6">
      {fromCart && hydrated && lines.length > 0 ? (
        <div className="mb-6 rounded-slab border-2 border-hivis bg-hivis-tint p-4">
          <h2 className="text-base">Sent over from your cart</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-slab-800">
            {lines.map((line) => (
              <li key={cartLineKey(line)} className="flex justify-between gap-3">
                <span>
                  {cartLineName(line)} x {line.quantity}
                </span>
                {line.quoteOnly ? (
                  <span className="shrink-0 text-slab-600">Quote only</span>
                ) : (
                  <span className="shrink-0 font-semibold">
                    {formatKes(line.priceKes * line.quantity)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {subtotalKes > 0 ? (
            <p className="mt-2 border-t border-hivis-dark/30 pt-2 text-sm text-slab-700">
              Indicative list total {formatKes(subtotalKes)} before any bulk
              adjustment. Collect from the yard.
            </p>
          ) : null}
          {evaluation.reasons.length > 0 ? (
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-slab-700">
              {evaluation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
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
          id="item"
          label="What do you need?"
          required
          hint="Product, pattern, dimensions. For custom moulds, describe the shape or say you will send a photo."
          rows={4}
          value={form.item}
          error={errors.item}
          onChange={(event) => update("item", event.target.value)}
        />
        <TextField
          id="quantity"
          label="Quantity"
          required
          hint="Pieces, square metres, or however you measure the job."
          placeholder="e.g. 200 square metres"
          value={form.quantity}
          error={errors.quantity}
          onChange={(event) => update("quantity", event.target.value)}
        />
        <TextAreaField
          id="notes"
          label="Anything else?"
          hint="Optional. Deadline, or when you plan to collect from the yard."
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
        />
      </div>

      <p className="mt-6 rounded-slab border-2 border-slab-200 bg-white px-3 py-2 text-sm text-slab-600">
        This goes to the yard. Someone will call you to confirm the price —
        nothing is charged now. Collection from the yard only.
      </p>

      {submitError ? (
        <p role="alert" className="mt-3 rounded-slab border-2 border-alert bg-alert-tint px-3 py-2 text-sm font-semibold text-slab-800">
          {submitError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        fullWidth
        className="mt-4"
        disabled={submitting}
      >
        {submitting ? "Sending..." : "Send quote request"}
      </Button>
    </form>
  );
}
