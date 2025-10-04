/**
 * Audio processing utilities for converting between Discord and Gemini formats
 * Discord: 48kHz stereo Opus -> PCM
 * Gemini: 16kHz or 24kHz mono PCM16
 */

import * as prism from "prism-media";
import { Transform } from "stream";

export class DiscordAudioProcessor {
  // Discord outputs 48kHz stereo PCM, Gemini expects 16kHz mono PCM16
  private readonly DISCORD_SAMPLE_RATE = 48000;
  private readonly GEMINI_SAMPLE_RATE = 16000;
  private readonly DISCORD_CHANNELS = 2;
  private readonly GEMINI_CHANNELS = 1;

  /**
   * Convert Discord audio (48kHz stereo PCM) to Gemini format (16kHz mono PCM16)
   * Returns base64 encoded string
   */
  public async convertDiscordToGemini(discordBuffer: Buffer): Promise<string> {
    try {
      // Convert stereo to mono by averaging channels
      const monoBuffer = this.stereoToMono(discordBuffer);

      // Downsample from 48kHz to 16kHz
      const downsampledBuffer = this.resample(
        monoBuffer,
        this.DISCORD_SAMPLE_RATE,
        this.GEMINI_SAMPLE_RATE
      );

      // Convert to base64
      return downsampledBuffer.toString("base64");
    } catch (error) {
      console.error("Error converting Discord audio to Gemini format:", error);
      throw error;
    }
  }

  /**
   * Convert Gemini audio (16kHz or 24kHz mono PCM16) to Discord format
   * Returns buffer ready for Opus encoding
   */
  public convertGeminiToDiscord(geminiAudio: Uint8Array): Buffer {
    try {
      // Gemini sends 24kHz mono PCM16
      const geminiSampleRate = 24000;
      
      // Convert to Buffer
      const buffer = Buffer.from(geminiAudio);

      // Upsample to 48kHz
      const upsampled = this.resample(buffer, geminiSampleRate, this.DISCORD_SAMPLE_RATE);

      // Convert mono to stereo (duplicate channel)
      const stereoBuffer = this.monoToStereo(upsampled);

      return stereoBuffer;
    } catch (error) {
      console.error("Error converting Gemini audio to Discord format:", error);
      throw error;
    }
  }

  /**
   * Convert stereo PCM16 to mono by averaging both channels
   */
  private stereoToMono(stereoBuffer: Buffer): Buffer {
    const monoBuffer = Buffer.alloc(stereoBuffer.length / 2);
    
    for (let i = 0; i < monoBuffer.length; i += 2) {
      const stereoIndex = i * 2;
      
      // Read left and right channels (16-bit samples)
      const left = stereoBuffer.readInt16LE(stereoIndex);
      const right = stereoBuffer.readInt16LE(stereoIndex + 2);
      
      // Average the channels
      const mono = Math.floor((left + right) / 2);
      
      // Write to mono buffer
      monoBuffer.writeInt16LE(mono, i);
    }
    
    return monoBuffer;
  }

  /**
   * Convert mono PCM16 to stereo by duplicating the channel
   */
  private monoToStereo(monoBuffer: Buffer): Buffer {
    const stereoBuffer = Buffer.alloc(monoBuffer.length * 2);
    
    for (let i = 0; i < monoBuffer.length; i += 2) {
      const sample = monoBuffer.readInt16LE(i);
      
      // Write same sample to both left and right channels
      stereoBuffer.writeInt16LE(sample, i * 2);
      stereoBuffer.writeInt16LE(sample, i * 2 + 2);
    }
    
    return stereoBuffer;
  }

  /**
   * Simple linear interpolation resampling
   * For production, consider using a proper resampling library
   */
  private resample(
    inputBuffer: Buffer,
    inputRate: number,
    outputRate: number
  ): Buffer {
    const ratio = outputRate / inputRate;
    const inputSamples = inputBuffer.length / 2; // 16-bit samples
    const outputSamples = Math.floor(inputSamples * ratio);
    const outputBuffer = Buffer.alloc(outputSamples * 2);

    for (let i = 0; i < outputSamples; i++) {
      const inputIndex = i / ratio;
      const inputIndexFloor = Math.floor(inputIndex);
      const inputIndexCeil = Math.min(inputIndexFloor + 1, inputSamples - 1);
      const fraction = inputIndex - inputIndexFloor;

      // Linear interpolation
      const sample1 = inputBuffer.readInt16LE(inputIndexFloor * 2);
      const sample2 = inputBuffer.readInt16LE(inputIndexCeil * 2);
      const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction);

      outputBuffer.writeInt16LE(interpolated, i * 2);
    }

    return outputBuffer;
  }

  /**
   * Encode PCM to Opus for Discord
   */
  public async encodePCMToOpus(pcmBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const encoder = new prism.opus.Encoder({
        rate: this.DISCORD_SAMPLE_RATE,
        channels: this.DISCORD_CHANNELS,
        frameSize: 960,
      });

      const chunks: Buffer[] = [];

      encoder.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      encoder.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      encoder.on("error", (error: Error) => {
        reject(error);
      });

      encoder.write(pcmBuffer);
      encoder.end();
    });
  }

  /**
   * Decode Opus to PCM from Discord
   */
  public async decodeOpusToPCM(opusBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const decoder = new prism.opus.Decoder({
        rate: this.DISCORD_SAMPLE_RATE,
        channels: this.DISCORD_CHANNELS,
        frameSize: 960,
      });

      const chunks: Buffer[] = [];

      decoder.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      decoder.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      decoder.on("error", (error: Error) => {
        reject(error);
      });

      decoder.write(opusBuffer);
      decoder.end();
    });
  }
}
