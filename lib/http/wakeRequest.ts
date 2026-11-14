import "server-only";

export const WAKE_INTERVAL_MILLISECONDS = 60_000;

// One wake-up per minute per server instance at most, so the endpoint cannot be used to keep the
// gateway busy or awake. The answer never waits for the gateway and says nothing about it.
export function createWakeHandler(wake: () => Promise<boolean>, now: () => number = Date.now) {
  let lastWake = Number.NEGATIVE_INFINITY;
  return (): Response => {
    const time = now();
    if (time - lastWake >= WAKE_INTERVAL_MILLISECONDS) {
      lastWake = time;
      wake().then(
        (woken) => {
          if (!woken) {
            console.error("The model gateway did not answer its wake-up call");
          }
        },
        () => console.error("Could not wake the model gateway: the server settings are incomplete"),
      );
    }
    return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  };
}
