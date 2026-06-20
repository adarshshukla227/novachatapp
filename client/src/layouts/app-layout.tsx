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
        <div className="h-full flex">

          {/* 
            ChatList panel:
            - Mobile: full width, chat open hone par hide
            - Desktop: fixed width sidebar always visible
          */}
          <div
            className={cn(
              "w-full lg:w-80 xl:w-96 h-full flex-shrink-0",
              "border-r border-border",
              chatId ? "hidden lg:flex" : "flex"
            )}
          >
            <div className="w-full h-full">
              <ChatList />
            </div>
          </div>

          {/* 
            Chat window / outlet:
            - Mobile: full width, sirf chat open hone par dikhao
            - Desktop: baaki sari width le lo
          */}
          <div
            className={cn(
              "flex-1 h-full min-w-0",
              !chatId ? "hidden lg:flex" : "flex"
            )}
          >
            <div className="w-full h-full">
              <Outlet />
            </div>
          </div>

        </div>
      </AppWrapper>

      {/* AI Chat Window — portal se render hota hai */}
      {showAiChat &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-background flex flex-col lg:left-[calc(44px+384px)]">
            <AiChatWindow onClose={() => setShowAiChat(false)} />
          </div>,
          document.body
        )}
    </AiChatContext.Provider>
  );
};

export default AppLayout;
