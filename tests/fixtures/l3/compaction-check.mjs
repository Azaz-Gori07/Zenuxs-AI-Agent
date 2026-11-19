// Integration check: invoke the shipped compaction API with a bounded large history.
import { createContextCompactionPrepareTurn } from "../../../packages/core/src/extensions/context/compaction.ts";

const messages = [
  { role: "user", content: "first user " + "x".repeat(10000) },
  { role: "assistant", content: "first assistant " + "y".repeat(10000) },
  { role: "user", content: "second user " + "x".repeat(10000) },
  { role: "assistant", content: "second assistant " + "y".repeat(10000) },
];
const prepare = createContextCompactionPrepareTurn({
  providerId: "openai-compatible",
  modelId: "fake-model",
  providerConfig: { providerId: "openai-compatible", modelId: "fake-model" },
  compaction: { enabled: true, strategy: "basic", thresholdRatio: 0.01 },
  logger: { debug: (m,d)=>console.log("DEBUG",m,JSON.stringify(d)), log: ()=>{}, error: ()=>{} },
});
const result = await prepare({
  agentId: "agent-1", conversationId: "conv-1", parentAgentId: null, iteration: 1,
  abortSignal: new AbortController().signal,
  systemPrompt: "system", tools: [], messages, apiMessages: messages,
  model: { id: "fake-model", provider: "openai-compatible", info: { id: "fake-model", contextWindow: 200000 } },
});
console.log(JSON.stringify({ compacted: !!result?.messages, before: messages.length, after: result?.messages?.length ?? null }));
