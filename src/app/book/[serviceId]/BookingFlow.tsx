"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { TextAreaField, TextField } from "@/components/Field";
import { Stepper } from "@/components/Stepper";
import { WEEKDAY_SHORT } from "@/data/business";
import { paymentConfig } from "@/data/config";
import type { Booking, PaymentStatus, WashService } from "@/types";
import {
  formatDuration,
  formatKes,
  formatLongDate,
  formatShortDate,
  fromDateKey,
  makeRef,
} from "@/lib/format";
import { processPayment } from "@/lib/payment";
import { generateSlots, getBookableDates, getDayHours } from "@/lib/slots";
import { addBooking, getBookings, useBookings, useIsHydrated } from "@/lib/store";
import { compactErrors, phoneError, requiredText } from "@/lib/validate";

const STEPS = ["Time", "Details", "Payment"];

export function BookingFlow({ service }: { service: WashService }) {
  const router = useRouter();

  const [step, setStep] = useState(0);

  // Slots depend on what is already booked, which only exists client-side.
  // Both of these come from the store rather than an effect, so a booking
  // made in another tab shows up here without a refresh.
  const existingBookings = useBookings();
  const hydrated = useIsHydrated();

  const dates = useMemo(() => getBookableDates(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getBookableDates().find((date) => !getDayHours(date).closed) ?? "";
  });
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const slots = useMemo(() => {
    if (!selectedDate || !hydrated) return [];
    return generateSlots(selectedDate, service.durationMinutes, existingBookings);
  }, [selectedDate, service.durationMinutes, existingBookings, hydrated]);

  const selectedSlot = slots.find((slot) => slot.startTime === selectedTime);

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    vehicle: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentStatus>("paid");
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    // Clear the error as soon as the customer starts fixing it.
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function goToPayment() {
    const found = compactErrors({
      customerName: requiredText(form.customerName, "Name"),
      phone: phoneError(form.phone),
      vehicle: requiredText(form.vehicle, "Vehicle"),
    });
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(2);
  }

  async function confirmBooking() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setPaymentError(null);

    const ref = makeRef("WB");

    // Pay-on-arrival skips the payment call entirely.
    if (paymentMethod === "paid") {
      const result = await processPayment({
        amountKes: service.priceKes,
        phone: form.phone,
        reference: ref,
      });
      if (!result.success) {
        setPaymentError(result.message);
        setSubmitting(false);
        return;
      }
    }

    // Re-check the slot at the last moment: another booking may have landed
    // while this form was open.
    const latest = getBookings();
    const stillFree = generateSlots(
      selectedDate,
      service.durationMinutes,
      latest,
    ).some((slot) => slot.startTime === selectedSlot.startTime && slot.available);

    if (!stillFree) {
      setSelectedTime(null);
      setPaymentError(
        "That slot was taken while you were filling in the form. Please pick another time.",
      );
      setSubmitting(false);
      setStep(0);
      return;
    }

    const booking: Booking = {
      ref,
      serviceId: service.id,
      serviceName: service.name,
      priceKes: service.priceKes,
      durationMinutes: service.durationMinutes,
      date: selectedDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      vehicle: form.vehicle.trim(),
      notes: form.notes.trim(),
      paymentStatus: paymentMethod,
      createdAt: new Date().toISOString(),
    };

    addBooking(booking);
    router.push(`/book/confirmed?ref=${booking.ref}`);
  }

  return (
    <div className="mt-6">
      <Stepper steps={STEPS} current={step} />

      {/* ------------------------- Step 1: time ------------------------- */}
      {step === 0 ? (
        <section className="mt-8" aria-labelledby="step-time">
          <h2 id="step-time" className="text-xl">
            Pick a day and time
          </h2>
          <p className="mt-1 text-sm text-slab-600">
            {service.name} needs {formatDuration(service.durationMinutes)} in the
            bay.
          </p>

          {paymentError ? (
            <p
              role="alert"
              className="mt-4 rounded-slab border-2 border-alert bg-alert-tint px-3 py-2 text-sm font-semibold text-alert"
            >
              {paymentError}
            </p>
          ) : null}

          {/* Date strip */}
          <div
            className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2"
            role="group"
            aria-label="Choose a date"
          >
            {dates.map((date) => {
              const closed = getDayHours(date).closed;
              const active = date === selectedDate;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={closed}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }}
                  aria-pressed={active}
                  className={`flex min-w-18 shrink-0 flex-col items-center rounded-slab border-2 px-3 py-2.5 transition-colors duration-150 ease-out ${
                    closed
                      ? "cursor-not-allowed border-slab-200 bg-slab-100 text-slab-400"
                      : active
                        ? "border-slab-900 bg-slab-900 text-slab-50"
                        : "border-slab-200 bg-white text-slab-700 hover:border-slab-500"
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {WEEKDAY_SHORT[fromDateKey(date).getDay()]}
                  </span>
                  <span className="text-sm font-bold">
                    {formatShortDate(date)}
                  </span>
                  {closed ? (
                    <span className="mt-0.5 text-[10px] uppercase">Closed</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Slot grid */}
          <div className="mt-6">
            <h3 className="text-base">{formatLongDate(selectedDate)}</h3>

            {!hydrated ? (
              <p className="mt-3 text-sm text-slab-500">Loading times...</p>
            ) : slots.length === 0 ? (
              <p className="mt-3 rounded-slab border-2 border-slab-200 bg-white px-3 py-4 text-sm text-slab-600">
                Closed on this day. Pick another date.
              </p>
            ) : slots.every((slot) => !slot.available) ? (
              <p className="mt-3 rounded-slab border-2 border-slab-200 bg-white px-3 py-4 text-sm text-slab-600">
                No times left on this day. Try the next one.
              </p>
            ) : (
              <div
                className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5"
                role="group"
                aria-label="Choose a time"
              >
                {slots.map((slot) => {
                  const active = slot.startTime === selectedTime;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setSelectedTime(slot.startTime)}
                      aria-pressed={active}
                      title={
                        slot.reason === "booked"
                          ? "Already booked"
                          : slot.reason === "too_soon"
                            ? "Too soon to book"
                            : undefined
                      }
                      className={`min-h-11 rounded-slab border-2 px-2 text-sm font-bold transition-colors duration-150 ease-out ${
                        !slot.available
                          ? "cursor-not-allowed border-slab-200 bg-slab-100 text-slab-400 line-through"
                          : active
                            ? "border-hivis bg-hivis text-slab-900"
                            : "border-slab-300 bg-white text-slab-800 hover:border-slab-900"
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 border-t-2 border-slab-200 pt-5">
            <p className="text-sm text-slab-600">
              {selectedSlot
                ? `${selectedSlot.startTime} - ${selectedSlot.endTime}`
                : "No time selected"}
            </p>
            <Button
              size="lg"
              disabled={!selectedSlot}
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {/* ----------------------- Step 2: details ------------------------ */}
      {step === 1 ? (
        <section className="mt-8" aria-labelledby="step-details">
          <h2 id="step-details" className="text-xl">
            Your details
          </h2>
          <p className="mt-1 text-sm text-slab-600">
            We call this number if anything changes at the bay.
          </p>

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
            <TextField
              id="vehicle"
              label="Vehicle"
              required
              hint="Make, model and number plate, so we know which car is yours."
              placeholder="Toyota Fielder, KDA 123X"
              value={form.vehicle}
              error={errors.vehicle}
              onChange={(event) => update("vehicle", event.target.value)}
            />
            <TextAreaField
              id="notes"
              label="Anything we should know?"
              hint="Optional. Heavy mud, pets in the car, child seats."
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
            />
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 border-t-2 border-slab-200 pt-5">
            <Button variant="quiet" size="lg" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button size="lg" onClick={goToPayment}>
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {/* ----------------------- Step 3: payment ------------------------ */}
      {step === 2 && selectedSlot ? (
        <section className="mt-8" aria-labelledby="step-payment">
          <h2 id="step-payment" className="text-xl">
            Confirm and pay
          </h2>

          <dl className="mt-5 divide-y-2 divide-slab-100 rounded-slab border-2 border-slab-200 bg-white">
            {[
              ["Service", service.name],
              ["When", formatLongDate(selectedDate)],
              ["Time", `${selectedSlot.startTime} - ${selectedSlot.endTime}`],
              ["Vehicle", form.vehicle],
              ["Contact", `${form.customerName} - ${form.phone}`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-wrap justify-between gap-2 px-4 py-3"
              >
                <dt className="text-sm font-bold uppercase tracking-wide text-slab-500">
                  {label}
                </dt>
                <dd className="text-sm font-semibold">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 bg-slab-50 px-4 py-3">
              <dt className="text-sm font-bold uppercase tracking-wide text-slab-700">
                Total
              </dt>
              <dd className="text-lg font-extrabold">
                {formatKes(service.priceKes)}
              </dd>
            </div>
          </dl>

          <fieldset className="mt-6">
            <legend className="text-sm font-bold uppercase tracking-wide text-slab-700">
              How would you like to pay?
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              {(
                [
                  ["paid", `Pay now - ${paymentConfig.aggregatorLabel}`],
                  ["pay_on_collection", "Pay at the bay when you arrive"],
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

          {/* Demo honesty: never let anyone think this took money. */}
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

          <div className="mt-8 flex items-center justify-between gap-4 border-t-2 border-slab-200 pt-5">
            <Button
              variant="quiet"
              size="lg"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              Back
            </Button>
            <Button size="lg" onClick={confirmBooking} disabled={submitting}>
              {submitting
                ? "Working..."
                : paymentMethod === "paid"
                  ? `Pay ${formatKes(service.priceKes)}`
                  : "Confirm booking"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
