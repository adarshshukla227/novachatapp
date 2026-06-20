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

          {/* ChatList — mobile pe full screen, desktop pe fixed panel */}
          <div
            className={cn(
              "h-full flex-shrink-0 border-r border-border",
              "w-full lg:w-80 xl:w-96",
              chatId ? "hidden lg:flex lg:flex-col" : "flex flex-col"
            )}
          >
            <ChatList />
          </div>

          {/* Chat window — mobile pe full screen, desktop pe flex-1 */}
          <div
            className={cn(
              "h-full min-w-0",
              "flex-1",
              !chatId ? "hidden lg:flex" : "flex"
            )}
          >
            <div className="w-full h-full">
              <Outlet />
            </div>
          </div>

        </div>
      </AppWrapper>

      {showAiChat &&
        createPortal(
          <div
            style={{ left: "calc(var(--aside-width-mobile) + 0px)" }}
            className="fixed inset-0 z-[9999] bg-background flex flex-col md:left-[calc(var(--aside-width-desktop)+0px)]"
          >
            <AiChatWindow onClose={() => setShowAiChat(false)} />
          </div>,
          document.body
        )}
    </AiChatContext.Provider>
  );
};

export default AppLayout;
