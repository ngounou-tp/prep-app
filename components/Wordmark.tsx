import { Icon } from "./Icon";

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary text-on-primary">
        <Icon name="document" className="h-5 w-5" />
      </span>
      <span className="font-heading text-2xl font-semibold text-ink sm:text-[28px]">Foreword</span>
    </span>
  );
}
