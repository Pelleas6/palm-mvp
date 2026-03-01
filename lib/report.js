import OpenAI from "openai";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateAnalysis({ prenom, dateNaissance, theme, imageGaucheBase64, imageDroiteBase64 }) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1800,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPrompt({ prenom, dateNaissance, theme }) },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageGaucheBase64}`,
              detail: "high",
            },
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageDroiteBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}
