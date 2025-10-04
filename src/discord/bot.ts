/**
 * Discord Bot for Gemini Live API Integration
 * Handles voice channel connections and audio streaming
 */

import {
  Client,
  GatewayIntentBits,
  VoiceState,
  Message,
  GuildMember,
  ChannelType,
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

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once("ready", () => {
      console.log(`✅ Bot is ready! Logged in as ${this.client.user?.tag}`);
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
          default:
            await message.reply(
              `Unknown command. Use \`${this.prefix} help\` for available commands.`
            );
        }
      } catch (error) {
        console.error("Error handling command:", error);
        await message.reply("❌ An error occurred while processing your command.");
      }
    });

    this.client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
      await this.handleVoiceStateUpdate(oldState, newState);
    });

    this.client.on("error", (error: Error) => {
      console.error("Discord client error:", error);
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

    // Check if it's a regular voice channel (not stage channel)
    if (voiceChannel.type !== ChannelType.GuildVoice) {
      await message.reply("❌ I can only join regular voice channels!");
      return;
    }

    if (this.voiceConnections.has(message.guild.id)) {
      await message.reply("⚠️ I'm already in a voice channel in this server!");
      return;
    }

    try {
      await message.reply("🔄 Joining voice channel and connecting to Gemini...");

      const connectionManager = new VoiceConnectionManager(
        voiceChannel as any, // Type cast needed due to Discord.js type complexity
        this.geminiApiKey,
        this.model,
        this.liveConfig
      );

      await connectionManager.connect();
      this.voiceConnections.set(message.guild.id, connectionManager);

      await message.reply(
        `✅ Joined ${voiceChannel.name} and connected to Gemini! Start speaking to interact.`
      );
    } catch (error) {
      console.error("Error joining voice channel:", error);
      await message.reply("❌ Failed to join voice channel or connect to Gemini.");
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
      await message.reply("👋 Left the voice channel and disconnected from Gemini.");
    } catch (error) {
      console.error("Error leaving voice channel:", error);
      await message.reply("❌ Failed to leave voice channel.");
    }
  }

  private async handleHelpCommand(message: Message) {
    const helpText = `
**Gemini Discord Bot Commands**

\`${this.prefix} join\` - Join your current voice channel and start listening
\`${this.prefix} leave\` - Leave the voice channel
\`${this.prefix} status\` - Check bot status
\`${this.prefix} test\` - Run audio processor tests
\`${this.prefix} help\` - Show this help message

**How to use:**
1. Join a voice channel
2. Use \`${this.prefix} join\` to invite the bot
3. Start speaking - the bot will listen and respond with voice
4. The bot can hear multiple people in the channel
    `;

    await message.reply(helpText);
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
    const statusText = `
**Bot Status**
🔊 Voice Channel: ${status.channelName}
🤖 Gemini Model: ${status.model}
📡 Voice Connection: ${status.voiceConnectionState}
🔗 Gemini Connection: ${status.geminiConnected ? "Connected" : "Disconnected"}
👥 Users in Channel: ${status.usersInChannel}
🎵 Queued Audio Chunks: ${status.queuedAudioChunks || 0}
    `;

    await message.reply(statusText);
  }

  private async handleTestCommand(message: Message) {
    await message.reply("🧪 Running audio processor tests... Check console for results.");
    
    try {
      const { DiscordAudioProcessor } = await import("./audio-processor-v2");
      const processor = new DiscordAudioProcessor();
      await processor.runTests();
      await message.reply("✅ Audio processor tests completed! Check console for detailed results.");
    } catch (error) {
      console.error("Test error:", error);
      await message.reply("❌ Audio processor tests failed. Check console for errors.");
    }
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    // Check if the bot was disconnected or moved
    if (oldState.member?.id === this.client.user?.id) {
      if (!newState.channel && oldState.channel) {
        // Bot was disconnected
        const guildId = oldState.guild.id;
        const connectionManager = this.voiceConnections.get(guildId);
        if (connectionManager) {
          connectionManager.disconnect();
          this.voiceConnections.delete(guildId);
          console.log(`Bot was disconnected from voice channel in guild ${guildId}`);
        }
      }
    }

    // Check if we're alone in the channel
    const guildId = newState.guild.id;
    const connectionManager = this.voiceConnections.get(guildId);
    
    if (connectionManager) {
      const channel = newState.guild.members.me?.voice.channel;
      if (channel) {
        const members = channel.members.filter((member: GuildMember) => !member.user.bot);
        if (members.size === 0) {
          // We're alone, optionally disconnect after a timeout
          console.log(`Bot is alone in voice channel in guild ${guildId}`);
          // Optionally implement auto-disconnect logic here
        }
      }
    }
  }

  public async start(token: string) {
    try {
      await this.client.login(token);
      console.log("🚀 Bot started successfully!");
    } catch (error) {
      console.error("Failed to start bot:", error);
      throw error;
    }
  }

  public async stop() {
    // Disconnect all voice connections
    for (const [, connectionManager] of this.voiceConnections) {
      connectionManager.disconnect();
    }
    this.voiceConnections.clear();

    // Destroy the client
    this.client.destroy();
    console.log("🛑 Bot stopped.");
  }

  public getClient(): Client {
    return this.client;
  }
}
