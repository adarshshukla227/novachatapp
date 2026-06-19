import { z } from "zod";
import type { MessageType } from "@/types/chat.type";
import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Paperclip, Send, X, Mic, MicOff } from "lucide-react";
import { Form, FormField, FormItem } from "../ui/form";
import { Input } from "../ui/input";
import ChatReplyBar from "./chat-reply-bar";
import { useChat } from "@/hooks/use-chat";
import { useSocket } from "@/hooks/use-socket";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Props {
  chatId: string | null;
  currentUserId: string | null;
  replyTo: MessageType | null;
  onCancelReply: () => void;
  smartReplyText?: string;
  onSmartReplyUsed?: () => void;
}

const ChatFooter = ({
  chatId,
  currentUserId,
  replyTo,
  onCancelReply,
  smartReplyText,
  onSmartReplyUsed,
}: Props) => {
  const messageSchema = z.object({
    message: z.string().optional(),
  });

  const { sendMessage, isSendingMsg } = useChat();
  const { socket } = useSocket();

  const [image, setImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const form = useForm({
    resolver: zodResolver(messageSchema),
    defaultValues: { message: "" },
  });

  // ─── Typing emit functions ─────────────────────────────────────────────────
  const emitTypingStart = () => {
    if (!socket || !chatId || isTypingRef.current) return;
    isTypingRef.current = true;
    socket.emit("typing:start", chatId);
  };

  const emitTypingStop = () => {
    if (!socket || !chatId || !isTypingRef.current) return;
    isTypingRef.current = false;
    socket.emit("typing:stop", chatId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue("message", e.target.value);

    if (e.target.value.trim()) {
      emitTypingStart();
      // 2 second baad koi change nahi hua toh typing stop kar do
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStop();
      }, 2000);
    } else {
      // Input khali ho gayi toh turant typing stop
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitTypingStop();
    }
  };

  // Cleanup — component unmount hone pe ya chatId change hone pe typing stop karo
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitTypingStop();
    };
  }, [chatId, socket]);
  // ──────────────────────────────────────────────────────────────────────────

  // Smart reply text aane par input mein set karo
  useEffect(() => {
    if (smartReplyText) {
      form.setValue("message", smartReplyText);
      onSmartReplyUsed?.();
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder="Type new message"]'
      );
      input?.focus();
    }
  }, [smartReplyText]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) setVoiceSupported(true);
  }, []);

  const createRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      form.setValue("message", final || interim);
    };
    rec.onend = () => { setIsListening(false); recognitionRef.current = null; };
    rec.onerror = () => { setIsListening(false); recognitionRef.current = null; };
    return rec;
  };

  const toggleVoice = () => {
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsListening(false);
      return;
    }
    const rec = createRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    try { rec.start(); setIsListening(true); } catch { recognitionRef.current = null; }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const onSubmit = (values: { message?: string }) => {
    if (isSendingMsg) return;
    if (!values.message?.trim() && !image) {
      toast.error("Please enter a message or select an image");
      return;
    }
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsListening(false);
    }
    // Message send hone pe typing stop karo
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitTypingStop();

    sendMessage({ chatId, content: values.message, image: image || undefined, replyTo });
    onCancelReply();
    handleRemoveImage();
    form.reset();
  };

  return (
    <>
      <div className="sticky bottom-0 inset-x-0 z-[999] bg-card border-t border-border py-4">
        {image && !isSendingMsg && (
          <div className="max-w-6xl mx-auto px-8.5">
            <div className="relative w-fit">
              <img src={image} className="object-contain h-16 bg-muted min-w-16" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-px right-1 bg-black/50 text-white rounded-full cursor-pointer"
                onClick={handleRemoveImage}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {isListening && (
          <div className="max-w-6xl mx-auto px-8.5 mb-2">
            <div className="flex items-center gap-2 text-xs text-blue-500">
              <div className="flex items-end gap-0.5 h-4">
                {[0.5, 1, 0.75, 1, 0.5].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-blue-500 rounded-full"
                    style={{
                      height: `${h * 100}%`,
                      animation: `pulse 600ms ease-in-out ${i * 100}ms infinite alternate`,
                    }}
                  />
                ))}
              </div>
              Listening... speak now
            </div>
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="max-w-6xl px-8.5 mx-auto flex items-end gap-2"
          >
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isSendingMsg}
                className="rounded-full"
                onClick={() => imageInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                disabled={isSendingMsg}
                ref={imageInputRef}
                onChange={handleImageChange}
              />
            </div>

            <FormField
              control={form.control}
              name="message"
              disabled={isSendingMsg}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <Input
                    {...field}
                    autoComplete="off"
                    placeholder={isListening ? "Listening... 🎤" : "Type new message"}
                    className="min-h-[40px] bg-background"
                    onChange={handleInputChange}
                  />
                </FormItem>
              )}
            />

            {voiceSupported && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isSendingMsg}
                className={`rounded-full ${isListening ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-500" : ""}`}
                onClick={toggleVoice}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}

            <Button
              type="submit"
              size="icon"
              className="rounded-lg"
              disabled={isSendingMsg}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </Form>
      </div>

      {replyTo && !isSendingMsg && (
        <ChatReplyBar
          replyTo={replyTo}
          currentUserId={currentUserId}
          onCancel={onCancelReply}
        />
      )}
    </>
  );
};

export default ChatFooter;