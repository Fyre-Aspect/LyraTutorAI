# Gemini Discord Bot

This Discord bot integrates the Gemini Live API to provide real-time voice conversations in Discord voice channels. Multiple users can interact with the AI simultaneously.

## Features

- 🎤 **Voice Input**: Bot listens to users speaking in voice channels
- 🔊 **Voice Output**: Bot responds with natural voice synthesis
- 👥 **Multi-User Support**: Handle multiple speakers in the same channel
- 🤖 **Gemini 2.0 Integration**: Powered by Google's latest multimodal AI
- ⚡ **Real-time Processing**: Low-latency audio streaming

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Discord Bot Token**
3. **Gemini API Key**
4. **FFmpeg** (for audio processing)

## Setup Instructions

### 1. Install FFmpeg

**Windows:**
```powershell
# Using chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

### 2. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name and create
4. Go to the "Bot" tab
5. Click "Add Bot"
6. Under "Privileged Gateway Intents", enable:
   - **Message Content Intent**
   - **Server Members Intent**
   - **Presence Intent**
7. Copy the bot token

### 3. Invite Bot to Your Server

1. In the Developer Portal, go to "OAuth2" > "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select permissions:
   - Read Messages/View Channels
   - Send Messages
   - Connect
   - Speak
   - Use Voice Activity
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

### 4. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create or select a project
3. Generate an API key
4. Copy the API key

### 5. Configure Environment Variables

Create or update `.env.local` file in the project root:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
BOT_PREFIX=!gemini

# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=models/gemini-2.0-flash-exp
GEMINI_VOICE=Puck
GEMINI_SYSTEM_INSTRUCTION=You are a helpful AI assistant in a Discord voice channel. Keep your responses concise and natural for voice conversation.
```

### 6. Install Dependencies

```powershell
npm install
```

The following Discord-related packages will be installed:
- `discord.js` - Discord API wrapper
- `@discordjs/voice` - Voice support for Discord
- `@discordjs/opus` - Opus audio codec
- `prism-media` - Audio processing
- `libsodium-wrappers` - Encryption for voice
- `dotenv` - Environment variable loading

### 7. Build and Run

```powershell
# Build TypeScript
npm run build

# Run the Discord bot
npm run bot
```

Or in development mode:
```powershell
# Run with ts-node
npx ts-node src/discord/index.ts
```

## Usage

### Commands

Once the bot is running and in your server:

1. **Join a voice channel**
2. **Invite the bot:**
   ```
   !gemini join
   ```

3. **Start speaking** - The bot will listen and respond with voice

4. **Check status:**
   ```
   !gemini status
   ```

5. **Get help:**
   ```
   !gemini help
   ```

6. **Leave the channel:**
   ```
   !gemini leave
   ```

### Available Commands

| Command | Description |
|---------|-------------|
| `!gemini join` | Bot joins your current voice channel |
| `!gemini leave` | Bot leaves the voice channel |
| `!gemini status` | Shows bot connection status |
| `!gemini help` | Displays help message |

## How It Works

### Architecture

```
Discord Voice Channel
       ↕️ (Opus Audio)
Voice Connection Manager
       ↕️ (PCM Audio)
Audio Processor
       ↕️ (Resampled PCM16)
Gemini Live API Client
       ↕️ (WebSocket)
Gemini 2.0 Flash API
```

### Audio Flow

1. **Input (Discord → Gemini):**
   - User speaks in Discord voice channel
   - Discord sends Opus-encoded audio (48kHz stereo)
   - Audio Processor decodes and converts to PCM
   - Resamples to 16kHz mono
   - Converts stereo to mono
   - Base64 encodes and sends to Gemini

2. **Output (Gemini → Discord):**
   - Gemini sends PCM16 audio (24kHz mono)
   - Audio Processor resamples to 48kHz
   - Converts mono to stereo
   - Encodes to Opus
   - Plays through Discord voice connection

### Multi-User Support

The bot can handle multiple users speaking in the same voice channel:
- Each user's audio stream is processed independently
- Voice Activity Detection determines when users are speaking
- All audio is sent to Gemini which can understand multiple speakers
- Bot responds naturally to all participants

## Configuration

### Voice Selection

Available voices:
- `Puck` (default)
- `Charon`
- `Kore`
- `Fenrir`
- `Aoede`

Change in `.env.local`:
```env
GEMINI_VOICE=Aoede
```

### Custom System Instructions

Modify bot personality in `.env.local`:
```env
GEMINI_SYSTEM_INSTRUCTION=You are a friendly gaming assistant. Help users with game strategies and tips. Keep responses brief and energetic.
```

### Command Prefix

Change the command prefix:
```env
BOT_PREFIX=!ai
```

Then use commands like `!ai join`

## Troubleshooting

### Bot doesn't join voice channel
- Ensure bot has "Connect" and "Speak" permissions
- Check that you're in a voice channel when running `!gemini join`
- Verify the bot is online (check Discord server member list)

### No audio from bot
- Ensure FFmpeg is installed correctly
- Check bot has "Speak" permission
- Verify Gemini API key is valid
- Check console logs for errors

### Bot can't hear users
- Verify Message Content Intent is enabled in Discord Developer Portal
- Ensure bot has "Use Voice Activity" permission
- Check that users aren't muted

### Installation errors
- Ensure Node.js version is 18 or higher
- Try deleting `node_modules` and running `npm install` again
- On Windows, you may need to run PowerShell as Administrator

## Development

### Project Structure

```
src/discord/
├── index.ts                      # Entry point
├── bot.ts                        # Main bot class
├── voice-connection-manager.ts   # Voice connection handling
└── audio-processor.ts            # Audio format conversion
```

### Running in Development

```powershell
# Watch mode with automatic restart
npx tsx watch src/discord/index.ts
```

### Adding New Commands

Edit `src/discord/bot.ts` and add a new case in the command handler:

```typescript
case "yourcommand":
  await this.handleYourCommand(message);
  break;
```

## Performance Considerations

- **Latency**: Typically 500ms-2s round trip (Discord → Gemini → Discord)
- **Concurrent Users**: Bot can handle multiple users in the same channel
- **Memory**: ~100-200MB per active voice connection
- **Network**: ~50-100 Kbps per active connection

## Security Notes

- Never commit `.env.local` to git
- Keep your Discord bot token and Gemini API key private
- Use environment variables for all secrets
- Regularly rotate API keys

## Limitations

- Bot can only be in one voice channel per Discord server
- Maximum audio quality limited by Discord's Opus codec
- Gemini API rate limits apply
- Some latency is inherent in real-time AI processing

## Support

For issues or questions:
1. Check console logs for errors
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check that FFmpeg is in your system PATH

## License

Same license as the parent project (Apache 2.0)
