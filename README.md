# Miii
![miii web](public/ss1.png)
![miii terminal](public/ss2.png)

Miii is a **privacy-first, local AI assistant** that pairs fast streaming chat with pluggable skills, semantic tool routing, and optional live web search — all running on your own machine.

## Why Miii exists

Traditional assistants ship every prompt to the cloud. Miii keeps your messages local while still giving you the flexibility of agentic tools, document-aware answers, and a modern UI.

- ⚡ **Streamlined UX** — browser chat plus a terminal UI (Ink) backed by the same server and skills.
- 🔌 **Composable intelligence** — define JSON skills, chain LangGraph actions, and optionally pull live Tavily search results.
- 🧠 **Document-aware context** — Chroma-based RAG per conversation with Ollama embeddings.
- 🛠️ **Developer-friendly** — streaming NDJSON, model picker, slash commands, and a CLI that installs globally.

## Quick start

### From source (recommended for contributors)

```bash
npm install
npm run dev
```

The web UI launches at `http://localhost:3000`, and you can build your prompts, enable tools, and see streaming Markdown responses instantly.

### Terminal-first workflow (TUI)

Run the TUI alongside the dev server:

```bash
npm run tui
```

Point it at a different host/port with `MIIIBOT_URL=http://127.0.0.1:3000 npm run tui` or `npm run tui -- --url ...`. Use `/help` inside the TUI for guidance.

### One-line installer (install globally as `miii`)

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/akshaymaru-61/miii/main/scripts/install.sh | bash
```

After installation you can run `miii web`, `miii tui`, or `miii help` from any terminal. Add `~/.npm-global/bin` (or wherever your npm global bin lives) to `PATH` if commands are missing.

## Architecture at a glance

```
User Input
    │
    ▼
Next.js App Router
    │
    ▼
/api/chat (streaming NDJSON)
    │
    ▼
LangGraph Agent ────┬──► Ollama streaming (no tools)
                    │
                    └──► Agent loop when tools / web search active
                         │
                         ├── Custom skills (`customTools/*.json` → LangChain)
                         └── Tavily web search (live results)

Response streams back to React renderer + Ink.
```

### Stack

Built with [Next.js App Router](https://nextjs.org), React 19, Tailwind CSS 4, Ink for the TUI, LangGraph, and Ollama for the local models.

## Features

### Agentic tool routing
Miii uses LangGraph to decide when to run a tool (custom skill, web search) and when to stream directly from Ollama, giving you the best of both speed and flexibility.

### Custom skills
Drop JSON tool definitions into `customTools/` and the UI will treat them as LangChain tools. Extend `lib/custom-tools.ts` to hook in actual execution logic if you need real-world actions.

Example definition:

```json
{
  "name": "my_skill",
  "description": "Explain how this skill works",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

Add, edit, or delete tools via the slash menu (`/tools`) or the dedicated UI panels.

### Optional live web search
Flip on Tavily web search from the UI (or set `TAVILY_API_KEY` in env). Miii will pull live search snippets before composing an answer so you can stay current despite model cutoffs. Keys stay in the browser unless you share them server-side.

### Model picker and slash menu
Switch models on the fly (`/model` in the TUI or picker in the browser). The composer supports `/` commands for clearing chats, managing tools, toggling web search, and more.

### Shared memory
Two frontends (browser + TUI) talk to the same backend, share conversations, and stream Markdown (GFM) token-by-token, including tables, code blocks, and lists.

## Configuration

| Variable | Meaning |
|----------|---------|
| `OLLAMA_BASE_URL` | Override Ollama server URL (defaults to local `ollama serve`). |
| `TAVILY_API_KEY` | Tavily key for server-side web search. Browser keys stay client-local. |
| `MIIIBOT_URL` | Base URL for the TUI client (`npm run tui`). |
| `CHROMA_URL` | Chroma HTTP API (`http://127.0.0.1:8000` by default). |
| `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` | Optional Chroma defaults. |
| `OLLAMA_EMBED_MODEL` | Embedding model for RAG (defaults to `nomic-embed-text`). |

Store overrides in `.env.local` or configure through the web UI / TUI (Chroma and Tavily headers persist in browser local storage).

## Running Chroma

The repo bundles `chromadb` as a dependency. Start the Chroma service from the project root:

```bash
npm run chroma
```

This runs `node_modules/.bin/chroma` on port 8000. You can also use `npx chroma run` or point to a remote server with `CHROMA_URL`.

## Slash commands

Send these from the composer for quick actions:

| Command | Action |
| ------- | ------ |
| `/clear` | Clear current conversation messages. |
| `/clear all` | Reset the browser to default chats. |
| `/tools` | Open Add Tool dialog (custom skills). |
| `/delete-tool` | Open Delete Tool dialog. |
| `/web` | Open Tavily key dialog. |

The TUI exposes additional CLI-friendly commands like `/rag list`, `/pull`, `/chroma`, `/regenerate`, and `/system`.

## Terminal UI commands

While connected to the server the TUI supports `/model`, `/url`, `/web on|off`, `/tavily set`, `/rag`, `/clear`, `/new`, `/quit`, and more. Use `/help` inside the TUI for the authoritative list.

## Custom skills wiring

1. Create or edit a JSON file under `customTools/` with `name`, `description`, and metadata.
2. Update `lib/custom-tools.ts` if the tool needs to call real code (e.g., shelling out, querying local data, etc.).
3. Navigate to the Tools menu in the UI or use `/tools` to activate it for the agent loop.

Custom skills behave like LangChain tools and can be combined with LangGraph reasoning for rich workflows.

## Contributing to Miii

We welcome contributors!

1. Fork the repo and open a pull request against `main`.
2. Run `npm run lint` and `npm run test` (if tests exist) before submitting.
3. Propose new features (new tools, UI improvements, docs updates) by opening an issue first if the scope is large.
4. Help triage issues, answer questions, or write docs — every contribution is valuable.

## Project layout

| Path | Role |
| ---- | ---- |
| `app/api/chat` | Streaming chat backbone (Ollama + LangGraph). |
| `app/api/models` | Lists local Ollama models. |
| `app/api/ollama/pull` | Streams `ollama pull` progress. |
| `app/api/rag/collections` | List Chroma collections. |
| `app/api/rag/ingest` | Ingest text/files for RAG. |
| `app/api/custom-tools` | CRUD for JSON skills. |
| `lib/chat-graph.ts` | LangGraph agent setup. |
| `lib/chat-tools.ts` | Tool merging logic. |
| `lib/custom-tools.ts` | Tool definitions loader. |
| `lib/rag-chroma.ts` | Chroma client helpers. |
| `lib/tavily-tool.ts` | Tavily web search integration. |
| `lib/messages.ts` | System prompts. |
| `lib/conversation-storage.ts` | Local storage helpers. |
| `customTools/` | JSON skill definitions. |
| `components/chat/` | Browser chat client. |
| `scripts/miii-tui.tsx` | Ink-based TUI entrypoint. |

## Roadmap highlights

- [ ] Persistent skill workers (real execution logic behind custom tools).
- [ ] ChromaDB semantic skill retrieval (auto tool selection via embeddings).
- [ ] Document ingestion (PDFs, notes, and local files) through the UI.
- [ ] Multi-turn memory across conversations.
- [ ] Docker Compose for single-command bootstrapping.

## Need help?

- Ask questions in the repository discussions or open an issue with the `support` label.
- Bring feature ideas and bug reports to GitHub — we track them in `Issues`.
- Want to sponsor ongoing work? See [GitHub Sponsors](https://github.com/sponsors/akshaymaru-61).

## License

Miii is open source under the [MIT License](LICENSE).
