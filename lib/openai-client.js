import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiClient() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Retourne un wrapper compatible avec le format OpenAI si besoin, 
  // ou on adapte le service generateReport
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}
