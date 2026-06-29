import { Router, Request, Response } from "express";

const router = Router();

router.post("/chat", async (req: Request, res: Response) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Messages array required" });
    return;
  }

  try {
    const hasImage = messages.some(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some((c: any) => c.type === "image_url")
    );

    const model = hasImage
      ? "meta-llama/llama-4-scout-17b-16e-instruct"
      : "llama-3.3-70b-versatile";

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `You are NovaChat AI, a professional and intelligent assistant built into a messaging platform.

LANGUAGE RULES (very important — follow in this exact priority order):
1. DEFAULT LANGUAGE IS ENGLISH. Always reply in pure, professional English by default — even for short, casual, or ambiguous messages like "hii", "ok", "thanks", or single-word greetings.
2. ONLY switch away from English if the user's message clearly contains Hindi words — either in Devanagari script (हिंदी) or Hinglish (Hindi words written in Roman/English letters, e.g. "kya haal hai", "tum kaise ho", "kaise ho bhai").
3. When switching, ALWAYS reply in Hinglish (Hindi words in Roman script mixed naturally with English) — NEVER reply in Devanagari script, even if the user themselves typed in Devanagari Hindi.
4. If the user's message is in plain English, do NOT switch to Hinglish just because earlier messages in the conversation were in Hindi/Hinglish — re-evaluate language per message and default back to English as soon as the user writes in English again.
5. When in doubt about the language, prefer English.

OTHER RULES:
- Be concise, clear, and professional.
- If an image is shared, analyze and describe it in detail.
- If a file is mentioned, help the user understand or work with it.
- Never break character — you are NovaChat AI, not any other AI.`,
            },
            ...messages,
          ],
          max_tokens: 1024,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("Groq error:", data.error);
      res.status(500).json({ error: data.error.message });
      return;
    }

    const reply =
      data.choices?.[0]?.message?.content ?? "Sorry, something went wrong.";
    res.json({ reply });
  } catch (error) {
    console.error("Groq API error:", error);
    res.status(500).json({ error: "Could not reach AI service." });
  }
});

export default router;