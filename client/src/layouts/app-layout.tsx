import AppWrapper from "@/components/app-wrapper";
import ChatList from "@/components/chat/chat-list";
import AiChatWindow from "@/components/AiChatWindow";
import useChatId from "@/hooks/use-chat-id";
import { cn } from "@/lib/utils";
import { Outlet } from "react-router-dom";
import { useState, createContext, useContext } from "react";
import { createPortal } from "react-dom";

interface AiChatContextType {
  showAiChat: boolean;
  setShowAiChat: (val: boolean) => void;
}

const AiChatContext = createContext<AiChatContextType | undefined>(undefined);

export const useAiChat = () => {
  const ctx = useContext(AiChatContext);
  if (!ctx) throw new Error("useAiChat must be used within AppLayout");
  return ctx;
};

const AppLayout = () => {
  const chatId = useChatId();
  const [showAiChat, setShowAiChat] = useState(false);

  return (
    <AiChatContext.Provider value={{ showAiChat, setShowAiChat }}>
      <AppWrapper>
        <div className="h-full flex overflow-hidden">

          {/* ChatList panel */}
          <div
            className={cn(
              "h-full flex-shrink-0",
              "w-full lg:w-[379px]",
              chatId ? "hidden lg:block" : "block"
            )}
          >
            <ChatList />
          </div>

          {/* Chat window */}
          <div
            className={cn(
              "flex-1 h-full min-w-0 overflow-hidden",
              !chatId ? "hidden lg:block" : "block"
            )}
          >
            <Outlet />
          </div>

        </div>
      </AppWrapper>

      {showAiChat &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-background flex flex-col lg:left-[calc(44px+379px)]">
            <AiChatWindow onClose={() => setShowAiChat(false)} />
          </div>,
          document.body
        )}
    </AiChatContext.Provider>
  );
};

export default AppLayout;
