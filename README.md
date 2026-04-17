# Miii
![miii web](public/ss1.png)
![miii terminal](public/ss2.png)

**Miii** is a privacy-first, local AI assistant with pluggable skills, semantic tool routing, and live web search — running 100% on your machine.

### What you get
- **Fast path to chatting** — pick a model, pull tags from the app, and stream responses over a simple HTTP API.
- **Optional agent features** — **Tavily** web search and **custom tools** (JSON skills) wired through **LangGraph** when enabled.
- **Document-aware answers** — **Chroma** RAG per conversation: ingest text/files, embed with Ollama, retrieve context for each turn.
- **Two interfaces, one backend** — browser chat with shortcuts and slash menu; **Ink** TUI talking to the same server.
Built with [Next.js](https://nextjs.org) (App Router), React 19, Tailwind CSS 4.

**Author:** Akshay Maru


## Why miii?

Most AI assistants send your data to the cloud. Miii is different.

Miii solves this by providing:

- ⚡ **Minimal setup** — get started in minutes
- 🔌 **Few integrations** — no heavy configuration
- 🖥️ **Dual interface** — Web UI + Terminal (TUI)
- 🧠 **Local-first architecture** — privacy-focused by default
- 🚀 **Smooth developer experience** — streaming + Markdown out of the box

## Architecture
 
```
User Input
    │
    ▼
Next.js App Router  ──────────────────────────────────────────┐
    │                                                         │
    ▼                                                         │
/api/chat (streaming NDJSON)                                  │
    │                                                         │
    ▼                                                         │
LangGraph Agent (lib/chat-graph.ts)                           │
    │                                                         │
    ├─── No tools active? ──► Stream directly from Ollama     │
    │                                                         │
    └─── Tools active? ──────► Agent → Tools loop             │
                │                                             │
                ├── Custom Skills (customTools/*.json)        │
                │   └── Loaded as LangChain tools             │
                │                                             │
                └── Tavily Web Search (live results)          │
                                                              │
    ◄─────────────────────────────────────────────────────────┘
Streamed response rendered with react-markdown (GFM)
```

## Features

### 🧠 Agentic Tool Routing (LangGraph)
When skills or web search are active, Miii runs a full LangGraph agent loop — it reasons, decides which tool to call, executes it, and synthesizes a response. When no tools are needed, it streams directly from Ollama for minimal latency.
 
### 🛠️ Custom Skills System
Define your own AI skills as JSON files in `customTools/`. The app loads them as LangChain tools and makes them available to the agent. Add, manage, and delete skills via the in-app UI or `/tools` slash command.
 
```json
// customTools/my-skill.json
{
  "name": "my_skill",
  "description": "What this skill does — the LLM reads this to decide when to use it",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```
 
Extend `skillToolFromDefinition` in `lib/custom-tools.ts` to wire in real execution logic.
 
### 🔍 Optional Live Web Search
Enable [Tavily](https://tavily.com) web search from the UI. When active, Miii can fetch live results before responding — great for current events, documentation lookups, or anything beyond a model's training cutoff. Your API key stays in the browser.
 
### 💬 Conversation Management
Multiple named conversations, persisted in the browser. Titles auto-generated from your first message. Clear individual chats or all history with `/clear`.
 
### 🖥️ Terminal UI (TUI)
A full terminal interface built with [Ink](https://github.com/vadimdemedes/ink) — same API, same models, same skills, no browser needed.
 
### 🔄 Model Picker
Lists all models pulled to your local Ollama server. Switch models mid-session from the UI or via `/model` in the TUI.
 
### ✨ Streamed Markdown Responses
Responses stream token-by-token and render as rich Markdown (GFM) — code blocks, tables, lists, and all.

### Web UI shortcuts

| Shortcut | Action |
| -------- | ------ |
| **⌘N / Ctrl+N** | New chat |
| **⌘K / Ctrl+K** | Open model picker |
| **⌘/ / Ctrl+/** | Focus composer |
| **⌘⇧P / Ctrl+Shift+P** | Pull model dialog |

The composer supports a **slash menu** (type `/` at the start of a line) for quick inserts and actions (clear, tools, Tavily key, …).

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Ollama](https://ollama.com) installed and running, with at least one model pulled (for example `ollama pull llama3.2`)
- For RAG: Chroma reachable locally or remotely. The **`chroma` CLI is not on your PATH** unless you install it globally; this repo already depends on **`chromadb`**, so start the server from the project root with **`npm run chroma`** (uses `node_modules/.bin/chroma`). Alternatively: `npx chroma run`. Default URL is `http://127.0.0.1:8000` (override with `CHROMA_URL`). For embeddings, use an Ollama embedding model (default `nomic-embed-text` unless overridden)—run e.g. `ollama pull nomic-embed-text`.


## Configuration

Environment variables (optional unless noted):

| Variable | Description |
|----------|-------------|
| `OLLAMA_BASE_URL` | Ollama API base URL (defaults match a local `ollama serve`; override e.g. `export OLLAMA_BASE_URL=http://127.0.0.1:11434`) |
| `TAVILY_API_KEY` | Tavily API key when web search is on and no client key is sent |
| `MIIIBOT_URL` | Base URL for the TUI client (override e.g. `MIIIBOT_URL=http://127.0.0.1:3000 npm run tui` or `npm run tui -- --url …`) |
| `CHROMA_URL` | Chroma HTTP API base (local example: `export CHROMA_URL=http://127.0.0.1:8000`) |
| `CHROMA_API_KEY` | Optional server default for Chroma token |
| `CHROMA_TENANT` | Optional server default tenant |
| `CHROMA_DATABASE` | Optional server default database |
| `OLLAMA_EMBED_MODEL` | Embedding model for RAG chunking/query (default: `nomic-embed-text`) |

Set values in `.env.local` as needed. For web search and Chroma headers you can also save values in the app (stored locally in the browser). The TUI reads `TAVILY_API_KEY` from the **shell** environment at startup and can override with `/tavily set` for the session.

## Terminal UI

In one terminal, start the web server:

```bash
npm run dev
# or: npm run build && npm run start
```

In **another** terminal, start the TUI (by default it uses the same host/port as a local **`npm run dev`** session — override if your server is elsewhere):

```bash
npm run tui
```

Point the TUI at a different base URL:

```bash
MIIIBOT_URL=http://127.0.0.1:3000 npm run tui
npm run tui -- --url http://127.0.0.1:3000
```

Use **`/help`** inside the TUI for the full command list. Examples:

- **`/model`**, **`/url`**, **`/web on|off`**, **`/tavily set`** (with your API key)
- **`/system`**, **`/rag`**, **`/rag list`**, **`/chroma`**, **`/pull`** (e.g. `llama3.2`)
- **`/new`**, **`/clear`**, **`/clear all`**, **`/regenerate`**, **`/quit`**

Source: `scripts/miii-tui.tsx` (Ink); `npm run tui` bundles it with **esbuild** to ESM (`scripts/.tui-bundle.mjs`, gitignored).

Run the TUI in a **real interactive terminal** (not a pipe or some IDE panels); Ink needs stdin raw mode.

## Getting started

### One-line install (curl · global `miii`)

The script clones the repo, runs **`npm install`**, then **`npm install -g .`**, which installs the **`miii`** CLI globally. Use **`miii help`**, **`miii web`**, or **`miii tui`** from any terminal afterward; if `miii` is not found, add npm’s global bin to `PATH` and open a new shell.

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/akshaymaru-61/miii/main/scripts/install.sh | bash
```

- **Fork / different clone URL:**

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/akshaymaru-61/miii/main/scripts/install.sh | env MIII_REPO_URL=https://github.com/maruakshay/miii.git bash -s
```

- **Dry run:**

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/akshaymaru-61/miii/main/scripts/install.sh | bash -s -- --dry-run
```

Requires **Git**, **Node.js 20+**, and **npm**.

### From a clone

```bash
npm install
npm run dev
```

---

## Scripts

| Command         | Description           |
| --------------- | --------------------- |
| `npm run dev`   | Development server    |
| `npm run build` | Production build      |
| `npm run start` | Run production server |
| `npm run lint`  | ESLint                |
| `npm run chroma`| Local Chroma server (`chroma run`, default port 8000) for RAG |
| `npm run tui`   | Terminal UI           |



## Slash commands

### Web UI (composer)

Sending a message that is exactly one of these runs the action instead of chatting:

| Command | Action |
| ------- | ------ |
| `/clear` | Clear the current conversation’s messages |
| `/clear all` | Reset to default conversations (all chats) |
| `/tools` | Open **Add tool** (custom skill) |
| `/delete-tool` | Open **Delete tool** |
| `/web` | Open Tavily API key dialog |

The composer also supports a **`/` menu** (slash autocomplete) for the same actions and quick inserts.

### TUI

Type **`/help`** for the authoritative list. The TUI adds CLI-oriented commands (e.g. **`/rag list`**, **`/pull`**, **`/chroma`**, **`/regenerate`**) and points document **ingest** at the web UI where multipart upload is used.

## Project layout (high level)

| Path                          | Role |
| ----------------------------- | ---- |
| `app/api/chat`                | Stream chat (Ollama + optional tools/RAG) |
| `app/api/models`              | List models |
| `app/api/ollama/pull`         | Proxy Ollama model pull (streaming) |
| `app/api/rag/collections`     | List Chroma collections |
| `app/api/rag/ingest`          | Ingest text/files into a collection |
| `app/api/custom-tools`        | Manage JSON tools |
| `lib/chat-graph.ts`           | LangGraph logic |
| `lib/chat-tools.ts`           | Tool merging |
| `lib/custom-tools.ts`         | Tool definitions |
| `lib/rag-chroma.ts`           | Chroma client, query & ingest |
| `lib/tavily-tool.ts`          | Tavily integration |
| `lib/messages.ts`             | System prompts |
| `lib/conversation-storage.ts` | Local storage |
| `customTools/`                | JSON tools |
| `components/chat/`            | Chat UI |
| `scripts/miii-tui.tsx`        | TUI |

## Roadmap
 
- [ ] Persistent skill execution (connect real logic to custom tool stubs)
- [ ] ChromaDB semantic skill retrieval (automatic tool selection by embedding similarity)
- [ ] File/document ingestion — chat with your local PDFs and notes
- [ ] Multi-turn memory across conversations
- [ ] Docker Compose setup for one-command start
