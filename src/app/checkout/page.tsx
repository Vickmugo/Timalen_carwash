"use client";

/**
 * =====================================================================
 * CONCRETE CHECKOUT — collect from the yard, pay by M-Pesa or cash.
 * ---------------------------------------------------------------------
 * WRITES TO THE SERVER now (/api/orders), not to this browser. What is
 * sent is what is in the basket — product, size, quantity — and the
 * customer's details and payment choice. NOT the prices: the server prices
 * every line from the live price book and stores its own total, which is
 * what the confirmation page then shows. The figures below are the
 * basket's copy, as they read when each item was added.
 *
 * NOTHING IS DELIVERED, so nothing here asks for an address. Concrete is
 * collected from the yard; see COLLECT_FROM_YARD in src/data/config.ts.
 *
 * NO PAYMENT IS TAKEN HERE. The customer pays to the paybill on their own
 * phone and types the SMS code, or chooses cash at collection. The mock
 * "payment succeeded" step that used to run first is gone.
 * =====================================================================
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { TextAreaField, TextField } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import {
  EMPTY_PAYMENT,
  PaymentChoice,
  paymentBody,
  paymentError,
  type PaymentValue,
} from "@/components/PaymentChoice";
import { COLLECT_FROM_YARD } from "@/data/config";
import { business } from "@/data/business";
import { clearCart, useCart } from "@/lib/cart";
import { cartLineKey, cartLineName } from "@/lib/cart-line";
import { formatKes } from "@/lib/format";
import { compactErrors, phoneError, requiredText } from "@/lib/validate";

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, hydrated, subtotalKes, evaluation } = useCart();

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState<PaymentValue>(EMPTY_PAYMENT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // An over-threshold cart must never reach a payment screen.
  useEffect(() => {
    if (hydrated && evaluation.requiresQuote) {
      router.replace("/quote?from=cart");
    }
  }, [hydrated, evaluation.requiresQuote, router]);

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
      customerName: requiredText(form.customerName, "Name"),
      phone: phoneError(form.phone),
      payment: paymentError(payment),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    let response: Response;
    try {
      response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // What was chosen, not what it costs.
          lines: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId ?? "",
            quantity: line.quantity,
          })),
          customerName: form.customerName.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
          payment: paymentBody(payment, "concrete"),
        }),
      });
    } catch {
      setSubmitError("We could not reach the yard's system. Check your connection and try again.");
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      const failure = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (failure.error === "code_used") {
        setErrors((current) => ({
          ...current,
          payment: failure.detail ?? "This M-Pesa code has already been used.",
        }));
      } else if (failure.error === "needs_quote") {
        router.replace("/quote?from=cart");
        return;
      } else {
        setSubmitError(
          response.status === 400 && failure.detail
            ? failure.detail
            : "We could not place your order. Nothing was saved — please try again.",
        );
      }
      setSubmitting(false);
      return;
    }

    const { order } = (await response.json()) as { order: { ref: string } };
    clearCart();
    router.push(`/checkout/confirmed?ref=${encodeURIComponent(order.ref)}`);
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-slab-500">Loading...</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <PageHeader title="Checkout" backHref="/products" backLabel="Products" />
        <div className="mt-6 rounded-slab border-2 border-slab-200 bg-white p-6 text-center">
          <p className="text-slab-600">There is nothing in your cart.</p>
          <ButtonLink href="/products" className="mt-4">
            Browse products
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        eyebrow="Concrete yard"
        title="Checkout"
        backHref="/cart"
        backLabel="Cart"
      />

      <section className="mt-6" aria-labelledby="order-summary">
        <h2 id="order-summary" className="text-base">
          Order summary
        </h2>
        <ul className="mt-3 divide-y-2 divide-slab-100 rounded-slab border-2 border-slab-200 bg-white">
          {lines.map((line) => (
            <li
              key={cartLineKey(line)}
              className="flex flex-wrap justify-between gap-2 px-4 py-3"
            >
              <span className="text-sm">
                <span className="font-semibold">{cartLineName(line)}</span>
                <span className="text-slab-500"> x {line.quantity}</span>
              </span>
              <span className="text-sm font-bold">
                {formatKes(line.priceKes * line.quantity)}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-2 bg-slab-50 px-4 py-3">
            <span className="text-sm font-bold uppercase tracking-wide text-slab-700">
              Total
            </span>
            <span className="text-lg font-extrabold">
              {formatKes(subtotalKes)}
            </span>
          </li>
        </ul>
        <p className="mt-2 text-sm text-slab-600">
          <span className="font-semibold">{COLLECT_FROM_YARD}</span> at{" "}
          {business.location}. We do not deliver.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="your-details">
        <h2 id="your-details" className="text-base">
          Your details
        </h2>
        <div className="mt-4 flex flex-col gap-5">
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
            label="Notes for the yard"
            hint="Optional. When you plan to collect, or help you need loading."
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </div>
      </section>

      <section className="mt-8" aria-label="Payment">
        <PaymentChoice
          context="concrete"
          amountKes={subtotalKes}
          value={payment}
          onChange={(next) => {
            setPayment(next);
            clearError("payment");
          }}
          error={errors.payment}
        />
      </section>

      {submitError ? (
        <p
          role="alert"
          className="mt-4 rounded-slab border-2 border-alert bg-alert-tint px-3 py-2 text-sm font-semibold text-alert"
        >
          {submitError}
        </p>
      ) : null}

      <Button
        size="lg"
        fullWidth
        className="mt-6"
        onClick={submit}
        disabled={submitting}
      >
        {submitting ? "Working..." : "Place order"}
      </Button>
    </div>
  );
}
