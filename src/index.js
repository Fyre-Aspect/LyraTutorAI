import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus } from '@discordjs/voice';
import dotenv from 'dotenv';
import { AudioReceiver } from './audio/receiver.js';
import { GeminiTranscriber } from './ai/transcriber.js';

dotenv.config();

// Create Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Store active voice connections and transcribers
const connections = new Map();
const audioReceivers = new Map();
const transcribers = new Map();

client.once('ready', () => {
  console.log('✅ Lyra is online!');
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Bot is in ${client.guilds.cache.size} server(s)`);
});

// Handle messages for commands
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // !join command - Join the voice channel
  if (content === '!join') {
    // Check if user is in a voice channel
    if (!message.member.voice.channel) {
      return message.reply('❌ You need to be in a voice channel first!');
    }

    try {
      const channel = message.member.voice.channel;
      const guildId = message.guild.id;
      
      // Join the voice channel
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false, // We need to hear the audio
        selfMute: false,
      });

      // Store the connection
      connections.set(guildId, connection);

      // Handle connection status
      connection.on(VoiceConnectionStatus.Ready, async () => {
        console.log('✅ Voice connection ready!');
        message.reply(`✅ Joined **${channel.name}**! I'm now listening and will transcribe what you say.`);

        // Initialize Gemini transcriber
        const transcriber = new GeminiTranscriber();
        await transcriber.connect();
        transcribers.set(guildId, transcriber);

        // Set up transcription callback
        transcriber.onTranscription((text) => {
          // Send transcription to the same text channel
          message.channel.send({
            embeds: [{
              color: 0x5865F2,
              title: '🎤 Transcription',
              description: text,
              timestamp: new Date().toISOString(),
              footer: {
                text: 'Powered by Gemini Live API',
              },
            }],
          });
        });

        // Start listening to audio
        const receiver = new AudioReceiver(connection, guildId);
        audioReceivers.set(guildId, receiver);

        receiver.startListening(async (audioBuffer, userId) => {
          console.log(`🎵 Processing audio from user ${userId}`);
          
          // Send audio to Gemini for transcription
          await transcriber.transcribeAudio(audioBuffer);
        });
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log('⚠️ Disconnected from voice channel');
        
        // Cleanup
        const receiver = audioReceivers.get(guildId);
        if (receiver) {
          receiver.stopListening();
          audioReceivers.delete(guildId);
        }

        const transcriber = transcribers.get(guildId);
        if (transcriber) {
          await transcriber.disconnect();
          transcribers.delete(guildId);
        }

        connections.delete(guildId);
      });

      connection.on('error', (error) => {
        console.error('❌ Voice connection error:', error);
        message.reply('❌ An error occurred with the voice connection.');
      });

    } catch (error) {
      console.error('Error joining voice channel:', error);
      message.reply('❌ Failed to join the voice channel. Please try again.');
    }
  }

  // !leave command - Leave the voice channel
  if (content === '!leave') {
    const guildId = message.guild.id;
    const connection = connections.get(guildId);
    
    if (!connection) {
      return message.reply('❌ I\'m not in a voice channel!');
    }

    try {
      // Stop audio receiver
      const receiver = audioReceivers.get(guildId);
      if (receiver) {
        receiver.stopListening();
        audioReceivers.delete(guildId);
      }

      // Disconnect from Gemini
      const transcriber = transcribers.get(guildId);
      if (transcriber) {
        await transcriber.disconnect();
        transcribers.delete(guildId);
      }

      // Destroy voice connection
      connection.destroy();
      connections.delete(guildId);
      
      message.reply('👋 Left the voice channel. See you next time!');
    } catch (error) {
      console.error('Error leaving voice channel:', error);
      message.reply('❌ Failed to leave the voice channel.');
    }
  }

  // !help command - Show available commands
  if (content === '!help') {
    message.reply({
      embeds: [{
        color: 0x5865F2,
        title: '🎓 Lyra - AI Study Teacher',
        description: 'An AI-powered study assistant for Discord voice calls',
        fields: [
          {
            name: '📝 Available Commands',
            value: '`!join` - Join your voice channel and start transcribing\n`!leave` - Leave the voice channel\n`!help` - Show this help message',
          },
          {
            name: '✨ Features',
            value: '🎤 Real-time speech-to-text transcription\n🤖 Powered by Gemini Live API\n📊 Automatic message posting',
          },
          {
            name: '🚀 Coming Soon',
            value: 'Voice activation with "Hey Lyra"\nAI-powered question answering\nSession summaries\nVoice responses via ElevenLabs',
          },
        ],
        footer: {
          text: 'Team Lyra - Hackathon 2025',
        },
      }],
    });
  }
});

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});
