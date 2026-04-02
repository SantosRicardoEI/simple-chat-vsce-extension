export type ChatConnectionStatus = "disconnected" | "connecting" | "connected";

export type ChatMode = "join" | "create";

export type ChatMessageType = "chat" | "system";

export interface ChatMessage {
  id?: number;
  room_id?: string;
  username: string;
  content: string;
  type: ChatMessageType;
  created_at: string;
}

export interface RoomDto {
  id: string;
  code: string;
  created_at: string;
}

export interface RoomResponse {
  ok: boolean;
  room?: RoomDto;
  messages?: ChatMessage[];
  error?: string;
}

export interface ConnectRequest {
  username: string;
  roomCode: string;
  password: string;
  mode: ChatMode;
}

export interface ChatSessionSnapshot {
  username: string;
  roomCode: string;
  password: string;
  mode: ChatMode;
  connectionStatus: ChatConnectionStatus;
  messages: ChatMessage[];
  unreadCount: number;
  shouldReconnect: boolean;
  isViewVisible: boolean;
}

export const DEFAULT_CHAT_SESSION_SNAPSHOT: ChatSessionSnapshot = {
  username: "",
  roomCode: "",
  password: "",
  mode: "join",
  connectionStatus: "disconnected",
  messages: [],
  unreadCount: 0,
  shouldReconnect: false,
  isViewVisible: false,
};