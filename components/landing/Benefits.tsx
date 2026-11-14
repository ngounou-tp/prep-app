import { Card } from "../Card";
import { Icon, type IconName } from "../Icon";

const BENEFITS: { title: string; text: string; icon: IconName; tone: string }[] = [
  { title: "Fresh research", text: "News, launches, hires and funding from the last 30 days.", icon: "search", tone: "bg-verified-surface text-verified" },
  { title: "Checked, not guessed", text: "Each fact is matched to the page it came from.", icon: "shield", tone: "bg-blush text-accent-text" },
  { title: "Questions ready", text: "Talking points written for your kind of meeting.", icon: "chat", tone: "bg-single-surface text-single" },
];

export function Benefits() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="mx-auto mt-10 max-w-[1000px] pb-16">
      <h2 id="how-it-works-title" className="sr-only">
        How it works
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {BENEFITS.map((benefit) => (
          <li key={benefit.title}>
            <Card className="flex h-full gap-4 p-5">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-tile ${benefit.tone}`}>
                <Icon name={benefit.icon} />
              </span>
              <span>
                <span className="block text-lg font-bold text-ink">{benefit.title}</span>
                <span className="mt-1 block leading-relaxed text-muted">{benefit.text}</span>
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
