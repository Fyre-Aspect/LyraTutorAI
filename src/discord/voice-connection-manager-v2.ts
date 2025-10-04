/**
 * IMPROVED Voice Connection Manager with proper audio streaming
 * Fixes the audio corruption issues
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
import { LiveConnectConfig, Modality } from "@google/genai";
import { DiscordAudioProcessor } from "./audio-processor-v2";
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
  private speakingUsers: Map<string, NodeJS.Timeout> = new Map();
  
  // Audio queue for playing Gemini responses
  private audioQueue: Buffer[] = [];
  private isPlaying: boolean = false;
  
  // Noise filtering and debouncing
  private userAudioBuffers: Map<string, { chunks: Buffer[], timer: NodeJS.Timeout | null, totalSamples: number }> = new Map();
  private readonly MIN_AUDIO_DURATION_MS = 500; // Reduced from 800ms - ignore very short bursts
  private readonly DEBOUNCE_MS = 800; // Reduced from 1500ms - faster response
  private readonly MIN_RMS_THRESHOLD = 400; // Reduced from 500 - slightly more sensitive
  private responseInProgress = false; // Track if bot is currently responding

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
    this.geminiClient.on("audio", (data: ArrayBuffer) => {
      // When we receive audio from Gemini, queue it for playback
      const buffer = Buffer.from(data);
      this.audioQueue.push(buffer);
      
      // Start playback as soon as we have some buffered audio (reduce latency)
      const MIN_BUFFER_CHUNKS = 2; // Start after receiving 2 chunks
      if (!this.isPlaying && this.audioQueue.length >= MIN_BUFFER_CHUNKS) {
        this.playNextAudio();
      }
    });

    this.geminiClient.on("error", (error) => {
      console.error("Gemini API error:", error);
    });

    this.geminiClient.on("close", () => {
      console.log("Gemini connection closed");
      this.isConnected = false;
    });

    this.geminiClient.on("open", () => {
      console.log("Gemini connection opened");
      this.isConnected = true;
    });

    this.geminiClient.on("interrupted", () => {
      console.log("⚠️ Gemini interrupted - someone spoke during response");
      // Don't immediately clear - let current audio finish unless it's been >2 seconds
      if (this.responseInProgress) {
        console.log("⏸️ Allowing current response to finish...");
      }
    });
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

    // Wait for the connection to be ready
    try {
      await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 30_000);
      console.log("✅ Voice connection established");
    } catch (error) {
      console.error("Failed to establish voice connection:", error);
      this.voiceConnection.destroy();
      throw error;
    }

    // Create audio player for output
    this.audioPlayer = createAudioPlayer();
    this.voiceConnection.subscribe(this.audioPlayer);

    // Listen for player state changes
    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (newState.status === 'idle' && oldState.status !== 'idle') {
        // Audio finished playing
        this.isPlaying = false;
        this.responseInProgress = false; // Response complete
        this.playNextAudio();
      }
    });

    this.audioPlayer.on('error', (error) => {
      console.error('Audio player error:', error);
      this.isPlaying = false;
      this.playNextAudio();
    });

    // Set up receiving audio from Discord users
    this.setupAudioReceiving();

    // Connect to Gemini
    await this.geminiClient.connect(this.model, {
      ...this.liveConfig,
      generationConfig: {
        ...this.liveConfig.generationConfig,
        responseModalities: [Modality.AUDIO],
      },
    });

    console.log("✅ Connected to Gemini API");
  }

  private setupAudioReceiving() {
    if (!this.voiceConnection) return;

    const receiver = this.voiceConnection.receiver;

    // Listen for users speaking
    receiver.speaking.on("start", (userId: string) => {
      console.log(`🎤 User ${userId} started speaking`);
      
      // Create audio stream for this user
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1200, // Reduced from 2500ms - 1.2s is good balance
        },
      });

      // Process the audio stream with debouncing
      this.processUserAudioDebounced(userId, audioStream);
    });
  }

  /**
   * Process audio with debouncing and noise filtering
   */
  private async processUserAudioDebounced(userId: string, audioStream: Readable) {
    try {
      // Get or create buffer for this user
      let userBuffer = this.userAudioBuffers.get(userId);
      if (!userBuffer) {
        userBuffer = { chunks: [], timer: null, totalSamples: 0 };
        this.userAudioBuffers.set(userId, userBuffer);
      }

      // Clear existing timer
      if (userBuffer.timer) {
        clearTimeout(userBuffer.timer);
      }

      // Discord sends Opus audio, we need to decode it to PCM
      const decoder = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      audioStream.pipe(decoder);

      decoder.on("data", (chunk: Buffer) => {
        userBuffer!.chunks.push(chunk);
        userBuffer!.totalSamples += chunk.length / 4; // 2 bytes per sample, 2 channels
      });

      decoder.on("end", async () => {
        if (userBuffer!.chunks.length === 0) return;

        // OPTIMIZATION: If bot is idle and not responding, process immediately with shorter debounce
        const debounceTime = this.isPlaying || this.responseInProgress 
          ? this.DEBOUNCE_MS // Full debounce if bot is talking
          : Math.min(this.DEBOUNCE_MS, 400); // Faster (400ms) if bot is idle

        // Set debounce timer - wait for user to finish speaking
        userBuffer!.timer = setTimeout(async () => {
          await this.processFinalAudio(userId);
        }, debounceTime);
      });

      decoder.on("error", (error: Error) => {
        console.error("Error decoding audio:", error);
      });
    } catch (error) {
      console.error("Error processing user audio:", error);
    }
  }

  /**
   * Process the final buffered audio after debounce period
   */
  private async processFinalAudio(userId: string) {
    const userBuffer = this.userAudioBuffers.get(userId);
    if (!userBuffer || userBuffer.chunks.length === 0) return;

    try {
      // Combine all chunks
      const fullBuffer = Buffer.concat(userBuffer.chunks);
      
      // Calculate audio duration
      const durationMs = (userBuffer.totalSamples / 48000) * 1000;
      
      // Filter out very short audio (likely noise/false triggers)
      if (durationMs < this.MIN_AUDIO_DURATION_MS) {
        console.log(`⚠️ Ignoring short audio from user ${userId} (${durationMs.toFixed(0)}ms)`);
        this.userAudioBuffers.delete(userId);
        return;
      }

      // Calculate RMS (volume) to filter quiet background noise
      const rms = this.calculateRMS(fullBuffer);
      if (rms < this.MIN_RMS_THRESHOLD) {
        console.log(`⚠️ Ignoring quiet audio from user ${userId} (RMS: ${rms.toFixed(0)})`);
        this.userAudioBuffers.delete(userId);
        return;
      }

      console.log(`✅ Processing ${durationMs.toFixed(0)}ms of audio from user ${userId} (RMS: ${rms.toFixed(0)})`);
      
      // Convert to the format Gemini expects (16kHz, mono, PCM16)
      const processedAudio = await this.audioProcessor.convertDiscordToGemini(fullBuffer);

      // Send to Gemini
      this.geminiClient.sendRealtimeInput([
        {
          mimeType: "audio/pcm",
          data: processedAudio,
        },
      ]);

      console.log(`📤 Sent ${processedAudio.length} bytes of audio to Gemini`);
      
      // Mark that we're expecting a response
      this.responseInProgress = true;

    } catch (error) {
      console.error("Error processing final audio:", error);
    } finally {
      // Clear the buffer
      this.userAudioBuffers.delete(userId);
    }
  }

  /**
   * Calculate RMS (Root Mean Square) volume of audio
   */
  private calculateRMS(buffer: Buffer): number {
    let sum = 0;
    const samples = buffer.length / 4; // 2 bytes per sample, 2 channels
    
    for (let i = 0; i < buffer.length; i += 4) {
      const left = buffer.readInt16LE(i);
      const right = buffer.readInt16LE(i + 2);
      const avg = (left + right) / 2;
      sum += avg * avg;
    }
    
    return Math.sqrt(sum / samples);
  }

  /**
   * IMPROVED: Buffer audio chunks and play as continuous stream
   */
  private async playNextAudio() {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioPlayer) {
      return;
    }

    this.isPlaying = true;

    try {
      // Collect all queued audio chunks into one continuous buffer
      const allChunks: Buffer[] = [];
      while (this.audioQueue.length > 0) {
        const geminiAudioChunk = this.audioQueue.shift()!;
        
        // Convert each Gemini chunk (24kHz mono) to Discord format (48kHz stereo)
        const discordAudio = this.audioProcessor.convertGeminiToDiscord(
          new Uint8Array(geminiAudioChunk)
        );
        
        allChunks.push(discordAudio);
      }

      // Concatenate all chunks into one continuous buffer
      const continuousAudio = Buffer.concat(allChunks);
      
      console.log(`🔊 Playing ${continuousAudio.length} bytes of continuous audio in Discord`);

      // CRITICAL: Create a proper continuous Opus stream for Discord
      const encoder = new prism.opus.Encoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      // Create a readable stream that pushes data in proper chunks
      const CHUNK_SIZE = 3840; // 960 samples * 2 channels * 2 bytes = 3840 bytes per frame
      let offset = 0;

      const pcmStream = new Readable({
        read() {
          if (offset < continuousAudio.length) {
            const chunk = continuousAudio.slice(offset, Math.min(offset + CHUNK_SIZE, continuousAudio.length));
            this.push(chunk);
            offset += CHUNK_SIZE;
          } else {
            this.push(null); // End the stream
          }
        }
      });

      // Pipe PCM through Opus encoder
      const opusStream = pcmStream.pipe(encoder);

      // Create audio resource with proper type
      const resource = createAudioResource(opusStream, {
        inputType: StreamType.Opus,
        inlineVolume: true,
      });

      // Play the audio
      this.audioPlayer.play(resource);
      
      console.log(`🔊 Playing response (response in progress: ${this.responseInProgress})`);
    } catch (error) {
      console.error("Error playing audio in Discord:", error);
      this.isPlaying = false;
      this.responseInProgress = false;
      // Try to play next chunk
      this.playNextAudio();
    }
  }

  public disconnect() {
    // Clear audio queue
    this.audioQueue = [];
    this.isPlaying = false;
    this.responseInProgress = false;
    
    // Clear all user audio buffers and timers
    for (const buffer of this.userAudioBuffers.values()) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
    }
    this.userAudioBuffers.clear();

    // Disconnect from Gemini
    if (this.geminiClient) {
      this.geminiClient.disconnect();
    }

    // Stop the audio player
    if (this.audioPlayer) {
      this.audioPlayer.stop();
    }

    // Destroy the voice connection
    if (this.voiceConnection) {
      this.voiceConnection.destroy();
    }

    this.isConnected = false;
    console.log("👋 Disconnected from voice channel and Gemini");
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
    return this.isConnected && this.voiceConnection?.state.status === VoiceConnectionStatus.Ready;
  }
}
