/**
 * Voice Connection Manager with proper response formatting integration
 */

import {
  VoiceConnection,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  VoiceConnectionStatus,
  entersState,
  EndBehaviorType,
  StreamType,
} from "@discordjs/voice";
import { VoiceChannel } from "discord.js";
import { GenAILiveClient } from "@/lib/genai-live-client";
import { LiveConnectConfig, Modality, Type } from "@google/genai";
import { DiscordAudioProcessor } from "./audio-processor-v2";
import { ResponseFormatter } from "@/lib/response-formatter";
import { Readable } from "stream";
import * as prism from "prism-media";

export class VoiceConnectionManager {
  private voiceConnection: VoiceConnection | null = null;
  private audioPlayer: AudioPlayer | null = null;
  private geminiClient: GenAILiveClient;
  private audioProcessor: DiscordAudioProcessor;
  private channel: VoiceChannel;
  private model: string;
  private liveConfig: LiveConnectConfig;
  private isConnected: boolean = false;
  
  private audioQueue: Buffer[] = [];
  private isPlaying: boolean = false;
  
  private userAudioBuffers: Map<string, { 
    chunks: Buffer[], 
    timer: NodeJS.Timeout | null, 
    totalSamples: number 
  }> = new Map();
  
  private readonly MIN_AUDIO_DURATION_MS = 500;
  private readonly DEBOUNCE_MS = 800;
  private readonly MIN_RMS_THRESHOLD = 400;
  private responseInProgress = false;

  constructor(
    channel: VoiceChannel,
    geminiApiKey: string,
    model: string,
    liveConfig: LiveConnectConfig
  ) {
    this.channel = channel;
    this.model = model;
    this.liveConfig = liveConfig;
    
    this.geminiClient = new GenAILiveClient({ apiKey: geminiApiKey });
    this.audioProcessor = new DiscordAudioProcessor();
    
    this.setupGeminiListeners();
  }

  private setupGeminiListeners() {
    // Audio streaming
    this.geminiClient.on("audio", (data: ArrayBuffer) => {
      const buffer = Buffer.from(data);
      this.audioQueue.push(buffer);
      
      const MIN_BUFFER_CHUNKS = 2;
      if (!this.isPlaying && this.audioQueue.length >= MIN_BUFFER_CHUNKS) {
        this.playNextAudio();
      }
    });

    // Response formatting events (logged but handled by bot.ts)
    this.geminiClient.on("voiceResponse", (summary: string) => {
      console.log(`🎙️ VCM: Voice summary ready (${summary.length} chars)`);
    });

    this.geminiClient.on("textResponse", (analysis: string) => {
      console.log(`📄 VCM: Detailed analysis ready (${analysis.length} chars)`);
    });

    this.geminiClient.on("formattedResponse", (formatted) => {
      console.log(`✅ VCM: Formatted response complete`);
    });

    this.geminiClient.on("content", (data: any) => {
      console.log("📝 VCM: Content update");
    });

    this.geminiClient.on("turncomplete", () => {
      console.log("✅ VCM: Turn complete");
      this.responseInProgress = false;
    });

    this.geminiClient.on("error", (error) => {
      console.error("❌ VCM: Gemini error:", error);
      this.responseInProgress = false;
    });

    this.geminiClient.on("close", () => {
      console.log("🔒 VCM: Gemini closed");
      this.isConnected = false;
    });

    this.geminiClient.on("open", () => {
      console.log("🔓 VCM: Gemini opened");
      this.isConnected = true;
    });

    this.geminiClient.on("interrupted", () => {
      console.log("⚠️ Gemini interrupted - someone spoke during response");
      // Don't immediately clear - let current audio finish unless it's been >2 seconds
      if (this.responseInProgress) {
        console.log("⏸️ Allowing current response to finish...");
      }
    });

    // Handle tool calls (function calling)
    this.geminiClient.on("toolcall", async (toolCall) => {
      console.log("🔧 Tool call received:", JSON.stringify(toolCall, null, 2));
      
      if (toolCall.functionCalls && toolCall.functionCalls.length > 0) {
        for (const functionCall of toolCall.functionCalls) {
          if (functionCall.name === "send_chat_message" && functionCall.id) {
            await this.handleSendChatMessage({
              id: functionCall.id,
              name: functionCall.name,
              args: functionCall.args,
            });
          }
        }
      }
    });
  }

  /**
   * Handle send_chat_message tool call from Gemini
   */
  private async handleSendChatMessage(functionCall: { id: string; name: string; args?: Record<string, unknown> }) {
    try {
      const args = functionCall.args || {};
      const message = args.message || "";
      
      if (!message) {
        console.error("❌ send_chat_message called without message");
        return;
      }

      console.log("💬 Sending chat message:", message);
      
      // Send the message to Discord
      await this.channel.send(`🤖 ${message}`);
      console.log("✅ Chat message sent successfully");
      
      // Send tool response back to Gemini
      await this.geminiClient.sendToolResponse({
        functionResponses: [
          {
            id: functionCall.id,
            name: functionCall.name,
            response: {
              success: true,
              message: "Message sent successfully to Discord",
            },
          },
        ],
      });
    } catch (error) {
      console.error("❌ Error handling send_chat_message:", error);
      
      // Send error response back to Gemini
      try {
        await this.geminiClient.sendToolResponse({
          functionResponses: [
            {
              id: functionCall.id,
              name: functionCall.name,
              response: {
                success: false,
                error: String(error),
              },
            },
          ],
        });
      } catch (sendError) {
        console.error("❌ Error sending tool response:", sendError);
      }
    }
  }

  /**
   * Handle send_chat_message tool call from Gemini
   */
  private async handleSendChatMessage(functionCall: { id: string; name: string; args?: Record<string, unknown> }) {
    try {
      const args = functionCall.args || {};
      const message = args.message || "";
      
      if (!message) {
        console.error("❌ send_chat_message called without message");
        return;
      }

      console.log("💬 Sending chat message:", message);
      
      // Send the message to Discord
      await this.channel.send(`🤖 ${message}`);
      console.log("✅ Chat message sent successfully");
      
      // Send tool response back to Gemini
      await this.geminiClient.sendToolResponse({
        functionResponses: [
          {
            id: functionCall.id,
            name: functionCall.name,
            response: {
              success: true,
              message: "Message sent successfully to Discord",
            },
          },
        ],
      });
    } catch (error) {
      console.error("❌ Error handling send_chat_message:", error);
      
      // Send error response back to Gemini
      try {
        await this.geminiClient.sendToolResponse({
          functionResponses: [
            {
              id: functionCall.id,
              name: functionCall.name,
              response: {
                success: false,
                error: String(error),
              },
            },
          ],
        });
      } catch (sendError) {
        console.error("❌ Error sending tool response:", sendError);
      }
    }
  }

  public async connect() {
    // Join the voice channel
    this.voiceConnection = joinVoiceChannel({
      channelId: this.channel.id,
      guildId: this.channel.guild.id,
      adapterCreator: this.channel.guild.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });

    try {
      await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 30_000);
      console.log("✅ VCM: Voice connection established");
    } catch (error) {
      console.error("❌ VCM: Voice connection failed:", error);
      this.voiceConnection.destroy();
      throw error;
    }

    this.audioPlayer = createAudioPlayer();
    this.voiceConnection.subscribe(this.audioPlayer);

    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (newState.status === 'idle' && oldState.status !== 'idle') {
        this.isPlaying = false;
        this.playNextAudio();
      }
    });

    this.audioPlayer.on('error', (error) => {
      console.error('❌ VCM: Audio player error:', error);
      this.isPlaying = false;
      this.playNextAudio();
    });

    this.setupAudioReceiving();

    // Connect to Gemini with tool (function calling) support
    await this.geminiClient.connect(this.model, {
      ...this.liveConfig,
      generationConfig: {
        ...this.liveConfig.generationConfig,
        responseModalities: [Modality.AUDIO],
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: "send_chat_message",
              description: "Send a text message to the Discord chat channel. Use this when you want to share information that's better displayed as text, like links, code snippets, lists, or when the user explicitly asks you to send a message in chat.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  message: {
                    type: Type.STRING,
                    description: "The text message to send to the Discord chat channel",
                  },
                },
                required: ["message"],
              },
            },
          ],
        },
      ],
    });

    console.log("✅ Connected to Gemini API");
  }

  private setupAudioReceiving() {
    if (!this.voiceConnection) return;

    const receiver = this.voiceConnection.receiver;

    receiver.speaking.on("start", (userId: string) => {
      console.log(`🎤 VCM: User ${userId} started speaking`);
      
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1200,
        },
      });

      this.processUserAudioDebounced(userId, audioStream);
    });
  }

  private async processUserAudioDebounced(userId: string, audioStream: Readable) {
    try {
      let userBuffer = this.userAudioBuffers.get(userId);
      if (!userBuffer) {
        userBuffer = { chunks: [], timer: null, totalSamples: 0 };
        this.userAudioBuffers.set(userId, userBuffer);
      }

      if (userBuffer.timer) {
        clearTimeout(userBuffer.timer);
      }

      const decoder = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      audioStream.pipe(decoder);

      decoder.on("data", (chunk: Buffer) => {
        userBuffer!.chunks.push(chunk);
        userBuffer!.totalSamples += chunk.length / 4;
      });

      decoder.on("end", async () => {
        if (userBuffer!.chunks.length === 0) return;

        const debounceTime = this.isPlaying || this.responseInProgress 
          ? this.DEBOUNCE_MS
          : Math.min(this.DEBOUNCE_MS, 400);

        userBuffer!.timer = setTimeout(async () => {
          await this.processFinalAudio(userId);
        }, debounceTime);
      });

      decoder.on("error", (error: Error) => {
        console.error("❌ VCM: Decoding error:", error);
      });
    } catch (error) {
      console.error("❌ VCM: Processing error:", error);
    }
  }

  private async processFinalAudio(userId: string) {
    const userBuffer = this.userAudioBuffers.get(userId);
    if (!userBuffer || userBuffer.chunks.length === 0) return;

    try {
      const fullBuffer = Buffer.concat(userBuffer.chunks);
      const durationMs = (userBuffer.totalSamples / 48000) * 1000;
      
      if (durationMs < this.MIN_AUDIO_DURATION_MS) {
        console.log(`⚠️ VCM: Ignoring short audio (${durationMs.toFixed(0)}ms)`);
        this.userAudioBuffers.delete(userId);
        return;
      }

      const rms = this.calculateRMS(fullBuffer);
      if (rms < this.MIN_RMS_THRESHOLD) {
        console.log(`⚠️ VCM: Ignoring quiet audio (RMS: ${rms.toFixed(0)})`);
        this.userAudioBuffers.delete(userId);
        return;
      }

      console.log(`✅ VCM: Processing ${durationMs.toFixed(0)}ms (RMS: ${rms.toFixed(0)})`);
      
      const processedAudio = await this.audioProcessor.convertDiscordToGemini(fullBuffer);

      this.geminiClient.sendRealtimeInput([
        {
          mimeType: "audio/pcm",
          data: processedAudio,
        },
      ]);

      console.log(`📤 VCM: Sent ${processedAudio.length} bytes to Gemini`);
      this.responseInProgress = true;

    } catch (error) {
      console.error("❌ VCM: Final audio processing error:", error);
    } finally {
      this.userAudioBuffers.delete(userId);
    }
  }

  private calculateRMS(buffer: Buffer): number {
    let sum = 0;
    const samples = buffer.length / 4;
    
    for (let i = 0; i < buffer.length; i += 4) {
      const left = buffer.readInt16LE(i);
      const right = buffer.readInt16LE(i + 2);
      const avg = (left + right) / 2;
      sum += avg * avg;
    }
    
    return Math.sqrt(sum / samples);
  }
  public stopPlayback() {
  console.log("🛑 VCM: Stopping playback");
  
  // Clear the audio queue
  this.audioQueue = [];
  
  // Stop the audio player
  if (this.audioPlayer) {
    this.audioPlayer.stop();
  }
  
  // Reset playing state
  this.isPlaying = false;
  this.responseInProgress = false;
  
  console.log("✅ VCM: Playback stopped");
}

  private async playNextAudio() {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioPlayer) {
      return;
    }

    this.isPlaying = true;

    try {
      const allChunks: Buffer[] = [];
      while (this.audioQueue.length > 0) {
        const geminiAudioChunk = this.audioQueue.shift()!;
        const discordAudio = this.audioProcessor.convertGeminiToDiscord(
          new Uint8Array(geminiAudioChunk)
        );
        allChunks.push(discordAudio);
      }

      const continuousAudio = Buffer.concat(allChunks);
      
      console.log(`🔊 VCM: Playing ${continuousAudio.length} bytes`);

      const encoder = new prism.opus.Encoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      const CHUNK_SIZE = 3840;
      let offset = 0;

      const pcmStream = new Readable({
        read() {
          if (offset < continuousAudio.length) {
            const chunk = continuousAudio.slice(
              offset, 
              Math.min(offset + CHUNK_SIZE, continuousAudio.length)
            );
            this.push(chunk);
            offset += CHUNK_SIZE;
          } else {
            this.push(null);
          }
        }
      });

      const opusStream = pcmStream.pipe(encoder);

      const resource = createAudioResource(opusStream, {
        inputType: StreamType.Opus,
        inlineVolume: true,
      });

      this.audioPlayer.play(resource);
    } catch (error) {
      console.error("❌ VCM: Playback error:", error);
      this.isPlaying = false;
      this.responseInProgress = false;
      this.playNextAudio();
    }
  }

  public disconnect() {
    console.log("🛑 VCM: Disconnecting");
    
    this.audioQueue = [];
    this.isPlaying = false;
    this.responseInProgress = false;
    
    for (const buffer of this.userAudioBuffers.values()) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
    }
    this.userAudioBuffers.clear();

    if (this.geminiClient) {
      this.geminiClient.disconnect();
    }

    if (this.audioPlayer) {
      this.audioPlayer.stop();
    }

    if (this.voiceConnection) {
      this.voiceConnection.destroy();
    }

    this.isConnected = false;
    console.log("👋 VCM: Disconnected");
  }

  public getStatus() {
    return {
      channelName: this.channel.name,
      model: this.model,
      voiceConnectionState: this.voiceConnection?.state.status || "disconnected",
      geminiConnected: this.isConnected,
      usersInChannel: this.channel.members.size - 1,
      queuedAudioChunks: this.audioQueue.length,
    };
  }

  public isActive(): boolean {
    return this.isConnected && 
           this.voiceConnection?.state.status === VoiceConnectionStatus.Ready;
  }

  public getGeminiClient(): GenAILiveClient {
    return this.geminiClient;
  }
}