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

LANGUAGE RULES (very important):
1. If the user writes in pure English, reply in pure English.
2. If the user writes in Hinglish (Hindi words written in English/Roman letters mixed with English, e.g. "kya haal hai", "tum kaise ho"), reply in the SAME Hinglish style — Hindi words written in Roman script mixed with English.
3. NEVER reply using Devanagari script (हिंदी). Even if the user writes in Devanagari Hindi, reply back in Hinglish (Roman script), not Devanagari.
4. Match the user's tone and language style as closely as possible, but always keep your response readable in Roman/English script.

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
