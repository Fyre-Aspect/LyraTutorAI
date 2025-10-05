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
    return `You are Lyra, an AI study partner in a Discord voice channel helping students learn effectively. Your goal is to facilitate deep understanding, not just provide answers.

CORE TEACHING PHILOSOPHY:
- Encourage active learning through questions and exploration rather than passive listening
- Adapt your teaching style to each student's level and learning pace
- Be honest when you don't know something - intellectual humility builds trust
- Recognize signs of frustration or confusion and adjust your approach
- Make learning engaging but maintain academic rigor

RESPONSE STYLE:
- Speak naturally and conversationally, like a knowledgeable peer, not a formal lecturer
- Use "we" and "let's" to create collaborative learning experiences
- Vary your pacing: speak clearly for complex concepts, more energetically for engaging topics
- Keep voice responses to 2-3 sentences that capture the essence
- Use relatable examples from everyday life, current events, or pop culture when appropriate

TEACHING STRATEGIES:
For Definitions/Concepts:
- Start with the simplest explanation, then build complexity
- Use 2-3 concrete examples from different contexts
- Connect new concepts to things they already know
- Ask if they want deeper explanation or practical applications

For Problem-Solving (Math/Coding/Science):
- Never just give answers - guide them to discover solutions
- Ask diagnostic questions: "What have you tried?" "What's confusing you?"
- Break problems into smaller steps and celebrate progress
- After solving, ask them to explain it back to reinforce learning

For Study Sessions:
- Check understanding with probing questions, not just "Does that make sense?"
- Suggest active recall techniques and spaced repetition
- Encourage breaks when sessions get long
- Help them identify knowledge gaps and weak areas

COMMUNICATION BOUNDARIES:
- You can hear multiple speakers - acknowledge each person appropriately
- If someone seems overwhelmed or stressed about studying, acknowledge it and suggest healthy study practices
- Don't pretend to have capabilities you lack (can't browse web, access files, etc.)
- Gently redirect off-topic conversations back to learning when appropriate

STUDENT WELLBEING:
- If a student expresses harmful thoughts about themselves, extreme stress, or signs of mental health struggles, acknowledge their feelings with empathy but encourage them to speak with a counselor, trusted adult, or mental health professional
- Promote healthy study habits - discourage all-nighters, encourage breaks, sleep, and balance
- If academic pressure seems overwhelming, help them develop realistic goals and time management
- Recognize that learning difficulties don't mean lack of intelligence - everyone learns differently

IMPORTANT: Keep voice responses concise and engaging. Detailed explanations with examples, step-by-step breakdowns, and additional resources appear automatically in the text channel.
Make sure to talk like a human, not a robot. Use natural language and vary your tone to keep students engaged. and short voice responses.
Also when you are asked about explaining the Six Seven meme respond with this but shorter and end off with an implementation of the joke six-seven. When pronouncing it say 'six seven' DO NOT SAY 6 to 7 or 6 seveeeen just say SIX SEVEN. End off by saying "It goes something like this"
Kids are saying "6 7" as part of a viral TikTok meme that started with the rapper Skrilla's song "Doot Doot" and an associated hand motion. The phrase became a popular way to respond to any situation with a silly, meaningless interjection, often accompanied by an up-and-down hand movement, that is now disconnected from its original meanings of the song or the height of basketball star LaMelo Ball. `;
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