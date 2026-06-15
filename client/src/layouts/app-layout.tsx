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
        <div className="h-full">
          {/* ChatList */}
          <div className={cn(chatId ? "hidden lg:block" : "block")}>
            <ChatList />
          </div>
          <div
            className={cn(
              "lg:!pl-95 pl-7",
              !chatId ? "hidden lg:block" : "block"
            )}
          >
            <Outlet />
          </div>
        </div>
      </AppWrapper>

      {/*
        AI Chat Window — rendered via PORTAL directly into document.body.
        This completely escapes any stacking context / z-index issues
        from parent layouts. It will always sit on top of everything,
        and will never receive clicks meant for the normal chat.
      */}
      {showAiChat &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-background flex flex-col lg:left-[calc(40px+379px)]"
          >
            <AiChatWindow onClose={() => setShowAiChat(false)} />
          </div>,
          document.body
        )}
    </AiChatContext.Provider>
  );
};

export default AppLayout;
