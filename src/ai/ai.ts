// src/ai/ai.ts
/**
 * @fileOverview This file loads environment variables and initializes the Genkit AI instance.
 * It is NOT a 'use server' file itself, allowing the 'ai' object to be imported by other server files.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Let Next.js handle .env loading.
// The key should be available in process.env when the server starts.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  // This error will be caught by the server during startup if the key is missing.
  // It's a critical failure, so throwing an error is appropriate.
  throw new Error("FATAL: GEMINI_API_KEY is not set in the environment. AI features will not work.");
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY,
    }),
  ],
});
