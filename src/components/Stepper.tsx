interface StepperProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol
      className="flex items-center gap-2"
      aria-label={`Step ${current + 1} of ${steps.length}`}
    >
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 w-full rounded-slab ${
                done || active ? "bg-hivis" : "bg-slab-200"
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-xs font-bold uppercase tracking-wide ${
                active ? "text-slab-900" : "text-slab-500"
              }`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
