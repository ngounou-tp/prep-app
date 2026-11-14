// Each line is kept whole: the title scales with the screen so it stays on two lines down to
// 360px, and the subtitle holds two lines from tablet width up (a phone is too narrow for that).
export function Hero() {
  return (
    <div className="mx-auto pt-6 text-center sm:pt-10">
      <h1 className="font-heading text-[clamp(1.6rem,7.4vw,4.75rem)] leading-[1.05] font-semibold tracking-tight whitespace-nowrap text-ink">
        <span className="block">Walk into every meeting</span>
        <em className="block italic text-accent-text">already briefed.</em>
      </h1>
      <p className="mx-auto mt-6 text-lg leading-relaxed text-muted md:text-[clamp(1rem,2.05vw,1.25rem)]">
        <span className="md:block md:whitespace-nowrap">Add the companies and people you are meeting.</span>{" "}
        <span className="md:block md:whitespace-nowrap">In under a minute, get one page on what changed in the last 30 days, and what to ask.</span>
      </p>
    </div>
  );
}
