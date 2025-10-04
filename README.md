# 🎓 Lyra — AI Study Teacher for Discord

An AI-powered study assistant that joins Discord group voice calls, answers questions in real time through natural voice interaction, detects off-topic discussions, and summarizes the session afterward.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- FFmpeg installed (required for voice support)
- A Discord account and server for testing

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your Discord Bot:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and give it a name (e.g., "Lyra")
   - Go to the "Bot" tab and click "Add Bot"
   - Under "Privileged Gateway Intents", enable:
     - ✅ MESSAGE CONTENT INTENT
     - ✅ SERVER MEMBERS INTENT (optional)
     - ✅ PRESENCE INTENT (optional)
   - Click "Reset Token" and copy your bot token
   - Copy your Application ID from the "General Information" tab

3. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Add your Discord bot token and client ID to `.env`
   - **Get a Gemini API key** from https://aistudio.google.com/apikey
   - Add your Gemini API key to `.env`

4. **Invite the bot to your server:**
   - Go to the "OAuth2" > "URL Generator" tab
   - Select scopes: `bot` and `applications.commands`
   - Select bot permissions:
     - ✅ Read Messages/View Channels
     - ✅ Send Messages
     - ✅ Connect
     - ✅ Speak
     - ✅ Use Voice Activity
   - Copy the generated URL and open it in your browser
   - Select your server and authorize the bot

5. **Install FFmpeg:**
   - **Windows:** 
     ```bash
     # Using winget
     winget install FFmpeg
     
     # Or download from https://ffmpeg.org/download.html
     ```
   - **macOS:** 
     ```bash
     brew install ffmpeg
     ```
   - **Linux:** 
     ```bash
     sudo apt install ffmpeg
     ```

6. **Run the bot:**
   ```bash
   npm start
   ```

## 🎮 Commands

- `!lyra join` - Lyra joins your current voice channel and starts transcribing
- `!lyra leave` - Lyra leaves the voice channel
- `!lyra help` - Display available commands

## ✨ Current Features

- ✅ **Real-time Speech-to-Text** - Automatic transcription of voice chat
- ✅ **Gemini Live API Integration** - Powered by Google's latest AI
- ✅ **Multi-user Support** - Transcribes each speaker separately
- ✅ **Auto-posting** - Transcriptions appear in Discord chat
- ✅ **Audio Processing** - Handles Discord voice format conversion

## 🛠️ Tech Stack

- **Framework:** Node.js with discord.js v14
- **Voice:** @discordjs/voice, FFmpeg, Opus codec
- **AI (Coming Soon):** Gemini 2.5 Flash for STT & LLM
- **TTS (Coming Soon):** ElevenLabs Real-Time Streaming

## 📋 Development Roadmap

- [x] Phase 1: Basic Discord bot setup
- [x] Phase 1: Voice channel join/leave functionality
- [x] Phase 2: Gemini Live API integration
- [x] Phase 2: Real-time speech-to-text transcription
- [x] Phase 2: Auto-posting transcriptions to Discord
- [ ] Phase 2: Wake phrase detection ("Hey Lyra")
- [ ] Phase 3: ElevenLabs TTS streaming
- [ ] Phase 4: Session memory & context tracking
- [ ] Phase 4: Session summaries
- [ ] Phase 5: Latency optimization & polish

## 📝 License

MIT License - Team Lyra, Hackathon 2025
