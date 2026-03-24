import { GoogleGenAI } from "@google/genai";

export const GENERATION_MODEL = "gemini-3.1-flash-image-preview";
export const TEXT_MODEL = "gemini-3-flash-preview";

export async function getAiInstance() {
  // For models like gemini-3.1-flash-image-preview, we should use the selected key if available
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
}
