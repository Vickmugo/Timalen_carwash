"use client";

import { useEffect, useState } from "react";

/**
 * Copies a payment number, DIGITS ONLY, so what lands in the M-Pesa menu
 * is exactly what it will accept — no spaces, no label.
 *
 * `navigator.clipboard` needs a secure context and is missing in some
 * in-app browsers, so a hidden textarea and `execCommand("copy")` stand in
 * when it is not there or refuses. If both fail the button says so; the
 * number is printed large right beside it either way.
 *
 * "Copied" is announced through an `aria-live` region, not just shown, so
 * a screen reader hears that the tap worked.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the fallback
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={async () => setState((await copyText(value.replace(/\D/g, ""))) ? "copied" : "failed")}
        aria-label={label}
        className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-slab border-2 px-3 text-xs font-bold uppercase tracking-wide transition-colors duration-150 ease-plain ${
          state === "copied"
            ? "border-ok bg-ok text-white"
            : "border-slab-900 bg-slab-900 text-slab-50 hover:bg-slab-800"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
          {state === "copied" ? (
            <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
              <path d="M10.5 5.5V3a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h2.5" />
            </>
          )}
        </svg>
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
      </button>
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? `${label}: copied` : state === "failed" ? "Could not copy. Type the number instead." : ""}
      </span>
    </>
  );
}
