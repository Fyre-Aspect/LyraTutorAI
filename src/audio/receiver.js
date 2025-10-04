import { EndBehaviorType } from '@discordjs/voice';

/**
 * AudioReceiver class handles capturing and processing audio from Discord voice channels
 */
export class AudioReceiver {
  constructor(connection, guildId) {
    this.connection = connection;
    this.guildId = guildId;
    this.audioBuffers = new Map(); // Store audio buffers per user
    this.isListening = false;
  }

  /**
   * Start listening to voice channel audio
   * @param {Function} onAudioCallback - Callback function when audio chunk is ready
   */
  startListening(onAudioCallback) {
    if (this.isListening) return;
    
    this.isListening = true;
    console.log('🎤 Started listening to voice channel');

    const receiver = this.connection.receiver;

    // Listen for users speaking
    receiver.speaking.on('start', (userId) => {
      console.log(`👤 User ${userId} started speaking`);

      // Create an audio stream for this user (already provides PCM data)
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 2000, // Increased to 2 seconds of silence
        },
      });

      const chunks = [];

      // Collect audio chunks (these are already PCM, not Opus!)
      audioStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      audioStream.on('end', async () => {
        if (chunks.length === 0) return;

        // Concatenate all chunks (already PCM 48kHz stereo)
        const pcmBuffer = Buffer.concat(chunks);
        
        // Filter out tiny audio chunks (less than 0.5 seconds)
        const minBytes = 48000 * 2 * 2 * 0.5; // 48kHz * 2 channels * 2 bytes/sample * 0.5 seconds
        if (pcmBuffer.length < minBytes) {
          console.log(`⚠️ Skipping tiny audio chunk (${pcmBuffer.length} bytes, need ${minBytes})`);
          return;
        }

        console.log(`🔊 Received ${chunks.length} audio chunks (${pcmBuffer.length} bytes) from user ${userId}`);

        try {
          // Convert to 16kHz mono (Gemini requirement)
          const processedAudio = this.convertTo16kHzMono(pcmBuffer);
          
          console.log(`✨ Processed to ${processedAudio.length} bytes (16kHz mono)`);
          
          // Call the callback with processed audio
          if (onAudioCallback) {
            onAudioCallback(processedAudio, userId);
          }
        } catch (error) {
          console.error('Error processing audio:', error);
        }
      });

      audioStream.on('error', (error) => {
        console.error('Audio stream error:', error);
      });
    });
  }

  /**
   * Convert 48kHz stereo PCM to 16kHz mono PCM (Gemini requirement)
   */
  convertTo16kHzMono(pcmBuffer) {
    // Simple downsampling: take every 3rd sample (48000/16000 = 3)
    // And convert stereo to mono by averaging channels
    const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
    const monoSamples = [];

    for (let i = 0; i < samples.length; i += 6) { // 6 = 2 channels * 3 for downsampling
      if (i + 1 < samples.length) {
        // Average left and right channels
        const mono = Math.floor((samples[i] + samples[i + 1]) / 2);
        monoSamples.push(mono);
      }
    }

    // Convert back to buffer
    const outputBuffer = Buffer.allocUnsafe(monoSamples.length * 2);
    for (let i = 0; i < monoSamples.length; i++) {
      outputBuffer.writeInt16LE(monoSamples[i], i * 2);
    }

    return outputBuffer;
  }

  /**
   * Stop listening to voice channel
   */
  stopListening() {
    this.isListening = false;
    console.log('🔇 Stopped listening to voice channel');
  }
}
