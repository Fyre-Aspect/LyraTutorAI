/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenAILiveClient } from "@/lib/genai-live-client";
import { LiveClientOptions, FormattedResponse } from "@/types";
import { AudioStreamer } from "@/lib/audio-streamer";
import { audioContext } from "@/lib/utils";
import VolMeterWorket from "@/lib/worklets/vol-meter";
import { LiveConnectConfig } from "@google/genai";

export type UseLiveAPIResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  model: string;
  setModel: (model: string) => void;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  // NEW: Response formatting results
  voiceResponse: string | null;
  textResponse: string | null;
  formattedResponse: FormattedResponse | null;
};

export function useLiveAPI(options: LiveClientOptions): UseLiveAPIResults {
  const client = useMemo(() => new GenAILiveClient(options), [options]);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [model, setModel] = useState<string>("models/gemini-2.0-flash-exp");
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [connected, setConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  
  // NEW: State for formatted responses
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState<string | null>(null);
  const [formattedResponse, setFormattedResponse] = useState<FormattedResponse | null>(null);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet("vumeter-out", VolMeterWorket, (ev: MessageEvent) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
    };

    const onError = (error: ErrorEvent) => {
      console.error("error", error);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) =>
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));

    // NEW: Handle formatted response events
    const onVoiceResponse = (summary: string) => {
      console.log("📢 Voice summary received:", summary.substring(0, 100));
      setVoiceResponse(summary);
    };

    const onTextResponse = (analysis: string) => {
      console.log("📝 Detailed analysis received:", analysis.substring(0, 100));
      setTextResponse(analysis);
    };

    const onFormattedResponse = (formatted: FormattedResponse) => {
      console.log("✅ Formatted response complete");
      setFormattedResponse(formatted);
    };

    client
      .on("error", onError)
      .on("open", onOpen)
      .on("close", onClose)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio)
      .on("voiceResponse", onVoiceResponse)
      .on("textResponse", onTextResponse)
      .on("formattedResponse", onFormattedResponse);

    return () => {
      client
        .off("error", onError)
        .off("open", onOpen)
        .off("close", onClose)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio)
        .off("voiceResponse", onVoiceResponse)
        .off("textResponse", onTextResponse)
        .off("formattedResponse", onFormattedResponse)
        .disconnect();
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error("config has not been set");
    }
    client.disconnect();
    await client.connect(model, config);
  }, [client, config, model]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
    // Clear formatted responses on disconnect
    setVoiceResponse(null);
    setTextResponse(null);
    setFormattedResponse(null);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    model,
    setModel,
    connected,
    connect,
    disconnect,
    volume,
    voiceResponse,
    textResponse,
    formattedResponse,
  };
}