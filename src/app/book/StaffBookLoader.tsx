"use client";

/**
 * The one door to the staff version of /book, rendered by the page only
 * when the server has verified a staff session.
 *
 * A DYNAMIC IMPORT FROM A CLIENT COMPONENT, ON PURPOSE. Next splits a
 * client component into its own chunk only when the `dynamic()` call sits
 * in a client module (node_modules/next/dist/docs/01-app/02-guides/
 * lazy-loading.md); called from the server page it would not split. So
 * this file holds nothing but the import, and the switch, the walk-in form
 * and the payment queues it reuses load only when this renders.
 */

import dynamic from "next/dynamic";
import type { PriceBook } from "@/types";

const StaffBook = dynamic(() => import("./StaffBook").then((module) => module.StaffBook));

export function StaffBookLoader({ priceBook }: { priceBook: PriceBook }) {
  return <StaffBook priceBook={priceBook} />;
}
