
import { processAnalyzePayload } from "../lib/process-analysis.js";

// Mock minimal pour éviter l'import réel des envs si besoin
// (Ici le code importé essaie d'importer ../lib/env, on va réparer l'import)


async function testAnalyzeFlow() {
  console.log("--- Lancement du test de flux avec mocks ---");
  
  const mockBody = {
    prenom: "Test",
    nom: "User",
    email: "test@example.com",
    dateNaissance: "1990-01-01",
    themeChoisi: "amour",
    leftPath: "mock-left.jpg",
    rightPath: "mock-right.jpg"
  };

  const mockOpenAI = { chat: { completions: { create: async () => ({ choices: [{ message: { content: "## Vue d'ensemble\n..." } }] }) } } };
  const mockSupabase = { storage: { from: () => ({ download: async () => ({ data: { arrayBuffer: async () => Buffer.from("test") }, error: null }), remove: async () => ({ error: null }) }) } };
  const mockResend = { emails: { send: async () => ({}) } };

  try {
    console.log("Exécution du flux avec mocks...");
    const result = await processAnalyzePayload(mockBody, { openai: mockOpenAI, supabase: mockSupabase, resend: mockResend });
    console.log("Résultat:", result);
  } catch (e) {
    console.error("Erreur de test:", e.message);
  }
}

testAnalyzeFlow();
