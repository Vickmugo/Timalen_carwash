import { Suspense } from "react";
import { BookingConfirmation } from "./BookingConfirmation";

export const metadata = {
  title: "Booking confirmed",
};

export default function BookingConfirmedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense
        fallback={<p className="text-slab-500">Loading your booking...</p>}
      >
        <BookingConfirmation />
      </Suspense>
    </div>
  );
}
