"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

/**
 * ONE number up here, not both.
 *
 * The header is already carrying a wordmark, four nav items and a cart on a
 * phone screen, and a second, near-identical phone number is the item that
 * makes a customer read instead of tap. So the primary line only — the
 * alternate is one scroll away in the footer, next to it, where somebody
 * who failed to get through has a reason to be looking.
 *
 * Styled as a nav link rather than as a button: hi-vis in this header means
 * "the page you are on", and a permanently amber contact link would compete
 * with that signal on every page.
 */
function WhatsAppLink() {
  const [primary] = contactNumbers;
  return (
    <a
      href={whatsappHref(primary.whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center rounded-slab px-3 text-sm font-bold uppercase tracking-wide text-slab-300 transition-colors duration-150 ease-out hover:text-slab-50"
    >
      WhatsApp
    </a>
  );
}

function CartLink() {
  const { itemCount, hydrated } = useCart();
  return (
    <Link
      href="/cart"
      className="relative flex min-h-11 items-center gap-2 rounded-slab border-2 border-slab-700 px-3 text-sm font-bold uppercase tracking-wide text-slab-100 transition-colors duration-150 ease-out hover:border-hivis hover:text-hivis"
    >
      Cart
      {/* Suppressed until hydrated so server and client markup agree. */}
      {hydrated && itemCount > 0 ? (
        <span className="rounded-slab bg-hivis px-1.5 text-xs text-slab-900">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="no-print border-b-2 border-slab-800 bg-slab-900 text-slab-100">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
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
        <Link
          href="/"
          className="mr-auto flex flex-col leading-tight"
          aria-label={`${business.name} — home`}
        >
          <span className="text-lg font-extrabold uppercase tracking-tight sm:text-xl">
            <Wordmark name={business.name} />
          </span>
          <span className="text-xs text-slab-400">{hoursSummary}</span>
        </Link>

        <nav
          aria-label="Main"
          className="order-3 -mx-4 w-[calc(100%+2rem)] overflow-x-auto border-t border-slab-800 px-4 pt-2 sm:order-none sm:mx-0 sm:w-auto sm:border-0 sm:pt-0"
        >
          <ul className="flex items-center gap-1 whitespace-nowrap">
            {navLinks.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-slab px-3 text-sm font-bold uppercase tracking-wide transition-colors duration-150 ease-out ${
                      active
                        ? "text-hivis"
                        : "text-slab-300 hover:text-slab-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <WhatsAppLink />
        <CartLink />
      </div>
    </header>
  );
}
