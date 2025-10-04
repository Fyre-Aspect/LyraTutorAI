/**
 * Discord Bot for Gemini Live API Integration
 * Handles voice channel connections and audio streaming
 * Enhanced with response formatting (voice summary + detailed text)
 */

import {
  Client,
  GatewayIntentBits,
  VoiceState,
  Message,
  GuildMember,
  ChannelType,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { LiveConnectConfig } from "@google/genai";
import { VoiceConnectionManager } from "./voice-connection-manager-v2";

export interface BotConfig {
  token: string;
  geminiApiKey: string;
  model?: string;
  liveConfig?: LiveConnectConfig;
  prefix?: string;
}

export class GeminiDiscordBot {
  private client: Client;
  private geminiApiKey: string;
  private model: string;
  private liveConfig: LiveConnectConfig;
  private prefix: string;
  private voiceConnections: Map<string, VoiceConnectionManager>;
  private textChannels: Map<string, TextChannel>;
  private sessionTimers: Map<string, NodeJS.Timeout>;
  private sessionStartTimes: Map<string, number>;

  constructor(config: BotConfig) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.geminiApiKey = config.geminiApiKey;
    this.model = config.model || "models/gemini-2.0-flash-exp";
    this.liveConfig = config.liveConfig || {};
    this.prefix = config.prefix || "!gemini";
    this.voiceConnections = new Map();
    this.textChannels = new Map();
    this.sessionTimers = new Map();
    this.sessionStartTimes = new Map();

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once("ready", () => {
      console.log(`✅ Bot ready! Logged in as ${this.client.user?.tag}`);
      console.log(`📝 Command prefix: ${this.prefix}`);
    });

    this.client.on("messageCreate", async (message: Message) => {
      if (message.author.bot) return;
      if (!message.content.startsWith(this.prefix)) return;

      const args = message.content.slice(this.prefix.length).trim().split(/ +/);
      const command = args.shift()?.toLowerCase();

      try {
        switch (command) {
          case "join":
            await this.handleJoinCommand(message);
            break;
          case "leave":
            await this.handleLeaveCommand(message);
            break;
          case "help":
            await this.handleHelpCommand(message);
            break;
          case "status":
            await this.handleStatusCommand(message);
            break;
          case "test":
            await this.handleTestCommand(message);
            break;
          case "lyra":
            await this.handleLyraCommand(message);
            break;
          case "stop":
          case "interrupt":
            await this.handleStopCommand(message);
            break;
          case "summarize":
            await this.handleSummarizeCommand(message);
            break;
          case "define":
            await this.handleDefineCommand(message);
            break;
          case "timer":
            await this.handleTimerCommand(message);
            break;
          case "recap":
            await this.handleRecapCommand(message);
            break;
          default:
            await message.reply(
              `Unknown command. Use \`${this.prefix} help\` for available commands.`
            );
        }
      } catch (error) {
        console.error("❌ Bot: Command error:", error);
        await message.reply("❌ An error occurred while processing your command.");
      }
    });

    this.client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
      await this.handleVoiceStateUpdate(oldState, newState);
    });

    this.client.on("error", (error: Error) => {
      console.error("❌ Bot: Discord client error:", error);
    });
  }

  private async handleJoinCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const member = message.member;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      await message.reply("❌ You need to be in a voice channel first!");
      return;
    }

    if (voiceChannel.type !== ChannelType.GuildVoice) {
      await message.reply("❌ I can only join regular voice channels!");
      return;
    }

    if (this.voiceConnections.has(message.guild.id)) {
      await message.reply("⚠️ I'm already in a voice channel in this server!");
      return;
    }

    try {
      await message.reply("🔄 Joining voice channel...");

      const connectionManager = new VoiceConnectionManager(
        voiceChannel as any,
        this.geminiApiKey,
        this.model,
        this.liveConfig
      );

      // Store text channel FIRST (before connecting)
      const textChannel = message.channel as TextChannel;
      this.textChannels.set(message.guild.id, textChannel);
      console.log(`📝 Bot: Stored text channel #${textChannel.name} for guild ${message.guild.id}`);

      // Get Gemini client and set up event listeners BEFORE connecting
      const geminiClient = connectionManager.getGeminiClient();
      const guildId = message.guild.id;
      
      // Voice response event (already spoken in voice, just log)
      geminiClient.on("voiceResponse", (summary: string) => {
        console.log(`🎙️ Bot [${guildId}]: Voice summary (${summary.length} chars)`);
      });

      // Text response event (send detailed analysis to Discord text channel)
      geminiClient.on("textResponse", async (analysis: string) => {
        console.log(`📄 Bot [${guildId}]: Text response (${analysis.length} chars)`);
        await this.sendDetailedAnalysis(guildId, analysis);
      });

      geminiClient.on("formattedResponse", (formatted: any) => {
        console.log(`📊 Bot [${guildId}]: Formatted response complete`);
      });

      geminiClient.on("turncomplete", () => {
        console.log(`✅ Bot [${guildId}]: Turn complete`);
      });

      console.log(`🔌 Bot [${guildId}]: Event listeners registered, connecting...`);

      // Now connect
      await connectionManager.connect();
      this.voiceConnections.set(message.guild.id, connectionManager);
      
      // Track session start time
      this.sessionStartTimes.set(message.guild.id, Date.now());

      await message.reply(
        `✅ Joined ${voiceChannel.name}!\n\n` +
        `**How it works:**\n` +
        `🎙️ **Voice:** Speak your questions → Brief summary in voice\n` +
        `📄 **Text:** Detailed analysis appears automatically here\n` +
        `💬 **Manual:** Use \`${this.prefix}<question>\` to ask via text\n\n` +
        `**Example:** \`${this.prefix}explain photosynthesis\``
      );

      console.log(`✅ Bot [${guildId}]: Setup complete`);
    } catch (error) {
      console.error(`❌ Bot [${message.guild.id}]: Join error:`, error);
      await message.reply("❌ Failed to join voice channel or connect to Gemini.");
      this.textChannels.delete(message.guild.id);
    }
  }

  /**
   * Send detailed analysis to the text channel
   */
  private async sendDetailedAnalysis(guildId: string, analysis: string) {
    console.log(`📤 Bot [${guildId}]: Sending detailed analysis...`);
    
    const textChannel = this.textChannels.get(guildId);
    if (!textChannel) {
      console.error(`❌ Bot [${guildId}]: No text channel found!`);
      return;
    }

    console.log(`📤 Bot [${guildId}]: Sending to #${textChannel.name}`);

    try {
      // Clean the analysis text
      const cleanAnalysis = analysis
        .replace(/^---DETAILED ANALYSIS---\s*/i, '')
        .replace(/^---\s*/i, '')
        .trim();
      
      if (!cleanAnalysis) {
        console.warn(`⚠️ Bot [${guildId}]: Analysis empty after cleaning`);
        return;
      }

      // Create embed for detailed analysis
      const embed = new EmbedBuilder()
        .setTitle("📚 Detailed Analysis")
        .setDescription(cleanAnalysis.substring(0, 4096)) // Discord embed limit
        .setColor(0x5865F2)
        .setTimestamp();

      await textChannel.send({ embeds: [embed] });
      console.log(`✅ Bot [${guildId}]: Sent embed (${cleanAnalysis.length} chars)`);

      // If analysis is longer than embed limit, send remainder in code blocks
      if (cleanAnalysis.length > 4095) {
        console.log(`📄 Bot [${guildId}]: Sending overflow content...`);
        const remaining = cleanAnalysis.substring(4096);
        const chunks = remaining.match(/.{1,1900}/gs) || [];
        
        for (let i = 0; i < chunks.length; i++) {
          await textChannel.send(`\`\`\`\n${chunks[i]}\n\`\`\``);
          console.log(`✅ Bot [${guildId}]: Sent chunk ${i + 1}/${chunks.length}`);
        }
      }

      console.log(`🎉 Bot [${guildId}]: Successfully sent all content`);
    } catch (error) {
      console.error(`❌ Bot [${guildId}]: Error sending analysis:`, error);
    }
  }

  private async handleLeaveCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const connectionManager = this.voiceConnections.get(message.guild.id);

    if (!connectionManager) {
      await message.reply("❌ I'm not in a voice channel!");
      return;
    }

    try {
      connectionManager.disconnect();
      this.voiceConnections.delete(message.guild.id);
      this.textChannels.delete(message.guild.id);
      
      // Clear timers and session data
      const timer = this.sessionTimers.get(message.guild.id);
      if (timer) {
        clearTimeout(timer);
        this.sessionTimers.delete(message.guild.id);
      }
      this.sessionStartTimes.delete(message.guild.id);
      
      console.log(`👋 Bot [${message.guild.id}]: Disconnected and cleaned up`);
      await message.reply("👋 Left the voice channel and disconnected from Gemini.");
    } catch (error) {
      console.error("❌ Bot: Leave error:", error);
      await message.reply("❌ Failed to leave voice channel.");
    }
  }

  private async handleHelpCommand(message: Message) {
    const helpEmbed = new EmbedBuilder()
      .setTitle("🤖 Lyra - AI Study Partner")
      .setDescription("An AI study partner that joins voice calls to help you learn")
      .addFields(
        {
          name: "📢 Voice Control",
          value: 
            `\`${this.prefix} join\` - Join your voice channel\n` +
            `\`${this.prefix} leave\` - Leave the voice channel\n` +
            `\`${this.prefix} stop\` - Stop talking immediately\n` +
            `\`${this.prefix} interrupt\` - Same as stop`,
        },
        {
          name: "💬 Question Commands",
          value:
            `\`${this.prefix} explain <question>\` - Ask a question via text\n` +
            `\`${this.prefix} define <concept>\` - Get a clear definition\n` +
            `**Example:** \`${this.prefix} define photosynthesis\``,
        },
        {
          name: "📝 Study Tools",
          value:
            `\`${this.prefix} summarize\` - Generate study notes from discussion\n` +
            `\`${this.prefix} summarize brief\` - Short bullet point summary\n` +
            `\`${this.prefix} summarize detailed\` - Comprehensive summary\n` +
            `\`${this.prefix} recap\` - End-of-session summary with insights`,
        },
        {
          name: "⏰ Time Management",
          value:
            `\`${this.prefix} timer <minutes>\` - Start a study timer (Pomodoro)\n` +
            `**Example:** \`${this.prefix} timer 25\` for 25-minute session`,
        },
        {
          name: "ℹ️ Info",
          value:
            `\`${this.prefix} status\` - Check bot status\n` +
            `\`${this.prefix} test\` - Run audio tests\n` +
            `\`${this.prefix} help\` - Show this message`,
        },
        {
          name: "How It Works",
          value:
            "1️⃣ Join a voice channel\n" +
            "2️⃣ Use `!gemini join` to invite Lyra\n" +
            "3️⃣ **Speak:** Ask questions in voice → Get brief audio summaries\n" +
            "4️⃣ **Read:** Detailed explanations appear automatically in this chat\n" +
            "5️⃣ **Type:** Use commands above for text-based interactions",
        }
      )
      .setColor(0x5865F2)
      .setFooter({ text: "All commands start with !lyra (or your custom prefix)" });

    await message.reply({ embeds: [helpEmbed] });
  }

  private async handleStatusCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const connectionManager = this.voiceConnections.get(message.guild.id);

    if (!connectionManager) {
      await message.reply("📊 Status: Not connected to any voice channel.");
      return;
    }

    const status = connectionManager.getStatus();
    const textChannel = this.textChannels.get(message.guild.id);

    const statusEmbed = new EmbedBuilder()
      .setTitle("📊 Bot Status")
      .addFields(
        { name: "🔊 Voice Channel", value: status.channelName, inline: true },
        { name: "🤖 Gemini Model", value: status.model, inline: true },
        { name: "📡 Voice Connection", value: status.voiceConnectionState, inline: true },
        { 
          name: "🔗 Gemini Connection", 
          value: status.geminiConnected ? "✅ Connected" : "❌ Disconnected", 
          inline: true 
        },
        { name: "👥 Users in Channel", value: status.usersInChannel.toString(), inline: true },
        { 
          name: "🎵 Queued Audio Chunks", 
          value: (status.queuedAudioChunks || 0).toString(), 
          inline: true 
        },
        { 
          name: "📝 Text Channel", 
          value: textChannel ? `#${textChannel.name}` : "❌ Not set", 
          inline: false 
        },
        {
          name: "📄 Response Mode",
          value: "Voice Summary (audio) + Detailed Analysis (text)",
          inline: false
        }
      )
      .setColor(status.geminiConnected ? 0x00FF00 : 0xFF0000)
      .setTimestamp();

    await message.reply({ embeds: [statusEmbed] });
  }

  private async handleTestCommand(message: Message) {
    await message.reply("🧪 Running audio processor tests... Check console for results.");
    
    try {
      const { DiscordAudioProcessor } = await import("./audio-processor-v2");
      const processor = new DiscordAudioProcessor();
      await processor.runTests();
      await message.reply("✅ Audio processor tests completed! Check console for detailed results.");
    } catch (error) {
      console.error("❌ Bot: Test error:", error);
      await message.reply("❌ Audio processor tests failed. Check console for errors.");
    }
  }

  private async handleLyraCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const connectionManager = this.voiceConnections.get(message.guild.id);

    if (!connectionManager) {
      await message.reply(
        `❌ I'm not in a voice channel! Use \`${this.prefix} join\` first.`
      );
      return;
    }

    try {
      // Extract the question/topic after the command
      const args = message.content.slice(this.prefix.length).trim().split(/ +/);
      args.shift(); // Remove 'lyra'
      const query = args.join(' ');

      if (!query) {
        await message.reply(
          `💬 Please provide a question or topic.\n` +
          `**Example:** \`${this.prefix} explain photosynthesis\``
        );
        return;
      }

      console.log(`📤 Bot [${message.guild.id}]: Text query: "${query}"`);
      await message.reply(`🤔 Processing: "${query}"`);

      // Send the query to Gemini via text input
      const geminiClient = connectionManager.getGeminiClient();
      geminiClient.send([{ text: query }], true);

      console.log(`✅ Bot [${message.guild.id}]: Query sent to Gemini`);
    } catch (error) {
      console.error(`❌ Bot [${message.guild.id}]: Lyra command error:`, error);
      await message.reply("❌ Failed to process your request.");
    }
  }

  private async handleStopCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const connectionManager = this.voiceConnections.get(message.guild.id);

    if (!connectionManager) {
      await message.reply(`❌ I'm not in a voice channel! Use \`${this.prefix} join\` first.`);
      return;
    }

    try {
      console.log(`🛑 Bot [${message.guild.id}]: Stop command received`);
      
      // Interrupt current audio playback
      const geminiClient = connectionManager.getGeminiClient();
      geminiClient.interrupt();
      
      await message.reply("🛑 Stopped speaking and cleared audio queue.");
      console.log(`✅ Bot [${message.guild.id}]: Successfully interrupted`);
    } catch (error) {
      console.error(`❌ Bot [${message.guild.id}]: Stop command error:`, error);
      await message.reply("❌ Failed to stop playback.");
    }
  }

  private async handleSummarizeCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const connectionManager = this.voiceConnections.get(message.guild.id);

    if (!connectionManager) {
      await message.reply(`❌ I'm not in a voice channel! Use \`${this.prefix} join\` first.`);
      return;
    }

    try {
      const args = message.content.slice(this.prefix.length).trim().split(/ +/);
      args.shift(); // Remove 'summarize'
      const detailLevel = args[0]?.toLowerCase() || "standard";

      let prompt = "Please summarize our discussion so far into clear, organized study notes.";
      
      if (detailLevel === "brief") {
        prompt = "Please provide a brief, high-level summary of our discussion in bullet points.";
      } else if (detailLevel === "detailed") {
        prompt = "Please provide a comprehensive, detailed summary of our discussion with explanations and examples.";
      }

      console.log(`📝 Bot [${message.guild.id}]: Summarize request (${detailLevel} mode)`);
      await message.reply(`📝 Generating ${detailLevel} summary...`);

      const geminiClient = connectionManager.getGeminiClient();
      geminiClient.send([{ text: prompt }], true);

      console.log(`✅ Bot [${message.guild.id}]: Summary request sent to Gemini`);
    } catch (error) {
      console.error(`❌ Bot [${message.guild.id}]: Summarize command error:`, error);
      await message.reply("❌ Failed to generate summary.");
    }
  }

  private async handleDefineCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const connectionManager = this.voiceConnections.get(message.guild.id);

    if (!connectionManager) {
      await message.reply(`❌ I'm not in a voice channel! Use \`${this.prefix} join\` first.`);
      return;
    }

    try {
      const args = message.content.slice(this.prefix.length).trim().split(/ +/);
      args.shift(); // Remove 'define'
      const concept = args.join(' ');

      if (!concept) {
        await message.reply(
          `💬 Please provide a term or concept to define.\n` +
          `**Example:** \`${this.prefix} define mitochondria\``
        );
        return;
      }

      const prompt = `Please provide a clear and concise definition of: ${concept}`;

      console.log(`📖 Bot [${message.guild.id}]: Define request for "${concept}"`);
      await message.reply(`📖 Defining: "${concept}"`);

      const geminiClient = connectionManager.getGeminiClient();
      geminiClient.send([{ text: prompt }], true);

      console.log(`✅ Bot [${message.guild.id}]: Define request sent to Gemini`);
    } catch (error) {
      console.error(`❌ Bot [${message.guild.id}]: Define command error:`, error);
      await message.reply("❌ Failed to process definition request.");
    }
  }

  private async handleTimerCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const connectionManager = this.voiceConnections.get(message.guild.id);

    if (!connectionManager) {
      await message.reply(`❌ I'm not in a voice channel! Use \`${this.prefix} join\` first.`);
      return;
    }

    try {
      const args = message.content.slice(this.prefix.length).trim().split(/ +/);
      args.shift(); // Remove 'timer'
      const minutes = parseInt(args[0]);

      if (!minutes || minutes <= 0 || minutes > 120) {
        await message.reply(
          `⏰ Please provide a valid time in minutes (1-120).\n` +
          `**Example:** \`${this.prefix} timer 25\` for a 25-minute Pomodoro session`
        );
        return;
      }

      // Clear any existing timer for this guild
      const existingTimer = this.sessionTimers.get(message.guild.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const userId = message.author.id;
      console.log(`⏰ Bot [${message.guild.id}]: Timer set for ${minutes} minutes by user ${userId}`);
      await message.reply(`⏰ ${minutes}-minute study timer started! I'll notify you when it's time for a break.`);

      // Set new timer
      const timer = setTimeout(async () => {
        const textChannel = this.textChannels.get(message.guild.id);
        if (textChannel) {
          const embed = new EmbedBuilder()
            .setTitle("⏰ Time's Up!")
            .setDescription(
              `<@${userId}> Your ${minutes}-minute study session is complete!\n\n` +
              `🧘 Take a 5-minute break to rest your mind.\n` +
              `💧 Hydrate and stretch!\n\n` +
              `Use \`${this.prefix} timer <minutes>\` to start another session.`
            )
            .setColor(0xFFAA00)
            .setTimestamp();

          await textChannel.send({ embeds: [embed] });
        }
        this.sessionTimers.delete(message.guild.id);
      }, minutes * 60 * 1000);

      this.sessionTimers.set(message.guild.id, timer);
    } catch (error) {
      console.error(`❌ Bot [${message.guild.id}]: Timer command error:`, error);
      await message.reply("❌ Failed to set timer.");
    }
  }

  private async handleRecapCommand(message: Message) {
    if (!message.guild) {
      await message.reply("This command can only be used in a server!");
      return;
    }

    const connectionManager = this.voiceConnections.get(message.guild.id);

    if (!connectionManager) {
      await message.reply(`❌ I'm not in a voice channel! Use \`${this.prefix} join\` first.`);
      return;
    }

    try {
      const sessionStart = this.sessionStartTimes.get(message.guild.id);
      const sessionDuration = sessionStart 
        ? Math.floor((Date.now() - sessionStart) / 60000) // minutes
        : 0;

      const prompt = 
        "Please provide an end-of-session recap that includes:\n" +
        "1. Main topics we covered\n" +
        "2. Key concepts discussed\n" +
        "3. Number of questions asked\n" +
        "4. Any practice problems or quizzes completed\n" +
        "5. Suggested next steps for continued learning\n\n" +
        "Format this as a comprehensive study session summary.";

      console.log(`📊 Bot [${message.guild.id}]: Recap request (session: ${sessionDuration} min)`);
      
      const embed = new EmbedBuilder()
        .setTitle("📊 Generating Session Recap...")
        .setDescription(`Session Duration: ${sessionDuration} minutes`)
        .setColor(0x5865F2)
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      const geminiClient = connectionManager.getGeminiClient();
      geminiClient.send([{ text: prompt }], true);

      console.log(`✅ Bot [${message.guild.id}]: Recap request sent to Gemini`);
    } catch (error) {
      console.error(`❌ Bot [${message.guild.id}]: Recap command error:`, error);
      await message.reply("❌ Failed to generate session recap.");
    }
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    // Handle bot being disconnected from voice
    if (oldState.member?.id === this.client.user?.id) {
      if (!newState.channel && oldState.channel) {
        const guildId = oldState.guild.id;
        const connectionManager = this.voiceConnections.get(guildId);
        if (connectionManager) {
          connectionManager.disconnect();
          this.voiceConnections.delete(guildId);
          this.textChannels.delete(guildId);
          
          // Clear any active timers
          const timer = this.sessionTimers.get(guildId);
          if (timer) {
            clearTimeout(timer);
            this.sessionTimers.delete(guildId);
          }
          this.sessionStartTimes.delete(guildId);
          
          console.log(`👋 Bot [${guildId}]: Bot disconnected from voice`);
        }
      }
    }

    // Log when bot is alone in channel
    const guildId = newState.guild.id;
    const connectionManager = this.voiceConnections.get(guildId);
    
    if (connectionManager) {
      const channel = newState.guild.members.me?.voice.channel;
      if (channel) {
        const members = channel.members.filter((member: GuildMember) => !member.user.bot);
        if (members.size === 0) {
          console.log(`🔇 Bot [${guildId}]: Bot is alone in voice channel`);
        }
      }
    }
  }

  public async start(token: string) {
    try {
      await this.client.login(token);
      console.log("🚀 Bot started successfully!");
    } catch (error) {
      console.error("❌ Bot: Failed to start:", error);
      throw error;
    }
  }

  public async stop() {
    console.log("🛑 Bot: Shutting down...");
    
    for (const [guildId, connectionManager] of this.voiceConnections) {
      console.log(`🛑 Bot [${guildId}]: Disconnecting...`);
      connectionManager.disconnect();
    }
    
    // Clear all timers
    for (const [guildId, timer] of this.sessionTimers) {
      clearTimeout(timer);
      console.log(`🛑 Bot [${guildId}]: Cleared timer`);
    }
    
    this.voiceConnections.clear();
    this.textChannels.clear();
    this.sessionTimers.clear();
    this.sessionStartTimes.clear();

    this.client.destroy();
    console.log("🛑 Bot stopped.");
  }

  public getClient(): Client {
    return this.client;
  }
}