# Quiz Feature Documentation

## Overview
The quiz feature allows users to take interactive quizzes on any topic using Lyra, your Discord bot. The quiz system uses **Gemini 2.5 Flash** for text generation and maintains conversation context throughout the quiz session.

## Features

### ✨ Core Capabilities
- **Dynamic Quiz Generation**: Ask for quizzes on any topic
- **Intelligent Evaluation**: Gemini evaluates answers and provides feedback
- **Conversation Context**: The bot remembers the entire quiz conversation
- **Reply-Based Interaction**: Users reply to Lyra's messages to submit answers
- **Auto-Cleanup**: Sessions expire after 15 minutes of inactivity
- **Score Tracking**: Tracks correct answers and provides final scores

### 📊 Quiz Flow
1. User starts a quiz with `!lyra quiz [topic]`
2. Lyra sends the first question
3. User replies to Lyra's message with their answer
4. Lyra evaluates the answer, provides feedback, and asks the next question
5. Process repeats for 10 questions
6. Final score summary is displayed

## Commands

### Start a Quiz
```
!lyra quiz [topic]
```
**Examples:**
- `!lyra quiz JavaScript`
- `!lyra quiz World History`
- `!lyra quiz Python Programming`
- `!lyra quiz Marine Biology`

### End a Quiz
```
!lyra quiz end
```
Ends your current active quiz session early.

## How It Works

### Architecture

#### QuizManager (`src/discord/quiz-manager.ts`)
- **Purpose**: Manages quiz sessions and Gemini API interactions
- **API Used**: `gemini-2.5-flash` (text generation model)
- **Session Management**: 
  - Tracks active sessions per user/channel
  - Maintains conversation history
  - Auto-cleanup after 15 minutes

#### Key Components:
1. **Session Storage**: `Map<string, QuizSession>`
   - Key: `${userId}-${channelId}`
   - Ensures one quiz per user per channel

2. **Conversation History**: Array of user/model messages
   - Maintains context throughout the quiz
   - Sent to Gemini with each answer for intelligent evaluation

3. **Score Tracking**:
   - Questions asked counter
   - Correct answers counter
   - Simple heuristic for detecting correct answers

### Message Flow

```
User: !lyra quiz JavaScript
  ↓
Bot: [Creates QuizSession, generates first question via Gemini]
  ↓
Bot: 🎯 Quiz Started: JavaScript
     Question 1/10:
     [Question text]
     *Reply to this message with your answer!*
  ↓
User: [Replies to bot's message] "Answer text"
  ↓
Bot: [Checks if reply is to bot's message]
  ↓
Bot: [Checks if user has active quiz session]
  ↓
Bot: [Sends answer + conversation history to Gemini]
  ↓
Bot: [Gemini evaluates and generates next question]
  ↓
Bot: [Feedback on answer]
     
     Question 2/10:
     [Next question]
  ↓
[Repeat for 10 questions]
  ↓
Bot: 🏆 Quiz Complete!
     
     Topic: JavaScript
     Score: 8/10 (80%)
     Time: 5m 23s
```

### Integration with Bot

The bot's message handler has special logic to detect quiz replies:

```typescript
// Check if message is a reply to bot's quiz message
if (message.reference?.messageId) {
  const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
  if (repliedMessage?.author.id === this.client.user?.id) {
    // Check if user has active quiz session
    const hasSession = this.quizManager.hasActiveSession(message.author.id, message.channel.id);
    if (hasSession) {
      // Handle quiz answer
      const response = await this.quizManager.handleAnswer(...);
      await message.reply(response);
      return; // Don't process as command
    }
  }
}
```

## Technical Details

### Gemini API Usage

**Model**: `gemini-2.5-flash`
- Fast text generation
- Separate from the Live API (voice) model
- Used specifically for quiz generation and evaluation

**API Calls**:
1. **Start Quiz**: Generates first question
   - System prompt defines quiz master role
   - Specifies question format and behavior
   
2. **Handle Answer**: Evaluates answer and generates next question
   - Sends full conversation history
   - Includes system context with instructions

### Session Management

**Session Object**:
```typescript
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
```

**Timeouts**:
- Session timeout: 15 minutes
- Cleanup interval: Every 5 minutes

### Score Grading

```typescript
🏆 90-100%  - Trophy
🌟 80-89%   - Star
✅ 70-79%   - Check mark
👍 60-69%   - Thumbs up
📊 0-59%    - Chart
```

## Configuration

### Environment Variables
The quiz feature uses the same `GEMINI_API_KEY` as the voice feature:

```env
GEMINI_API_KEY=your_api_key_here
BOT_PREFIX=!lyra  # Optional, defaults to !lyra
```

### Customization

You can customize the quiz settings in `quiz-manager.ts`:

```typescript
private readonly MAX_QUESTIONS = 10;  // Number of questions per quiz
private readonly SESSION_TIMEOUT = 15 * 60 * 1000;  // 15 minutes
```

## Error Handling

The quiz system handles several error cases:

1. **Already Active Quiz**: User is notified if they try to start a quiz while one is active
2. **No Topic Provided**: Usage instructions are shown
3. **API Errors**: Graceful error messages to user
4. **Session Expiry**: Automatic cleanup after timeout

## Usage Examples

### Example 1: JavaScript Quiz
```
User: !lyra quiz JavaScript
Bot: 🎯 Quiz Started: JavaScript
     
     Question 1/10:
     What is the difference between `let` and `const` in JavaScript?
     
     *Reply to this message with your answer!*

User: [Replies] "let can be reassigned, const cannot"
Bot: ✅ Correct! `let` allows reassignment while `const` creates a read-only reference.
     
     Question 2/10:
     What does the spread operator (...) do in JavaScript?
```

### Example 2: Ending Quiz Early
```
User: !lyra quiz end
Bot: 🛑 Quiz Ended
     
     You answered 3/5 questions correctly before ending the quiz.
```

## Best Practices

1. **Reply to Bot Messages**: Always reply to Lyra's quiz messages to submit answers
2. **One Quiz at a Time**: You can only have one active quiz per channel
3. **Clear Topics**: Provide specific, clear topics for better questions
4. **Natural Answers**: Answer in natural language; Gemini understands context

## Future Enhancements

Possible improvements:
- Difficulty levels (easy, medium, hard)
- Leaderboards
- Question types specification (multiple choice, true/false, etc.)
- Timed questions
- Team quizzes
- Quiz history and statistics
- Custom question pools
- Multi-language support

## Troubleshooting

**Quiz not starting?**
- Check if you have an active quiz: `!lyra quiz end`
- Verify the Gemini API key is set in `.env.local`

**Answers not being recognized?**
- Make sure you're **replying** to Lyra's message, not sending a new message
- Check if your quiz session expired (15 min timeout)

**Bot not responding?**
- Check console for errors
- Verify bot has message permissions in the channel
- Ensure `GEMINI_API_KEY` is valid
