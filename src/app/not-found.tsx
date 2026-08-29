import { ButtonLink } from "@/components/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-hivis-dark">
        404
      </p>
      <h1 className="mt-2 text-3xl">Page not found</h1>
      <p className="mt-3 text-slab-600">
        That link does not lead anywhere. Try one of these instead.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/book">Book a wash</ButtonLink>
        <ButtonLink href="/products" variant="dark">
          Browse products
        </ButtonLink>
        <ButtonLink href="/" variant="quiet">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
