# 🎤 Real-Time Speech-to-Text - Quick Setup

## What You Need to Do

### 1. Get Gemini API Key (5 minutes)

1. **Visit Google AI Studio:**
   ```
   https://aistudio.google.com/apikey
   ```

2. **Sign in** with your Google account

3. **Create API Key:**
   - Click "Create API Key"
   - Choose "Create API key in new project" (or select existing)
   - **Copy the API key** (you'll need this next)

4. **Add to your `.env` file:**
   - Open `.env` in your project
   - Add the line:
     ```env
     GEMINI_API_KEY=paste_your_api_key_here
     ```
   - Save the file

### 2. Install New Dependencies

```bash
npm install
```

This installs:
- `@google/genai` - Gemini Live API
- `prism-media` - Audio processing

### 3. Test It!

```bash
npm start
```

Then in Discord:
1. Join a voice channel
2. Type `!join` in any text channel
3. **Start speaking!** 🎤
4. Watch your words appear as text in Discord! ✨

---

## 🎯 How to Use

### Commands
- `!join` - Bot joins and starts transcribing
- `!leave` - Bot leaves and stops transcribing
- `!help` - Show help message

### Tips
- Speak clearly at normal pace
- Bot waits 1 second of silence before transcribing
- Transcriptions appear automatically in text channel
- Each person's speech is transcribed separately

---

## 🐛 Common Issues

### "GEMINI_API_KEY is not set"
- Check `.env` file has `GEMINI_API_KEY=...`
- No spaces around the `=`
- Restart the bot after editing `.env`

### No transcriptions appearing
- Check console for errors
- Verify API key is correct (no extra spaces)
- Try speaking after a pause
- Check Gemini API quota at https://aistudio.google.com

### "Failed to connect to Gemini"
- Verify internet connection
- Check API key is active
- Try restarting the bot

---

## ✅ Success Checklist

- [ ] Got Gemini API key
- [ ] Added to `.env` file
- [ ] Ran `npm install`
- [ ] Bot starts without errors
- [ ] Bot joins voice channel
- [ ] Console shows "✅ Connected to Gemini Live API"
- [ ] Speaking creates transcriptions in Discord

---

## 📊 What You'll See

### Console Output:
```
✅ Lyra is online!
🔗 Connecting to Gemini Live API...
✅ Connected to Gemini Live API
🎤 Started listening to voice channel
👤 User 123456789 started speaking
📝 Transcription: Hello, this is working!
```

### Discord Output:
Pretty embedded messages with:
- 🎤 Transcription title
- Your spoken words as text
- Timestamp
- "Powered by Gemini Live API" footer

---

## 🚀 What's Next?

Now that you have speech-to-text working, you can:
- Add wake phrase detection ("Hey Lyra")
- Integrate AI responses
- Add voice output with ElevenLabs
- Build session summaries

See `PHASE2_STATUS.md` for detailed technical info!

---

**Need help?** Check the console - error messages are usually very helpful!
