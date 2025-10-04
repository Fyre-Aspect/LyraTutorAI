# 🔧 Setup Instructions for Lyra Discord Bot

Follow these steps to get your Lyra bot up and running!

---

## Step 1: Create a Discord Bot

1. **Go to Discord Developer Portal:**
   - Visit: https://discord.com/developers/applications
   - Log in with your Discord account

2. **Create a New Application:**
   - Click the "New Application" button (top right)
   - Name it "Lyra" (or whatever you prefer)
   - Click "Create"

3. **Set up the Bot:**
   - In the left sidebar, click "Bot"
   - Click "Add Bot" and confirm
   - **Important:** Under "Privileged Gateway Intents", enable:
     - ✅ **MESSAGE CONTENT INTENT** (required to read messages)
     - ✅ **SERVER MEMBERS INTENT** (optional, for future features)

4. **Get your Bot Token:**
   - Click "Reset Token" (you may need to verify with 2FA)
   - **Copy the token** - you'll need this for `.env`
   - ⚠️ **Never share this token publicly!**

5. **Get your Application ID:**
   - Go to "General Information" in the left sidebar
   - Copy your "Application ID"

---

## Step 2: Install Required Software

### Install Node.js
- Download from: https://nodejs.org/ (LTS version recommended)
- Verify installation: `node --version` (should be 18+)

### Install FFmpeg (Required for Voice)

**Windows (PowerShell):**
```powershell
# Option 1: Using winget (Windows 10/11)
winget install FFmpeg

# Option 2: Using Chocolatey
choco install ffmpeg

# Option 3: Manual installation
# Download from https://ffmpeg.org/download.html
# Extract and add to PATH
```

**Verify FFmpeg installation:**
```powershell
ffmpeg -version
```

---

## Step 3: Configure the Bot

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Open the `.env` file in the project root
   - Add your Discord credentials:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_application_id_here
   ```

---

## Step 4: Invite Bot to Your Server

1. **Generate Invite URL:**
   - Go back to Discord Developer Portal
   - Click "OAuth2" > "URL Generator"
   - Select **Scopes:**
     - ✅ `bot`
     - ✅ `applications.commands`
   - Select **Bot Permissions:**
     - ✅ Read Messages/View Channels
     - ✅ Send Messages
     - ✅ Send Messages in Threads
     - ✅ Embed Links
     - ✅ Connect (to voice channels)
     - ✅ Speak (in voice channels)
     - ✅ Use Voice Activity

2. **Invite the Bot:**
   - Copy the generated URL at the bottom
   - Paste it in your browser
   - Select your Discord server
   - Click "Authorize"

---

## Step 5: Run the Bot

```bash
npm start
```

You should see:
```
✅ Lyra is online!
Logged in as Lyra#1234
Bot is in 1 server(s)
```

---

## Step 6: Test the Bot

1. **Join a voice channel** in your Discord server
2. **In any text channel**, type: `!join`
3. The bot should join your voice channel!
4. Try other commands:
   - `!help` - See all commands
   - `!leave` - Bot leaves voice channel

---

## 🎯 Next Steps (Development Phases)

### Phase 2: Add Gemini AI (Hours 6-14)
- Get Gemini API key from Google AI Studio
- Implement speech-to-text
- Add wake phrase detection

### Phase 3: Add ElevenLabs TTS (Hours 14-24)
- Get ElevenLabs API key
- Implement real-time voice output
- Connect AI responses to voice

### Phase 4: Context & Memory (Hours 24-30)
- Add session tracking
- Implement conversation memory
- Build summary generation

---

## 🐛 Troubleshooting

### Bot won't start
- ✅ Check that `DISCORD_TOKEN` is set correctly in `.env`
- ✅ Verify Node.js version: `node --version` (should be 18+)
- ✅ Run `npm install` again

### Bot can't join voice channel
- ✅ Check FFmpeg is installed: `ffmpeg -version`
- ✅ Ensure bot has "Connect" and "Speak" permissions
- ✅ Make sure you're in a voice channel when typing `!join`

### "Missing Access" error
- ✅ Re-invite bot with correct permissions (see Step 4)
- ✅ Check bot role is high enough in server settings

---

## 📚 Useful Links

- [Discord.js Guide](https://discordjs.guide/)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [FFmpeg Download](https://ffmpeg.org/download.html)
- [Google AI Studio](https://makersuite.google.com/app/apikey)
- [ElevenLabs API](https://elevenlabs.io/docs/api-reference)

---

**Need help?** Check the error messages in your terminal - they usually point to the issue!
