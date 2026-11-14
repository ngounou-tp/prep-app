// The wrapping element clips the circles, so their drift never causes sideways scrolling.
// The drift stops for people who ask for reduced motion (app/globals.css).
export function DecorativeCircles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" data-print="hide">
      <div className="absolute -top-56 -right-48 h-[420px] w-[420px] animate-[drift-sun_9s_ease-in-out_infinite_alternate] rounded-full bg-sun sm:-top-40 sm:-right-24 lg:h-[520px] lg:w-[520px]" />
      <div className="absolute top-[640px] -left-56 hidden h-[380px] w-[380px] animate-[drift-blush_11s_ease-in-out_infinite_alternate] rounded-full bg-blush md:block lg:-left-40" />
    </div>
  );
}
