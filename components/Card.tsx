import type { ComponentPropsWithoutRef } from "react";

export function Card({ className = "", large = false, ...rest }: ComponentPropsWithoutRef<"section"> & { large?: boolean }) {
  const radius = large ? "rounded-form" : "rounded-card";
  return <section className={`${radius} border border-line bg-surface shadow-card ${className}`} {...rest} />;
}
