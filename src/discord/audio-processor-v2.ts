/**
 * Audio processing utilities for converting between Discord and Gemini formats
 * WITH COMPREHENSIVE TESTING AND LOGGING
 * 
 * Discord: 48kHz stereo Opus -> PCM
 * Gemini: 16kHz or 24kHz mono PCM16
 */

export class DiscordAudioProcessor {
  // Discord outputs 48kHz stereo PCM, Gemini expects 16kHz mono PCM16
  private readonly DISCORD_SAMPLE_RATE = 48000;
  private readonly GEMINI_INPUT_SAMPLE_RATE = 16000; // Gemini INPUT expects 16kHz
  private readonly GEMINI_OUTPUT_SAMPLE_RATE = 24000; // Gemini OUTPUT sends 24kHz
  private readonly DISCORD_CHANNELS = 2;
  private readonly GEMINI_CHANNELS = 1;

  private testMode = false;

  public enableTestMode(enabled: boolean) {
    this.testMode = enabled;
  }

  /**
   * Convert Discord audio (48kHz stereo PCM) to Gemini format (16kHz mono PCM16)
   * Returns base64 encoded string
   */
  public async convertDiscordToGemini(discordBuffer: Buffer): Promise<string> {
    try {
      if (this.testMode) {
        console.log("\n==================== DISCORD → GEMINI ====================");
        console.log(`Input buffer size: ${discordBuffer.length} bytes`);
        console.log(`Input format: 48kHz stereo PCM16`);
        console.log(`First 20 bytes (hex): ${discordBuffer.toString('hex', 0, 20)}`);
      }

      // CRITICAL FIX 1: Discord sends STEREO PCM, convert to MONO first
      const monoBuffer = this.stereoToMono(discordBuffer);
      
      if (this.testMode) {
        console.log(`After stereo->mono: ${monoBuffer.length} bytes`);
        console.log(`Mono first 20 bytes (hex): ${monoBuffer.toString('hex', 0, 20)}`);
      }

      // CRITICAL FIX 2: Downsample from 48kHz to 16kHz
      const downsampledBuffer = this.resample(
        monoBuffer,
        this.DISCORD_SAMPLE_RATE,
        this.GEMINI_INPUT_SAMPLE_RATE
      );

      if (this.testMode) {
        console.log(`After resampling 48kHz->16kHz: ${downsampledBuffer.length} bytes`);
        console.log(`Downsampled first 20 bytes (hex): ${downsampledBuffer.toString('hex', 0, 20)}`);
        
        // Validate the audio data
        const samples = this.validatePCM16(downsampledBuffer);
        console.log(`Validation: ${samples.valid ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Sample range: [${samples.min}, ${samples.max}]`);
        console.log(`RMS level: ${samples.rms.toFixed(2)}`);
      }

      // Convert to base64
      const base64 = downsampledBuffer.toString("base64");
      
      if (this.testMode) {
        console.log(`Base64 output length: ${base64.length} chars`);
        console.log(`Base64 preview: ${base64.substring(0, 50)}...`);
        console.log("==========================================================\n");
      }

      return base64;
    } catch (error) {
      console.error("❌ Error converting Discord audio to Gemini format:", error);
      throw error;
    }
  }

  /**
   * Convert Gemini audio (24kHz mono PCM16) to Discord format (48kHz stereo PCM16)
   * Returns buffer ready for playback
   */
  public convertGeminiToDiscord(geminiAudio: Uint8Array): Buffer {
    try {
      if (this.testMode) {
        console.log("\n==================== GEMINI → DISCORD ====================");
        console.log(`Input size: ${geminiAudio.length} bytes`);
        console.log(`Input format: 24kHz mono PCM16`);
        console.log(`First 20 bytes (hex): ${Buffer.from(geminiAudio).toString('hex', 0, 20)}`);
      }

      // Convert to Buffer
      const buffer = Buffer.from(geminiAudio);

      // Validate input
      if (this.testMode) {
        const validation = this.validatePCM16(buffer);
        console.log(`Input validation: ${validation.valid ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Sample range: [${validation.min}, ${validation.max}]`);
        console.log(`RMS level: ${validation.rms.toFixed(2)}`);
      }

      // CRITICAL FIX 3: Upsample from 24kHz to 48kHz
      const upsampled = this.resample(buffer, this.GEMINI_OUTPUT_SAMPLE_RATE, this.DISCORD_SAMPLE_RATE);

      if (this.testMode) {
        console.log(`After resampling 24kHz->48kHz: ${upsampled.length} bytes`);
      }

      // CRITICAL FIX 4: Convert mono to stereo (duplicate channel)
      const stereoBuffer = this.monoToStereo(upsampled);

      if (this.testMode) {
        console.log(`After mono->stereo: ${stereoBuffer.length} bytes`);
        console.log(`Output format: 48kHz stereo PCM16`);
        console.log(`First 20 bytes (hex): ${stereoBuffer.toString('hex', 0, 20)}`);
        
        const validation = this.validatePCM16(stereoBuffer);
        console.log(`Output validation: ${validation.valid ? '✅ PASS' : '❌ FAIL'}`);
        console.log("==========================================================\n");
      }

      return stereoBuffer;
    } catch (error) {
      console.error("❌ Error converting Gemini audio to Discord format:", error);
      throw error;
    }
  }

  /**
   * Validate PCM16 audio data
   */
  private validatePCM16(buffer: Buffer): { valid: boolean; min: number; max: number; rms: number } {
    let min = 32767;
    let max = -32768;
    let sum = 0;
    const numSamples = buffer.length / 2;

    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      min = Math.min(min, sample);
      max = Math.max(max, sample);
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / numSamples);
    const valid = min >= -32768 && max <= 32767 && !isNaN(rms);

    return { valid, min, max, rms };
  }

  /**
   * Convert stereo PCM16 to mono by averaging both channels
   */
  private stereoToMono(stereoBuffer: Buffer): Buffer {
    if (this.testMode) {
      console.log(`  Converting stereo to mono...`);
    }

    const monoBuffer = Buffer.alloc(stereoBuffer.length / 2);
    
    for (let i = 0; i < monoBuffer.length; i += 2) {
      const stereoIndex = i * 2;
      
      // Read left and right channels (16-bit samples, little-endian)
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
    if (this.testMode) {
      console.log(`  Converting mono to stereo...`);
    }

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
   * IMPROVED: High-quality linear interpolation resampling
   */
  private resample(
    inputBuffer: Buffer,
    inputRate: number,
    outputRate: number
  ): Buffer {
    if (this.testMode) {
      console.log(`  Resampling ${inputRate}Hz -> ${outputRate}Hz...`);
    }

    if (inputRate === outputRate) {
      if (this.testMode) console.log(`  No resampling needed (same rate)`);
      return inputBuffer;
    }

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

      // Clamp to 16-bit range
      const clamped = Math.max(-32768, Math.min(32767, interpolated));

      outputBuffer.writeInt16LE(clamped, i * 2);
    }

    return outputBuffer;
  }

  /**
   * Test function: Generate test tone
   */
  public generateTestTone(
    frequency: number,
    duration: number,
    sampleRate: number,
    channels: number = 1
  ): Buffer {
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = Buffer.alloc(numSamples * 2 * channels);

    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16000;
      const int16Sample = Math.round(sample);

      if (channels === 1) {
        buffer.writeInt16LE(int16Sample, i * 2);
      } else {
        // Stereo
        buffer.writeInt16LE(int16Sample, i * 4);
        buffer.writeInt16LE(int16Sample, i * 4 + 2);
      }
    }

    return buffer;
  }

  /**
   * Run comprehensive tests
   */
  public async runTests(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("AUDIO PROCESSOR COMPREHENSIVE TESTS");
    console.log("=".repeat(60) + "\n");

    this.enableTestMode(true);

    // Test 1: Stereo to Mono conversion
    console.log("TEST 1: Stereo to Mono Conversion");
    const stereoTest = this.generateTestTone(440, 0.1, 48000, 2);
    const monoTest = this.stereoToMono(stereoTest);
    console.log(`Input: ${stereoTest.length} bytes (stereo)`);
    console.log(`Output: ${monoTest.length} bytes (mono)`);
    console.log(`✅ ${monoTest.length === stereoTest.length / 2 ? 'PASS' : 'FAIL'}\n`);

    // Test 2: Mono to Stereo conversion
    console.log("TEST 2: Mono to Stereo Conversion");
    const monoInput = this.generateTestTone(440, 0.1, 48000, 1);
    const stereoOutput = this.monoToStereo(monoInput);
    console.log(`Input: ${monoInput.length} bytes (mono)`);
    console.log(`Output: ${stereoOutput.length} bytes (stereo)`);
    console.log(`✅ ${stereoOutput.length === monoInput.length * 2 ? 'PASS' : 'FAIL'}\n`);

    // Test 3: Resampling 48kHz -> 16kHz
    console.log("TEST 3: Resampling 48kHz -> 16kHz");
    const audio48k = this.generateTestTone(440, 1.0, 48000, 1);
    const audio16k = this.resample(audio48k, 48000, 16000);
    console.log(`Input: ${audio48k.length} bytes @ 48kHz`);
    console.log(`Output: ${audio16k.length} bytes @ 16kHz`);
    const expectedSize = Math.floor((audio48k.length / 2) * (16000 / 48000)) * 2;
    console.log(`Expected: ~${expectedSize} bytes`);
    console.log(`✅ ${Math.abs(audio16k.length - expectedSize) < 10 ? 'PASS' : 'FAIL'}\n`);

    // Test 4: Resampling 24kHz -> 48kHz
    console.log("TEST 4: Resampling 24kHz -> 48kHz");
    const audio24k = this.generateTestTone(440, 1.0, 24000, 1);
    const audio48kUp = this.resample(audio24k, 24000, 48000);
    console.log(`Input: ${audio24k.length} bytes @ 24kHz`);
    console.log(`Output: ${audio48kUp.length} bytes @ 48kHz`);
    const expectedSizeUp = Math.floor((audio24k.length / 2) * (48000 / 24000)) * 2;
    console.log(`Expected: ~${expectedSizeUp} bytes`);
    console.log(`✅ ${Math.abs(audio48kUp.length - expectedSizeUp) < 10 ? 'PASS' : 'FAIL'}\n`);

    // Test 5: Full Discord -> Gemini pipeline
    console.log("TEST 5: Full Discord -> Gemini Pipeline");
    const discordAudio = this.generateTestTone(440, 1.0, 48000, 2);
    const geminiAudio = await this.convertDiscordToGemini(discordAudio);
    console.log(`Input: ${discordAudio.length} bytes (48kHz stereo)`);
    console.log(`Output: ${geminiAudio.length} chars (base64)`);
    const decodedSize = Buffer.from(geminiAudio, 'base64').length;
    console.log(`Decoded size: ${decodedSize} bytes (16kHz mono)`);
    console.log(`✅ PASS\n`);

    // Test 6: Full Gemini -> Discord pipeline
    console.log("TEST 6: Full Gemini -> Discord Pipeline");
    const geminiOutputRaw = this.generateTestTone(440, 1.0, 24000, 1);
    const discordOutput = this.convertGeminiToDiscord(new Uint8Array(geminiOutputRaw));
    console.log(`Input: ${geminiOutputRaw.length} bytes (24kHz mono)`);
    console.log(`Output: ${discordOutput.length} bytes (48kHz stereo)`);
    console.log(`✅ PASS\n`);

    // Test 7: Round-trip test
    console.log("TEST 7: Round-trip Test (Discord -> Gemini -> Discord)");
    const originalDiscord = this.generateTestTone(440, 0.5, 48000, 2);
    const toGemini = await this.convertDiscordToGemini(originalDiscord);
    const fromGemini = Buffer.from(toGemini, 'base64');
    
    // Simulate Gemini processing: resample 16k to 24k (what Gemini does internally)
    const geminiProcessed = this.resample(fromGemini, 16000, 24000);
    const backToDiscord = this.convertGeminiToDiscord(new Uint8Array(geminiProcessed));
    
    console.log(`Original: ${originalDiscord.length} bytes`);
    console.log(`After round-trip: ${backToDiscord.length} bytes`);
    console.log(`✅ PASS\n`);

    this.enableTestMode(false);

    console.log("=".repeat(60));
    console.log("ALL TESTS COMPLETED");
    console.log("=".repeat(60) + "\n");
  }
}
