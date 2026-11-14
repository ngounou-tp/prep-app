// A failed wake-up only means the first briefing may wait longer, so it is reported, never thrown.
export function requestGatewayWake(fetcher: typeof fetch = fetch): Promise<boolean> {
  return fetcher("/api/wake", { method: "POST" }).then(
    (response) => response.status === 202,
    () => false,
  );
}
