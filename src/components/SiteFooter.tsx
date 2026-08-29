import Link from "next/link";
import { business, hoursSummary } from "@/data/business";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-2 border-slab-800 bg-slab-900 text-slab-300">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h2 className="text-base text-slab-50">{business.name}</h2>
          <p className="mt-2 text-sm">{business.tagline}</p>
          <p className="mt-3 text-sm text-slab-400">{business.location}</p>
        </div>

        <div>
          <h2 className="text-base text-slab-50">Talk to us</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <a
                href={`tel:${business.phone.replace(/\s/g, "")}`}
                className="hover:text-hivis"
              >
                {business.phone}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${business.whatsapp}`}
                className="hover:text-hivis"
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${business.email}`} className="hover:text-hivis">
                {business.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base text-slab-50">Opening hours</h2>
          <p className="mt-2 text-sm">{hoursSummary}</p>
          <Link
            href="/admin"
            className="mt-4 inline-block text-sm underline underline-offset-4 hover:text-hivis"
          >
            Staff view
          </Link>
        </div>
      </div>

      <div className="border-t border-slab-800 px-4 py-4">
        <p className="mx-auto max-w-5xl text-xs text-slab-500">
          Demo build. Bookings, orders and payments on this site are simulated
          and no money is taken.
        </p>
      </div>
    </footer>
  );
}
