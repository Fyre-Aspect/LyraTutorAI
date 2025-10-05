/**
 * Quiz Manager for Discord Bot
 * Uses Gemini 2.5 Flash for generating quiz questions and evaluating answers
 */

import { GoogleGenAI } from "@google/genai";

interface QuizSession {
  topic: string;
  userId: string;
  channelId: string;
  conversationHistory: Array<{ role: "user" | "model"; text: string }>;
  currentQuestion: string;
  questionsAsked: number;
  correctAnswers: number;
  startTime: Date;
  lastMessageId?: string;
}

export class QuizManager {
  private genAI: GoogleGenAI;
  private activeSessions: Map<string, QuizSession> = new Map();
  private readonly MAX_QUESTIONS = 10;
  private readonly SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  constructor(apiKey: string) {
    this.genAI = new GoogleGenAI({ apiKey });
  }

  /**
   * Start a new quiz session
   */
  public async startQuiz(
    userId: string,
    channelId: string,
    topic: string
  ): Promise<string> {
    const sessionKey = this.getSessionKey(userId, channelId);

    // Check if user already has an active session
    if (this.activeSessions.has(sessionKey)) {
      return "⚠️ You already have an active quiz! Reply to my questions or use `!lyra quiz end` to end it.";
    }

    try {
      // Initialize session
      const session: QuizSession = {
        topic,
        userId,
        channelId,
        conversationHistory: [],
        currentQuestion: "",
        questionsAsked: 0,
        correctAnswers: 0,
        startTime: new Date(),
      };

      // Generate first question
      const systemPrompt = `You are a quiz master. Create engaging, educational quiz questions about "${topic}". 
- Ask ONE question at a time
- Provide clear, concise questions
- After the user answers, evaluate their answer and provide feedback
- If correct, acknowledge it and ask the next question
- If incorrect, provide the correct answer and explanation, then ask the next question
- Keep questions at an appropriate difficulty level
- Vary question types (multiple choice, true/false, short answer)
- After ${this.MAX_QUESTIONS} questions, provide a final score summary

Start by asking the first question about "${topic}". Be friendly and encouraging!`;

      const firstQuestionPrompt = `Generate the first quiz question about "${topic}". Just provide the question, nothing else.`;

      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "user", parts: [{ text: firstQuestionPrompt }] },
        ],
      });

      const questionText =
        response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Error generating question.";

      session.currentQuestion = questionText;
      session.questionsAsked = 1;
      session.conversationHistory.push({
        role: "model",
        text: questionText,
      });

      this.activeSessions.set(sessionKey, session);

      // Set timeout to auto-cleanup session
      setTimeout(() => {
        if (this.activeSessions.has(sessionKey)) {
          this.endQuiz(userId, channelId);
        }
      }, this.SESSION_TIMEOUT);

      return `🎯 **Quiz Started: ${topic}**\n\n**Question 1/${this.MAX_QUESTIONS}:**\n${questionText}\n\n*Reply to this message with your answer!*`;
    } catch (error) {
      console.error("Error starting quiz:", error);
      return "❌ Failed to start quiz. Please try again.";
    }
  }

  /**
   * Handle user's answer to a quiz question
   */
  public async handleAnswer(
    userId: string,
    channelId: string,
    answer: string
  ): Promise<string | null> {
    const sessionKey = this.getSessionKey(userId, channelId);
    const session = this.activeSessions.get(sessionKey);

    if (!session) {
      return null; // No active session
    }

    try {
      // Add user's answer to conversation history
      session.conversationHistory.push({
        role: "user",
        text: answer,
      });

      // Check if quiz should end
      if (session.questionsAsked >= this.MAX_QUESTIONS) {
        return await this.generateFinalScore(session);
      }

      // Generate response from Gemini
      const conversationForAPI = session.conversationHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      }));

      const systemContext = `You are evaluating an answer in a quiz about "${session.topic}". 
Current question number: ${session.questionsAsked}/${this.MAX_QUESTIONS}
Previous question was: "${session.currentQuestion}"

Instructions:
1. Evaluate if the answer is correct
2. Provide brief feedback (1-2 sentences)
3. If incorrect, give the correct answer
4. Then ask the NEXT question
5. Keep it concise and engaging
6. Do NOT repeat the question number in your response (it will be added automatically)

Format your response as:
[Feedback on their answer]

[Next question]`;

      conversationForAPI.unshift({
        role: "user",
        parts: [{ text: systemContext }],
      });

      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: conversationForAPI,
      });

      const responseText =
        response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Error generating response.";

      // Update session
      session.conversationHistory.push({
        role: "model",
        text: responseText,
      });
      session.questionsAsked++;

      // Check if answer was correct (basic heuristic)
      const wasCorrect =
        responseText.toLowerCase().includes("correct") ||
        responseText.toLowerCase().includes("right") ||
        responseText.toLowerCase().includes("yes") ||
        responseText.toLowerCase().includes("well done") ||
        responseText.toLowerCase().includes("exactly");

      if (wasCorrect && !responseText.toLowerCase().includes("incorrect")) {
        session.correctAnswers++;
      }

      // Format response with question number
      const questionNum = Math.min(session.questionsAsked + 1, this.MAX_QUESTIONS);
      const formattedResponse = `${responseText}\n\n**Question ${questionNum}/${this.MAX_QUESTIONS}:**`;

      return formattedResponse;
    } catch (error) {
      console.error("Error handling quiz answer:", error);
      return "❌ Error processing your answer. Please try again.";
    }
  }

  /**
   * Generate final score and end quiz
   */
  private async generateFinalScore(session: QuizSession): Promise<string> {
    const duration = Date.now() - session.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    const sessionKey = this.getSessionKey(session.userId, session.channelId);
    this.activeSessions.delete(sessionKey);

    const percentage = Math.round(
      (session.correctAnswers / this.MAX_QUESTIONS) * 100
    );
    let grade = "📊";
    if (percentage >= 90) grade = "🏆";
    else if (percentage >= 80) grade = "🌟";
    else if (percentage >= 70) grade = "✅";
    else if (percentage >= 60) grade = "👍";

    return `${grade} **Quiz Complete!**\n\n**Topic:** ${session.topic}\n**Score:** ${session.correctAnswers}/${this.MAX_QUESTIONS} (${percentage}%)\n**Time:** ${minutes}m ${seconds}s\n\n*Great job! Use \`!lyra quiz [topic]\` to start a new quiz.*`;
  }

  /**
   * End an active quiz session
   */
  public endQuiz(userId: string, channelId: string): string {
    const sessionKey = this.getSessionKey(userId, channelId);
    const session = this.activeSessions.get(sessionKey);

    if (!session) {
      return "❌ You don't have an active quiz session.";
    }

    const score = `${session.correctAnswers}/${session.questionsAsked}`;
    this.activeSessions.delete(sessionKey);

    return `🛑 **Quiz Ended**\n\nYou answered ${score} questions correctly before ending the quiz.`;
  }

  /**
   * Check if user has an active session
   */
  public hasActiveSession(userId: string, channelId: string): boolean {
    return this.activeSessions.has(this.getSessionKey(userId, channelId));
  }

  /**
   * Get active session
   */
  public getSession(userId: string, channelId: string): QuizSession | undefined {
    return this.activeSessions.get(this.getSessionKey(userId, channelId));
  }

  /**
   * Generate unique session key
   */
  private getSessionKey(userId: string, channelId: string): string {
    return `${userId}-${channelId}`;
  }

  /**
   * Get number of active sessions
   */
  public getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Clean up expired sessions
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [key, session] of this.activeSessions.entries()) {
      if (now - session.startTime.getTime() > this.SESSION_TIMEOUT) {
        this.activeSessions.delete(key);
        console.log(`🧹 Cleaned up expired quiz session: ${key}`);
      }
    }
  }
}
