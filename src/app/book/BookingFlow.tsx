"use client";

/**
 * =====================================================================
 * THE BOOKING FLOW — VEHICLE TYPE, THEN SERVICES, THEN A SLOT
 * ---------------------------------------------------------------------
 * WHAT CHANGED. This used to be three invented tiers, one per URL, each at
 * one guessed price: /book/exterior-wash and friends. The yard does not
 * sell those. The real board (src/data/services.ts) prices eleven services
 * across three vehicle sizes, so the flow now asks which vehicle and then
 * which services, and the total is the sum of real cells.
 *
 * WHY VEHICLE AND SERVICES SHARE ONE STEP. Every price in the list depends
 * on the vehicle column. Splitting them across two steps would show a list
 * of services with no prices on it, then the same list again with prices —
 * the customer choosing twice to learn something they could have seen once.
 *
 * WHAT AN UNREAD CELL LOOKS LIKE HERE. Three services (Interior Wash,
 * Complete Wash, Buffing) have no transcribed price for any vehicle. They
 * are LISTED, greyed, unselectable, and labelled "price not listed — ask at
 * the yard". They are not hidden, because hiding them tells the customer
 * the yard does not do interior washes, which is false; and they carry no
 * number, because inventing one is the thing the whole price-board exercise
 * was done to stop. The gap is visible, and it is honest about being a gap.
 *
 * DURATION IS STILL A PLACEHOLDER and deliberately untouched. Every booking
 * takes one fixed block of bay time from `bookingConfig`, however many
 * services are on it. See the long note there; the screen says so too, at
 * the point where it would otherwise mislead.
 *
 * ONE PICKER, FOUR TIMES. Vehicle, date, time and payment method are the
 * same control repeated, so they are painted the same way — the same
 * convention the staff filters on /admin use:
 *
 *   resting    border-slab-200 bg-white, hover:border-slab-500
 *   selected   border-slab-900 bg-slab-900 text-slab-50   (bare buttons)
 *              border-slab-900 bg-white                   (rows with a real
 *                                                          checkbox/radio,
 *                                                          which shows the
 *                                                          state itself)
 *   disabled   border-slab-200 bg-slab-100 text-slab-400
 *   easing     transition-colors duration-150 ease-plain
 *
 * Amber appears once per screen, on the Continue button. A picker that
 * fills amber when chosen competes with it, which is why none of them do.
 * =====================================================================
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { TextAreaField, TextField } from "@/components/Field";
import { Stepper } from "@/components/Stepper";
import { WEEKDAY_SHORT } from "@/data/business";
import { bookingConfig, paymentConfig } from "@/data/config";
import { vehicleTypes, washPriceRows } from "@/data/services";
import { washPrice } from "@/lib/prices";
import type { PaymentStatus, PriceBook, VehicleTypeId } from "@/types";
import {
  formatDuration,
  formatKes,
  formatLongDate,
  formatShortDate,
  fromDateKey,
} from "@/lib/format";
import {
  selectionTotalKes,
  subsumption,
  toLines,
  withoutCovered,
} from "@/lib/booking";
import { processPayment } from "@/lib/payment";
import type { Slot } from "@/lib/slots";
import { getBookableDates, getDayHours } from "@/lib/slots";
import { compactErrors, phoneError, requiredText } from "@/lib/validate";

const STEPS = ["Wash", "Time", "Details", "Payment"];

/** Every booking holds the bay for this long. Placeholder — see config. */
const DURATION = bookingConfig.placeholderWashDurationMinutes;

/**
 * `priceBook` ARRIVES AS A PROP, fetched by the server component in
 * page.tsx. This is a client component: it has no database credentials and
 * must never have any, so the figures are handed to it already read.
 *
 * What it renders is therefore a snapshot — the prices as they stood when
 * the page was served. That is fine for showing a customer what things
 * cost, and it is deliberately NOT what they get charged: /api/bookings
 * re-reads the book at submit time and computes the total itself. If the
 * yard edits a price while somebody is mid-booking, the figure on their
 * screen may be stale for a minute; the figure on their receipt will not
 * be. Both sides run the same `toLines` over the same shape, so the two
 * agree whenever the book has not moved underneath them.
 */
export function BookingFlow({ priceBook }: { priceBook: PriceBook }) {
  const router = useRouter();

  const [step, setStep] = useState(0);

  /*
    SLOTS COME FROM THE SERVER NOW.

    They used to be computed here from the bookings in this browser's own
    localStorage, which meant a slot was only ever taken for the person who
    took it — everybody else's phone showed it free. With one shared wash
    bay and one shared diary, that is the whole point of the feature, so
    the grid is built by /api/slots against the real table.

    What comes back is TIMES ONLY, never the day's bookings: this is a
    public page and those records carry customer names and phone numbers.
    See the note at the top of src/app/api/slots/route.ts.
  */
  const [slotData, setSlotData] = useState<{
    date: string;
    slots: Slot[];
    error: string | null;
  }>({ date: "", slots: [], error: null });

  /* ------------------------- wash selection ------------------------- */

  /*
    No default vehicle type. Defaulting to Saloon would price a pick-up
    owner's whole booking against the wrong column unless they noticed a
    control they never touched — and on this board that is the difference
    between 150 and 1200 for the same wet vacuum. One tap is cheaper than
    that mistake.
  */
  const [vehicleTypeId, setVehicleTypeId] = useState<VehicleTypeId | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const vehicleType = vehicleTypes.find((type) => type.id === vehicleTypeId);

  /*
    What one choice implies about the others. `covered` is only ever
    populated once a service's inclusion list is CONFIRMED in the data; an
    unconfirmed scope (Complete Wash today) lands in `unconfirmedScope` and
    produces a warning instead of silently dropping a line. See
    src/lib/booking.ts.
  */
  const { covered, unconfirmedScope } = useMemo(
    () => subsumption(washPriceRows, selectedIds),
    [selectedIds],
  );

  /** The selection actually charged: covered rows removed. */
  const chargeable = useMemo(
    () => withoutCovered(selectedIds, covered),
    [selectedIds, covered],
  );

  const totalKes = vehicleTypeId
    ? selectionTotalKes(washPriceRows, priceBook, chargeable, vehicleTypeId)
    : 0;

  const lines = vehicleTypeId
    ? toLines(washPriceRows, priceBook, chargeable, vehicleTypeId)
    : [];

  function toggleService(id: string) {
    setSelectionError(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function chooseVehicle(id: VehicleTypeId) {
    setSelectionError(null);
    setVehicleTypeId(id);
    /*
      Drop any service that has no price in the NEW column.

      Nothing on the board is priced for some vehicles and not others today
      — the three unread rows are unread for all three columns — so this
      currently never fires. It is here because the moment one column of
      Interior Wash gets transcribed and the others do not, a customer could
      otherwise tick it as a Saloon, switch to Pick-up, and carry an unread
      cell into a booking.
    */
    setSelectedIds((current) => {
      const next = new Set<string>();
      for (const serviceId of current) {
        const row = washPriceRows.find((entry) => entry.id === serviceId);
        if (row && washPrice(priceBook, row.id, id) !== null) next.add(serviceId);
      }
      return next;
    });
  }

  function goToTime() {
    if (!vehicleTypeId) {
      setSelectionError("Pick a vehicle type first.");
      return;
    }
    if (chargeable.size === 0) {
      setSelectionError("Pick at least one service.");
      return;
    }
    setSelectionError(null);
    setStep(1);
  }

  /* ------------------------------ time ------------------------------ */

  const dates = useMemo(() => getBookableDates(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getBookableDates().find((date) => !getDayHours(date).closed) ?? "";
  });
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  /*
    LOADING IS DERIVED, NOT STORED. The grid is "loading" whenever the data
    we hold is for a different day than the one selected, which is true the
    instant somebody taps a new date — no flag to set, and no window where
    the previous day's times are on screen under the new day's heading.

    A failed fetch renders no slots AND says why. It must not fall through
    to the empty grid, because an empty grid reads as "the yard is fully
    booked", which is a different and much more damaging thing to tell a
    customer than "this did not load".
  */
  const slotsLoading = slotData.date !== selectedDate;
  const slots = slotsLoading ? [] : slotData.slots;
  const slotsError = slotsLoading ? null : slotData.error;

  const fetchSlots = useCallback(
    async (date: string): Promise<{ slots: Slot[]; error: string | null }> => {
      try {
        const response = await fetch(
          `/api/slots?date=${encodeURIComponent(date)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { slots: Slot[] };
        return { slots: body.slots, error: null };
      } catch {
        return {
          slots: [],
          error:
            "We could not load available times. Check your connection and try again.",
        };
      }
    },
    [],
  );

  /*
    `cancelled` is not ceremony. Tapping through four dates fires four
    requests, and they can come back in any order — without this, a slow
    answer for Tuesday can land after Thursday's and paint Tuesday's times
    under Thursday's heading. The flag drops every response but the one for
    the date still selected.
  */
  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchSlots(selectedDate);
      if (!cancelled) setSlotData({ date: selectedDate, ...result });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, fetchSlots]);

  /** Refetch the current day on demand — used when a slot is lost mid-form. */
  const reloadSlots = useCallback(async () => {
    if (!selectedDate) return;
    const result = await fetchSlots(selectedDate);
    setSlotData({ date: selectedDate, ...result });
  }, [selectedDate, fetchSlots]);

  const selectedSlot = slots.find((slot) => slot.startTime === selectedTime);

  /* ---------------------------- details ----------------------------- */

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    vehicle: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentStatus>("paid");
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
    if (Object.keys(found).length === 0) setStep(3);
  }

  async function confirmBooking() {
    if (!selectedSlot || !vehicleTypeId || !vehicleType) return;
    // Re-derived at submit rather than trusted from render, so what is
    // written is what the totals were computed from.
    if (lines.length === 0) return;

    setSubmitting(true);
    setPaymentError(null);

    /*
      PAYMENT STILL RUNS FIRST, AND IT IS STILL A STUB.

      `processPayment` waits 1.6s and reports success — no API is called and
      no money moves (src/lib/payment.ts). Unchanged by this stage, and
      deliberately: wiring a real aggregator is its own job. What HAS
      changed is that a successful "payment" is now followed by a write to
      a real database rather than to this browser, so the ordering matters
      more than it used to. It is left as it was — pay, then write — and
      the gap is called out where it lands: if the write below fails after
      this returns success, the customer has "paid" for a booking that does
      not exist. With a stubbed processor that is a demo artefact; with a
      real one it is the thing to fix first, by taking payment only after
      the slot is held.

      No reference is minted here any more. The server decides it, because
      the server is the only party that can check it is not already taken.
    */
    if (paymentMethod === "paid") {
      const result = await processPayment({
        amountKes: totalKes,
        phone: form.phone,
        // The booking has no reference yet. The stub only echoes this back.
        reference: "pending",
      });
      if (!result.success) {
        setPaymentError(result.message);
        setSubmitting(false);
        return;
      }
    }

    /*
      WHAT IS SENT: WHAT WAS CHOSEN, NOT WHAT IT COSTS.

      The service ids and the vehicle column go up; the prices do not. The
      server reads the same price board and works the total out itself —
      see the note in src/app/api/bookings/route.ts. A booking's price is
      not something a browser gets to assert now that the record lives on a
      server and staff print receipts from it.
    */
    let response: Response;
    try {
      response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleTypeId,
          serviceIds: [...chargeable],
          date: selectedDate,
          startTime: selectedSlot.startTime,
          customerName: form.customerName.trim(),
          phone: form.phone.trim(),
          vehicle: form.vehicle.trim(),
          notes: form.notes.trim(),
          paymentStatus: paymentMethod,
        }),
      });
    } catch {
      setPaymentError(
        "We could not reach the booking system. Check your connection and try again.",
      );
      setSubmitting(false);
      return;
    }

    // The slot went while the form was open. Send them back to the grid
    // with the reason, and refetch it so the taken time is greyed out.
    if (response.status === 409) {
      setSelectedTime(null);
      setPaymentError(
        "That slot was taken while you were filling in the form. Please pick another time.",
      );
      setSubmitting(false);
      setStep(1);
      void reloadSlots();
      return;
    }

    if (!response.ok) {
      /*
        Anything else: a validation rejection, or the database being
        unreachable. The customer gets a sentence they can act on and the
        booking is NOT silently dropped — they are still on the form, with
        everything they typed, and can press the button again. The specific
        cause is in the server log, which is where it belongs.
      */
      setPaymentError(
        "We could not save your booking. Nothing has been reserved — please try again.",
      );
      setSubmitting(false);
      return;
    }

    const { booking } = (await response.json()) as { booking: { ref: string } };
    router.push(`/book/confirmed?ref=${booking.ref}`);
  }

  return (
    <div className="mt-6">
      <Stepper steps={STEPS} current={step} />

      {/* --------------------- Step 1: what you need --------------------- */}
      {step === 0 ? (
        <section className="mt-8" aria-labelledby="step-wash">
          <h2 id="step-wash" className="text-xl">
            What are we washing?
          </h2>
          <p className="mt-1 text-sm text-slab-600">
            Prices depend on the size of the vehicle, so pick that first.
          </p>

          <div
            className="mt-4 grid gap-2 sm:grid-cols-3"
            role="group"
            aria-label="Choose a vehicle type"
          >
            {vehicleTypes.map((type) => {
              const active = type.id === vehicleTypeId;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => chooseVehicle(type.id)}
                  aria-pressed={active}
                  className={`min-h-12 rounded-slab border-2 px-4 text-base font-bold uppercase tracking-wide transition-colors duration-150 ease-plain ${
                    active
                      ? "border-slab-900 bg-slab-900 text-slab-50"
                      : "border-slab-200 bg-white text-slab-700 hover:border-slab-500"
                  }`}
                >
                  {type.name}
                </button>
              );
            })}
          </div>

          {!vehicleTypeId ? (
            <p className="mt-6 rounded-slab border-2 border-dashed border-slab-300 px-4 py-8 text-center text-sm text-slab-600">
              Pick a vehicle type above to see the prices.
            </p>
          ) : (
            <>
              <h3 className="mt-8 text-base">
                Services for a {vehicleType?.name.toLowerCase()}
              </h3>
              <p className="mt-1 text-sm text-slab-600">
                Pick as many as you need. Prices are from the board at the
                bay.
              </p>

              <ul className="mt-4 flex flex-col gap-2">
                {washPriceRows.map((row) => (
                  <ServiceOption
                    key={row.id}
                    id={row.id}
                    name={row.name}
                    priceKes={washPrice(priceBook, row.id, vehicleTypeId)}
                    checked={selectedIds.has(row.id)}
                    coveredBy={covered.get(row.id)}
                    onToggle={() => toggleService(row.id)}
                  />
                ))}
              </ul>

              {/*
                THE COMPLETE-WASH WARNING. Shown only for a selected service
                whose inclusion list is unconfirmed in the data. Nothing is
                deselected — see `subsumption` in src/lib/booking.ts for why
                a warning beats a silent removal here.
              */}
              {unconfirmedScope.length > 0 ? (
                <p className="mt-4 rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-2 text-sm text-slab-800">
                  {unconfirmedScope.map((row) => row.name).join(" and ")} may
                  already include some of the other services you have picked.
                  We have not double-charged you deliberately — check with the
                  bay when you arrive and they will adjust it.
                </p>
              ) : null}

              <div className="mt-6 rounded-slab border-2 border-slab-900 bg-white">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm font-bold uppercase tracking-wide text-slab-700">
                    {lines.length === 0
                      ? "Nothing picked yet"
                      : `${lines.length} service${lines.length === 1 ? "" : "s"}`}
                  </span>
                  <span className="text-2xl font-extrabold">
                    {formatKes(totalKes)}
                  </span>
                </div>
              </div>
            </>
          )}

          {selectionError ? (
            <p
              role="alert"
              className="mt-4 rounded-slab border-2 border-alert bg-alert-tint px-3 py-2 text-sm font-semibold text-alert"
            >
              {selectionError}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-end gap-4 border-t-2 border-slab-200 pt-5">
            <Button size="lg" onClick={goToTime}>
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {/* ------------------------- Step 2: time ------------------------- */}
      {step === 1 ? (
        <section className="mt-8" aria-labelledby="step-time">
          <h2 id="step-time" className="text-xl">
            Pick a day and time
          </h2>
          {/*
            Says "we hold the bay for 30 minutes", NOT "your wash takes 30
            minutes". The figure is a placeholder that does not vary with
            how much was picked (see bookingConfig), and promising a
            duration this app cannot actually predict is the kind of small
            lie a customer measures with their own watch.
          */}
          <p className="mt-1 text-sm text-slab-600">
            We hold the bay for {formatDuration(DURATION)} per booking. If
            you have picked several services it may take longer — the bay
            will tell you when you arrive.
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
                  className={`flex min-w-18 shrink-0 flex-col items-center rounded-slab border-2 px-3 py-2.5 transition-colors duration-150 ease-plain ${
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

            {slotsLoading ? (
              <p className="mt-3 text-sm text-slab-500">Loading times...</p>
            ) : slotsError ? (
              <p className="mt-3 rounded-slab border-2 border-fail bg-fail-tint px-3 py-4 text-sm text-slab-800">
                {slotsError}
              </p>
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
                      /*
                        Selected reads DARK, not amber, and that matches the
                        date strip directly above it: picking a day and
                        picking a time are the same act done twice, and two
                        colours for it read as two different kinds of state.
                        Amber is also the Continue button sitting a few
                        centimetres below — one accent per screen, and it
                        belongs on the thing that moves you forward.
                      */
                      className={`min-h-11 rounded-slab border-2 px-2 text-sm font-bold transition-colors duration-150 ease-plain ${
                        !slot.available
                          ? "cursor-not-allowed border-slab-200 bg-slab-100 text-slab-400 line-through"
                          : active
                            ? "border-slab-900 bg-slab-900 text-slab-50"
                            : "border-slab-200 bg-white text-slab-700 hover:border-slab-500"
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
            <Button variant="quiet" size="lg" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              size="lg"
              disabled={!selectedSlot}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {/* ----------------------- Step 3: details ------------------------ */}
      {step === 2 ? (
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
            <Button variant="quiet" size="lg" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="lg" onClick={goToPayment}>
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {/* ----------------------- Step 4: payment ------------------------ */}
      {step === 3 && selectedSlot && vehicleType ? (
        <section className="mt-8" aria-labelledby="step-payment">
          <h2 id="step-payment" className="text-xl">
            Confirm and pay
          </h2>

          <div className="mt-5 rounded-slab border-2 border-slab-200 bg-white">
            {/*
              The itemised list, priced against the chosen column and headed
              by it. A total on its own would be a number the customer has
              to take on trust; this is the same breakdown that reaches the
              confirmation page, the receipt and the staff view.
            */}
            <div className="border-b-2 border-slab-100 px-4 py-3">
              <p className="text-sm font-bold uppercase tracking-wide text-slab-500">
                {vehicleType.name}
              </p>
            </div>
            <ul className="divide-y-2 divide-slab-100">
              {lines.map((line) => (
                <li
                  key={line.serviceId}
                  className="flex flex-wrap justify-between gap-2 px-4 py-2.5"
                >
                  <span className="text-sm font-semibold">{line.name}</span>
                  <span className="text-sm font-semibold">
                    {formatKes(line.priceKes)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="divide-y-2 divide-slab-100 border-t-2 border-slab-100">
              {[
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
                  {formatKes(totalKes)}
                </dd>
              </div>
            </dl>
          </div>

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
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-slab border-2 px-4 py-3 transition-colors duration-150 ease-plain ${
                    paymentMethod === value
                      ? "border-slab-900 bg-white"
                      : "border-slab-200 bg-white hover:border-slab-500"
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
              onClick={() => setStep(2)}
              disabled={submitting}
            >
              Back
            </Button>
            <Button size="lg" onClick={confirmBooking} disabled={submitting}>
              {submitting
                ? "Working..."
                : paymentMethod === "paid"
                  ? `Pay ${formatKes(totalKes)}`
                  : "Confirm booking"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One line of the service picker                                      */
/* ------------------------------------------------------------------ */

/**
 * A service, in one of three states.
 *
 *   BOOKABLE      a real price, a checkbox, and it counts to the total
 *   NOT PRICED    the board cell has not been transcribed. Listed, greyed,
 *                 no checkbox, and the price column says so in words.
 *                 NOT hidden: the yard does do interior washes, and a
 *                 missing row would say otherwise
 *   COVERED       another selected service already includes this one, so
 *                 it is disabled and labelled with what covers it. Only
 *                 ever reached from a CONFIRMED inclusion list
 *
 * A <label> wrapping the input rather than a button, so the whole row is a
 * tap target on a phone and the browser's own checkbox semantics carry the
 * state to a screen reader without an aria-pressed of our own.
 */
function ServiceOption({
  id,
  name,
  priceKes,
  checked,
  coveredBy,
  onToggle,
}: {
  id: string;
  name: string;
  /** null when nobody has read this cell off the board. */
  priceKes: number | null;
  checked: boolean;
  /** Name of the selected service that already includes this one. */
  coveredBy?: string;
  onToggle: () => void;
}) {
  const unavailable = priceKes === null;
  const disabled = unavailable || Boolean(coveredBy);

  if (disabled) {
    return (
      <li
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-slab border-2 border-dashed px-4 py-3 ${
          unavailable
            ? "border-slab-300 bg-slab-100"
            : "border-ok/40 bg-ok-tint"
        }`}
      >
        <span className="text-sm font-semibold text-slab-600">{name}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-slab-500">
          {unavailable
            ? "Price not listed - ask at the yard"
            : `Included in ${coveredBy}`}
        </span>
      </li>
    );
  }

  return (
    <li>
      <label
        className={`flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-slab border-2 px-4 py-3 transition-colors duration-150 ease-plain ${
          checked
            ? "border-slab-900 bg-white"
            : "border-slab-200 bg-white hover:border-slab-500"
        }`}
      >
        <span className="flex items-center gap-3">
          <input
            type="checkbox"
            name="services"
            value={id}
            checked={checked}
            onChange={onToggle}
            className="size-4 shrink-0 accent-hivis"
          />
          <span className="text-sm font-semibold">{name}</span>
        </span>
        <span className="text-sm font-bold whitespace-nowrap">
          {formatKes(priceKes)}
        </span>
      </label>
    </li>
  );
}
