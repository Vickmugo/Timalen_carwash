"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { business, contactNumbers, hoursSummary, whatsappHref } from "@/data/business";
import { useCart } from "@/lib/cart";

const navLinks = [
  { href: "/book", label: "Book a Wash" },
  /*
    Next to the booking link, because "what does it cost" is the question
    asked immediately before "can I book" — and because the price board
    covers work that cannot be booked online at all (carpets, lorries,
    buses, motorbikes), which would otherwise have no way in from the nav.
  */
  { href: "/prices", label: "Prices" },
  { href: "/products", label: "Products" },
  { href: "/quote", label: "Get a Quote" },
];

/**
 * The trading name, with the ampersand in the accent colour.
 *
 * Reads `business.name` rather than spelling the name out, because no
 * component in this app hardcodes business content — see the header of
 * src/data/business.ts. Splitting is done here rather than storing a
 * pre-split name in the data file: the data file holds one plain string a
 * non-developer can edit, and how it is painted stays a presentation
 * decision.
 *
 * A name with no ampersand renders unchanged, so this degrades quietly if
 * the client ever trades as something else.
 */
function Wordmark({ name }: { name: string }) {
  const [before, ...rest] = name.split("&");
  if (rest.length === 0) return <>{name}</>;

  return (
    <>
      {before}
      <span className="text-hivis">&amp;</span>
      {rest.join("&")}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Icons — drawn for this site. No brand marks: the chat bubble is a   */
/* generic speech bubble, not the WhatsApp logo.                       */
/* ------------------------------------------------------------------ */

const ICON = "size-4 shrink-0";

function ChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
      <path d="M5.5 7h.01M8 7h.01M10.5 7h.01" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 2h2l1.6 8h7.4l1.5-5.5H4.3" />
      <circle cx="6" cy="13.25" r="1" />
      <circle cx="11.5" cy="13.25" r="1" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="11" rx="1" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
    </svg>
  );
}

/*
  EVERY HEADER CONTROL IS THE SAME BOX: 44px tall, the site's 4px corner,
  bold uppercase label, FILLED. Outlines on charcoal read as unfinished, so
  the secondary controls sit on slab-800 and only Book a Wash is amber.
*/
const CONTROL =
  "flex min-h-11 shrink-0 items-center gap-2 rounded-slab border-2 px-3 text-sm font-bold uppercase tracking-wide whitespace-nowrap transition-colors duration-150 ease-plain";
const SECONDARY =
  "border-slab-800 bg-slab-800 text-slab-100 hover:border-slab-600 hover:bg-slab-700";

/**
 * ONE number up here, not both: the primary line. The alternate is in the
 * footer, next to it, where somebody who failed to get through has a
 * reason to be looking.
 */
function WhatsAppLink({ className = "" }: { className?: string }) {
  const [primary] = contactNumbers;
  return (
    <a
      href={whatsappHref(primary.whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${CONTROL} ${SECONDARY} ${className}`}
    >
      <ChatIcon />
      WhatsApp
    </a>
  );
}

/**
 * The cart, with a live count of pieces. The badge is suppressed until
 * hydration so server and client markup agree, and hidden at 0. Under
 * 390px the word "Cart" goes and the icon and badge stay; the name is
 * always in `aria-label`.
 */
function CartLink({ active, className = "" }: { active: boolean; className?: string }) {
  const { itemCount, hydrated } = useCart();
  const count = hydrated ? itemCount : 0;
  return (
    <Link
      href="/cart"
      aria-current={active ? "page" : undefined}
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className={`${CONTROL} ${className} ${
        active
          ? "border-hivis bg-slab-800 text-hivis"
          : "border-slab-100 bg-slab-100 text-slab-900 hover:bg-white"
      }`}
    >
      <CartIcon />
      <span className="hidden min-[390px]:inline">Cart</span>
      {count > 0 ? (
        <span className="min-w-5 rounded-slab bg-hivis px-1 text-center text-xs leading-5 text-slab-900 tabular-nums">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The nav row. On a phone it is its own line and scrolls sideways — only
 * this row, never the page — and while there is more off the right edge
 * that edge fades out, so the cut-off button reads as "more" rather than
 * as a mistake. The fade is a mask on the row itself, not a painted
 * overlay, so it adds no colour.
 */
function NavRow({ pathname }: { pathname: string }) {
  const rowRef = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () => setMore(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    update();
    row.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      row.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <nav
      aria-label="Main"
      className="-mx-4 w-[calc(100%+2rem)] lg:order-2 lg:mx-0 lg:w-auto"
    >
      <ul
        ref={rowRef}
        // -mt-1.5/pt-1.5: room inside the scroller for the focus ring's top
        // edge, which overflow-x would otherwise clip, at no extra height.
        className={`no-scrollbar -mt-1.5 flex items-center gap-2 overflow-x-auto px-4 pt-1.5 pb-2 md:pb-3 lg:mt-0 lg:overflow-visible lg:px-0 lg:py-0 ${
          more ? "[mask-image:linear-gradient(to_right,#000_calc(100%-3rem),transparent)]" : ""
        }`}
      >
        {navLinks.map((link, index) => {
          const active = pathname.startsWith(link.href);
          const primary = index === 0;
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`${CONTROL} ${
                  primary
                    ? `border-hivis bg-hivis text-slab-900 hover:border-hivis-dark hover:bg-hivis-dark ${
                        active ? "ring-2 ring-slab-50 ring-offset-2 ring-offset-slab-900" : ""
                      }`
                    : active
                      ? "border-hivis bg-slab-800 text-hivis"
                      : SECONDARY
                }`}
              >
                {primary ? <CalendarIcon /> : null}
                {link.label}
              </Link>
            </li>
          );
        })}
        {/* On a phone WhatsApp rides at the end of this row; from md up it sits beside the cart. */}
        <li className="shrink-0 md:hidden">
          <WhatsAppLink />
        </li>
      </ul>
    </nav>
  );
}

/**
 * LAYOUT, BY WIDTH.
 *
 *   PHONE   row 1: wordmark left, cart right, nothing else, in a row
 *           that cannot wrap. Row 2: the nav row, Book a Wash first. Tagline
 *           and hours are hidden here; they are in the footer.
 *   md      the hours line comes back under the wordmark and WhatsApp
 *           moves up beside the cart.
 *   lg      one row: wordmark, nav, WhatsApp, cart.
 *
 * Not sticky: it scrolls away with the page, so it never covers content.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="no-print border-b-2 border-slab-800 bg-slab-900 text-slab-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pt-2 md:pt-3 lg:flex-nowrap lg:gap-3 lg:py-3">
        {/*
          NO ICON. The wordmark is the mark.

          What stood here was an amber tile holding a paving block above a
          wavy line — a "concrete + water" rebus. It was clip-art: it could
          have been screwed to the front of any car wash in the world, and
          it was the only generic thing on a page whose headline, button
          subtext and product copy are all specific to this yard. A vague
          mark next to precise writing does not read as neutral; it reads as
          the part nobody thought about, and it drags the writing down with
          it.

          Drawing a better one was the other option and was not obviously
          reachable: the business has no logo, its real signage is
          hand-painted text on a green iron sheet, and inventing a crest for
          it would be inventing brand assets the client never asked for and
          may contradict the day they paint a new sign. The name already
          does the job an icon would have been doing — it says both trades
          out loud.

          The AMPERSAND carries the one accent colour. That is not
          decoration: "two trades, one yard" is the pitch of the entire home
          page, and the ampersand is the character where the two trades meet.
          It is the single most specific mark available here and it costs no
          illustration, no SVG and no request.
        */}
        {/*
          ROW ONE NEVER WRAPS. Wordmark and cart share a non-wrapping row,
          so a cart badge can never push the cart onto a line of its own;
          if the row were ever too narrow, the wordmark would take an
          ellipsis rather than the cart moving. At lg the row dissolves
          (`contents`) and its pieces join the one-line desktop header.
        */}
        <div className="flex w-full min-w-0 items-center gap-2 lg:contents">
          <Link
            href="/"
            className="mr-auto flex min-h-11 min-w-0 flex-col justify-center leading-tight lg:order-1"
            aria-label={`${business.name} — home`}
          >
            <span className="truncate text-sm font-extrabold uppercase tracking-tight md:text-xl">
              <Wordmark name={business.name} />
            </span>
            <span className="hidden text-xs text-slab-400 md:block">{hoursSummary}</span>
          </Link>

          <WhatsAppLink className="hidden md:flex lg:order-3" />
          <CartLink active={pathname.startsWith("/cart")} className="lg:order-4" />
        </div>

        <NavRow pathname={pathname} />
      </div>
    </header>
  );
}
