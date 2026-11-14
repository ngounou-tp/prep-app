import { readEnvironment } from "@/lib/config/env";
import { createWakeHandler } from "@/lib/http/wakeRequest";
import { wakeGateway } from "@/lib/model/llm";

const handle = createWakeHandler(() => wakeGateway(readEnvironment()));

export function POST(): Response {
  return handle();
}
