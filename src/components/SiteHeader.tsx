"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { business, hoursSummary } from "@/data/business";
import { useCart } from "@/lib/cart";

const navLinks = [
  { href: "/book", label: "Book a Wash" },
  { href: "/products", label: "Products" },
  { href: "/quote", label: "Get a Quote" },
];

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
    <header className="border-b-2 border-slab-800 bg-slab-900 text-slab-100">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <Link href="/" className="mr-auto flex items-center gap-3">
          {/* Mark: a paving block over a water line. Inline SVG, no request. */}
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-slab bg-hivis"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none">
              <path
                d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z"
                fill="#1a1d1e"
              />
              <path
                d="M3 15c1.8 0 1.8 1.6 3.6 1.6S8.4 15 10.2 15s1.8 1.6 3.6 1.6S15.6 15 17.4 15s1.8 1.6 3.6 1.6"
                stroke="#1a1d1e"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-extrabold uppercase tracking-tight">
              {business.name}
            </span>
            <span className="block text-xs text-slab-400">{hoursSummary}</span>
          </span>
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

        <CartLink />
      </div>
    </header>
  );
}
