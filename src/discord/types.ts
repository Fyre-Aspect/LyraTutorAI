/**
 * Type definitions for Discord bot integration
 */

import { VoiceConnection, AudioPlayer } from "@discordjs/voice";
import { VoiceChannel } from "discord.js";

export interface BotStatus {
  channelName: string;
  model: string;
  voiceConnectionState: string;
  geminiConnected: boolean;
  usersInChannel: number;
}

export interface VoiceConnectionState {
  connection: VoiceConnection | null;
  player: AudioPlayer | null;
  channel: VoiceChannel;
  isActive: boolean;
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  userId: string;
}

export interface DiscordBotConfig {
  token: string;
  geminiApiKey: string;
  model?: string;
  prefix?: string;
  systemInstruction?: string;
  voice?: string;
  autoDisconnectTimeout?: number;
}
