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
import { Readable, PassThrough } from "stream";
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
      
      if (!this.isPlaying) {
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
      console.log("Gemini interrupted - clearing audio queue");
      this.audioQueue = [];
      this.audioPlayer?.stop();
      this.isPlaying = false;
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
          duration: 1000, // 1 second of silence
        },
      });

      // Process the audio stream
      this.processUserAudio(userId, audioStream);
    });
  }

  private async processUserAudio(userId: string, audioStream: Readable) {
    try {
      // Discord sends Opus audio, we need to decode it to PCM
      const decoder = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      // Pipe the audio through the decoder
      audioStream.pipe(decoder);

      const chunks: Buffer[] = [];

      decoder.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      decoder.on("end", async () => {
        if (chunks.length === 0) return;

        // Combine all chunks
        const fullBuffer = Buffer.concat(chunks);
        
        // Convert to the format Gemini expects (16kHz, mono, PCM16)
        const processedAudio = await this.audioProcessor.convertDiscordToGemini(
          fullBuffer
        );

        // Send to Gemini
        this.geminiClient.sendRealtimeInput([
          {
            mimeType: "audio/pcm",
            data: processedAudio,
          },
        ]);

        console.log(`📤 Sent ${processedAudio.length} bytes of audio to Gemini`);
      });

      decoder.on("error", (error: Error) => {
        console.error("Error decoding audio:", error);
      });
    } catch (error) {
      console.error("Error processing user audio:", error);
    }
  }

  /**
   * CRITICAL FIX: Properly play audio from Gemini
   * The issue was creating individual streams per chunk instead of queueing
   */
  private async playNextAudio() {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioPlayer) {
      return;
    }

    this.isPlaying = true;

    try {
      // Get the next audio chunk from queue
      const geminiAudioChunk = this.audioQueue.shift()!;
      
      // Convert Gemini's PCM16 audio (24kHz mono) to Discord format (48kHz stereo)
      const discordAudio = this.audioProcessor.convertGeminiToDiscord(
        new Uint8Array(geminiAudioChunk)
      );

      // CRITICAL: Create a proper Opus stream for Discord
      const encoder = new prism.opus.Encoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      // Create a readable stream from the PCM data
      const pcmStream = new Readable({
        read() {
          this.push(discordAudio);
          this.push(null); // End the stream
        }
      });

      // Pipe PCM through Opus encoder
      const opusStream = pcmStream.pipe(encoder);

      // Create audio resource with proper type
      const resource = createAudioResource(opusStream, {
        inputType: StreamType.Opus,
      });

      // Play the audio
      this.audioPlayer.play(resource);

      console.log(`🔊 Playing ${discordAudio.length} bytes of audio in Discord`);
    } catch (error) {
      console.error("Error playing audio in Discord:", error);
      this.isPlaying = false;
      // Try to play next chunk
      this.playNextAudio();
    }
  }

  public disconnect() {
    // Clear audio queue
    this.audioQueue = [];
    this.isPlaying = false;

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
