/**
 * CAR WASH SERVICES
 *
 * TODO / CONFIRM WITH CLIENT: ALL PRICING BELOW IS PLACEHOLDER.
 * Confirm the real tier names, the real KES prices, and — importantly —
 * the real duration of each tier. Only the 30-minute entry tier has been
 * discussed; the wax figure is a guess.
 */

import type { WashService } from "@/types";

export const washServices: WashService[] = [
  {
    id: "exterior-wash",
    name: "Exterior Wash",
    description:
      "Body wash, wheels and a hand dry. The quick in-and-out option.",
    priceKes: 300, // PLACEHOLDER PRICE
    durationMinutes: 30, // confirmed with client
    includes: ["Body and wheels", "Hand dry", "Tyre shine"],
  },
  {
    id: "full-wash-vacuum",
    name: "Full Wash + Vacuum",
    description:
      "Everything in the exterior wash, plus interior vacuum and a wipe-down of the dash and mats.",
    priceKes: 500, // PLACEHOLDER PRICE
    durationMinutes: 45, // PLACEHOLDER DURATION - not confirmed
    includes: [
      "Body and wheels",
      "Interior vacuum",
      "Dash and door wipe-down",
      "Mats cleaned",
    ],
  },
  {
    id: "wash-wax",
    name: "Wash + Wax",
    description:
      "Full wash and vacuum followed by a hand-applied wax for paint protection.",
    priceKes: 800, // PLACEHOLDER PRICE
    durationMinutes: 90, // PLACEHOLDER DURATION - not confirmed
    includes: [
      "Everything in Full Wash + Vacuum",
      "Hand-applied wax",
      "Trim and glass polish",
    ],
  },
];

export function getService(id: string): WashService | undefined {
  return washServices.find((service) => service.id === id);
}
