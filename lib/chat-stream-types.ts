/** Parts emitted by the chat streaming layer (mapped to NDJSON in `/api/chat`). */
export type ChatStreamPart =
  | { type: "token"; t: string }
  | {
      type: "meta";
      promptEvalCount?: number;
      evalCount?: number;
      totalDurationNs?: number;
    };
