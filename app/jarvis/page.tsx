"use client";
import { useEffect, useState } from "react";
import { BootSequence } from "@/components/jarvis/BootSequence";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import ChatInterface from "@/components/jarvis/ChatInterface";
import { SettingsPanel } from "@/components/jarvis/SettingsPanel";
import { MemoriesPanel } from "@/components/jarvis/MemoriesPanel";
import { ToastContainer } from "@/components/ui/Toast";
import { useChatStore, useUIStore } from "@/store";

export default function JarvisPage() {
  const [booting, setBooting] = useState(true);
  const { showSettings, showMemories, toasts } = useUIStore();
  const { conversations, activeConvId, newConversation } = useChatStore();

  // Bootstrap — ensure at least one conversation exists
  useEffect(() => {
    if (!booting && conversations.length === 0) {
      newConversation();
    }
  }, [booting, conversations.length, newConversation]);

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", zIndex: 2 }}>
      <ToastContainer toasts={toasts} />

      {booting && <BootSequence onDone={() => setBooting(false)} />}

      {!booting && (
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
          <Sidebar />
          <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
            <TopBar />
            <ChatInterface />
          </main>
        </div>
      )}

      {showSettings && <SettingsPanel />}
      {showMemories && <MemoriesPanel />}
    </div>
  );
}
