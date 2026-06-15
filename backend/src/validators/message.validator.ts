import { z } from "zod";
 
export const sendMessageSchema = z.object({
  chatId: z.string(),
  content: z.string().optional(),
  image: z.string().optional(),
  replyToId: z.string().optional(),
});
 
export const reactMessageSchema = z.object({
  messageId: z.string(),
  emoji: z.string().min(1).max(10),
});
 
// NEW — mark seen validator (validates :chatId param)
export const markSeenSchema = z.object({
  chatId: z.string(),
});
 