
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION, IRIS_VOICE, GEMINI_MODEL } from "../constants";
import { decodeBase64, decodeAudioData, createPcmBlob } from "./audioUtils";

export interface GeminiSessionCallbacks {
  onAudioChunk: (buffer: AudioBuffer) => void;
  onInterrupted: () => void;
  onTranscription: (text: string, isUser: boolean) => void;
  onTurnComplete: () => void;
  onClose: () => void;
  onError: (error: any) => void;
}

export class GeminiLiveSession {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private microphoneStream: MediaStream | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  }

  async connect(callbacks: GeminiSessionCallbacks) {
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    
    this.sessionPromise = this.ai.live.connect({
      model: GEMINI_MODEL,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: IRIS_VOICE } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          console.log("Gemini Live Session Opened");
          this.startMicrophone();
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
            const audioBytes = decodeBase64(message.serverContent.modelTurn.parts[0].inlineData.data);
            const audioBuffer = await decodeAudioData(audioBytes, this.inputAudioContext!, 24000, 1);
            callbacks.onAudioChunk(audioBuffer);
          }

          if (message.serverContent?.interrupted) {
            callbacks.onInterrupted();
          }

          if (message.serverContent?.inputTranscription) {
            callbacks.onTranscription(message.serverContent.inputTranscription.text, true);
          }
          if (message.serverContent?.outputTranscription) {
            callbacks.onTranscription(message.serverContent.outputTranscription.text, false);
          }

          if (message.serverContent?.turnComplete) {
            callbacks.onTurnComplete();
          }
        },
        onclose: () => {
          this.cleanup();
          callbacks.onClose();
        },
        onerror: (e) => {
          this.cleanup();
          callbacks.onError(e);
        }
      }
    });

    return this.sessionPromise;
  }

  private async startMicrophone() {
    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.inputAudioContext!.createMediaStreamSource(this.microphoneStream);
      this.scriptProcessor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        
        this.sessionPromise?.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioContext!.destination);
    } catch (err) {
      console.error("Microphone access failed", err);
    }
  }

  stop() {
    this.cleanup();
    this.sessionPromise?.then(session => session.close());
  }

  private cleanup() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop());
      this.microphoneStream = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
  }
}
