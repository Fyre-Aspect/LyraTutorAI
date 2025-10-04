# Discord Bot Quick Start Guide

## Quick Setup (5 minutes)

### Step 1: Install Dependencies

**Windows (PowerShell):**
```powershell
.\setup-discord-bot.ps1
```

**Linux/Mac:**
```bash
chmod +x setup-discord-bot.sh
./setup-discord-bot.sh
```

**Or manually:**
```powershell
npm install
```

### Step 2: Get Your API Keys

#### Discord Bot Token:
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Go to "Bot" tab → "Add Bot"
4. Enable these intents under "Privileged Gateway Intents":
   - ✅ Message Content Intent
   - ✅ Server Members Intent
5. Click "Reset Token" and copy it

#### Gemini API Key:
1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the key

### Step 3: Configure Environment

Edit `.env.local`:
```env
DISCORD_BOT_TOKEN=paste_your_discord_token_here
GEMINI_API_KEY=paste_your_gemini_key_here
```

### Step 4: Invite Bot to Server

1. In Discord Developer Portal, go to "OAuth2" → "URL Generator"
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select permissions:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Connect
   - ✅ Speak
   - ✅ Use Voice Activity
4. Copy the URL and open in browser
5. Select your server

### Step 5: Run the Bot

```powershell
npm run bot
```

### Step 6: Use the Bot

1. Join a voice channel in your Discord server
2. In any text channel, type:
   ```
   !gemini join
   ```
3. Start speaking! The bot will respond with voice.

---

## Commands

| Command | Description |
|---------|-------------|
| `!gemini join` | Join your voice channel |
| `!gemini leave` | Leave the voice channel |
| `!gemini status` | Show bot status |
| `!gemini help` | Show help |

---

## Troubleshooting

### Bot doesn't respond to commands
- Check bot has "Read Messages" permission
- Verify bot is online (green dot in member list)
- Make sure you're using the correct prefix (`!gemini`)

### Bot joins but doesn't hear you
- Enable "Message Content Intent" in Discord Developer Portal
- Check you're not muted in Discord
- Verify FFmpeg is installed: `ffmpeg -version`

### Bot doesn't speak
- Ensure bot has "Speak" permission in the voice channel
- Check console for errors
- Verify Gemini API key is correct

### Installation errors
```powershell
# Delete and reinstall
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install
```

### FFmpeg not found
**Windows:**
```powershell
choco install ffmpeg
```

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

---

## Advanced Configuration

### Change Voice
In `.env.local`:
```env
GEMINI_VOICE=Aoede  # Options: Puck, Charon, Kore, Fenrir, Aoede
```

### Custom System Prompt
```env
GEMINI_SYSTEM_INSTRUCTION=You are a gaming assistant. Help users with strategies and tips. Keep responses brief.
```

### Change Command Prefix
```env
BOT_PREFIX=!ai  # Now use: !ai join
```

---

## Architecture

```
User speaks → Discord → Bot decodes Opus → 
Converts to PCM16 → Gemini processes → 
Returns audio → Bot encodes to Opus → 
Plays in Discord
```

---

## Need Help?

1. Check the full documentation: `README.discord.md`
2. View console logs for errors
3. Ensure `.env.local` has both tokens
4. Verify FFmpeg is installed and in PATH

---

## Running in Production

```powershell
# Build TypeScript
npm run build

# Run with pm2 (process manager)
npm install -g pm2
pm2 start "npm run bot" --name gemini-discord-bot
pm2 save
pm2 startup
```

---

Enjoy your AI-powered Discord voice bot! 🎉
