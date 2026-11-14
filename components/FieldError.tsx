import { Icon } from "./Icon";

export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message === undefined) {
    return null;
  }
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-accent-text">
      <Icon name="warning" className="mt-0.5 h-4 w-4" />
      {message}
    </p>
  );
}
