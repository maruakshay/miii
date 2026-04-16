export type SlashLineContext = {
  lineStart: number;
  lineEnd: number;
  query: string;
};

/** Current line starts with `/` and cursor is inside a slash token (start of line). */
export function getSlashLineContext(
  value: string,
  cursorPos: number,
): SlashLineContext | null {
  if (cursorPos < 0 || cursorPos > value.length) return null;
  const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
  const lineEndIdx = value.indexOf("\n", cursorPos);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const rel = cursorPos - lineStart;
  const line = value.slice(lineStart, lineEnd);
  const before = line.slice(0, rel);
  if (!line.startsWith("/")) return null;
  if (!/^\/[\w-]*$/.test(before)) return null;
  return {
    lineStart,
    lineEnd,
    query: before.slice(1),
  };
}

export type SlashAction = "addSkill" | "deleteSkill" | "tavily";

export type SlashItem = {
  id: string;
  label: string;
  description: string;
  insert: string;
  action?: SlashAction;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "clear",
    label: "Clear chat",
    description: "Empty this conversation",
    insert: "/clear",
  },
  {
    id: "clear-all",
    label: "Clear all chats",
    description: "Remove every saved chat",
    insert: "/clear all",
  },
  {
    id: "add-tool",
    label: "Add tool",
    description: "Save a new custom skill",
    insert: "/tools",
    action: "addSkill",
  },
  {
    id: "delete-tool",
    label: "Delete tool",
    description: "Remove a saved skill file",
    insert: "/delete-tool",
    action: "deleteSkill",
  },
  {
    id: "web",
    label: "Web search",
    description: "Enable Tavily web search (API key)",
    insert: "",
    action: "tavily",
  },
];
