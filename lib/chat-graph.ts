import {
  AIMessage,
  AIMessageChunk,
  type AIMessageChunk as AIMessageChunkType,
  type BaseMessage,
} from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";

import type { ChatStreamPart } from "@/lib/chat-stream-types";
import { loadAllChatTools } from "@/lib/chat-tools";
import {
  langchainMessagesToOllamaApi,
  streamOllamaNativeChat,
} from "@/lib/ollama-native-chat";
import { getOllamaBaseUrl } from "@/lib/ollama";

import type { StructuredToolInterface } from "@langchain/core/tools";

export function createOllamaChat(model: string, streaming: boolean) {
  return new ChatOllama({
    model,
    baseUrl: getOllamaBaseUrl(),
    temperature: 0.7,
    streaming,
  });
}

function chunkToDelta(chunk: AIMessageChunkType): string {
  const c = chunk.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    let s = "";
    for (const part of c) {
      if (typeof part === "string") s += part;
      else if (part && typeof part === "object" && "text" in part) {
        s += String((part as { text?: string }).text ?? "");
      }
    }
    return s;
  }
  return "";
}

const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  model: Annotation<string>(),
});

function compileGraph(tools: StructuredToolInterface[]) {
  if (tools.length === 0) {
    return new StateGraph(GraphState)
      .addNode("chat", async (state: typeof GraphState.State) => {
        const llm = createOllamaChat(state.model, false);
        const response = await llm.invoke(state.messages);
        return { messages: [response] };
      })
      .addEdge(START, "chat")
      .addEdge("chat", END)
      .compile();
  }

  const toolNode = new ToolNode(tools);
  return new StateGraph(GraphState)
    .addNode("agent", async (state: typeof GraphState.State) => {
      const llm = createOllamaChat(state.model, true).bindTools(tools);
      const stream = await llm.stream(state.messages);
      let gathered: AIMessageChunk | undefined;
      for await (const chunk of stream) {
        if (AIMessageChunk.isInstance(chunk)) {
          gathered = gathered ? gathered.concat(chunk) : chunk;
        }
      }
      if (!gathered) {
        return { messages: [] };
      }
      const response = new AIMessage({
        content: gathered.content,
        tool_calls: gathered.tool_calls,
        invalid_tool_calls: gathered.invalid_tool_calls,
        usage_metadata: gathered.usage_metadata,
        id: gathered.id,
        response_metadata: gathered.response_metadata,
        additional_kwargs: gathered.additional_kwargs,
      });
      return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, ["tools", END])
    .addEdge("tools", "agent")
    .compile();
}

export type StreamChatOptions = {
  webSearch?: boolean;
  tavilyApiKey?: string | null;
};

/** Token + usage stream for `/api/chat` (NDJSON). */
export async function* streamChatParts(
  messages: BaseMessage[],
  model: string,
  options?: StreamChatOptions,
): AsyncGenerator<ChatStreamPart, void, undefined> {
  const tools = await loadAllChatTools({
    webSearchRequested: options?.webSearch === true,
    tavilyApiKey: options?.tavilyApiKey,
  });
  const graph = compileGraph(tools);

  if (tools.length === 0) {
    const ollamaMessages = langchainMessagesToOllamaApi(messages);
    for await (const part of streamOllamaNativeChat(model.trim(), ollamaMessages)) {
      yield part;
    }
    return;
  }

  const graphStream = await graph.stream(
    { messages, model: model.trim() },
    { recursionLimit: 25, streamMode: "messages" },
  );

  for await (const part of graphStream) {
    if (!Array.isArray(part) || part.length < 1) continue;
    const msg = part[0] as BaseMessage;
    if (!AIMessage.isInstance(msg) && !AIMessageChunk.isInstance(msg)) {
      continue;
    }
    const delta = chunkToDelta(msg as AIMessageChunk);
    if (delta) yield { type: "token", t: delta };
  }
}

export const chatGraph = compileGraph([]);
