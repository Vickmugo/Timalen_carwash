"use client";

/**
 * =====================================================================
 * !!! NO AUTHENTICATION. THIS ROUTE IS PUBLIC. !!!
 * ---------------------------------------------------------------------
 * /admin is wide open so the demo can be clicked through without a login.
 * It shows customer names and phone numbers.
 *
 * BEFORE THIS GOES ANYWHERE PUBLIC, IT MUST BE LOCKED DOWN:
 *   - put a real auth check in middleware.ts matching /admin/:path*
 *     (Auth.js / Clerk / Supabase Auth — whatever the backend ends up being)
 *   - move the reads to a server component or API route that verifies the
 *     session server-side; a client-side check alone protects nothing
 *   - add a role check, not just "logged in"
 *   - add rate limiting and an audit trail on status changes
 *
 * Right now this data only lives in the visitor's own localStorage, so
 * nothing real is exposed yet. That stops being true the moment a
 * database is added.
 * =====================================================================
 */

import { PaymentBadge, QuoteStatusBadge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import type { QuoteStatus } from "@/types";
import { formatKes, formatLongDate } from "@/lib/format";
import {
  clearAll,
  updateQuoteStatus,
  useBookings,
  useIsHydrated,
  useOrders,
  useQuotes,
} from "@/lib/store";

const QUOTE_STATUSES: QuoteStatus[] = ["new", "contacted", "quoted", "closed"];

const th =
  "whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slab-400";
const td = "px-3 py-2.5 align-top text-sm";

export default function AdminPage() {
  // Subscribed reads: a booking made in another tab appears here live.
  const bookings = useBookings();
  const quotes = useQuotes();
  const orders = useOrders();
  const loaded = useIsHydrated();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        eyebrow="Staff view"
        title="Admin"
        backHref="/"
        backLabel="Home"
      />

      {/* Deliberately loud. This must not ship as-is. */}
      <div className="mt-6 rounded-slab border-2 border-alert bg-alert-tint p-4">
        <h2 className="text-base text-alert">Not secured</h2>
        <p className="mt-2 text-sm text-slab-800">
          This page has no login and anyone with the URL can open it. It must be
          put behind authentication before the site goes live. See the comment
          at the top of <code className="font-mono">src/app/admin/page.tsx</code>
          .
        </p>
      </div>

      <p className="mt-4 text-sm text-slab-600">
        Demo records are stored in this browser only. They will not appear on
        another device, and clearing site data erases them.
      </p>

      {!loaded ? (
        <p className="mt-8 text-slab-500">Loading records...</p>
      ) : (
        <>
          {/* ------------------------- Bookings ------------------------- */}
          <section className="mt-10" aria-labelledby="admin-bookings">
            <h2 id="admin-bookings" className="text-xl">
              Wash bookings{" "}
              <span className="text-slab-400">({bookings.length})</span>
            </h2>

            {bookings.length === 0 ? (
              <p className="mt-3 rounded-slab border-2 border-slab-200 bg-white px-4 py-5 text-sm text-slab-600">
                No bookings yet. Book a wash and it will appear here.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-slab border-2 border-slab-200 bg-white">
                <table className="w-full min-w-[46rem] border-collapse">
                  <thead className="bg-slab-900">
                    <tr>
                      <th className={th}>Date</th>
                      <th className={th}>Time</th>
                      <th className={th}>Service</th>
                      <th className={th}>Customer</th>
                      <th className={th}>Phone</th>
                      <th className={th}>Vehicle</th>
                      <th className={th}>Payment</th>
                      <th className={th}>Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slab-100">
                    {bookings.map((booking) => (
                      <tr key={booking.ref}>
                        <td className={`${td} whitespace-nowrap font-semibold`}>
                          {formatLongDate(booking.date)}
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          {booking.startTime} - {booking.endTime}
                        </td>
                        <td className={td}>{booking.serviceName}</td>
                        <td className={td}>{booking.customerName}</td>
                        <td className={`${td} whitespace-nowrap`}>
                          {booking.phone}
                        </td>
                        <td className={td}>{booking.vehicle}</td>
                        <td className={td}>
                          <span className="flex flex-col items-start gap-1">
                            <PaymentBadge status={booking.paymentStatus} />
                            <span className="text-xs text-slab-500">
                              {formatKes(booking.priceKes)}
                            </span>
                          </span>
                        </td>
                        <td className={`${td} font-mono text-xs text-slab-500`}>
                          {booking.ref}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ---------------------- Quote requests ---------------------- */}
          <section className="mt-10" aria-labelledby="admin-quotes">
            <h2 id="admin-quotes" className="text-xl">
              Quote requests{" "}
              <span className="text-slab-400">({quotes.length})</span>
            </h2>

            {quotes.length === 0 ? (
              <p className="mt-3 rounded-slab border-2 border-slab-200 bg-white px-4 py-5 text-sm text-slab-600">
                No quote requests yet. Submit one and it will appear here.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-slab border-2 border-slab-200 bg-white">
                <table className="w-full min-w-[52rem] border-collapse">
                  <thead className="bg-slab-900">
                    <tr>
                      <th className={th}>Customer</th>
                      <th className={th}>Phone</th>
                      <th className={th}>Item</th>
                      <th className={th}>Quantity</th>
                      <th className={th}>Delivery</th>
                      <th className={th}>Notes</th>
                      <th className={th}>Status</th>
                      <th className={th}>Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slab-100">
                    {quotes.map((quote) => (
                      <tr key={quote.ref}>
                        <td className={`${td} font-semibold`}>
                          {quote.customerName}
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          {quote.phone}
                        </td>
                        <td className={`${td} max-w-64 whitespace-pre-line`}>
                          {quote.item}
                        </td>
                        <td className={td}>{quote.quantity}</td>
                        <td className={td}>{quote.deliveryLocation}</td>
                        <td className={`${td} max-w-48 text-slab-600`}>
                          {quote.notes || "-"}
                        </td>
                        <td className={td}>
                          <span className="flex flex-col items-start gap-1.5">
                            <QuoteStatusBadge status={quote.status} />
                            <label className="sr-only" htmlFor={`st-${quote.ref}`}>
                              Change status for {quote.ref}
                            </label>
                            <select
                              id={`st-${quote.ref}`}
                              value={quote.status}
                              onChange={(event) =>
                                updateQuoteStatus(
                                  quote.ref,
                                  event.target.value as QuoteStatus,
                                )
                              }
                              className="rounded-slab border-2 border-slab-300 bg-white px-1.5 py-1 text-xs font-semibold focus:border-slab-900 focus:outline-none"
                            >
                              {QUOTE_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </span>
                        </td>
                        <td className={`${td} font-mono text-xs text-slab-500`}>
                          {quote.ref}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* -------------------------- Orders -------------------------- */}
          <section className="mt-10" aria-labelledby="admin-orders">
            <h2 id="admin-orders" className="text-xl">
              Product orders{" "}
              <span className="text-slab-400">({orders.length})</span>
            </h2>

            {orders.length === 0 ? (
              <p className="mt-3 rounded-slab border-2 border-slab-200 bg-white px-4 py-5 text-sm text-slab-600">
                No product orders yet. Complete a checkout and it will appear
                here.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-slab border-2 border-slab-200 bg-white">
                <table className="w-full min-w-[46rem] border-collapse">
                  <thead className="bg-slab-900">
                    <tr>
                      <th className={th}>Customer</th>
                      <th className={th}>Phone</th>
                      <th className={th}>Items</th>
                      <th className={th}>Delivery</th>
                      <th className={th}>Total</th>
                      <th className={th}>Payment</th>
                      <th className={th}>Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slab-100">
                    {orders.map((order) => (
                      <tr key={order.ref}>
                        <td className={`${td} font-semibold`}>
                          {order.customerName}
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          {order.phone}
                        </td>
                        <td className={td}>
                          <ul className="flex flex-col gap-0.5">
                            {order.lines.map((line) => (
                              <li key={line.productId}>
                                {line.name}{" "}
                                <span className="text-slab-500">
                                  x {line.quantity}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className={td}>{order.deliveryLocation}</td>
                        <td className={`${td} whitespace-nowrap font-bold`}>
                          {formatKes(order.subtotalKes)}
                        </td>
                        <td className={td}>
                          <PaymentBadge status={order.paymentStatus} />
                        </td>
                        <td className={`${td} font-mono text-xs text-slab-500`}>
                          {order.ref}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="mt-12 border-t-2 border-slab-200 pt-6">
            <Button
              variant="quiet"
              onClick={() => {
                if (
                  window.confirm(
                    "Delete all demo bookings, orders and quote requests from this browser?",
                  )
                ) {
                  clearAll();
                }
              }}
            >
              Clear all demo data
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
