import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return cachedClient;
}

export function getScriptModel() {
  return process.env.OPENAI_SCRIPT_MODEL || "gpt-5.2";
}
