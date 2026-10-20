"use client";

/**
 * =====================================================================
 * HOW WILL YOU PAY — one block, three checkouts.
 * ---------------------------------------------------------------------
 * Used by the booking flow's payment step, the concrete checkout and the
 * carpet request form, so the wording, the numbers and the code field are
 * identical everywhere a customer meets them.
 *
 * TWO CHOICES, NOTHING PRESELECTED:
 *
 *   Pay by M-Pesa         the customer pays on their own phone, following
 *                         the steps shown, then types the confirmation code
 *                         from the SMS. That code is a CLAIM — staff check
 *                         it against the statement before anything is
 *                         called paid. No STK push yet.
 *   Pay cash at the yard  no code. Paid when they bring the vehicle, bring
 *                         the carpets in, or collect the concrete.
 *
 * The steps are said in the words on the handset's own M-Pesa menu, and
 * the numbers come from `mpesaDestinations` in src/data/config.ts and
 * nowhere else. No business name is shown: nobody has confirmed the name
 * M-Pesa displays for either account.
 *
 * The amount shown is the page's estimate. The server computes the amount
 * it records from the live price book; if the yard changed a price in the
 * last few minutes the two can differ, and staff compare the code against
 * the recorded figure.
 * =====================================================================
 */

import { CopyButton } from "@/components/CopyButton";
import { TextField } from "@/components/Field";
import { MpesaBadge } from "@/components/MpesaBadge";
import { mpesaDestinations } from "@/data/config";
import { formatKes } from "@/lib/format";
import {
  destinationFor,
  isValidMpesaCode,
  normaliseMpesaCode,
} from "@/lib/payments";
import type { PaymentMethod, PaymentStream } from "@/types";

/** Which checkout this is. Carpets pay like the wash; only the wording differs. */
export type PaymentContext = "wash" | "carpet" | "concrete";

export interface PaymentValue {
  method: PaymentMethod | null;
  /** As typed. Normalised when it is checked and when it is sent. */
  code: string;
}

export const EMPTY_PAYMENT: PaymentValue = { method: null, code: "" };

function streamOf(context: PaymentContext): PaymentStream {
  return context === "concrete" ? "concrete" : "wash";
}

const CASH_WORDS: Record<PaymentContext, string> = {
  wash: "Pay when you bring your vehicle.",
  carpet: "Pay when you bring them in.",
  concrete: "Pay when you collect from the yard.",
};

/**
 * The browser's own check, so a mistyped code is caught on the phone. The
 * server runs the same rules (src/lib/payments.ts) and its answer is the
 * one that counts.
 */
export function paymentError(value: PaymentValue, mpesaAllowed = true): string | undefined {
  if (!value.method) return "Choose how you will pay.";
  if (value.method === "cash") return undefined;
  if (!mpesaAllowed) return "This can only be paid at the yard.";
  const code = normaliseMpesaCode(value.code);
  if (!code) return "Enter the M-Pesa confirmation code from your SMS.";
  if (!isValidMpesaCode(code)) {
    return "That does not look like an M-Pesa confirmation code. It is 10 letters and numbers, at the start of the SMS.";
  }
  return undefined;
}

/**
 * What goes in the request body. Method, destination, code — never a
 * status and never an amount; the server would ignore both.
 */
export function paymentBody(value: PaymentValue, context: PaymentContext) {
  if (value.method === "cash") return { method: "cash" as const };
  return {
    method: "mpesa" as const,
    destination: destinationFor(streamOf(context)),
    mpesaCode: normaliseMpesaCode(value.code),
  };
}

export function PaymentChoice({
  context,
  amountKes,
  value,
  onChange,
  error,
  mpesaAllowed = true,
  cashOnlyReason,
}: {
  context: PaymentContext;
  /** What the page totals to. Null when part of it has no price yet. */
  amountKes: number | null;
  value: PaymentValue;
  onChange: (next: PaymentValue) => void;
  error?: string;
  /** False when there is no known amount to send (an unpriced carpet line). */
  mpesaAllowed?: boolean;
  /** Said when M-Pesa is unavailable, so the customer knows why. */
  cashOnlyReason?: string;
}) {
  const destination = destinationFor(streamOf(context));
  const choices: [PaymentMethod, string][] = mpesaAllowed
    ? [
        ["mpesa", "Pay by M-Pesa"],
        ["cash", "Pay cash at the yard"],
      ]
    : [["cash", "Pay cash at the yard"]];

  return (
    <div>
      <fieldset>
        <legend className="text-sm font-bold uppercase tracking-wide text-slab-700">
          How would you like to pay?
        </legend>
        {!mpesaAllowed && cashOnlyReason ? (
          <p className="mt-1 text-sm text-slab-600">{cashOnlyReason}</p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          {choices.map(([method, label]) => (
            <label
              key={method}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-slab border-2 bg-white px-4 py-3 transition-colors duration-150 ease-plain ${
                value.method === method
                  ? "border-slab-900"
                  : "border-slab-200 hover:border-slab-500"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method}
                checked={value.method === method}
                onChange={() => onChange({ ...value, method })}
                className="size-4 accent-hivis"
              />
              <span className="text-sm font-semibold">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {value.method === "mpesa" ? (
        <div className="mt-4 rounded-slab border-2 border-slab-900 bg-white px-4 py-4">
          {/*
            THE HANDSET'S OWN MENU WORDS. "Buy Goods and Services" and "Pay
            Bill" are the items the customer is looking for, and a Buy Goods
            till takes no account number — a customer hunting for one either
            gives up or invents a reference nobody can match. ONE destination
            per card, the one this purchase is paid to: wash and carpets to
            the till, concrete to the paybill.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <MpesaBadge />
            <p className="text-sm font-bold">
              Lipa na M-PESA &rarr;{" "}
              {destination === "till" ? "Buy Goods and Services" : "Pay Bill"}
            </p>
          </div>

          <dl className="mt-4 divide-y-2 divide-slab-100 border-y-2 border-slab-100">
            {(destination === "till"
              ? [["Till number", mpesaDestinations.till.tillNumber]]
              : [
                  ["Business number", mpesaDestinations.paybill.businessNumber],
                  ["Account number", mpesaDestinations.paybill.accountNumber],
                ]
            ).map(([label, number]) => (
              <div key={label} className="py-2.5">
                <dt className="text-xs font-bold uppercase tracking-wide text-slab-600">
                  {label}
                </dt>
                <dd className="flex items-center justify-between gap-3">
                  <span className="font-mono text-2xl font-extrabold tabular-nums">{number}</span>
                  <CopyButton value={number} label={`Copy ${label.toLowerCase()}`} />
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-xs font-bold uppercase tracking-wide text-slab-600">
                Amount due
              </dt>
              <dd className="text-xl font-extrabold tabular-nums">
                {amountKes === null ? "—" : formatKes(amountKes)}
              </dd>
            </div>
          </dl>

          <ol className="mt-4 flex list-decimal flex-col gap-1 pl-5 text-sm marker:font-bold">
            {destination === "till" ? (
              <>
                <li>
                  On your phone, open M-PESA and choose Lipa na M-PESA, then
                  Buy Goods and Services.
                </li>
                <li>Enter the till number and the amount due.</li>
              </>
            ) : (
              <>
                <li>
                  On your phone, open M-PESA and choose Lipa na M-PESA, then
                  Pay Bill.
                </li>
                <li>Enter the business number, the account number and the amount due.</li>
              </>
            )}
            <li>Enter your PIN, then type the code from the M-Pesa SMS below.</li>
          </ol>

          <div className="mt-4">
            <TextField
              id="mpesaCode"
              label="M-Pesa confirmation code"
              required
              hint="You'll find it in the M-Pesa SMS you get after paying"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. QK12ABC345"
              value={value.code}
              error={error}
              onChange={(event) => onChange({ ...value, code: event.target.value })}
            />
          </div>
          <p className="mt-3 text-sm text-slab-600">
            We check every code against our M-Pesa statement before marking it
            paid. Your receipt is issued once it is confirmed.
          </p>
        </div>
      ) : value.method === "cash" ? (
        <p className="mt-4 rounded-slab border-2 border-slab-200 bg-white px-4 py-3 text-sm font-semibold">
          {CASH_WORDS[context]}
        </p>
      ) : null}

      {error && value.method !== "mpesa" ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
