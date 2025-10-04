# Function Calling (Tool Use) - send_chat_message

## Overview

The Discord bot now supports **function calling** (also called "tool use") with Gemini's Live API. This allows the AI to autonomously decide when to send text messages to the Discord chat channel, separate from voice responses.

## How It Works

### The Flow

1. **User speaks** in Discord voice channel
2. **Gemini processes** the audio and decides how to respond
3. **Gemini can choose** to:
   - Respond with voice (as usual)
   - Call the `send_chat_message` tool to post text
   - Do both!

### When Does Gemini Use This Tool?

Gemini will automatically use `send_chat_message` when it determines that text is better than voice, such as:

- **Links/URLs**: "Here's the documentation: https://..."
- **Code snippets**: Multi-line code or commands
- **Lists**: Shopping lists, todo items, step-by-step instructions
- **Tables**: Structured data
- **Long text**: Information that's easier to read than listen to
- **User requests**: "Can you send that in chat?"

## Implementation Details

### Tool Declaration

```typescript
{
  name: "send_chat_message",
  description: "Send a text message to the Discord chat channel. Use this when you want to share information that's better displayed as text, like links, code snippets, lists, or when the user explicitly asks you to send a message in chat.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: {
        type: Type.STRING,
        description: "The text message to send to the Discord chat channel",
      },
    },
    required: ["message"],
  },
}
```

### Event Flow

```
1. User: "Can you send me the link to the docs?"
   ↓
2. Gemini processes request
   ↓
3. Gemini emits "toolcall" event with:
   {
     functionCalls: [{
       id: "call_abc123",
       name: "send_chat_message",
       args: { message: "Here's the link: https://docs.example.com" }
     }]
   }
   ↓
4. Bot handles toolcall:
   - Extracts message from args
   - Sends to Discord: "🤖 Here's the link: https://docs.example.com"
   - Sends success response back to Gemini
   ↓
5. Gemini can continue conversation knowing the message was sent
```

### Code Structure

**Location**: `src/discord/voice-connection-manager-v2.ts`

#### 1. Tool Declaration (in `connect()`)
```typescript
tools: [
  {
    functionDeclarations: [
      {
        name: "send_chat_message",
        description: "...",
        parameters: { ... }
      }
    ]
  }
]
```

#### 2. Event Listener (in `setupGeminiListeners()`)
```typescript
this.geminiClient.on("toolcall", async (toolCall) => {
  if (toolCall.functionCalls) {
    for (const functionCall of toolCall.functionCalls) {
      if (functionCall.name === "send_chat_message") {
        await this.handleSendChatMessage(functionCall);
      }
    }
  }
});
```

#### 3. Handler Method
```typescript
private async handleSendChatMessage(functionCall) {
  // Extract message from args
  const message = functionCall.args.message;
  
  // Send to Discord
  await this.channel.send(`🤖 ${message}`);
  
  // Send success response back to Gemini
  await this.geminiClient.sendToolResponse({
    functionResponses: [{
      id: functionCall.id,
      name: functionCall.name,
      response: { success: true }
    }]
  });
}
```

## Usage Examples

### Example 1: Sharing a Link

**User (voice):** "Can you send me the link to the Gemini API docs?"

**Gemini (voice):** "Sure! I'll send that to you in chat."

**Gemini (tool call):** Sends to chat:
```
🤖 Here's the Gemini API documentation: https://ai.google.dev/gemini-api/docs
```

### Example 2: Code Snippet

**User (voice):** "How do I install Node.js?"

**Gemini (voice):** "I'll send you the installation command in chat."

**Gemini (tool call):** Sends to chat:
```
🤖 To install Node.js on Windows, use:
winget install OpenJS.NodeJS
```

### Example 3: Structured List

**User (voice):** "Give me a shopping list for making pasta"

**Gemini (voice):** "I'll send a shopping list to chat."

**Gemini (tool call):** Sends to chat:
```
🤖 Shopping List for Pasta:
• 1 lb pasta
• 2 cans crushed tomatoes
• 1 onion
• 4 cloves garlic
• Olive oil
• Fresh basil
• Parmesan cheese
```

### Example 4: Mixed Response

**User (voice):** "Explain async/await in JavaScript"

**Gemini (voice):** "Async/await is a way to handle asynchronous operations in JavaScript. Let me send you an example in chat."

**Gemini (tool call):** Sends to chat:
```
🤖 Example of async/await:

async function fetchData() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

**Gemini (voice continues):** "This pattern makes asynchronous code look more like synchronous code, making it easier to read and understand."

## Adding More Tools

You can easily add more function declarations to give Gemini more capabilities:

### Example: Get Weather

```typescript
tools: [
  {
    functionDeclarations: [
      {
        name: "send_chat_message",
        description: "...",
        parameters: { ... }
      },
      {
        name: "get_weather",
        description: "Get current weather for a location",
        parameters: {
          type: Type.OBJECT,
          properties: {
            location: {
              type: Type.STRING,
              description: "City name or coordinates"
            }
          },
          required: ["location"]
        }
      }
    ]
  }
]
```

Then add the handler:

```typescript
this.geminiClient.on("toolcall", async (toolCall) => {
  if (toolCall.functionCalls) {
    for (const functionCall of toolCall.functionCalls) {
      if (functionCall.name === "send_chat_message") {
        await this.handleSendChatMessage(functionCall);
      } else if (functionCall.name === "get_weather") {
        await this.handleGetWeather(functionCall);
      }
    }
  }
});
```

### Example: Search Discord Messages

```typescript
{
  name: "search_messages",
  description: "Search previous messages in the Discord channel",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Search query"
      },
      limit: {
        type: Type.NUMBER,
        description: "Max number of results"
      }
    },
    required: ["query"]
  }
}
```

## Debugging

### Enable Verbose Logging

The bot already logs tool calls:

```
🔧 Tool call received: {
  "functionCalls": [
    {
      "id": "call_123",
      "name": "send_chat_message",
      "args": { "message": "Hello!" }
    }
  ]
}
💬 Sending chat message: Hello!
✅ Chat message sent successfully
```

### Check Tool Response

If Gemini isn't getting responses:

```typescript
await this.geminiClient.sendToolResponse({
  functionResponses: [{
    id: functionCall.id,
    name: functionCall.name,
    response: {
      success: true,
      message: "Message sent successfully",
      // Add debugging info
      debug: {
        channelId: this.channel.id,
        timestamp: new Date().toISOString()
      }
    }
  }]
});
```

## System Instruction Tips

To make Gemini use the tool more effectively, update the system instruction:

```typescript
systemInstruction: {
  parts: [{
    text: `You are a helpful AI assistant in a Discord voice channel.

When responding to users:
- Use voice for short, conversational responses
- Use the send_chat_message tool for:
  * Links and URLs
  * Code snippets or commands
  * Lists and structured data
  * Long text that's easier to read
  * When users ask "can you send that in chat?"

Keep voice responses concise and natural.`
  }]
}
```

## Troubleshooting

### Tool Not Being Called

**Problem:** Gemini responds with voice but never calls the tool

**Solutions:**
1. Check tool declaration is properly formatted
2. Update system instruction to guide tool usage
3. Be more explicit: "Please send me that link in chat"

### Tool Response Not Received

**Problem:** Gemini calls tool but seems to hang

**Solutions:**
1. Verify `sendToolResponse()` is being called
2. Check the response includes the correct `id` and `name`
3. Look for errors in console logs

### Multiple Tool Calls

**Problem:** Gemini calls the tool multiple times

**Solution:** Handle array of function calls:
```typescript
for (const functionCall of toolCall.functionCalls) {
  // Process each call
}

// Send all responses at once
await this.geminiClient.sendToolResponse({
  functionResponses: toolCall.functionCalls.map(fc => ({
    id: fc.id,
    name: fc.name,
    response: { success: true }
  }))
});
```

## References

- [Gemini Live API Tool Use Docs](https://ai.google.dev/gemini-api/docs/live-tools)
- [Function Calling Guide](https://ai.google.dev/gemini-api/docs/function-calling)
- [Example: Altair Charts](../src/components/altair/Altair.tsx)
