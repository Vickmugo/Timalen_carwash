"use client";

/**
 * =====================================================================
 * REGISTER A WASH — a car at the counter, no time slot.
 * ---------------------------------------------------------------------
 * One screen, phone first: vehicle, services (the same buttons and rows
 * as /book), name, phone and plate (all optional), Now or earlier today,
 * and Already finished. The total shown is worked out from the server's
 * live prices, and the server works it out again when the form is sent:
 * nothing priced here is trusted.
 *
 * ONE REQUEST ID PER OPENING. `walkinRequestId` is drawn when the form
 * opens, so a double tap or a retry on a bad connection sends the same id
 * and the server returns the booking it already made instead of a second.
 *
 * PAYMENT IS SEPARATE AND NOTHING HERE SETTLES IT. "Paying cash" makes a
 * cash-due payment and "M-Pesa code" a claim, typed on the customer's
 * behalf. Taking the cash and verifying the code are the existing queue
 * actions, reused unchanged below, each a second tap that issues the
 * receipt. "Done" is never blocked on payment; the card says "Awaiting
 * payment" or "Paid" instead.
 * =====================================================================
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { flatVehicles, getFlatVehicle, vehicleTypes, washPriceRows, flatVehicleRows } from "@/data/services";
import { flatVehicleLines, subsumption, toLines, withoutCovered } from "@/lib/booking";
import { formatKes, minutesToTime } from "@/lib/format";
import { nairobiNow } from "@/lib/nairobi-time";
import { isSettled } from "@/lib/payments";
import type { QueuedPayment } from "@/lib/payments-db";
import { flatPrice, washPrice } from "@/lib/prices";
import { postStaff, type StaffList } from "@/lib/use-staff-list";
import { isValidKenyanPhone } from "@/lib/validate";
import { OUTSIDE_HOURS_MESSAGE, PLATE_MAX, WALKIN_DEFAULT_NAME } from "@/lib/walkin-text";
import type { Booking, BookingVehicleId, PriceBook } from "@/types";
import { FlatSizeOption, SelectionTotal, ServiceOption } from "../book/BookingFlow";
import { PaymentCell } from "./PaymentCell";
import { CashDue, PaymentsToVerify } from "./PaymentQueues";

/**
 * A v4 uuid from `getRandomValues`, which (unlike `randomUUID`) also works
 * on a page that is not a secure context, such as the yard's LAN address.
 */
function newRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function describeFailure(status: number, data: Record<string, unknown>): string {
  if (status === 401) return "Your session has expired. Reload to sign in again.";
  if (typeof data.detail === "string") return data.detail;
  if (status === 0) return "No connection. Nothing was saved — try again.";
  return "That did not save. Nothing changed — try again.";
}

function Alert({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="rounded-slab border-2 border-alert bg-alert-tint px-3 py-2 text-sm font-semibold text-alert"
    >
      {text}
    </p>
  );
}

/** Two big buttons that behave as one choice. */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-h-12 rounded-slab border-2 px-4 text-base font-bold uppercase tracking-wide transition-colors duration-150 ease-plain ${
              active
                ? "border-slab-900 bg-slab-900 text-slab-50"
                : "border-slab-200 bg-white text-slab-700 hover:border-slab-500"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The button and the form                                             */
/* ------------------------------------------------------------------ */

export function RegisterWalkin({ onChanged }: { onChanged: () => void }) {
  // A new key per opening: a fresh form, and a fresh request id with it.
  const [opening, setOpening] = useState(0);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        size="lg"
        fullWidth
        onClick={() => {
          setOpening((value) => value + 1);
          setOpen(true);
        }}
      >
        Register a wash
      </Button>
    );
  }
  return (
    <WalkinForm
      key={opening}
      onClose={() => setOpen(false)}
      onAnother={() => setOpening((value) => value + 1)}
      onChanged={onChanged}
    />
  );
}

type TimeMode = "now" | "earlier";

function WalkinForm({
  onClose,
  onAnother,
  onChanged,
}: {
  onClose: () => void;
  onAnother: () => void;
  onChanged: () => void;
}) {
  const [requestId] = useState(newRequestId);

  const [prices, setPrices] = useState<{
    book: PriceBook | null;
    /** Price sections the server could not read ("wash", "flat"). */
    unavailable: string[];
    error: string | null;
  }>({ book: null, unavailable: [], error: null });
  // The live price book, for the total on screen. The server prices the
  // walk-in again from its own read when the form is sent.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let outcome: { book: PriceBook | null; unavailable: string[]; error: string | null };
      try {
        const response = await fetch("/api/prices", { cache: "no-store" });
        if (response.status === 401) {
          outcome = { book: null, unavailable: [], error: "Your session has expired. Reload to sign in again." };
        } else if (!response.ok) {
          outcome = { book: null, unavailable: [], error: "Prices could not be loaded. Close this and try again." };
        } else {
          const body = (await response.json()) as { priceBook: PriceBook; unavailable?: string[] };
          outcome = { book: body.priceBook, unavailable: body.unavailable ?? [], error: null };
        }
      } catch {
        outcome = { book: null, unavailable: [], error: "Prices could not be loaded. Close this and try again." };
      }
      if (!cancelled) setPrices(outcome);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [vehicleId, setVehicleId] = useState<BookingVehicleId | null>(null);
  /*
    The section this vehicle is priced from could not be read: say so,
    rather than listing every service as "not listed". The server refuses
    the same case with a 503.
  */
  const sectionDown =
    vehicleId !== null && prices.unavailable.includes(getFlatVehicle(vehicleId) ? "flat" : "wash");
  const book = sectionDown ? null : prices.book;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickedFlatRowId, setPickedFlatRowId] = useState<string | null>(null);

  const vehicleType = vehicleTypes.find((type) => type.id === vehicleId);
  const flatVehicle = vehicleId ? getFlatVehicle(vehicleId) : undefined;
  const flatRows = flatVehicle ? flatVehicleRows(flatVehicle) : [];
  const flatRowId =
    flatRows.length === 1
      ? flatRows[0].id
      : flatRows.some((row) => row.id === pickedFlatRowId)
        ? pickedFlatRowId
        : null;

  const { covered } = useMemo(() => subsumption(washPriceRows, selectedIds), [selectedIds]);
  const chargeable = useMemo(() => withoutCovered(selectedIds, covered), [selectedIds, covered]);
  const lines =
    !book
      ? []
      : vehicleType
        ? toLines(washPriceRows, book, chargeable, vehicleType.id)
        : flatVehicle && flatRowId
          ? flatVehicleLines(book, flatVehicle, flatRowId)
          : [];
  const totalKes = lines.reduce((total, line) => total + line.priceKes, 0);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("now");
  const [serviceTime, setServiceTime] = useState("");
  const [alreadyDone, setAlreadyDone] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askOutsideHours, setAskOutsideHours] = useState(false);
  const [registered, setRegistered] = useState<Booking | null>(null);

  const nowHhMm = minutesToTime(nairobiNow(new Date()).minutes);

  function chooseVehicle(id: BookingVehicleId) {
    setError(null);
    setVehicleId(id);
    setPickedFlatRowId(null);
  }

  function toggleService(id: string) {
    setError(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function chooseTime(mode: TimeMode) {
    setTimeMode(mode);
    // Off for a car arriving now, on for one washed earlier; either can be changed.
    setAlreadyDone(mode === "earlier");
    setAskOutsideHours(false);
  }

  async function submit(confirmOutsideHours: boolean) {
    setError(null);
    if (!vehicleId) return setError("Pick a vehicle type.");
    if (lines.length === 0) {
      return setError(flatVehicle ? "Pick the size." : "Pick at least one service with a price.");
    }
    if (phone.trim() && !isValidKenyanPhone(phone)) {
      return setError("That phone number is not valid. Leave it blank if they have none.");
    }
    if (timeMode === "earlier" && !serviceTime) return setError("Enter the time the car came in.");
    if (timeMode === "earlier" && serviceTime > nowHhMm) {
      return setError("That time has not happened yet today. Pick Now, or a time before now.");
    }

    setSending(true);
    const result = await postStaff("/api/admin/walkins", {
      walkinRequestId: requestId,
      vehicleTypeId: vehicleId,
      serviceIds: flatVehicle ? (flatRowId ? [flatRowId] : []) : [...selectedIds],
      customerName,
      phone,
      plate,
      serviceTime: timeMode === "earlier" ? serviceTime : null,
      alreadyDone,
      confirmOutsideHours,
    });
    setSending(false);

    if (result.status === 409 && result.data.error === "outside_hours") {
      setAskOutsideHours(true);
      return;
    }
    setAskOutsideHours(false);
    if (!result.ok) return setError(describeFailure(result.status, result.data));
    setRegistered(result.data.booking as Booking);
    onChanged();
  }

  if (registered) {
    return (
      <WalkinEntryCard
        initial={registered}
        onChanged={onChanged}
        onAnother={onAnother}
        onClose={onClose}
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-slab border-2 border-slab-900 bg-white p-4"
      aria-labelledby="walkin-title"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id="walkin-title" className="text-lg">
          Register a wash
        </h3>
        <Button type="button" variant="quiet" className="min-h-11" onClick={onClose}>
          Close
        </Button>
      </div>

      {prices.error ? <Alert text={prices.error} /> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-bold uppercase tracking-wide text-slab-700">Vehicle</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...vehicleTypes, ...flatVehicles].map((type) => {
            const active = type.id === vehicleId;
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
      </fieldset>

      {sectionDown ? (
        <Alert text="Prices for this vehicle could not be read. Close this and try again in a moment." />
      ) : null}

      {vehicleId && !book && !prices.error && !sectionDown ? (
        <p className="text-sm text-slab-500">Loading prices...</p>
      ) : null}

      {book && vehicleType ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-bold uppercase tracking-wide text-slab-700">Services</legend>
          <ul className="flex flex-col gap-2">
            {washPriceRows.map((row) => (
              <ServiceOption
                key={row.id}
                id={row.id}
                name={row.name}
                priceKes={washPrice(book, row.id, vehicleType.id)}
                checked={selectedIds.has(row.id)}
                coveredBy={covered.get(row.id)}
                onToggle={() => toggleService(row.id)}
              />
            ))}
          </ul>
        </fieldset>
      ) : null}

      {book && flatVehicle ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-bold uppercase tracking-wide text-slab-700">
            {flatVehicle.name}
          </legend>
          <ul className="flex flex-col gap-2">
            {flatRows.map((row) => (
              <FlatSizeOption
                key={row.id}
                id={row.id}
                name={row.name}
                priceKes={flatPrice(book, row.id)}
                selectable={flatRows.length > 1}
                checked={row.id === flatRowId}
                onPick={() => {
                  setError(null);
                  setPickedFlatRowId(row.id);
                }}
              />
            ))}
          </ul>
        </fieldset>
      ) : null}

      {book && vehicleId ? (
        <div className="-mt-1">
          <SelectionTotal
            label={lines.length === 0 ? "Nothing picked yet" : "Total due"}
            totalKes={totalKes}
          />
        </div>
      ) : null}

      <TextField
        id="walkin-name"
        label="Name"
        hint={`Optional. Saved as "${WALKIN_DEFAULT_NAME}" if blank.`}
        autoComplete="off"
        value={customerName}
        onChange={(event) => setCustomerName(event.target.value)}
      />
      <TextField
        id="walkin-phone"
        label="Phone"
        hint="Optional."
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <TextField
        id="walkin-plate"
        label="Number plate"
        hint="Optional."
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={PLATE_MAX}
        value={plate}
        onChange={(event) => setPlate(event.target.value.toUpperCase())}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-bold uppercase tracking-wide text-slab-700">Time</legend>
        <Choice
          label="When the car came in"
          value={timeMode}
          onChange={chooseTime}
          options={[
            { value: "now", label: "Now" },
            { value: "earlier", label: "Earlier today" },
          ]}
        />
        {timeMode === "earlier" ? (
          <TextField
            id="walkin-time"
            label="Came in at"
            hint={`Today, before ${nowHhMm}.`}
            type="time"
            min="00:00"
            max={nowHhMm}
            value={serviceTime}
            onChange={(event) => setServiceTime(event.target.value)}
          />
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-semibold">
          <input
            type="checkbox"
            checked={alreadyDone}
            onChange={(event) => setAlreadyDone(event.target.checked)}
            className="size-5 shrink-0 accent-hivis"
          />
          Already finished
        </label>
      </fieldset>

      {error ? <Alert text={error} /> : null}

      {askOutsideHours ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-3"
        >
          <p className="text-base font-semibold text-slab-900">{OUTSIDE_HOURS_MESSAGE}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="dark"
              size="lg"
              disabled={sending}
              onClick={() => void submit(true)}
            >
              {sending ? "Saving..." : "Yes"}
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="lg"
              disabled={sending}
              onClick={() => setAskOutsideHours(false)}
            >
              No
            </Button>
          </div>
        </div>
      ) : (
        <Button type="submit" size="lg" fullWidth disabled={sending || !book}>
          {sending ? "Saving..." : "Register"}
        </Button>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* The entry, once registered                                          */
/* ------------------------------------------------------------------ */

/** "Awaiting payment" / "Paid", read off the latest payment. */
export function walkinPaidLabel(booking: Booking): "Awaiting payment" | "Paid" {
  return booking.payment && isSettled(booking.payment.status) ? "Paid" : "Awaiting payment";
}

/** The shape the reused queue components take, for this one payment. */
function asQueued(booking: Booking): QueuedPayment | null {
  const payment = booking.payment;
  if (!payment) return null;
  return {
    id: payment.id,
    stream: "wash",
    method: payment.method,
    destination: payment.destination,
    status: payment.status,
    amountKes: payment.amountKes,
    mpesaCode: payment.mpesaCode,
    claimedAt: payment.claimedAt,
    kind: "booking",
    ref: booking.ref,
    customerName: booking.customerName,
    phone: booking.phone,
    unpricedPieces: 0,
  };
}

function WalkinEntryCard({
  initial,
  onChanged,
  onAnother,
  onClose,
}: {
  initial: Booking;
  onChanged: () => void;
  onAnother: () => void;
  onClose: () => void;
}) {
  const [booking, setBooking] = useState(initial);

  async function reload() {
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(booking.ref)}`, { cache: "no-store" });
      if (response.ok) setBooking(((await response.json()) as { booking: Booking }).booking);
    } catch {
      // The list below refreshes too; a missed reload here is not lost data.
    }
  }

  const queued = asQueued(booking);
  const single: StaffList<QueuedPayment> = {
    items: queued ? [queued] : [],
    loading: false,
    error: null,
    refresh: reload,
  };
  const paid = walkinPaidLabel(booking);

  return (
    <div className="flex flex-col gap-4 rounded-slab border-2 border-slab-900 bg-white p-4" role="status">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slab-500">Registered</p>
        <p className="mt-1 font-mono text-2xl font-extrabold">{booking.ref}</p>
        <p className="mt-1 text-sm text-slab-700">
          {booking.customerName}
          {booking.vehicle ? ` · ${booking.vehicle}` : ""} · {booking.startTime}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-slab border-2 border-slab-200 px-4 py-3">
        <span className="text-sm font-bold uppercase tracking-wide text-slab-700">
          {paid === "Paid" ? "Paid" : "Amount due"}
        </span>
        <span className="text-2xl font-extrabold">{formatKes(booking.priceKes)}</span>
      </div>

      <WalkinPayment booking={booking} onChanged={() => void reload().then(onChanged)} />

      {queued && queued.status === "cash_due" ? (
        <CashDue list={single} onChanged={onChanged} />
      ) : null}
      {queued && queued.status === "claimed" ? (
        <PaymentsToVerify list={single} onChanged={onChanged} />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onAnother}>
          Register another
        </Button>
        <Button type="button" variant="quiet" size="lg" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recording how a walk-in pays                                        */
/* ------------------------------------------------------------------ */

/**
 * The label, and — until a payment exists (or the last one was rejected) —
 * the two ways to start one. Used on the entry card and in the bookings
 * table. Nothing here settles anything.
 */
export function WalkinPayment({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const payment = booking.payment;
  const canStart = !payment || payment.status === "rejected";
  const paid = walkinPaidLabel(booking);

  async function start(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const result = await postStaff(`/api/admin/walkins/${encodeURIComponent(booking.ref)}/payment`, body);
    setBusy(false);
    if (!result.ok) {
      setError(describeFailure(result.status, result.data));
      return;
    }
    setCodeOpen(false);
    setCode("");
    onChanged();
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <span
        className={`self-start rounded-slab border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
          paid === "Paid" ? "border-ok/30 bg-ok-tint text-ok" : "border-hivis/40 bg-hivis-tint text-slab-800"
        }`}
      >
        {paid}
      </span>
      {payment ? <PaymentCell payment={payment} kind="booking" reference={booking.ref} /> : null}

      {canStart ? (
        codeOpen ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void start({ method: "mpesa", destination: "till", mpesaCode: code });
            }}
          >
            <label className="text-xs font-bold uppercase tracking-wide text-slab-700" htmlFor={`code-${booking.ref}`}>
              Customer&apos;s M-Pesa code
            </label>
            <input
              id={`code-${booking.ref}`}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={14}
              className="min-h-11 w-full rounded-slab border-2 border-slab-300 px-3 font-mono text-base font-bold focus:border-slab-900 focus:outline-none"
            />
            <p className="text-xs text-slab-600">
              Saved as a claim. Verify it against the till statement as the next step.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="submit" variant="dark" className="min-h-11" disabled={busy || !code.trim()}>
                {busy ? "Saving..." : "Save code"}
              </Button>
              <Button type="button" variant="quiet" className="min-h-11" disabled={busy} onClick={() => setCodeOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="dark"
              className="min-h-11"
              disabled={busy}
              onClick={() => void start({ method: "cash" })}
            >
              {busy ? "Saving..." : "Paying cash"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => setCodeOpen(true)}
            >
              M-Pesa code
            </Button>
          </div>
        )
      ) : null}

      {error ? <Alert text={error} /> : null}
    </div>
  );
}
