/** Space reserved for the fixed composer so the last message clears it */
export const COMPOSER_GAP =
  "pb-[calc(9rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]";

export const TAVILY_KEY_STORAGE = "miii.tavilyApiKey";
export const WEB_SEARCH_STORAGE = "miii.webSearch";
export const CHROMA_KEY_STORAGE = "miii.chromaApiKey";
export const CHROMA_TENANT_STORAGE = "miii.chromaTenant";
export const CHROMA_DATABASE_STORAGE = "miii.chromaDatabase";

export const CMD_NO_MODEL = new Set([
  "/clear",
  "/clear all",
  "/tools",
  "/delete-tool",
  "/web",
]);
