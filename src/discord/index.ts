/**
 * Main entry point for the Discord bot
 */

import { Modality } from "@google/genai";
import { GeminiDiscordBot, BotConfig } from "./bot";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function main() {
  const config: BotConfig = {
    token: process.env.DISCORD_BOT_TOKEN || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "models/gemini-2.0-flash-exp",
    prefix: process.env.BOT_PREFIX || "!gemini",
    liveConfig: {
      systemInstruction: {
        parts: [
          {
            text: process.env.GEMINI_SYSTEM_INSTRUCTION || 
              "You are a helpful AI assistant in a Discord voice channel. " +
              "Keep your responses concise and natural for voice conversation. " +
              "You can hear multiple people speaking, so address them appropriately.",
          },
        ],
      },
      generationConfig: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: process.env.GEMINI_VOICE || "Puck",
            },
          },
        },
      },
    },
  };

  // Validate required environment variables
  if (!config.token) {
    console.error("❌ Error: DISCORD_BOT_TOKEN is required in .env.local");
    process.exit(1);
  }

  if (!config.geminiApiKey) {
    console.error("❌ Error: GEMINI_API_KEY is required in .env.local");
    process.exit(1);
  }

  console.log("🚀 Starting Gemini Discord Bot...");
  console.log(`📱 Model: ${config.model}`);
  console.log(`🎤 Voice: ${config.liveConfig?.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName}`);
  console.log(`📝 Prefix: ${config.prefix}`);

  const bot = new GeminiDiscordBot(config);

  try {
    await bot.start(config.token);
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down bot...");
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 Shutting down bot...");
    await bot.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
