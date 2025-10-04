# 🎤 QUICK REFERENCE - Speech-to-Text Setup

## ⚡ 30-Second Setup

### 1. Get Gemini API Key
Visit: **https://aistudio.google.com/apikey** → Create API Key → Copy it

### 2. Update .env
```env
GEMINI_API_KEY=paste_your_key_here
```

### 3. Install & Run
```bash
npm install
npm start
```

### 4. Test in Discord
```
!join
[speak in voice channel]
[watch transcription appear!]
```

---

## 📝 Commands

| Command | What It Does |
|---------|--------------|
| `!join` | Join voice + start transcribing |
| `!leave` | Leave voice + stop transcribing |
| `!help` | Show help |

---

## ✅ Quick Checklist

Before running:
- [ ] Have Gemini API key
- [ ] Added to `.env` file
- [ ] Ran `npm install`
- [ ] Bot token and client ID in `.env`
- [ ] FFmpeg installed

To test:
- [ ] Bot starts without errors
- [ ] Join voice channel in Discord
- [ ] Type `!join`
- [ ] See "Connected to Gemini Live API" in console
- [ ] Speak in voice
- [ ] Transcription appears in text channel

---

## 🐛 Quick Fixes

**Error: GEMINI_API_KEY is not set**
→ Add to `.env` file, restart bot

**No transcriptions**
→ Check API key, speak after pause, check console

**"Failed to connect"**
→ Check internet, verify API key, restart bot

**Bot won't join voice**
→ Check FFmpeg installed, bot permissions

---

## 📊 What to Expect

**Console will show:**
```
✅ Connected to Gemini Live API
🎤 Started listening to voice channel
👤 User started speaking
📝 Transcription: [your words]
```

**Discord will show:**
Pretty embed with your transcribed speech

**Timing:**
~1-2 seconds from speaking to seeing text

---

## 📚 Files to Read

1. **TRANSCRIPTION_SETUP.md** - Detailed setup guide
2. **PHASE2_STATUS.md** - Technical details
3. **IMPLEMENTATION_SUMMARY.md** - Complete overview

---

## 🎯 Tips

- Speak clearly at normal pace
- Wait 1 second of silence between phrases
- Check console for real-time status
- Each speaker transcribed separately

---

## 🚀 Get Gemini API Key

**Direct link:** https://aistudio.google.com/apikey

**Steps:**
1. Sign in with Google
2. Click "Create API Key"
3. Select or create project
4. Copy the key
5. Paste in `.env`

**Free tier:** Generous limits for testing!

---

## 💡 Pro Tips

- Test with one speaker first
- Monitor console output
- Use `!help` to check features
- Restart bot if connection issues
- Keep API key secret

---

**Need Help?**
- Check console errors (they're helpful!)
- Read TRANSCRIPTION_SETUP.md
- Verify all `.env` values are set
- Make sure FFmpeg is installed

---

**Ready to go! 🚀**
