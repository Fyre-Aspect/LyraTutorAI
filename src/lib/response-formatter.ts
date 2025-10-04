/**
 * Response Formatter for Lyra AI Study Partner
 * Formats AI responses into voice summaries and detailed text analysis
 */

// TypeScript type definitions for response formatting
export interface FormattedResponse {
  voiceSummary: string;
  detailedAnalysis: string;
  timestamp: number;
}

export class ResponseFormatter {
  /**
   * Formats a complete AI response into voice and text components
   * @param {string} fullResponse - Complete AI response from Gemini
   * @returns {{voiceSummary: string, detailedAnalysis: string, timestamp: number}}
   */
  static formatResponse(fullResponse: string): FormattedResponse {
    if (!fullResponse || typeof fullResponse !== 'string') {
      return {
        voiceSummary: '',
        detailedAnalysis: '',
        timestamp: Date.now()
      };
    }

    // Split markers that indicate where voice ends and detailed analysis begins
    const splitMarkers = [
      '---DETAILED ANALYSIS---',
      '---',
      'Detailed Analysis',
      'Detailed:',
      '[DETAILED]',
      '## Detailed',
      '# Detailed',
    ];

    let voiceSummary = fullResponse;
    let detailedAnalysis = fullResponse;
    let foundSplit = false;

    // Try to find natural split point
    for (const marker of splitMarkers) {
      const splitIndex = fullResponse.indexOf(marker);
      if (splitIndex !== -1) {
        voiceSummary = fullResponse.substring(0, splitIndex).trim();
        detailedAnalysis = fullResponse.substring(splitIndex).trim();
        foundSplit = true;
        console.log(`✂️ Split response using marker: "${marker}"`);
        break;
      }
    }

    // Fallback: If no marker found, use first 2-3 sentences for voice
    if (!foundSplit) {
      console.log('⚠️ No split marker found, using sentence-based split');
      const sentences = fullResponse.match(/[^.!?]+[.!?]+/g) || [fullResponse];
      
      if (sentences.length <= 3) {
        // Short response - use all as voice, repeat as detailed
        voiceSummary = fullResponse.trim();
        detailedAnalysis = fullResponse.trim();
      } else {
        // Longer response - first 3 sentences for voice, all for detailed
        voiceSummary = sentences.slice(0, 3).join(' ').trim();
        detailedAnalysis = fullResponse.trim();
      }
    }

    // Clean voice summary for natural speech
    voiceSummary = this.cleanForVoice(voiceSummary);

    console.log(`📊 Formatted response: voice=${voiceSummary.length} chars, detailed=${detailedAnalysis.length} chars`);

    return {
      voiceSummary,
      detailedAnalysis,
      timestamp: Date.now()
    };
  }

  /**
   * Cleans text for natural voice output (removes markdown, limits length)
   * @param {string} text - Text to clean
   * @returns {string} Cleaned text suitable for TTS
   */
  static cleanForVoice(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italics
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/`([^`]+)`/g, '$1') // Remove code formatting
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\n{2,}/g, '. ') // Replace multiple newlines with period
      .replace(/\n/g, ' ') // Replace single newlines with space
      .replace(/---DETAILED ANALYSIS---/gi, '') // Remove any leftover markers
      .trim()
      .substring(0, 800); // Limit to ~800 chars for reasonable TTS length
  }

  /**
   * Returns system prompt instructions for AI to format responses properly
   * @returns {string} System prompt for Gemini
   */
  static getSystemPrompt(): string {
    return `You are Lyra, an AI study partner joining a Discord voice call to help students learn collaboratively.

CRITICAL INSTRUCTION - Response Format:
When responding to questions or explaining concepts, you MUST structure your response in this exact format:

[First 2-3 sentences: Brief, conversational summary suitable for voice]

---DETAILED ANALYSIS---
[Comprehensive explanation with details, examples, and proper markdown formatting]

Example response:
"Great question! Photosynthesis is how plants convert sunlight into chemical energy using chlorophyll. They take in CO2 and water to produce glucose and oxygen. This process is essential for life on Earth.

---DETAILED ANALYSIS---
# Photosynthesis: Converting Light to Chemical Energy

## Overview
Photosynthesis is a complex biochemical process that occurs in plants, algae, and some bacteria. It's the foundation of most food chains on Earth.

## Key Components
- **Chlorophyll**: The green pigment that absorbs light energy
- **Thylakoids**: Membrane structures where light-dependent reactions occur
- **Stroma**: The fluid where the Calvin cycle takes place

## Chemical Equation
6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂

## Process Steps
1. Light-dependent reactions capture energy
2. Calvin cycle builds glucose molecules
3. Oxygen is released as a byproduct"

IMPORTANT RULES:
1. Keep the voice summary (before ---DETAILED ANALYSIS---) to 2-4 sentences maximum
2. Make voice summaries conversational and natural for speaking
3. Put ALL detailed information, examples, equations, and explanations AFTER the ---DETAILED ANALYSIS--- marker
4. Use proper markdown formatting in the detailed section (headers, lists, code blocks, etc.)
5. ALWAYS include the ---DETAILED ANALYSIS--- marker to separate the two sections

The system automatically:
- Speaks the brief summary via voice
- Posts the detailed analysis to the Discord text channel`;
  }

  /**
   * Validates if a response has proper formatting
   * @param {string} response - Response to validate
   * @returns {boolean} True if response appears to be formatted
   */
  static isFormatted(response: string): boolean {
    const markers = [
      '---DETAILED ANALYSIS---',
      '---',
      'Detailed Analysis',
      '[DETAILED]'
    ];
    return markers.some(marker => response.includes(marker));
  }
}