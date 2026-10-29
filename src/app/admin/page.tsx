"use client";

/**
 * =====================================================================
 * STAFF VIEW — behind a signed session cookie (see src/proxy.ts)
 * ---------------------------------------------------------------------
 * This route is not public. src/proxy.ts matches /admin and checks for a
 * valid session cookie before Next.js renders anything here; without one it
 * redirects to /login, which takes a first name and the shared password in
 * ADMIN_PASSWORD. If ADMIN_PASSWORD or SESSION_SECRET is unset the route is
 * refused outright rather than opened. The mechanics are documented in
 * src/lib/session.ts; failed sign-ins are rate-limited per IP.
 *
 * That is still a STOPGAP, not production auth. One shared password means
 * no per-person identity and no roles. It is enough to stop a URL being
 * passed around; it is not per-person accountability.
 *
 * The NAME on every change is the first name typed at sign-in, carried in
 * the signed session and stamped by the server — no request from this page
 * sends one. It is still self-reported: anyone with the password can type
 * any listed name, so a name in the history is a courtesy, not evidence.
 *
 * Every read goes through an API route that checks the session server-side.
 *
 * STILL TO DO:
 *   - real per-person accounts and a role check, replacing the one shared
 *     password and the self-reported name
 *   - "clear all" is still the one destructive action nothing records
 *
 * ---------------------------------------------------------------------
 * THIS PAGE IS A TOOL, NOT A SHOWCASE.
 * It is opened many times a day to answer small questions: who is booked
 * this morning, what is this number that just called, which quotes are
 * still unanswered. So it stays dense and plain. No metric cards, no
 * charts, no decoration. Counts are a line of text under each heading
 * because that is all a count is, and the badges are flat two-colour pills
 * because a status is information, not an advertisement.
 *
 * The three sections share one shape — a bordered panel with a grey header
 * strip carrying the heading, the counts, the status filter and the sort —
 * so the page reads as one instrument with three parts rather than three
 * tables that happened to end up on the same URL.
 *
 * AND IT IS USED ON A PHONE. Every table below carries `record-table`,
 * which turns each row into a labelled card under 48rem. The long comment
 * on that class in src/app/globals.css is worth reading before adding a
 * column here.
 * =====================================================================
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChangeRequestBadge,
  PaymentBadge,
  QuoteStatusBadge,
  paymentLabel,
  quoteLabel,
} from "@/components/Badge";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { UNATTRIBUTED } from "@/data/admin-users";
import { useStaffName } from "./StaffName";
import { CarpetRequests } from "./CarpetRequests";
import { PaymentCell } from "./PaymentCell";
import { CashDue, PaymentsToVerify } from "./PaymentQueues";
import { PriceEditor } from "./PriceEditor";
import { ReceiptsLedger } from "./ReceiptsLedger";
import { RegisterWalkin, WalkinPayment } from "./Walkins";
import { WALKIN_DEFAULT_NAME } from "@/lib/walkin-text";
import { productCategories } from "@/data/products";
import type {
  Booking,
  ChangeRequest,
  ChangeRequestKind,
  ChangeRequestStatus,
  JobStatus,
  Order,
  PaymentStatus,
  ProductCategoryId,
  QuoteRequest,
  QuoteStatus,
  ReceiptRecord,
  StatusChange,
} from "@/types";
import type { QueuedPayment } from "@/lib/payments-db";
import { isSettled } from "@/lib/payments";
import { patchStaff, postStaff, useStaffList } from "@/lib/use-staff-list";
import {
  NOT_LIVE_BANNER,
  NOT_LIVE_CARD,
  categoryLabel,
  changeStatusLabel,
  kindLabel,
  requestText,
  stockSubjects,
  whatsappDraftUrl,
} from "@/lib/change-requests";
import {
  formatKes,
  formatLongDate,
  formatShortDate,
  formatTimestamp,
  toDateKey,
} from "@/lib/format";
import {
  bookingLines,
  bookingServiceText,
  bookingVehicleTypeName,
} from "@/lib/booking";
import { cartLineKey, cartLineName } from "@/lib/cart-line";
import { useIsHydrated } from "@/lib/store";
import {
  patchBookingJob,
  patchBookingPayment,
  useServerBookings,
} from "@/lib/use-server-bookings";

const QUOTE_STATUSES: QuoteStatus[] = ["new", "contacted", "quoted", "closed"];

const CHANGE_REQUEST_STATUSES: ChangeRequestStatus[] = ["draft", "sent"];

const CHANGE_REQUEST_KINDS: ChangeRequestKind[] = [
  "new_item",
  "stock",
];

/**
 * Ordered worst-to-best on purpose: this doubles as the "by status" sort
 * rank for bookings and orders, and the thing staff want at the top of that
 * sort is the money not yet collected.
 */
const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "pay_on_collection",
  "paid",
];

/**
 * The work on a booking, in the order it normally goes. Separate from the
 * money: see `JobStatus` in src/types/index.ts.
 */
const JOB_STATUSES: JobStatus[] = ["booked", "in_progress", "done", "cancelled", "no_show"];

/**
 * The bookings filter: each job status, plus the one question the yard
 * actually needs answered at the end of the day — which washes are finished
 * and still not paid for.
 */
type BookingFilter = JobStatus | "done_not_paid";
const BOOKING_FILTERS: BookingFilter[] = [...JOB_STATUSES, "done_not_paid"];

function bookingFilterLabel(filter: BookingFilter): string {
  return filter === "done_not_paid" ? "Done, not paid" : jobLabel(filter);
}

function jobLabel(status: JobStatus): string {
  return status === "no_show" ? "No-show" : statusWords(status).replace(/^./, (c) => c.toUpperCase());
}

/**
 * Money confirmed for this booking? A booking with a payment record is
 * paid when staff verified the code or took the cash. One made before
 * payments were recorded falls back to its hand-set status.
 */
function bookingIsPaid(booking: Booking): boolean {
  return booking.payment ? isSettled(booking.payment.status) : booking.paymentStatus === "paid";
}

function matchesBookingFilter(booking: Booking, filter: BookingFilter): boolean {
  const job = booking.jobStatus ?? "booked";
  return filter === "done_not_paid" ? job === "done" && !bookingIsPaid(booking) : job === filter;
}

/** "pay_on_collection" -> "pay on collection". Stored values are raw. */
function statusWords(status: string): string {
  return status.replace(/_/g, " ");
}

const th =
  "whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slab-400";
const td = "px-3 py-2.5 align-top text-sm";

/**
 * The three tables, minus the parts that differ.
 *
 * `record-table` is the plain-CSS class that turns rows into cards on a
 * phone (src/app/globals.css). Everything `md:`-prefixed here is a
 * desktop-only table decoration that would fight the card layout: the row
 * dividers become gaps between cards, and the minimum width becomes no
 * width at all.
 */
const tableShell =
  "record-table w-full border-collapse md:min-w-[46rem]";
const tableBody = "md:divide-y-2 md:divide-slab-100";
/** Padding around the cards on a phone; edge-to-edge table on a laptop. */
const tableWrap = "p-3 md:overflow-x-auto md:p-0";

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

/**
 * ONE search box for all three tables, not three.
 *
 * The question this page actually gets asked is "what do we have for this
 * person" — a phone number rings, and the answer might be a booking, an
 * order, or a quote from three weeks ago. Three separate filters would make
 * that three searches. One filter narrows every table at once and the
 * heading of each says how much of it is left.
 *
 * It matches name, phone, vehicle, reference, what was ordered, the free
 * text on a quote, the status in words, AND the date in every form somebody
 * might type it (see `dateTerms`). Status also has its own row of buttons
 * per section, because working through everything unpaid is a routine job
 * rather than a lookup, and it should not depend on remembering the word.
 */
function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function haystack(parts: (string | undefined)[]): string {
  return normalise(parts.filter(Boolean).join(" "));
}

/**
 * Every way somebody might type the day a record belongs to.
 *
 * "2026-09-03", "3 Sep" and "Tuesday, 3 September" are the same day, and
 * which one gets typed depends on whether the person is reading a phone
 * screen or a diary. Searching a raw ISO timestamp matched none of them
 * except the first, and only if you included the dashes.
 *
 * Takes either a "YYYY-MM-DD" date key or a full ISO timestamp.
 */
function dateTerms(value: string | undefined): string {
  if (!value) return "";
  const key = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  return `${key} ${formatLongDate(key)} ${formatShortDate(key)}`;
}

function useSearch<T>(items: T[], query: string, toText: (item: T) => string) {
  return useMemo(() => {
    const needle = normalise(query);
    if (!needle) return items;
    // Every whitespace-separated term must appear somewhere in the record,
    // so "john unpaid" narrows rather than widens.
    const terms = needle.split(/\s+/);
    return items.filter((item) => {
      const text = toText(item);
      return terms.every((term) => text.includes(term));
    });
    // toText is defined inline at each call site and is stable in behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);
}

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

type SortKey = "newest" | "oldest" | "status";

function SortSelect({
  id,
  value,
  onChange,
  dateLabel,
}: {
  id: string;
  value: SortKey;
  onChange: (value: SortKey) => void;
  /** What "newest" means for this table — a booking date, or a received time. */
  dateLabel: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="text-xs font-bold uppercase tracking-wide text-slab-500"
      >
        Sort
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as SortKey)}
        className="min-h-9 rounded-slab border-2 border-slab-300 bg-white px-2 py-1 text-sm font-semibold focus:border-slab-900 focus:outline-none"
      >
        <option value="newest">{dateLabel}, newest first</option>
        <option value="oldest">{dateLabel}, oldest first</option>
        <option value="status">By status</option>
      </select>
    </span>
  );
}

/**
 * Sorts a copy, never the array from the store — those references are shared
 * and cached (see src/lib/store.ts) and sorting one in place would corrupt
 * every other reader of it.
 */
function sortRecords<T>(
  items: T[],
  key: SortKey,
  dateOf: (item: T) => string,
  statusRank: (item: T) => number,
): T[] {
  const copy = [...items];
  if (key === "status") {
    // Within a status, newest first — otherwise "by status" would leave the
    // rows inside each group in whatever order they happened to arrive.
    return copy.sort(
      (a, b) =>
        statusRank(a) - statusRank(b) || dateOf(b).localeCompare(dateOf(a)),
    );
  }
  return copy.sort((a, b) =>
    key === "newest"
      ? dateOf(b).localeCompare(dateOf(a))
      : dateOf(a).localeCompare(dateOf(b)),
  );
}

/* ------------------------------------------------------------------ */
/* Status filter                                                       */
/* ------------------------------------------------------------------ */

/**
 * The row of status buttons under each section heading.
 *
 * One component for all three sections rather than the quotes-only version
 * this replaced. "Show me everything unpaid" is the same job as "show me
 * the quotes nobody has answered", and a tool where the same job looks
 * different in each section is a tool people learn three times.
 *
 * Each button carries its own count, so the row doubles as a breakdown and
 * the answer to "is there anything to do here" is visible before clicking
 * anything. Counts are of ALL records in the section, not of the current
 * search — a zero that appears because of a search you have forgotten about
 * is worse than no number.
 *
 * `aria-pressed` rather than a radio group: these read as toggles, and a
 * screen reader saying "pressed" for the active one matches what the
 * styling says.
 */
function StatusFilter<T extends string>({
  label,
  value,
  onChange,
  options,
  labelOf,
  countOf,
  total,
}: {
  /** Names the group for screen readers, e.g. "Filter bookings by payment". */
  label: string;
  value: T | "all";
  onChange: (value: T | "all") => void;
  options: readonly T[];
  labelOf: (status: T) => string;
  countOf: (status: T) => number;
  total: number;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4"
    >
      {(["all", ...options] as const).map((status) => {
        const active = value === status;
        const count = status === "all" ? total : countOf(status as T);
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status as T | "all")}
            aria-pressed={active}
            className={`flex min-h-9 items-center whitespace-nowrap rounded-slab border-2 px-3 text-xs font-bold uppercase tracking-wide transition-colors duration-150 ease-plain ${
              active
                ? "border-slab-900 bg-slab-900 text-slab-50"
                : "border-slab-200 bg-white text-slab-600 hover:border-slab-500"
            }`}
          >
            {status === "all" ? "All" : labelOf(status as T)} ({count})
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section shell                                                       */
/* ------------------------------------------------------------------ */

/**
 * ONE SHAPE FOR ALL THREE SECTIONS.
 *
 * A bordered panel with a grey header strip: heading and counts on the
 * left, sort on the right, status filter across the bottom of the strip,
 * records below it. Bookings, quotes and orders all get exactly this, in
 * exactly this order, so moving between them costs nothing — the sort
 * control is always in the same place, and the boundary between one
 * section and the next is a hard edge rather than a guess about spacing.
 *
 * The panel supplies the border, which is why the tables inside carry none
 * of their own and sit edge-to-edge against it on a laptop.
 */
function Section({
  id,
  title,
  counts,
  sort,
  filter,
  children,
}: {
  id: string;
  title: string;
  counts: string[];
  sort: React.ReactNode;
  filter: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="mt-6 overflow-hidden rounded-slab border-2 border-slab-300 bg-white"
    >
      <div className="border-b-2 border-slab-200 bg-slab-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <h2 id={id} className="text-lg">
              {title}
            </h2>
            <Counts parts={counts} />
          </div>
          {sort}
        </div>
        {filter}
      </div>
      {children}
    </section>
  );
}

/** The count line under a heading. Plain text on purpose — see the note above. */
function Counts({ parts }: { parts: string[] }) {
  return (
    <p className="mt-1 text-sm text-slab-600">
      {parts.filter(Boolean).join(" · ")}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Empty states                                                        */
/* ------------------------------------------------------------------ */

/**
 * Two different nothings, told apart.
 *
 * "You have no bookings yet" and "your search matched no bookings" look
 * identical as a blank table and mean completely opposite things — one is a
 * quiet Tuesday, the other is a typo or a filter left on from ten minutes
 * ago. The second one also has an obvious next action, so it offers it.
 *
 * The first one says where records come from, and links there. On a demo
 * that is the difference between an empty page and an empty page you can do
 * something about.
 */
function EmptyState({
  filtered,
  onClear,
  children,
}: {
  filtered: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="m-3 rounded-slab border-2 border-dashed border-slab-300 px-4 py-8 text-center md:m-4">
      {filtered ? (
        <>
          <p className="text-sm font-semibold text-slab-700">
            Nothing here matches the current search or filter.
          </p>
          <button
            type="button"
            onClick={onClear}
            className="mt-2 min-h-9 text-sm font-bold uppercase tracking-wide text-slab-600 underline underline-offset-4 hover:text-slab-900"
          >
            Clear search and filter
          </button>
        </>
      ) : (
        <p className="text-sm text-slab-600">{children}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/**
 * SIGN OUT — the thing HTTP Basic Auth could not do.
 *
 * A plain form posting to /api/logout, which clears the cookie and sends
 * the browser to /login. No `onSubmit`, no fetch, no state: the button
 * works before this page's JavaScript has finished arriving, which on a
 * yard phone on 3G is a real window rather than a hypothetical one.
 *
 * POST rather than a link, because a logout on GET can be fired by a
 * prefetcher or an image tag and sign somebody out mid-shift. The reasoning
 * is written out in src/app/api/logout/route.ts.
 */
function SignOutButton() {
  return (
    <form method="post" action="/api/logout">
      <Button type="submit" variant="quiet" size="sm">
        Sign out
      </Button>
    </form>
  );
}

/**
 * The honest small print, folded away.
 *
 * Every caveat that used to sit in two full-width blocks above the tables
 * is still here, word for word — but this page is opened dozens of times a
 * day by people who have already read it, and three paragraphs of "this is
 * not real authentication" between the heading and the first booking is a
 * cost paid on every one of those visits.
 *
 * So the fact that changes what someone does — a shared password — stays
 * on the summary line, always visible, and the
 * full explanation is one click behind a native <details>. Nothing is
 * hidden that a person needs in order to avoid a mistake.
 */
function AboutPanel() {
  const staffName = useStaffName();
  return (
    <div className="mt-4 rounded-slab border-2 border-slab-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="max-w-prose">
          <p className="text-sm font-bold text-slab-900">
            Signed in as {staffName}
          </p>
          <p className="mt-0.5 text-xs text-slab-500">
            Name chosen at sign-in, not verified. It is recorded on every
            change you make here.
          </p>
        </div>
        <SignOutButton />
      </div>

      <details className="border-t-2 border-slab-200 px-4 py-3">
        <summary className="cursor-pointer list-item text-sm font-bold uppercase tracking-wide text-slab-600 hover:text-slab-900">
          What this page is, and what it is not
        </summary>

        <p className="mt-3 max-w-prose text-sm text-slab-700">
          Getting in needs one password, set in{" "}
          <code className="font-mono">ADMIN_PASSWORD</code> and shared by
          everybody. There are no separate staff logins. Signing in lasts
          twelve hours on this device; Sign out ends it now. Rotating{" "}
          <code className="font-mono">SESSION_SECRET</code> signs out every
          device at once, and is the only way to do that.
        </p>
        <p className="mt-2 max-w-prose text-sm text-slab-700">
          The name you typed at sign-in is attached to every change by the
          server, but nobody checks it is yours, so the change history below
          is a courtesy to each other rather than a record that would settle
          an argument. Before this holds real
          customer data it needs proper accounts — see the notes in{" "}
          <code className="font-mono">src/proxy.ts</code>.
        </p>
        <p className="mt-2 max-w-prose text-sm text-slab-700">
          Everything on this page, change requests included, is read from
          the server, so it is the same on every device.
        </p>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status control and its history                                      */
/* ------------------------------------------------------------------ */

/**
 * The inline status select, shared by all three tables.
 *
 * Deliberately a bare select sitting in the cell rather than an edit mode
 * or a dialog: changing a status is a one-second job done while the phone
 * is still ringing, and it should cost one click from the row you are
 * already looking at. That holds on the phone layout too, where the cell
 * becomes a line in a card and the select is still right there in it.
 *
 * Options are labelled with the raw stored value, spaces for underscores.
 * The badge directly above already carries the friendly wording, so a
 * second set of labels here would only be a second thing to keep in step.
 */
function StatusSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  /** Screen-reader label. The visible column heading is not enough on its own. */
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-9 rounded-slab border-2 border-slab-300 bg-white px-1.5 py-1 text-xs font-semibold focus:border-slab-900 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {statusWords(option)}
          </option>
        ))}
      </select>
    </>
  );
}

/**
 * THE RECEIPT LINK, WHICH IS NOT ALWAYS THERE.
 *
 * Shown only once the payment status says the money is in — the rule lives
 * in `canIssueReceipt` (src/lib/receipt.ts) so the staff view and anything
 * added later cannot disagree about it. "Pay on arrival" does not qualify,
 * and it is the one that looks as though it should.
 *
 * Rendering nothing rather than a disabled control: a greyed-out button
 * invites a click and then explains itself, where an absent one simply is
 * not the job yet. The status select is right beside it, so the way to make
 * the link appear is already under the cursor.
 *
 * Opens in a new tab. Whoever prints a receipt is in the middle of working
 * down a list, and losing their place in it — the search, the sort, the
 * expanded quote — to a document they will close in ten seconds is a poor
 * trade.
 */
/*
  THE OLD RECEIPT LINK IS GONE. It appeared whenever a status select said
  "paid", which anybody could set. A receipt now exists only when the
  database has issued one, and its number links to it from the payment
  cell (./PaymentCell.tsx).
*/

function whoLabel(by: string): string {
  // "Changed by unattributed" reads like a name. Say what actually happened.
  // (Only older rows carry it; every change now has the session's name.)
  return by === UNATTRIBUTED ? "someone who had not set a name" : `${by} (self-reported)`;
}

/**
 * WHO CHANGED THIS, AND WHEN — right under the control that changed it.
 *
 * The most recent change is a plain line because that is the question
 * asked ninety-nine times out of a hundred. Older entries go in a short
 * scrollable list underneath: they are worth keeping, but not worth letting
 * one busy record push every other row off the screen. No pagination and no
 * "view all" — this is a footnote on a table row, not a feature.
 *
 * Older entries name the status they set; the latest one does not, because
 * the badge immediately above it already says so.
 */
function StatusLog({ history }: { history?: StatusChange[] }) {
  if (!history || history.length === 0) return null;

  const [latest, ...older] = history;

  return (
    <div className="text-xs leading-snug text-slab-500 md:max-w-44">
      <p>
        Changed by{" "}
        <span className="font-semibold text-slab-600">
          {whoLabel(latest.by)}
        </span>
        , {formatTimestamp(latest.at)}
      </p>
      {older.length > 0 ? (
        <ul className="mt-1 max-h-16 overflow-y-auto border-l-2 border-slab-200 pl-2">
          {older.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              {statusWords(entry.to)} &middot; {whoLabel(entry.by)},{" "}
              {formatTimestamp(entry.at)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  /*
    EVERY LIST ON THIS PAGE COMES FROM THE DATABASE, through staff-only API
    routes: bookings here, the rest through `useStaffList`.

    One consequence worth knowing at the counter: a booking made by a
    customer while this tab is open does not appear until it refreshes.
    See the note in src/lib/use-server-bookings.ts.
  */
  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    refresh: refreshBookings,
  } = useServerBookings();
  /*
    QUOTE REQUESTS COME FROM THE SERVER now (/api/quote-requests). Before,
    the /quote form saved only to the customer's own browser, so this list
    showed requests made on THIS device and nothing from customers.
  */
  const quotesList = useStaffList<QuoteRequest>("/api/quote-requests", "requests", "quote requests");
  const quotes = quotesList.items;
  const [quoteWriteError, setQuoteWriteError] = useState<string | null>(null);

  async function changeQuoteStatus(ref: string, status: QuoteStatus) {
    setQuoteWriteError(null);
    const result = await patchStaff(`/api/quote-requests/${encodeURIComponent(ref)}`, { status });
    if (!result.ok) {
      setQuoteWriteError(`Could not update ${ref}. The change was not saved — try again.`);
      return;
    }
    await quotesList.refresh();
  }
  /*
    ORDERS COME FROM THE DATABASE TOO, as of the payments stage. Orders
    placed before that are still in the browsers that placed them; this
    page no longer reads them.
  */
  const ordersList = useStaffList<Order>("/api/orders", "orders", "orders");
  const orders = ordersList.items;
  const claimedPayments = useStaffList<QueuedPayment>(
    "/api/payments?status=claimed",
    "payments",
    "payments to verify",
  );
  const cashDuePayments = useStaffList<QueuedPayment>(
    "/api/payments?status=cash_due",
    "payments",
    "cash due",
  );
  const receiptsList = useStaffList<ReceiptRecord>("/api/receipts", "receipts", "receipts");
  const [carpetRefresh, setCarpetRefresh] = useState(0);
  const loaded = useIsHydrated();

  /**
   * After a payment moves (or a receipt is voided), everything that shows
   * it reloads. The queue that acted refreshes itself.
   */
  function refreshAfterPayment() {
    void refreshBookings();
    void ordersList.refresh();
    void claimedPayments.refresh();
    void cashDuePayments.refresh();
    void receiptsList.refresh();
    setCarpetRefresh((value) => value + 1);
  }

  const [query, setQuery] = useState("");

  const [bookingSort, setBookingSort] = useState<SortKey>("newest");
  const [quoteSort, setQuoteSort] = useState<SortKey>("newest");
  const [orderSort, setOrderSort] = useState<SortKey>("newest");

  const [bookingStatus, setBookingStatus] = useState<BookingFilter | "all">(
    "all",
  );
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus | "all">("all");
  const [orderStatus, setOrderStatus] = useState<PaymentStatus | "all">("all");

  const [openQuote, setOpenQuote] = useState<string | null>(null);
  const [bookingWriteError, setBookingWriteError] = useState<string | null>(
    null,
  );

  /*
    A payment status change is now a request, not a local mutation, so it
    can fail — and it must not fail silently. On success the table is
    refetched rather than patched in place, so what is on screen is what
    the database actually holds, including the history row the server just
    wrote.
  */
  async function changeBookingPayment(ref: string, status: PaymentStatus) {
    setBookingWriteError(null);
    const ok = await patchBookingPayment(ref, status);
    if (!ok) {
      setBookingWriteError(
        `Could not update ${ref}. The change was not saved — try again.`,
      );
      return;
    }
    await refreshBookings();
  }

  async function changeBookingJob(ref: string, status: JobStatus) {
    setBookingWriteError(null);
    const ok = await patchBookingJob(ref, status);
    if (!ok) {
      setBookingWriteError(
        `Could not update ${ref}. The change was not saved — try again.`,
      );
      return;
    }
    await refreshBookings();
  }

  const searching = normalise(query).length > 0;

  /* ------------------------------ bookings ----------------------------- */

  const foundBookings = useSearch(bookings, query, (booking) =>
    haystack([
      booking.customerName,
      booking.phone,
      booking.vehicle,
      // Every service on the booking, plus the board column it was priced
      // against — so "pickup polishing" finds the right row.
      bookingServiceText(booking),
      bookingVehicleTypeName(booking) ?? "",
      booking.ref,
      dateTerms(booking.date),
      booking.startTime,
      statusWords(booking.paymentStatus),
      statusWords(booking.jobStatus ?? "booked"),
      booking.payment?.mpesaCode ?? "",
      booking.payment?.receipt?.number ?? "",
    ]),
  );

  const shownBookings = useMemo(() => {
    const byStatus =
      bookingStatus === "all"
        ? foundBookings
        : foundBookings.filter((booking) =>
            matchesBookingFilter(booking, bookingStatus),
          );
    return sortRecords(
      byStatus,
      bookingSort,
      (booking) => `${booking.date} ${booking.startTime}`,
      (booking) => JOB_STATUSES.indexOf(booking.jobStatus ?? "booked"),
    );
  }, [foundBookings, bookingStatus, bookingSort]);

  /* ------------------------------- quotes ------------------------------ */

  const foundQuotes = useSearch(quotes, query, (quote) =>
    haystack([
      quote.customerName,
      quote.phone,
      quote.item,
      quote.quantity,
      quote.deliveryLocation,
      quote.notes,
      quote.ref,
      quote.status,
      dateTerms(quote.createdAt),
      formatTimestamp(quote.createdAt),
    ]),
  );

  const shownQuotes = useMemo(() => {
    const byStatus =
      quoteStatus === "all"
        ? foundQuotes
        : foundQuotes.filter((quote) => quote.status === quoteStatus);
    return sortRecords(
      byStatus,
      quoteSort,
      (quote) => quote.createdAt,
      (quote) => QUOTE_STATUSES.indexOf(quote.status),
    );
  }, [foundQuotes, quoteStatus, quoteSort]);

  /* ------------------------------- orders ------------------------------ */

  const foundOrders = useSearch(orders, query, (order) =>
    haystack([
      order.customerName,
      order.phone,
      order.notes,
      order.ref,
      order.payment?.mpesaCode ?? "",
      order.payment?.receipt?.number ?? "",
      statusWords(order.paymentStatus),
      dateTerms(order.createdAt),
      formatTimestamp(order.createdAt),
      order.lines.map((line) => cartLineName(line)).join(" "),
    ]),
  );

  const shownOrders = useMemo(() => {
    const byStatus =
      orderStatus === "all"
        ? foundOrders
        : foundOrders.filter((order) => order.paymentStatus === orderStatus);
    return sortRecords(
      byStatus,
      orderSort,
      (order) => order.createdAt,
      (order) => PAYMENT_STATUSES.indexOf(order.paymentStatus),
    );
  }, [foundOrders, orderStatus, orderSort]);

  /* ------------------------------- counts ------------------------------ */

  /*
    Plain sentences, not tiles. "3 bookings today" is a fact that takes one
    line of text; wrapping it in a bordered card with a big number and a
    label underneath would make it a dashboard, and staff would still be
    reading the same three words.

    Counted from the FULL list, never the filtered one, so the header keeps
    telling the truth about the business while the table below shows a
    slice of it. "Showing 2 of 9" is appended separately when a search or
    filter is on, which is the only honest way to say both things at once.
  */
  const today = toDateKey(new Date());
  const bookingsToday = bookings.filter(
    (booking) => booking.date === today,
  ).length;
  const bookingsDoneNotPaid = bookings.filter((booking) =>
    matchesBookingFilter(booking, "done_not_paid"),
  ).length;
  const quotesNew = quotes.filter((quote) => quote.status === "new").length;
  const ordersUnpaid = orders.filter(
    (order) => order.paymentStatus === "unpaid",
  ).length;

  /** "showing 2 of 9" — omitted entirely when nothing is being narrowed. */
  function showing(shown: number, total: number): string {
    return shown === total ? "" : `showing ${shown} of ${total}`;
  }

  const bookingsFiltered = searching || bookingStatus !== "all";
  const quotesFiltered = searching || quoteStatus !== "all";
  const ordersFiltered = searching || orderStatus !== "all";

  /** Puts every narrowing control back to neutral, from any empty state. */
  function clearAllFilters() {
    setQuery("");
    setBookingStatus("all");
    setQuoteStatus("all");
    setOrderStatus("all");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        eyebrow="Staff view"
        title="Admin"
        backHref="/"
        backLabel="Home"
      />

      <AboutPanel />

      {!loaded ? (
        <p className="mt-8 text-slab-500">Loading records...</p>
      ) : (
        <>
          {/* --------------------------- Search --------------------------- */}
          <div className="mt-6 rounded-slab border-2 border-slab-300 bg-white p-4">
            <label
              htmlFor="admin-search"
              className="block text-xs font-bold uppercase tracking-wide text-slab-500"
            >
              Search all records
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="admin-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, phone, date, ref or status"
                className="min-h-11 w-full rounded-slab border-2 border-slab-300 px-3 text-base focus:border-slab-900 focus:outline-none sm:text-sm"
              />
              {searching ? (
                <Button variant="quiet" onClick={() => setQuery("")}>
                  Clear
                </Button>
              ) : null}
            </div>
            {searching ? (
              <p className="mt-2 text-sm text-slab-600">
                {shownBookings.length} of {bookings.length} bookings,{" "}
                {shownQuotes.length} of {quotes.length} quotes,{" "}
                {shownOrders.length} of {orders.length} orders match.
              </p>
            ) : null}
          </div>

          {/* ----------------------- Payment queues ----------------------- */}
          {/*
            FIRST, because these are the jobs that cannot wait: a customer
            who has paid is waiting for their code to be checked, and a
            receipt number is only issued from here.
          */}
          <Section
            id="admin-verify"
            title="Payments to verify"
            counts={[
              claimedPayments.loading
                ? ""
                : `${claimedPayments.items.length} M-Pesa code${claimedPayments.items.length === 1 ? "" : "s"} waiting, oldest first`,
            ]}
            sort={null}
            filter={null}
          >
            <div className="p-3 md:p-4">
              <PaymentsToVerify list={claimedPayments} onChanged={refreshAfterPayment} />
            </div>
          </Section>

          <Section
            id="admin-cash"
            title="Cash due"
            counts={[
              cashDuePayments.loading
                ? ""
                : `${cashDuePayments.items.length} waiting`,
            ]}
            sort={null}
            filter={null}
          >
            <div className="p-3 md:p-4">
              <CashDue list={cashDuePayments} onChanged={refreshAfterPayment} />
            </div>
          </Section>

          {/* ------------------------- Bookings ------------------------- */}
          <Section
            id="admin-bookings"
            title="Wash bookings"
            counts={[
              `${bookings.length} in total`,
              `${bookingsToday} today`,
              bookingsDoneNotPaid > 0 ? `${bookingsDoneNotPaid} done, not paid` : "",
              showing(shownBookings.length, bookings.length),
            ]}
            sort={
              bookings.length > 0 ? (
                <SortSelect
                  id="sort-bookings"
                  value={bookingSort}
                  onChange={setBookingSort}
                  dateLabel="Wash date"
                />
              ) : null
            }
            filter={
              bookings.length > 0 ? (
                <StatusFilter
                  label="Filter bookings by job"
                  value={bookingStatus}
                  onChange={setBookingStatus}
                  options={BOOKING_FILTERS}
                  labelOf={bookingFilterLabel}
                  countOf={(filter) =>
                    bookings.filter((booking) =>
                      matchesBookingFilter(booking, filter),
                    ).length
                  }
                  total={bookings.length}
                />
              ) : null
            }
          >
            {/*
              A CAR AT THE COUNTER, NO SLOT. First in the section, full
              width on a phone: this is the job done most often at the yard.
              See src/app/admin/Walkins.tsx.
            */}
            <div className="border-b-2 border-slab-200 p-3 md:p-4">
              <RegisterWalkin onChanged={refreshAfterPayment} />
            </div>

            {bookingsError || bookingWriteError ? (
              <p className="mb-4 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800">
                {bookingWriteError ?? bookingsError}
              </p>
            ) : null}

            {bookingsLoading ? (
              <p className="text-sm text-slab-500">Loading bookings...</p>
            ) : shownBookings.length === 0 ? (
              <EmptyState filtered={bookingsFiltered} onClear={clearAllFilters}>
                No bookings yet.{" "}
                <Link
                  href="/book"
                  className="font-semibold underline underline-offset-4 hover:text-slab-900"
                >
                  Book a wash
                </Link>{" "}
                and it will appear here.
              </EmptyState>
            ) : (
              <div className={tableWrap}>
                <table className={tableShell}>
                  <thead className="bg-slab-900">
                    <tr>
                      <th className={th}>Date</th>
                      <th className={th}>Time</th>
                      <th className={th}>Services</th>
                      <th className={th}>Customer</th>
                      <th className={th}>Phone</th>
                      <th className={th}>Vehicle</th>
                      <th className={th}>Job</th>
                      <th className={th}>Payment</th>
                      <th className={th}>Ref</th>
                    </tr>
                  </thead>
                  <tbody className={tableBody}>
                    {shownBookings.map((booking) => (
                      <BookingRow
                        key={booking.ref}
                        booking={booking}
                        today={today}
                        onPaymentChange={changeBookingPayment}
                        onJobChange={changeBookingJob}
                        onWalkinPayment={refreshAfterPayment}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ---------------------- Quote requests ---------------------- */}
          <Section
            id="admin-quotes"
            title="Quote requests"
            counts={[
              `${quotes.length} in total`,
              quotes.length === 0
                ? ""
                : quotesNew > 0
                  ? `${quotesNew} not yet contacted`
                  : "all answered",
              showing(shownQuotes.length, quotes.length),
            ]}
            sort={
              quotes.length > 0 ? (
                <SortSelect
                  id="sort-quotes"
                  value={quoteSort}
                  onChange={setQuoteSort}
                  dateLabel="Received"
                />
              ) : null
            }
            filter={
              quotes.length > 0 ? (
                <StatusFilter
                  label="Filter quote requests by status"
                  value={quoteStatus}
                  onChange={setQuoteStatus}
                  options={QUOTE_STATUSES}
                  labelOf={quoteLabel}
                  countOf={(status) =>
                    quotes.filter((quote) => quote.status === status).length
                  }
                  total={quotes.length}
                />
              ) : null
            }
          >
            {quotesList.error || quoteWriteError ? (
              <p className="m-3 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800">
                {quoteWriteError ?? quotesList.error}
              </p>
            ) : null}
            {quotesList.loading ? (
              <p className="p-4 text-sm text-slab-500">Loading quote requests...</p>
            ) : shownQuotes.length === 0 ? (
              <EmptyState filtered={quotesFiltered} onClear={clearAllFilters}>
                No quote requests yet.{" "}
                <Link
                  href="/quote"
                  className="font-semibold underline underline-offset-4 hover:text-slab-900"
                >
                  Submit one
                </Link>{" "}
                and it will appear here.
              </EmptyState>
            ) : (
              <div className={tableWrap}>
                <table className={`${tableShell} md:min-w-[42rem]`}>
                  <thead className="bg-slab-900">
                    <tr>
                      <th className={th}>Received</th>
                      <th className={th}>Customer</th>
                      <th className={th}>Phone</th>
                      <th className={th}>Wants</th>
                      <th className={th}>Status</th>
                      <th className={th}>
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={tableBody}>
                    {shownQuotes.map((quote) => (
                      <QuoteRows
                        key={quote.ref}
                        quote={quote}
                        expanded={openQuote === quote.ref}
                        onStatus={(status) => void changeQuoteStatus(quote.ref, status)}
                        onToggle={() =>
                          setOpenQuote((current) =>
                            current === quote.ref ? null : quote.ref,
                          )
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ------------------ Carpet & sofa-set requests ------------------ */}
          <Section
            id="admin-carpets"
            title="Carpet & sofa-set requests"
            counts={["from /book/carpets — payments are handled in the queues above"]}
            sort={null}
            filter={null}
          >
            <CarpetRequests refreshKey={carpetRefresh} />
          </Section>

          {/* -------------------------- Orders -------------------------- */}
          <Section
            id="admin-orders"
            title="Product orders"
            counts={[
              `${orders.length} in total`,
              ordersUnpaid > 0 ? `${ordersUnpaid} unpaid` : "",
              showing(shownOrders.length, orders.length),
            ]}
            sort={
              orders.length > 0 ? (
                <SortSelect
                  id="sort-orders"
                  value={orderSort}
                  onChange={setOrderSort}
                  dateLabel="Received"
                />
              ) : null
            }
            filter={
              orders.length > 0 ? (
                <StatusFilter
                  label="Filter orders by payment"
                  value={orderStatus}
                  onChange={setOrderStatus}
                  options={PAYMENT_STATUSES}
                  labelOf={paymentLabel}
                  countOf={(status) =>
                    orders.filter((order) => order.paymentStatus === status)
                      .length
                  }
                  total={orders.length}
                />
              ) : null
            }
          >
            {ordersList.error ? (
              <p className="mb-4 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800">
                {ordersList.error}
              </p>
            ) : null}
            {ordersList.loading ? (
              <p className="text-sm text-slab-500">Loading orders...</p>
            ) : shownOrders.length === 0 ? (
              <EmptyState filtered={ordersFiltered} onClear={clearAllFilters}>
                No product orders yet.{" "}
                <Link
                  href="/products"
                  className="font-semibold underline underline-offset-4 hover:text-slab-900"
                >
                  Complete a checkout
                </Link>{" "}
                and it will appear here.
              </EmptyState>
            ) : (
              <div className={tableWrap}>
                <table className={tableShell}>
                  <thead className="bg-slab-900">
                    <tr>
                      <th className={th}>Received</th>
                      <th className={th}>Customer</th>
                      <th className={th}>Phone</th>
                      <th className={th}>Items</th>
                      <th className={th}>Collection</th>
                      <th className={th}>Total</th>
                      <th className={th}>Payment</th>
                      <th className={th}>Ref</th>
                    </tr>
                  </thead>
                  <tbody className={tableBody}>
                    {shownOrders.map((order) => (
                      <OrderRow key={order.ref} order={order} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* --------------------------- Receipts --------------------------- */}
          <Section
            id="admin-receipts"
            title="Receipts"
            counts={[
              receiptsList.loading ? "" : `${receiptsList.items.length} issued in total`,
              "W = wash and carpets (till, bay cash) · C = concrete (paybill, yard cash)",
            ]}
            sort={null}
            filter={null}
          >
            <div className="p-3 md:p-4">
              <ReceiptsLedger list={receiptsList} onChanged={refreshAfterPayment} />
            </div>
          </Section>

          {/* ---------------------------- Prices ---------------------------- */}
          {/*
            ABOVE the change requests, and that ordering is the point. This
            is the section that actually changes the site; the one below is
            for the two things staff still cannot do themselves. Somebody
            arriving to fix a price should meet the editor first.
          */}
          <Section
            id="admin-prices"
            title="Prices"
            counts={["live — saved changes apply immediately"]}
            sort={null}
            filter={null}
          >
            <PriceEditor />
          </Section>

          <ChangeRequestsSection />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

/*
  EVERY CELL BELOW CARRIES `data-label`, AND THAT IS NOT DECORATION.

  Under 48rem the `record-table` class (src/app/globals.css) turns each row
  into a card and each cell into a labelled line, using `data-label` as the
  label — so a cell without one loses its heading entirely on a phone. The
  first cell of each row takes `data-head` instead: it becomes the card's
  title line, which needs no label because the value says what it is.

  Keep `data-label` identical to the column heading above it. Two names for
  one column is two things to change.
*/

function BookingRow({
  booking,
  today,
  onPaymentChange,
  onJobChange,
  onWalkinPayment,
}: {
  booking: Booking;
  today: string;
  /*
    Passed in rather than imported. The row used to call the store directly
    and the write was synchronous and could not fail; it is now a request
    to the server, and the page above owns both the refresh that follows it
    and the message shown if it does not land.
  */
  onPaymentChange: (ref: string, status: PaymentStatus) => void;
  onJobChange: (ref: string, status: JobStatus) => void;
  /** A walk-in's payment was started; reload what shows it. */
  onWalkinPayment: () => void;
}) {
  const isToday = booking.date === today;
  const job = booking.jobStatus ?? "booked";
  const walkIn = booking.source === "staff";
  return (
    <tr>
      <td className={`${td} font-semibold md:whitespace-nowrap`} data-head="">
        {formatLongDate(booking.date)}
        {/* The one thing worth spotting at a glance on this table. */}
        {isToday ? (
          <span className="ml-2 rounded-slab bg-hivis px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slab-900">
            Today
          </span>
        ) : null}
        {walkIn ? (
          <span className="ml-2 rounded-slab border border-slab-900 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slab-900">
            Walk-in
          </span>
        ) : null}
      </td>
      <td className={`${td} md:whitespace-nowrap`} data-label="Time">
        {booking.startTime} - {booking.endTime}
      </td>
      {/*
        Every service on the booking, one per line, with the vehicle column
        underneath. Staff read this cell to know what the bay is actually
        doing to the car, and a booking is no longer one thing — "Body Wash,
        Polishing" run together on one line is a sentence rather than a list.

        Read through `bookingLines` so a record made before the price board
        existed still shows its single old service instead of a blank cell.
      */}
      <td className={td} data-label="Services">
        <ul className="flex flex-col gap-0.5">
          {bookingLines(booking).map((line) => (
            <li key={line.serviceId}>
              {line.name}{" "}
              <span className="text-slab-500">{formatKes(line.priceKes)}</span>
            </li>
          ))}
        </ul>
        {bookingVehicleTypeName(booking) ? (
          <span className="mt-0.5 block text-xs text-slab-500">
            {bookingVehicleTypeName(booking)}
          </span>
        ) : null}
      </td>
      <td className={td} data-label="Customer">
        {booking.customerName}
        {/* A walk-in left as "Customer" is known by its plate. */}
        {walkIn && booking.customerName === WALKIN_DEFAULT_NAME && booking.vehicle ? (
          <span className="mt-0.5 block font-mono text-xs font-bold">{booking.vehicle}</span>
        ) : null}
      </td>
      <td className={`${td} md:whitespace-nowrap`} data-label="Phone">
        {booking.phone ? (
          <a href={`tel:${booking.phone.replace(/\s/g, "")}`} className="underline underline-offset-4 hover:text-slab-600">
            {booking.phone}
          </a>
        ) : (
          <span className="text-slab-500">No phone</span>
        )}
      </td>
      <td className={td} data-label="Vehicle">
        {booking.vehicle}
      </td>
      {/*
        THE WORK, separately from the money. Every change goes to
        `status_changes` with the session's name, alongside the payment
        events the queues write, so the log under it is the whole story.
      */}
      <td className={td} data-label="Job">
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs font-bold uppercase tracking-wide">
            {jobLabel(job)}
          </span>
          <StatusSelect
            id={`job-booking-${booking.ref}`}
            label={`Change job status for booking ${booking.ref}`}
            value={job}
            options={JOB_STATUSES}
            onChange={(status) => onJobChange(booking.ref, status)}
          />
          <StatusLog history={booking.history} />
        </div>
      </td>
      <td className={td} data-label="Payment">
        {walkIn ? (
          /*
            A WALK-IN: never the legacy hand-set select (the server refuses
            it too). Its payment is started here and settled in the queues
            above, which issue the receipt.
          */
          <WalkinPayment booking={booking} onChanged={onWalkinPayment} />
        ) : booking.payment ? (
          <PaymentCell payment={booking.payment} kind="booking" reference={booking.ref} />
        ) : (
          /*
            A BOOKING FROM BEFORE PAYMENTS WERE RECORDED. It has nothing to
            verify and no receipt can be issued for it, so its hand-set
            status stays editable here — the server refuses this select for
            any booking that has a payment record.
          */
          <div className="flex flex-col items-start gap-1">
            <PaymentBadge status={booking.paymentStatus} />
            <span className="text-xs text-slab-500">
              {formatKes(booking.priceKes)} · no payment record
            </span>
            <StatusSelect
              id={`pay-booking-${booking.ref}`}
              label={`Change payment status for booking ${booking.ref}`}
              value={booking.paymentStatus}
              options={PAYMENT_STATUSES}
              onChange={(status) => onPaymentChange(booking.ref, status)}
            />
          </div>
        )}
      </td>
      <td className={`${td} font-mono text-xs text-slab-500`} data-label="Ref">
        {booking.ref}
      </td>
    </tr>
  );
}

/**
 * A quote as two rows: the scannable line, and the detail underneath it when
 * asked for.
 *
 * The long fields — what they want, quantity, delivery, notes, and any cart
 * lines the request came from — were making every row three lines tall and
 * the table 52rem wide, which is a horizontal scroll on any laptop. They are
 * still one click away, in place, and NOT in a dialog: a modal would cover
 * the list you are working through, and the job here is to go down the new
 * requests one after another.
 *
 * Status stays an inline select on the summary row for the same reason.
 * Changing it is a one-second action and it should not cost a round trip
 * through a dialog.
 *
 * `data-detail` on the second row is what tells the phone layout to join it
 * to the card above rather than start a new one.
 */
function QuoteRows({
  quote,
  expanded,
  onToggle,
  onStatus,
}: {
  quote: QuoteRequest;
  expanded: boolean;
  onToggle: () => void;
  /** Saved on the server, attributed to the session's name there. */
  onStatus: (status: QuoteStatus) => void;
}) {
  const detailId = `quote-detail-${quote.ref}`;
  return (
    <>
      <tr>
        <td className={`${td} md:whitespace-nowrap`} data-head="">
          {formatTimestamp(quote.createdAt)}
          <span className="mt-0.5 block font-mono text-xs font-normal text-slab-400">
            {quote.ref}
          </span>
        </td>
        <td className={`${td} font-semibold`} data-label="Customer">
          {quote.customerName}
        </td>
        <td className={`${td} md:whitespace-nowrap`} data-label="Phone">
          <a href={`tel:${quote.phone.replace(/\s/g, "")}`} className="underline underline-offset-4 hover:text-slab-600">
            {quote.phone}
          </a>
        </td>
        <td className={`${td} md:max-w-64`} data-label="Wants">
          <span className="line-clamp-2">{quote.item}</span>
          <span className="mt-0.5 block text-xs text-slab-500">
            Qty {quote.quantity}
          </span>
        </td>
        <td className={td} data-label="Status">
          <div className="flex flex-col items-start gap-1.5">
            <QuoteStatusBadge status={quote.status} />
            <StatusSelect
              id={`st-${quote.ref}`}
              label={`Change status for quote ${quote.ref}`}
              value={quote.status}
              options={QUOTE_STATUSES}
              onChange={(status) =>
                onStatus(status)
              }
            />
            <StatusLog history={quote.history} />
          </div>
        </td>
        <td className={`${td} md:text-right`}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={detailId}
            className="min-h-9 w-full whitespace-nowrap rounded-slab border-2 border-slab-300 px-2.5 text-xs font-bold uppercase tracking-wide text-slab-700 transition-colors duration-150 ease-plain hover:border-slab-900 hover:text-slab-900 md:w-auto"
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </td>
      </tr>

      {expanded ? (
        <tr id={detailId} className="bg-slab-50" data-detail="">
          <td className={`${td} text-slab-700`} colSpan={6}>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-slab-500">
                  Wants
                </dt>
                <dd className="mt-0.5 max-w-prose whitespace-pre-line">
                  {quote.item}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slab-500">
                  Quantity
                </dt>
                <dd className="mt-0.5">{quote.quantity}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slab-500">
                  Collection / location given
                </dt>
                <dd className="mt-0.5">{quote.deliveryLocation || "-"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-slab-500">
                  Notes
                </dt>
                <dd className="mt-0.5 max-w-prose whitespace-pre-line">
                  {quote.notes || "-"}
                </dd>
              </div>
              {quote.lines.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slab-500">
                    Came from a cart
                  </dt>
                  <dd className="mt-0.5">
                    <ul className="flex flex-col gap-0.5">
                      {quote.lines.map((line) => (
                        <li key={cartLineKey(line)}>
                          {cartLineName(line)}{" "}
                          <span className="text-slab-500">
                            x {line.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <tr>
      <td className={`${td} md:whitespace-nowrap`} data-head="">
        {formatTimestamp(order.createdAt)}
      </td>
      <td className={`${td} font-semibold`} data-label="Customer">
        {order.customerName}
      </td>
      <td className={`${td} md:whitespace-nowrap`} data-label="Phone">
        <a href={`tel:${order.phone.replace(/\s/g, "")}`} className="underline underline-offset-4 hover:text-slab-600">
          {order.phone}
        </a>
      </td>
      <td className={td} data-label="Items">
        <ul className="flex flex-col gap-0.5">
          {order.lines.map((line) => (
            <li key={cartLineKey(line)}>
              {cartLineName(line)}{" "}
              <span className="text-slab-500">x {line.quantity}</span>
            </li>
          ))}
        </ul>
      </td>
      <td className={td} data-label="Collection">
        {order.deliveryLocation}
      </td>
      <td className={`${td} font-bold md:whitespace-nowrap`} data-label="Total">
        {formatKes(order.subtotalKes)}
      </td>
      <td className={td} data-label="Payment">
        {order.payment ? (
          <div className="flex flex-col items-start gap-1">
            <PaymentCell payment={order.payment} kind="order" reference={order.ref} />
            <StatusLog history={order.history} />
          </div>
        ) : (
          <PaymentBadge status={order.paymentStatus} />
        )}
      </td>
      <td className={`${td} font-mono text-xs text-slab-500`} data-label="Ref">
        {order.ref}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Content-change requests                                             */
/* ------------------------------------------------------------------ */

/**
 * =====================================================================
 * THE ONE SECTION ON THIS PAGE THAT CHANGES NOTHING
 * ---------------------------------------------------------------------
 * Bookings, orders and quotes above are RECORDS: a customer did a thing,
 * and the row is the evidence. This section is the opposite — it is the
 * yard asking for something that has not happened yet, and it is sitting
 * directly underneath three tables that look almost identical to it.
 *
 * That resemblance is the risk the whole design of this section is built
 * around. Somebody drafts "Slabs, 550 -> 600", sees a tidy card land in a
 * list beneath the real ones, and leaves believing the price changed. The
 * next customer is quoted 550 at the counter and 550 on the phone, and
 * nobody understands why.
 *
 * So the not-live wording is stated THREE times — a banner that cannot be
 * dismissed, a line on every single card, and a line at the bottom of the
 * copied message where it outlives this screen entirely. Repetition is the
 * feature. A banner at the top of a list is read once and scrolled past
 * forever after.
 *
 * WHAT IT DOES INSTEAD. It drafts a message. "Copy" puts a labelled,
 * plain-text version on the clipboard; "Send on WhatsApp" opens WhatsApp
 * with that text and NO recipient, so whoever is holding the phone picks
 * from their own contacts. Neither one touches the catalogue, because the
 * catalogue is a TypeScript file in a build.
 *
 * "Mark sent" is a tick on the yard's own list — see the note on
 * `ChangeRequestStatus` in src/types/index.ts for why there is no third
 * "applied" state.
 * =====================================================================
 */

/** Shared input styling for the change-request form. */
const formControl =
  "min-h-11 w-full rounded-slab border-2 border-slab-300 bg-white px-3 text-base font-semibold text-slab-900 focus:border-slab-900 focus:outline-none sm:text-sm";

const formLabel =
  "block text-xs font-bold uppercase tracking-wide text-slab-500";

/**
 * The banner. Amber, bordered, and NOT dismissible.
 *
 * A dismiss button would be the obvious kindness and it is the wrong call:
 * the person who most needs this sentence is the one who has seen it enough
 * times to close it, and it costs one line of a section they are already
 * scrolled to.
 */
function NotLiveBanner() {
  return (
    <p className="border-b-2 border-hivis bg-hivis-tint px-4 py-3 text-sm font-semibold text-slab-800">
      {NOT_LIVE_BANNER}
    </p>
  );
}

/**
 * COPY TO CLIPBOARD, WITH THE FAILURE CASE VISIBLE.
 *
 * `navigator.clipboard` needs a secure context and a permission that a
 * browser can refuse, and this page runs on phones in a yard. A copy that
 * silently does nothing is worse than no button: staff paste into WhatsApp,
 * send whatever was on the clipboard before, and find out later. So a
 * refusal says so and tells them the text is selectable on the card.
 */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 3000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button variant="quiet" size="sm" onClick={copy}>
        {state === "copied" ? "Copied" : "Copy"}
      </Button>
      {state === "failed" ? (
        <span role="alert" className="text-xs font-semibold text-alert">
          Could not reach the clipboard. Select the text below and copy it by
          hand.
        </span>
      ) : null}
    </span>
  );
}

/**
 * The three kinds, as a row of chips.
 *
 * Same shape and colours as `StatusFilter` above, deliberately — this page
 * has one idiom for "pick one of a short list" and a second one would be a
 * second thing to learn. Not a `<select>`: there are three options, they
 * change the whole form underneath, and a dropdown hides two of the three
 * things this section can do behind a click.
 */
function KindPicker({
  value,
  onChange,
}: {
  value: ChangeRequestKind;
  onChange: (kind: ChangeRequestKind) => void;
}) {
  return (
    <div
      role="group"
      aria-label="What kind of change are you asking for?"
      className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1"
    >
      {CHANGE_REQUEST_KINDS.map((kind) => {
        const active = value === kind;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onChange(kind)}
            aria-pressed={active}
            className={`flex min-h-9 items-center whitespace-nowrap rounded-slab border-2 px-3 text-xs font-bold uppercase tracking-wide transition-colors duration-150 ease-plain ${
              active
                ? "border-slab-900 bg-slab-900 text-slab-50"
                : "border-slab-200 bg-white text-slab-600 hover:border-slab-500"
            }`}
          >
            {kindLabel(kind)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * THE DRAFTING FORM — inline, above the list, never a dialog.
 *
 * Same argument as the quote detail rows: a modal covers the list you are
 * working through, and drafting a request is often prompted by looking at
 * one that is already there. It stays open after a save, with the fields
 * cleared, because these come in batches — a price review is six of these
 * in a row, not one.
 */
function ChangeRequestForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<ChangeRequestKind>("new_item");
  const [error, setError] = useState<string | null>(null);
  const [savedRef, setSavedRef] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Shared across kinds.
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");

  /*
    NO PRICE SCOPE OR SUBJECT STATE ANY MORE. The two-step
    vehicle-then-service picker moved to the price editor, which edits the
    real figure instead of asking somebody else to change it.
  */

  // New item.
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<ProductCategoryId | "other">(
    productCategories[0].id,
  );
  const [otherCategory, setOtherCategory] = useState("");
  const [description, setDescription] = useState("");
  const [photoNeeded, setPhotoNeeded] = useState(false);

  // Stock.
  const [stockId, setStockId] = useState("");
  const [intent, setIntent] = useState<"out_of_stock" | "back_in_stock">(
    "out_of_stock",
  );

  // Reads the catalogue, which is compiled in and cannot change while the
  // page is open. Computed once rather than on every keystroke.
  const stockOptions = useMemo(() => stockSubjects(), []);

  /**
   * Whole shillings or nothing.
   *
   * `formatKes` prints no decimals, so a proposed 549.50 would be shown to
   * the developer as 550 — a request quietly altered between typing and
   * reading. Rejected rather than rounded.
   */
  function readPrice(): number | null {
    const value = Number(price.trim());
    if (!Number.isFinite(value) || value <= 0) return null;
    if (!Number.isInteger(value)) return null;
    return value;
  }

  function resetFields() {
    setNote("");
    setPrice("");
    setName("");
    setCategoryId(productCategories[0].id);
    setOtherCategory("");
    setDescription("");
    setPhotoNeeded(false);
    setStockId("");
    setIntent("out_of_stock");
  }

  /*
    The server mints the ref, the time and the name (from the staff
    session) and checks every field again; this only catches the obvious
    before a round trip.
  */
  async function save() {
    setSavedRef(null);

    const base = { note: note.trim() };
    let request: Record<string, unknown>;

    if (kind === "new_item") {
      if (!name.trim()) {
        setError("Give the new item a name.");
        return;
      }
      if (categoryId === "other" && !otherCategory.trim()) {
        setError("Describe the new category.");
        return;
      }
      const proposed = readPrice();
      if (proposed === null) {
        setError("Enter the proposed price in whole shillings.");
        return;
      }
      request = {
        ...base,
        kind: "new_item",
        name: name.trim(),
        categoryId,
        otherCategory: otherCategory.trim(),
        proposedPriceKes: proposed,
        description: description.trim(),
        photoNeeded,
      };
    } else {
      const subject = stockOptions.find((option) => option.id === stockId);
      if (!subject) {
        setError("Pick which product this is about.");
        return;
      }
      request = {
        ...base,
        kind: "stock",
        subjectId: subject.id,
        intent,
      };
    }

    setSaving(true);
    const result = await postStaff("/api/change-requests", request);
    setSaving(false);
    if (!result.ok) {
      setError(
        typeof result.data.detail === "string"
          ? result.data.detail
          : result.status === 401
            ? "Your session has expired. Reload the page to sign in again."
            : "Could not save the request. Nothing was stored — try again.",
      );
      return;
    }
    setError(null);
    setSavedRef(String(result.data.ref));
    resetFields();
    await onSaved();
  }

  return (
    <div className="border-b-2 border-slab-200 bg-slab-50 px-4 py-4">
      <h3 className="text-base">Draft a request</h3>
      <div className="mt-3">
        <KindPicker
          value={kind}
          onChange={(next) => {
            setKind(next);
            setError(null);
          }}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {kind === "new_item" ? (
          <>
            <div>
              <label htmlFor="cr-name" className={formLabel}>
                Name
              </label>
              <input
                id="cr-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Air vents"
                className={`mt-1.5 ${formControl}`}
              />
            </div>

            <div>
              <label htmlFor="cr-category" className={formLabel}>
                Category
              </label>
              {/*
                The eight real categories from src/data/products.ts, plus
                an escape hatch. The yard genuinely makes things that fit
                none of them — air vents and culverts are named on the quote
                page already — and filing one of those under "Slabs" because
                the dropdown had nothing else creates a request the
                developer has to undo before they can act on it.
              */}
              <select
                id="cr-category"
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(
                    event.target.value as ProductCategoryId | "other",
                  )
                }
                className={`mt-1.5 ${formControl}`}
              >
                {productCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="other">Other — describe it</option>
              </select>
            </div>

            {categoryId === "other" ? (
              <div className="sm:col-span-2">
                <label htmlFor="cr-other-category" className={formLabel}>
                  New category
                </label>
                <input
                  id="cr-other-category"
                  type="text"
                  value={otherCategory}
                  onChange={(event) => setOtherCategory(event.target.value)}
                  placeholder="Culverts"
                  className={`mt-1.5 ${formControl}`}
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="cr-new-price" className={formLabel}>
                Proposed price (KES)
              </label>
              <input
                id="cr-new-price"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="1200"
                className={`mt-1.5 ${formControl}`}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cr-description" className={formLabel}>
                Short description
              </label>
              <textarea
                id="cr-description"
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What it is, what size, what it is used for."
                className={`mt-1.5 ${formControl} py-2`}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={photoNeeded}
                onChange={(event) => setPhotoNeeded(event.target.checked)}
                className="size-4 shrink-0 accent-hivis"
              />
              <span className="text-sm font-semibold text-slab-700">
                We still owe a photo of this
              </span>
            </label>
          </>
        ) : null}

        {kind === "stock" ? (
          <>
            <div className="sm:col-span-2">
              <label htmlFor="cr-stock" className={formLabel}>
                Which product
              </label>
              <select
                id="cr-stock"
                value={stockId}
                onChange={(event) => setStockId(event.target.value)}
                className={`mt-1.5 ${formControl}`}
              >
                <option value="">Choose...</option>
                {stockOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cr-intent" className={formLabel}>
                Change to
              </label>
              <select
                id="cr-intent"
                value={intent}
                onChange={(event) =>
                  setIntent(
                    event.target.value as "out_of_stock" | "back_in_stock",
                  )
                }
                className={`mt-1.5 ${formControl}`}
              >
                <option value="out_of_stock">Out of stock</option>
                <option value="back_in_stock">Back in stock</option>
              </select>
            </div>
          </>
        ) : null}

        <div className="sm:col-span-2">
          <label htmlFor="cr-note" className={formLabel}>
            Note (optional)
          </label>
          <input
            id="cr-note"
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything the developer should know."
            className={`mt-1.5 ${formControl}`}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-slab border-2 border-alert bg-alert-tint px-3 py-2 text-sm font-semibold text-alert"
        >
          {error}
        </p>
      ) : null}

      {savedRef ? (
        <p
          role="status"
          className="mt-4 rounded-slab border-2 border-slab-300 bg-white px-3 py-2 text-sm text-slab-700"
        >
          Saved as <span className="font-mono font-bold">{savedRef}</span>. It
          is a draft — nothing has been sent and nothing on the site has
          changed.
        </p>
      ) : null}

      <div className="mt-4">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save as draft"}
        </Button>
      </div>
    </div>
  );
}

/**
 * ONE REQUEST, AS A CARD.
 *
 * A card rather than a table row, which every other list on this page uses.
 * The difference is real: a table is for scanning many similar records down
 * a column, and what happens to one of these is that somebody reads the
 * whole thing once, copies it, and sends it. The unit of use is the whole
 * record, so the whole record is one block.
 *
 * The copied text is shown verbatim in a `<pre>` and not hidden behind the
 * button. It is what will land in somebody's chat thread, it should be
 * readable before it is sent, and when the clipboard is refused it is the
 * fallback — selectable text on the page.
 */
function ChangeRequestCard({
  request,
  onStatus,
}: {
  request: ChangeRequest;
  onStatus: (status: ChangeRequestStatus) => void;
}) {
  const text = requestText(request);

  return (
    <li className="rounded-slab border-2 border-slab-300 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b-2 border-slab-100 px-4 py-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slab-900">
            {kindLabel(request.kind)}
          </p>
          <p className="mt-0.5 text-xs text-slab-500">
            <span className="font-mono">{request.ref}</span> &middot;{" "}
            {whoLabel(request.by)}, {formatTimestamp(request.createdAt)}
          </p>
        </div>
        <ChangeRequestBadge status={request.status} />
      </div>

      <dl className="grid gap-x-8 gap-y-3 px-4 py-3 text-sm sm:grid-cols-2">
        {request.kind === "new_item" ? (
          <>
            <Detail label="Item" value={request.name} />
            <Detail
              label="Category"
              value={categoryLabel(request.categoryId, request.otherCategory)}
            />
            <Detail
              label="Proposed price"
              value={formatKes(request.proposedPriceKes)}
            />
            {request.photoNeeded ? (
              <Detail label="Photo" value="Still needed" />
            ) : null}
            {request.description ? (
              <Detail label="Description" value={request.description} wide />
            ) : null}
          </>
        ) : null}

        {request.kind === "stock" ? (
          <>
            <Detail label="Product" value={request.subjectLabel} />
            <Detail
              label="Change to"
              value={
                request.intent === "out_of_stock"
                  ? "Out of stock"
                  : "Back in stock"
              }
            />
          </>
        ) : null}

        {request.note ? (
          <Detail label="Note" value={request.note} wide />
        ) : null}
      </dl>

      {/*
        SAID AGAIN, ON EVERY CARD. See the header comment on this section:
        the banner above is read once and scrolled past, and this list sits
        directly under three tables of things that DID happen.
      */}
      <p className="border-t-2 border-slab-100 bg-hivis-tint px-4 py-2 text-xs font-bold uppercase tracking-wide text-slab-800">
        {NOT_LIVE_CARD}
      </p>

      <details className="border-t-2 border-slab-100 px-4 py-3">
        <summary className="cursor-pointer list-item text-xs font-bold uppercase tracking-wide text-slab-600 hover:text-slab-900">
          The message that will be sent
        </summary>
        <pre className="mt-2 max-w-full overflow-x-auto rounded-slab border-2 border-slab-200 bg-slab-50 p-3 font-mono text-xs whitespace-pre-wrap text-slab-700">
          {text}
        </pre>
      </details>

      <div className="flex flex-wrap items-center gap-3 border-t-2 border-slab-100 px-4 py-3">
        <CopyButton text={text} />

        {/*
          NO RECIPIENT IN THIS URL, on purpose — see `whatsappDraftUrl`.
          A plain anchor rather than next/link: this leaves the app for
          another origin, and it opens in a new tab so a half-finished
          shift on this page survives it.
        */}
        <a
          href={whatsappDraftUrl(request)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center rounded-slab border-2 border-slab-300 px-3 text-xs font-bold uppercase tracking-wide text-slab-700 transition-colors duration-150 ease-plain hover:border-slab-900 hover:text-slab-900"
        >
          Send on WhatsApp
        </a>

        <div className="ml-auto flex flex-col items-start gap-1">
          <StatusSelect
            id={`cr-status-${request.ref}`}
            label={`Change status for request ${request.ref}`}
            value={request.status}
            options={CHANGE_REQUEST_STATUSES}
            onChange={onStatus}
          />
          <StatusLog history={request.history} />
        </div>
      </div>
    </li>
  );
}

/** One labelled value on a request card. */
function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-bold uppercase tracking-wide text-slab-500">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-line text-slab-800">{value}</dd>
    </div>
  );
}

function ChangeRequestsSection() {
  /*
    FROM THE SERVER, like every other list here. These used to live in this
    browser's localStorage only; see src/lib/change-requests-db.ts.
  */
  const list = useStaffList<ChangeRequest>("/api/change-requests", "requests", "change requests");
  const requests = list.items;
  const [writeError, setWriteError] = useState<string | null>(null);
  const [status, setStatus] = useState<ChangeRequestStatus | "all">("all");

  async function changeStatus(ref: string, next: ChangeRequestStatus) {
    setWriteError(null);
    const result = await patchStaff(`/api/change-requests/${encodeURIComponent(ref)}`, { status: next });
    if (!result.ok) {
      setWriteError(`Could not update ${ref}. The change was not saved — try again.`);
      return;
    }
    await list.refresh();
  }

  const shown = useMemo(
    () =>
      status === "all"
        ? requests
        : requests.filter((request) => request.status === status),
    [requests, status],
  );

  const drafts = requests.filter(
    (request) => request.status === "draft",
  ).length;

  return (
    <Section
      id="admin-change-requests"
      title="Change requests"
      counts={[
        `${requests.length} in total`,
        drafts > 0 ? `${drafts} still to send` : "",
        status === "all" || shown.length === requests.length
          ? ""
          : `showing ${shown.length} of ${requests.length}`,
      ]}
      /* Newest first, always — see `listChangeRequests` in src/lib/change-requests-db.ts. */
      sort={null}
      filter={
        requests.length > 0 ? (
          <StatusFilter
            label="Filter change requests by status"
            value={status}
            onChange={setStatus}
            options={CHANGE_REQUEST_STATUSES}
            labelOf={changeStatusLabel}
            countOf={(value) =>
              requests.filter((request) => request.status === value).length
            }
            total={requests.length}
          />
        ) : null
      }
    >
      <NotLiveBanner />
      <ChangeRequestForm onSaved={list.refresh} />

      {list.error || writeError ? (
        <p className="m-3 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800">
          {writeError ?? list.error}
        </p>
      ) : null}
      {list.loading ? (
        <p className="p-4 text-sm text-slab-500">Loading change requests...</p>
      ) : shown.length === 0 ? (
        <EmptyState filtered={status !== "all"} onClear={() => setStatus("all")}>
          No change requests yet. Draft one above when a price moves or the
          yard starts making something new.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3 p-3 md:p-4">
          {shown.map((request) => (
            <ChangeRequestCard
              key={request.ref}
              request={request}
              onStatus={(next) => void changeStatus(request.ref, next)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
