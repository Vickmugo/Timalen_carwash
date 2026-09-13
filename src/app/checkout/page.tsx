"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { TextAreaField, TextField } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { paymentConfig } from "@/data/config";
import type { Order, PaymentStatus } from "@/types";
import { clearCart, useCart } from "@/lib/cart";
import { cartLineKey, cartLineName } from "@/lib/cart-line";
import { formatKes, makeRef } from "@/lib/format";
import { processPayment } from "@/lib/payment";
import { addOrder } from "@/lib/store";
import { compactErrors, phoneError, requiredText } from "@/lib/validate";

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, hydrated, subtotalKes, evaluation } = useCart();

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    deliveryLocation: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentStatus>("paid");
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // An over-threshold cart must never reach a payment screen.
  useEffect(() => {
    if (hydrated && evaluation.requiresQuote) {
      router.replace("/quote?from=cart");
    }
  }, [hydrated, evaluation.requiresQuote, router]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
      deliveryLocation: requiredText(
        form.deliveryLocation,
        "Delivery or collection point",
      ),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setPaymentError(null);

    const ref = makeRef("OR");

    if (paymentMethod === "paid") {
      const result = await processPayment({
        amountKes: subtotalKes,
        phone: form.phone,
        reference: ref,
      });
      if (!result.success) {
        setPaymentError(result.message);
        setSubmitting(false);
        return;
      }
    }

    const order: Order = {
      ref,
      lines,
      subtotalKes,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      deliveryLocation: form.deliveryLocation.trim(),
      notes: form.notes.trim(),
      paymentStatus: paymentMethod,
      createdAt: new Date().toISOString(),
    };

    addOrder(order);
    clearCart();
    router.push(`/checkout/confirmed?ref=${order.ref}`);
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
              Subtotal
            </span>
            <span className="text-lg font-extrabold">
              {formatKes(subtotalKes)}
            </span>
          </li>
        </ul>
        <p className="mt-2 text-sm text-slab-500">
          Delivery is quoted separately once we know the location and load.
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
          <TextField
            id="deliveryLocation"
            label="Delivery or collection point"
            required
            hint="Town or estate, plus a landmark if the road is hard to find."
            value={form.deliveryLocation}
            error={errors.deliveryLocation}
            onChange={(event) => update("deliveryLocation", event.target.value)}
          />
          <TextAreaField
            id="notes"
            label="Notes for the yard"
            hint="Optional. Access limits, preferred delivery day, offloading help."
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </div>
      </section>

      <fieldset className="mt-8">
        <legend className="text-sm font-bold uppercase tracking-wide text-slab-700">
          How would you like to pay?
        </legend>
        <div className="mt-3 flex flex-col gap-2">
          {(
            [
              ["paid", `Pay now - ${paymentConfig.aggregatorLabel}`],
              ["pay_on_collection", "Pay on collection or delivery"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 rounded-slab border-2 px-4 py-3 transition-colors duration-150 ease-out ${
                paymentMethod === value
                  ? "border-slab-900 bg-white"
                  : "border-slab-200 bg-white hover:border-slab-400"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={value}
                checked={paymentMethod === value}
                onChange={() => setPaymentMethod(value)}
                className="size-4 accent-hivis"
              />
              <span className="text-sm font-semibold">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="mt-4 rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-2 text-sm text-slab-800">
        Demo only. No payment is processed and no M-Pesa prompt is sent.
      </p>

      {paymentError ? (
        <p
          role="alert"
          className="mt-4 rounded-slab border-2 border-alert bg-alert-tint px-3 py-2 text-sm font-semibold text-alert"
        >
          {paymentError}
        </p>
      ) : null}

      <Button
        size="lg"
        fullWidth
        className="mt-6"
        onClick={submit}
        disabled={submitting}
      >
        {submitting
          ? "Working..."
          : paymentMethod === "paid"
            ? `Pay ${formatKes(subtotalKes)}`
            : "Place order"}
      </Button>
    </div>
  );
}
