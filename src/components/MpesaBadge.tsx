/**
 * THE LOGO SLOT ON THE PAYMENT CARD.
 *
 * The M-PESA and Lipa na M-PESA marks are Safaricom's, so they are never
 * drawn, traced or rebuilt here. When the business supplies the official
 * file at public/brand/mpesa-logo.svg (or .png / .webp), next.config.ts
 * finds it at build time and this renders it, 28px tall.
 *
 * Until then: the site's own badge — a phone with a shilling sign on its
 * screen, drawn for this site, and the plain words "M-PESA" in the site's
 * font. It names the service without imitating its branding.
 */
const LOGO = process.env.NEXT_PUBLIC_MPESA_LOGO ?? "";

export function MpesaBadge() {
  if (LOGO) {
    // A local, fixed-size brand file: next/image would add nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={LOGO} alt="M-PESA" height={28} className="h-7 w-auto" />;
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-slab border-2 border-slab-900 px-1.5 py-0.5">
      <svg aria-hidden="true" viewBox="0 0 20 24" className="h-5 w-auto" fill="none">
        <rect x="3" y="1.5" width="14" height="21" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M8 4.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <text
          x="10"
          y="16"
          textAnchor="middle"
          fontSize="8"
          fontWeight="800"
          fill="var(--color-hivis-dark)"
          fontFamily="inherit"
        >
          Sh
        </text>
      </svg>
      <span className="text-xs font-extrabold tracking-wide">M-PESA</span>
    </span>
  );
}
