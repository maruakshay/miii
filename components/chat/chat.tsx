"use client";

import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AddSkillDialog } from "@/components/chat/add-skill-dialog";
import { DeleteSkillDialog } from "@/components/chat/delete-skill-dialog";
import { TavilyKeyDialog } from "@/components/chat/tavily-key-dialog";
import { ChromaKeyDialog } from "./chroma-key-dialog";
import { ChatComposer } from "./chat-composer";
import { ChatMessageList } from "./chat-message-list";
import { ChatSidebar } from "./chat-sidebar";
import { ModelPickerDialog } from "./model-picker-dialog";
import { ModelPullDialog } from "./model-pull-dialog";
import { RagIngestDialog } from "./rag-ingest-dialog";
import { useChatKeyboard } from "./use-chat-keyboard";
import { useMiiiChat } from "./use-miii-chat";

export function Chat() {
  const chat = useMiiiChat();

  useChatKeyboard({
    onNewChat: chat.newChat,
    onOpenModelPicker: () => chat.setModelPickerOpen(true),
    onFocusComposer: () => {},
    onOpenPull: () => chat.setModelPullOpen(true),
    composerTextareaRef: chat.textareaRef,
  });

  return (
    <div className="flex min-h-0 flex-1">
      <ChatSidebar
        sidebarOpen={chat.sidebarOpen}
        setSidebarOpen={chat.setSidebarOpen}
        hydrated={chat.hydrated}
        sending={chat.sending}
        newChat={chat.newChat}
        conversationsSorted={chat.conversationsSorted}
        activeConversationId={chat.activeConversationId}
        selectConversation={chat.selectConversation}
        models={chat.models}
        model={chat.model}
        setModel={chat.setModel}
        loadingModels={chat.loadingModels}
        webSearch={chat.webSearch}
        setWebSearch={chat.setWebSearch}
        setTavilyDialogOpen={chat.setTavilyDialogOpen}
        activeConversation={chat.activeConversation}
        updateActiveConversation={chat.updateActiveConversation}
        chromaCollections={chat.chromaCollections}
        chromaListError={chat.chromaListError}
        setModelPullOpen={chat.setModelPullOpen}
        setRagIngestOpen={chat.setRagIngestOpen}
        refreshChromaCollections={chat.refreshChromaCollections}
        chromaHasCredentials={
          Boolean(chat.chromaApiKey.trim()) ||
          Boolean(chat.chromaTenant.trim()) ||
          Boolean(chat.chromaDatabase.trim())
        }
        onOpenChromaKey={() => chat.setChromaKeyDialogOpen(true)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--chat-canvas)]">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--chat-border)] bg-[var(--chat-canvas)]/90 px-2 backdrop-blur-md md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-[#5c5748] hover:bg-black/[0.06]"
            onClick={() => chat.setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </Button>
          <span className="min-w-0 truncate text-[15px] font-semibold text-[#2d2a20]">
            {chat.conversations.find((c) => c.id === chat.activeConversationId)
              ?.title ?? "Miii"}
          </span>
        </header>

        {chat.modelsError ? (
          <p className="shrink-0 border-b border-amber-200/90 bg-amber-50/95 px-4 py-2 text-center text-[12px] text-amber-950/90">
            {chat.modelsError}
          </p>
        ) : null}

        <ChatMessageList
          hydrated={chat.hydrated}
          messages={chat.messages}
          sending={chat.sending}
          bottomRef={chat.bottomRef}
          editingUserId={chat.editingUserId}
          editDraft={chat.editDraft}
          setEditDraft={chat.setEditDraft}
          onStartEdit={(msg) => {
            chat.setEditingUserId(msg.id);
            chat.setEditDraft(msg.content);
          }}
          onCancelEdit={() => {
            chat.setEditingUserId(null);
            chat.setEditDraft("");
          }}
          onCommitEdit={() => void chat.commitUserEdit()}
          onRegenerate={() => void chat.regenerateLast()}
        />
      </div>

      <ChatComposer
        input={chat.input}
        setInput={chat.setInput}
        cursorPos={chat.cursorPos}
        setCursorPos={chat.setCursorPos}
        sending={chat.sending}
        sendDisabled={chat.sendDisabled}
        onSend={() => void chat.send()}
        slashMenuActive={chat.slashMenuActive}
        slashFiltered={chat.slashFiltered}
        slashHighlight={chat.slashHighlight}
        setSlashHighlight={chat.setSlashHighlight}
        slashCtx={chat.slashCtx}
        applySlashItem={chat.applySlashItem}
        textareaRef={chat.textareaRef}
        composerRef={chat.composerRef}
      />

      <AddSkillDialog
        open={chat.skillDialogOpen}
        onOpenChange={chat.setSkillDialogOpen}
      />
      <DeleteSkillDialog
        open={chat.deleteSkillDialogOpen}
        onOpenChange={chat.setDeleteSkillDialogOpen}
      />
      <TavilyKeyDialog
        open={chat.tavilyDialogOpen}
        onOpenChange={(open) => {
          chat.setTavilyDialogOpen(open);
          if (!open) chat.setTavilyErrorHint(null);
        }}
        initialKey={chat.tavilyApiKey}
        serverHint={chat.tavilyErrorHint}
        onSave={(k) => {
          chat.setTavilyApiKey(k);
          chat.setWebSearch(true);
          chat.setTavilyErrorHint(null);
        }}
      />

      <ModelPickerDialog
        open={chat.modelPickerOpen}
        onOpenChange={chat.setModelPickerOpen}
        models={chat.models}
        currentModel={chat.model}
        onSelect={chat.setModel}
      />

      <ModelPullDialog
        open={chat.modelPullOpen}
        onOpenChange={chat.setModelPullOpen}
        onPulled={() => void chat.refreshModels()}
      />

      <RagIngestDialog
        open={chat.ragIngestOpen}
        onOpenChange={chat.setRagIngestOpen}
        onIngested={() => void chat.refreshChromaCollections()}
        chromaHeaders={chat.chromaRequestHeaders}
      />

      <ChromaKeyDialog
        open={chat.chromaKeyDialogOpen}
        onOpenChange={chat.setChromaKeyDialogOpen}
        initialChromaUrl={chat.chromaBaseUrl}
        initialApiKey={chat.chromaApiKey}
        initialTenant={chat.chromaTenant}
        initialDatabase={chat.chromaDatabase}
        onSave={(opts) => {
          chat.setChromaBaseUrl(opts.chromaUrl);
          chat.setChromaApiKey(opts.apiKey);
          chat.setChromaTenant(opts.tenant);
          chat.setChromaDatabase(opts.database);
          void chat.refreshChromaCollections();
        }}
      />
    </div>
  );
}
