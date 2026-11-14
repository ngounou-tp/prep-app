import type { StepStatus } from "@/lib/client/progressState";
import { Icon } from "../Icon";

export type Step = { label: string; detail: string; status: StepStatus };

const STATE_WORDS: Record<StepStatus, string> = { done: "done", current: "in progress", waiting: "waiting" };

function StepMarker({ number, status }: { number: number; status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-verified text-on-primary">
        <Icon name="check" />
      </span>
    );
  }
  const look = status === "current" ? "bg-primary text-on-primary ring-6 ring-blush" : "border-2 border-line-strong text-muted";
  return <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${look}`}>{number}</span>;
}

export function Stepper({ steps }: { steps: readonly Step[] }) {
  return (
    <ol className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-3" aria-current={step.status === "current" ? "step" : undefined}>
          <StepMarker number={index + 1} status={step.status} />
          <span className="min-w-0">
            <span className={`block font-bold ${step.status === "waiting" ? "text-muted" : "text-ink"}`}>
              {step.label}
              <span className="sr-only">, {STATE_WORDS[step.status]}</span>
            </span>
            <span className="block text-sm text-muted">{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
