
export enum IrisState {
  IDLE = 'IDLE',
  LISTENING_WAKEWORD = 'LISTENING_WAKEWORD',
  ACTIVE_LISTENING = 'ACTIVE_LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}

export interface Message {
  role: 'user' | 'iris';
  text: string;
  timestamp: number;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
}
