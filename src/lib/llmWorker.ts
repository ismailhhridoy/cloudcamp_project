// Dedicated Web Worker that hosts the WebLLM engine off the main thread.
// Imported by `llm.ts` via `new Worker(new URL("./llmWorker.ts", import.meta.url), {type:"module"})`.

import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
