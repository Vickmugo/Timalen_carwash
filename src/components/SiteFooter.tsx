import Link from "next/link";
import {
  business,
  contactNumbers,
  hasEmail,
  hoursSummary,
  telHref,
  whatsappHref,
} from "@/data/business";
import { mpesaDestinations } from "@/data/config";

export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t-2 border-slab-800 bg-slab-900 text-slab-300">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h2 className="text-base text-slab-50">{business.name}</h2>
          <p className="mt-2 text-sm">{business.tagline}</p>
          <p className="mt-3 text-sm text-slab-400">{business.location}</p>
        </div>

        <div>
          <h2 className="text-base text-slab-50">Talk to us</h2>
          {/*
            BOTH LINES, EACH TWICE. Every number is a `tel:` on the digits
            and a wa.me link on the label beside it, because "call them" and
            "message them" are two different intentions and a customer
            arriving with the second one should not have to copy a number
            out by hand. Which is the more likely intention here: this is a
            WhatsApp-first customer base, which is why the chat link is the
            one carrying the accent colour on hover.

            Labels come from src/data/business.ts and say only "WhatsApp"
            and "Alt WhatsApp" — see the note there on why they do NOT yet
            name a trade.
          */}
          <ul className="mt-2 space-y-1 text-sm">
            {contactNumbers.map((contact) => (
              <li
                key={contact.whatsapp}
                className="flex flex-wrap items-baseline gap-x-2"
              >
                <a href={telHref(contact.display)} className="hover:text-hivis">
                  {contact.display}
                </a>
                <a
                  href={whatsappHref(contact.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold uppercase tracking-wide text-slab-400 hover:text-hivis"
                >
                  {contact.label}
                </a>
              </li>
            ))}
            {/*
              Gated like the till block below. There is no confirmed email
              yet, and a `mailto:` pointing at a placeholder is a dead drop
              — the customer writes, nobody answers, and they read that as
              being ignored rather than as a broken address. Two working
              WhatsApp numbers sit directly above it, so the honest output
              here is nothing. See the note on `email` in
              src/data/business.ts.
            */}
            {hasEmail ? (
              <li>
                <a
                  href={`mailto:${business.email}`}
                  className="hover:text-hivis"
                >
                  {business.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div>
          <h2 className="text-base text-slab-50">Opening hours</h2>
          <p className="mt-2 text-sm">{hoursSummary}</p>

          {/*
            BOTH DESTINATIONS, ON EVERY PAGE, EACH NAMED BY WHAT IT PAYS FOR.
            This used to show only the wash till, cart and checkout
            included — so a customer paying for concrete from the footer
            paid the wrong account, and staff could not find it on the
            statement. One short line each, numbers from
            `mpesaDestinations` and nowhere else.

            "Buy Goods" and "Pay Bill" are the handset's menu words. A
            Buy Goods till takes no account number; a paybill needs both.
          */}
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slab-400">
              Pay by M-Pesa
            </h3>
            <dl className="mt-1 space-y-1.5 text-sm">
              <div>
                <dt className="text-slab-400">Car wash &amp; carpets</dt>
                <dd>
                  Buy Goods, till{" "}
                  <span className="font-mono font-bold text-slab-50">
                    {mpesaDestinations.till.tillNumber}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slab-400">Concrete</dt>
                <dd>
                  Pay Bill{" "}
                  <span className="font-mono font-bold text-slab-50">
                    {mpesaDestinations.paybill.businessNumber}
                  </span>
                  , account{" "}
                  <span className="font-mono font-bold text-slab-50">
                    {mpesaDestinations.paybill.accountNumber}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/*
            THE STAFF DOOR. Deliberately quiet — small, grey, no button, and
            tucked under the opening hours where a customer has no reason to
            look. It is a convenience for the people who work here, not a
            feature of the site.

            It points at /admin rather than straight at /login, so signing in
            is not a step anybody takes when they do not need to: with a live
            session this goes to the staff view directly, and without one
            src/proxy.ts bounces it to /login and sends it back here after.

            Not hidden, either. Security by not-linking-it is not security,
            and the gate in src/proxy.ts does not care whether the URL was
            typed or clicked.
          */}
          <Link
            href="/admin"
            className="mt-4 inline-block text-sm text-slab-400 underline underline-offset-4 hover:text-hivis"
          >
            Staff
          </Link>
        </div>
      </div>
    </footer>
  );
}
