import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * GeminiTranscriber class handles real-time speech-to-text using Gemini Live API
 */
export class GeminiTranscriber {
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.session = null;
    this.isConnected = false;
    this.responseQueue = [];
    this.onTranscriptionCallback = null;
  }

  /**
   * Connect to Gemini Live API
   */
  async connect() {
    if (this.isConnected) return;

    try {
      console.log('🔗 Connecting to Gemini Live API...');

      const model = 'gemini-live-2.5-flash-preview';
      const config = {
        responseModalities: [Modality.TEXT], // We want text responses
        systemInstruction: 'You are a speech-to-text transcriber. Simply transcribe what the user says, word for word. Do not add commentary.',
      };

      this.session = await this.ai.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            console.log('✅ Connected to Gemini Live API');
            this.isConnected = true;
          },
          onmessage: (message) => {
            this.handleMessage(message);
          },
          onerror: (error) => {
            console.error('❌ Gemini API error:', error.message);
          },
          onclose: (event) => {
            console.log('🔌 Disconnected from Gemini Live API:', event.reason);
            this.isConnected = false;
          },
        },
        config: config,
      });

      console.log('✅ Gemini Live API session established');
    } catch (error) {
      console.error('Failed to connect to Gemini:', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages from Gemini
   */
  handleMessage(message) {
    // Check for text response (transcription)
    if (message.text) {
      const transcription = message.text;
      console.log('📝 Transcription:', transcription);
      
      if (this.onTranscriptionCallback) {
        this.onTranscriptionCallback(transcription);
      }
      return; // Found transcription, exit early
    }

    // Check for server content
    if (message.serverContent) {
      // Check for model turn with text
      if (message.serverContent.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.text) {
            console.log('📝 Model turn text:', part.text);
            if (this.onTranscriptionCallback) {
              this.onTranscriptionCallback(part.text);
            }
            return; // Found transcription, exit early
          }
        }
      }

      // Check if turn is complete
      if (message.serverContent.turnComplete) {
        console.log('✅ Turn complete');
      }

      // Log setup complete (only once)
      if (message.setupComplete) {
        console.log('✅ Gemini setup complete');
      }
    }

    // If we didn't find any text, log the message structure for debugging
    if (!message.text && !message.serverContent?.modelTurn && !message.setupComplete && !message.serverContent?.turnComplete) {
      console.log('⚠️ Unknown message from Gemini:', JSON.stringify(message, null, 2));
    }
  }

  /**
   * Send audio data to Gemini for transcription
   * @param {Buffer} audioBuffer - PCM audio buffer (16kHz, mono, 16-bit)
   */
  async transcribeAudio(audioBuffer) {
    if (!this.isConnected || !this.session) {
      console.error('❌ Not connected to Gemini API');
      return null;
    }

    // Skip very small audio buffers
    if (audioBuffer.length < 1000) {
      console.log(`⚠️ Skipping audio < 1000 bytes (got ${audioBuffer.length})`);
      return null;
    }

    try {
      // Convert buffer to base64
      const base64Audio = audioBuffer.toString('base64');

      console.log(`📤 Sending ${audioBuffer.length} bytes of audio to Gemini...`);

      // Try using the send method with audio in parts
      await this.session.send({
        parts: [
          { text: 'Transcribe this audio:' },
          { 
            inlineData: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Audio
            }
          }
        ]
      });

      console.log('📤 Sent audio to Gemini for transcription');
    } catch (error) {
      console.error('Error transcribing audio:', error);
      console.error('Error details:', error.stack);
      return null;
    }
  }

  /**
   * Set callback for transcription results
   */
  onTranscription(callback) {
    this.onTranscriptionCallback = callback;
  }

  /**
   * Disconnect from Gemini Live API
   */
  async disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
      this.isConnected = false;
      console.log('👋 Disconnected from Gemini API');
    }
  }
}
