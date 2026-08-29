/**
 * ============================================================
 * STUBBED PAYMENT — NOTHING HERE TOUCHES A REAL PAYMENT API.
 * ============================================================
 *
 * `processPayment()` waits a moment and reports success. That is all it
 * does. It exists so the checkout UI has something to await, and so there
 * is exactly ONE function to replace when the client is ready to take
 * real money.
 *
 * ------------------------------------------------------------
 * WHERE THE REAL INTEGRATION PLUGS IN
 * ------------------------------------------------------------
 * Replace the body of `processPayment` with a call to your own API route
 * (never call an aggregator directly from the browser — the secret key
 * must stay on the server):
 *
 *   1. Create `src/app/api/payments/route.ts` (server-side).
 *   2. From this function, POST { amountKes, phone, reference } to it.
 *   3. In the route handler, call the aggregator's "collect / STK push"
 *      endpoint using credentials from environment variables:
 *
 *        Pesapal      POST /api/Transactions/SubmitOrderRequest
 *        Flutterwave  POST /v3/charges?type=mpesa
 *        IntaSend     POST /api/v1/payment/mpesa-stk-push/
 *
 *      All three wrap M-Pesa, so a direct Safaricom Daraja integration is
 *      not required.
 *   4. The customer approves the STK prompt on their phone. The aggregator
 *      then calls YOUR webhook (an IPN / callback URL you register with
 *      them) with the final result — success is confirmed there, not here.
 *   5. Until that webhook arrives, the order stays `unpaid`. Poll the
 *      order status from the client, or reconcile it in the admin view.
 *
 * The `PaymentResult` shape below is intentionally close to what those
 * APIs return, so the calling code should not need to change much.
 */

export interface PaymentRequest {
  amountKes: number;
  phone: string;
  /** Booking or order reference, used as the merchant reference. */
  reference: string;
}

export interface PaymentResult {
  success: boolean;
  /** The aggregator's transaction id in a real integration. */
  transactionId: string;
  message: string;
}

/** How long the fake "waiting for M-Pesa" state lasts, in ms. */
const MOCK_DELAY_MS = 1600;

export async function processPayment(
  request: PaymentRequest,
): Promise<PaymentResult> {
  // --- MOCK ONLY. Replace everything below with the API route call. ---
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  return {
    success: true,
    transactionId: `MOCK-${request.reference}`,
    message: `Simulated payment of KES ${request.amountKes.toLocaleString(
      "en-KE",
    )} accepted. No money moved.`,
  };
  // --- END MOCK ---
}
