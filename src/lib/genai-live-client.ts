/**
 * Copyright 2024 Google LLC
 * Enhanced with detailed logging for debugging
 */

import {
  Content,
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
} from "@google/genai";

import { EventEmitter } from "eventemitter3";
import { difference } from "lodash";  
import { LiveClientOptions, StreamingLog, FormattedResponse } from "../types";
import { base64ToArrayBuffer } from "./utils";
import { ResponseFormatter } from "./response-formatter";

export interface LiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: LiveServerContent) => void;
  error: (error: ErrorEvent) => void;
  interrupted: () => void;
  log: (log: StreamingLog) => void;
  open: () => void;
  setupcomplete: () => void;
  toolcall: (toolCall: LiveServerToolCall) => void;
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  turncomplete: () => void;
  voiceResponse: (summary: string) => void;
  textResponse: (analysis: string) => void;
  formattedResponse: (formatted: FormattedResponse) => void;
}

export class GenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  protected client: GoogleGenAI;

  private _status: "connected" | "disconnected" | "connecting" = "disconnected";
  public get status() {
    return this._status;
  }

  private _session: Session | null = null;
  public get session() {
    return this._session;
  }

  private _model: string | null = null;
  public get model() {
    return this._model;
  }

  protected config: LiveConnectConfig | null = null;

  // Buffer for accumulating text content
  private textBuffer: string = "";

  public getConfig() {
    return { ...this.config };
  }

  constructor(options: LiveClientOptions) {
    super();
    this.client = new GoogleGenAI(options);
    this.send = this.send.bind(this);
    this.onopen = this.onopen.bind(this);
    this.onerror = this.onerror.bind(this);
    this.onclose = this.onclose.bind(this);
    this.onmessage = this.onmessage.bind(this);
  }

  protected log(type: string, message: StreamingLog["message"]) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit("log", log);
  }

  async connect(model: string, config: LiveConnectConfig): Promise<boolean> {
    if (this._status === "connected" || this._status === "connecting") {
      return false;
    }

    this._status = "connecting";
    this.config = config;
    this._model = model;
    this.textBuffer = "";

    console.log("🔌 GenAILiveClient connecting...");

    const callbacks: LiveCallbacks = {
      onopen: this.onopen,
      onmessage: this.onmessage,
      onerror: this.onerror,
      onclose: this.onclose,
    };

    try {
      this._session = await this.client.live.connect({
        model,
        config,
        callbacks,
      });
      console.log("✅ GenAILiveClient session created");
    } catch (e) {
      console.error("❌ Error connecting to GenAI Live:", e);
      this._status = "disconnected";
      return false;
    }

    this._status = "connected";
    return true;
  }

  public disconnect() {
    if (!this.session) {
      return false;
    }
    this.session?.close();
    this._session = null;
    this._status = "disconnected";
    this.textBuffer = "";

    this.log("client.close", `Disconnected`);
    console.log("🔌 GenAILiveClient disconnected");
    return true;
  }

  protected onopen() {
    this.log("client.open", "Connected");
    console.log("🔓 GenAILiveClient connection opened");
    this.emit("open");
  }

  protected onerror(e: ErrorEvent) {
    this.log("server.error", e.message);
    console.error("❌ GenAILiveClient error:", e.message);
    this.emit("error", e);
  }

  protected onclose(e: CloseEvent) {
    this.log(
      `server.close`,
      `disconnected ${e.reason ? `with reason: ${e.reason}` : ``}`
    );
    console.log("🔒 GenAILiveClient connection closed:", e.reason || "no reason");
    this.emit("close", e);
  }

  protected async onmessage(message: LiveServerMessage) {
    console.log("📨 GenAILiveClient received message, keys:", Object.keys(message));

    if (message.setupComplete) {
      this.log("server.send", "setupComplete");
      console.log("✅ Setup complete");
      this.emit("setupcomplete");
      return;
    }

    if (message.toolCall) {
      this.log("server.toolCall", message);
      console.log("🔧 Tool call received");
      this.emit("toolcall", message.toolCall);
      return;
    }

    if (message.toolCallCancellation) {
      this.log("server.toolCallCancellation", message);
      console.log("🚫 Tool call cancellation");
      this.emit("toolcallcancellation", message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;
      console.log("📦 Server content received, keys:", Object.keys(serverContent));

      if ("interrupted" in serverContent) {
        this.log("server.content", "interrupted");
        console.log("⚠️ Response interrupted");
        this.emit("interrupted");
        this.textBuffer = "";
        return;
      }

      if ("turnComplete" in serverContent) {
        this.log("server.content", "turnComplete");
        console.log("✅ Turn complete, text buffer length:", this.textBuffer.length);
        
        // Process accumulated text buffer when turn completes
        if (this.textBuffer.trim()) {
          console.log("📝 Processing accumulated text:", this.textBuffer.substring(0, 200) + "...");
          this.processTextResponse(this.textBuffer);
          this.textBuffer = "";
        } else {
          console.warn("⚠️ Turn complete but text buffer is empty!");
        }
        
        this.emit("turncomplete");
        return;
      }

      if ("modelTurn" in serverContent) {
        let parts: Part[] = serverContent.modelTurn?.parts || [];
        console.log("🤖 Model turn received with", parts.length, "parts");

        // Process audio parts
        const audioParts = parts.filter(
          (p) => p.inlineData && p.inlineData.mimeType?.startsWith("audio/pcm")
        );
        
        if (audioParts.length > 0) {
          console.log("🔊 Found", audioParts.length, "audio parts");
        }

        const base64s = audioParts.map((p) => p.inlineData?.data);
        const otherParts = difference(parts, audioParts);

        base64s.forEach((b64) => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emit("audio", data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });

        if (!otherParts.length) {
          console.log("ℹ️ No non-audio parts to process");
          return;
        }

        parts = otherParts;

        // Accumulate text content
        parts.forEach((part) => {
          if (part.text) {
            console.log("📝 Accumulating text chunk:", part.text.substring(0, 100) + "...");
            this.textBuffer += part.text;
          } else {
            console.log("ℹ️ Part has no text:", Object.keys(part));
          }
        });

        console.log("📊 Current text buffer length:", this.textBuffer.length);

        const content: { modelTurn: Content } = { modelTurn: { parts } };
        this.emit("content", content);
        this.log(`server.content`, message);
      }
    } else {
      console.warn("⚠️ Received unmatched message:", message);
    }
  }

  /**
   * Process complete text response using ResponseFormatter
   */
  private processTextResponse(text: string) {
    console.log("🔄 Processing text response, length:", text.length);
    console.log("📄 Full text preview:", text.substring(0, 300));

    try {
      const formatted = ResponseFormatter.formatResponse(text);
      
      console.log("✂️ Formatted response:");
      console.log("  - Voice summary:", formatted.voiceSummary.substring(0, 100));
      console.log("  - Detailed analysis length:", formatted.detailedAnalysis.length);
      
      // Emit separate events for voice and text
      this.emit("voiceResponse", formatted.voiceSummary);
      this.emit("textResponse", formatted.detailedAnalysis);
      this.emit("formattedResponse", formatted);
      
      console.log("✅ Emitted all formatted response events");
      
      this.log("client.formattedResponse", {
        voiceSummary: `${formatted.voiceSummary.substring(0, 50)}...`,
        detailedAnalysis: `${formatted.detailedAnalysis.substring(0, 50)}...`,
      });
    } catch (error) {
      console.error("❌ Error formatting response:", error);
      // Fallback: emit original text for both
      this.emit("voiceResponse", text.substring(0, 500));
      this.emit("textResponse", text);
    }
  }

  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    let hasAudio = false;
    let hasVideo = false;
    for (const ch of chunks) {
      this.session?.sendRealtimeInput({ media: ch });
      if (ch.mimeType.includes("audio")) {
        hasAudio = true;
      }
      if (ch.mimeType.includes("image")) {
        hasVideo = true;
      }
      if (hasAudio && hasVideo) {
        break;
      }
    }
    const message =
      hasAudio && hasVideo
        ? "audio + video"
        : hasAudio
        ? "audio"
        : hasVideo
        ? "video"
        : "unknown";
    this.log(`client.realtimeInput`, message);
    console.log("📤 Sent realtime input:", message);
  }

  sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this.session?.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      });
      this.log(`client.toolResponse`, toolResponse);
      console.log("🔧 Sent tool response");
    }
  }

  send(parts: Part | Part[], turnComplete: boolean = true) {
    this.session?.sendClientContent({ turns: parts, turnComplete });
    this.log(`client.send`, {
      turns: Array.isArray(parts) ? parts : [parts],
      turnComplete,
    });
    console.log("📤 Sent client content, turnComplete:", turnComplete);
  }
}