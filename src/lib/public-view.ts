/**
 * =====================================================================
 * WHAT ANYONE HOLDING A REF MAY SEE.
 * ---------------------------------------------------------------------
 * A booking or order ref is not a secret: it is read aloud at the counter,
 * pasted into WhatsApp threads and visible in screenshots. So the lookup by
 * ref — GET /api/bookings/[ref], GET /api/orders/[ref] and the two
 * confirmation pages — shows only enough for the customer to recognise
 * their own booking and know what to do next:
 *
 *   first name, phone masked to its last three digits, date and time (or
 *   order lines), what is being done, the total, a customer-safe payment
 *   label, and the receipt number once one has been issued.
 *
 * NEVER: the full name or phone, notes, vehicle/plate, the M-Pesa code,
 * the reason a payment was rejected, the staff history, internal ids.
 *
 * Staff with a session still get the full record from the API routes.
 * =====================================================================
 */

import { bookingLines, bookingVehicleTypeName } from "@/lib/booking";
import { firstNameOf, maskPhone } from "@/lib/mask";
import { paymentRecordLabel } from "@/lib/payments";
import type {
  Booking,
  BookingLine,
  CartLine,
  Order,
  PaymentDestination,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentStatus,
  PaymentSummary,
  ReceiptSummary,
} from "@/types";

export interface PublicPayment {
  method: PaymentMethod;
  destination: PaymentDestination | null;
  status: PaymentRecordStatus;
  amountKes: number;
  amountReceivedKes: number | null;
  /** Present only once the database has issued one. */
  receipt: ReceiptSummary | null;
}

export interface PublicBooking {
  ref: string;
  firstName: string;
  phoneMasked: string;
  /** The grid column or flat vehicle id ("motorbike"): not personal. */
  vehicleTypeId?: string;
  vehicleTypeName: string | null;
  lines: BookingLine[];
  date: string;
  startTime: string;
  endTime: string;
  priceKes: number;
  /** Bookings made before payment records existed carry only this. */
  paymentStatus: PaymentStatus;
  paymentLabel: string;
  payment?: PublicPayment;
}

export interface PublicOrder {
  ref: string;
  firstName: string;
  phoneMasked: string;
  lines: CartLine[];
  subtotalKes: number;
  collection: string;
  paymentStatus: PaymentStatus;
  paymentLabel: string;
  payment?: PublicPayment;
}

// Shared with the public receipt (src/lib/receipt-view.ts).
export { firstNameOf, maskPhone };

const LEGACY_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  pay_on_collection: "Pay at the yard",
  unpaid: "Not paid yet",
};

function publicPayment(payment: PaymentSummary | undefined): PublicPayment | undefined {
  if (!payment) return undefined;
  return {
    method: payment.method,
    destination: payment.destination,
    status: payment.status,
    amountKes: payment.amountKes,
    amountReceivedKes: payment.amountReceivedKes,
    receipt: payment.receipt,
  };
}

function label(payment: PaymentSummary | undefined, legacy: PaymentStatus): string {
  return payment ? paymentRecordLabel(payment.status) : LEGACY_LABELS[legacy];
}

export function publicBooking(booking: Booking): PublicBooking {
  return {
    ref: booking.ref,
    firstName: firstNameOf(booking.customerName),
    phoneMasked: maskPhone(booking.phone),
    ...(booking.vehicleTypeId ? { vehicleTypeId: booking.vehicleTypeId } : {}),
    vehicleTypeName: bookingVehicleTypeName(booking),
    lines: bookingLines(booking),
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    priceKes: booking.priceKes,
    paymentStatus: booking.paymentStatus,
    paymentLabel: label(booking.payment, booking.paymentStatus),
    ...(booking.payment ? { payment: publicPayment(booking.payment) } : {}),
  };
}

export function publicOrder(order: Order): PublicOrder {
  return {
    ref: order.ref,
    firstName: firstNameOf(order.customerName),
    phoneMasked: maskPhone(order.phone),
    lines: order.lines,
    subtotalKes: order.subtotalKes,
    collection: order.deliveryLocation,
    paymentStatus: order.paymentStatus,
    paymentLabel: label(order.payment, order.paymentStatus),
    ...(order.payment ? { payment: publicPayment(order.payment) } : {}),
  };
}
