import { EventEmitter } from "events";
import WebSocket from "ws";
import {
  ChatConnectionStatus,
  ChatMessage,
  ChatSessionSnapshot,
  ConnectRequest,
  RoomResponse,
} from "./chatType";
import { ChatStateStore } from "./chatStateStore";

type ServerWsMessage =
  | {
      type: "system";
      message: string;
    }
  | {
      type: "join_success";
      room: {
        id: string;
        code: string;
        created_at: string;
      };
    }
  | {
      type: "join_error";
      error: string;
    }
  | {
      type: "error";
      error: string;
    }
  | {
      type: "users_list";
      users: string[];
    }
  | {
      type: "new_message";
      message: ChatMessage;
    };

export type ChatSessionManagerEvent =
  | "snapshot_changed"
  | "connection_status_changed"
  | "message_added"
  | "messages_replaced"
  | "users_list"
  | "error";

const HTTP_BASE_URL = "https://chat-server-production-1962.up.railway.app";
const WS_URL = "wss://chat-server-production-1962.up.railway.app";

export class ChatSessionManager extends EventEmitter {
  private snapshot: ChatSessionSnapshot;
  private ws: WebSocket | null = null;

  constructor(private readonly stateStore: ChatStateStore) {
    super();
    this.snapshot = this.stateStore.getSnapshot();
  }

  getSnapshot(): ChatSessionSnapshot {
    return this.cloneSnapshot(this.snapshot);
  }

  async restoreFromStore(): Promise<void> {
    this.snapshot = this.stateStore.getSnapshot();
    this.emit("snapshot_changed", this.getSnapshot());
    this.emit("connection_status_changed", this.snapshot.connectionStatus);
  }

  async connect(request: ConnectRequest): Promise<void> {
    console.log("[Simple Chat][manager] connect called with:", request);

    const username = request.username.trim();
    const roomCode = request.roomCode.trim();
    const password = request.password;
    const mode = request.mode;

    if (!username || !roomCode) {
      await this.emitError("Username and room code are required.");
      return;
    }

    await this.setConnectionStatus("connecting");
    await this.updateSnapshot(
      {
        username,
        roomCode,
        password,
        mode,
        shouldReconnect: true,
      },
      { emitSnapshotChanged: true }
    );

    try {
      if (mode === "create") {
        const createData = await this.createRoom(roomCode, password);

        if (!createData.ok || !createData.room) {
          await this.setConnectionStatus("disconnected");
          await this.emitError(createData.error ?? "Error creating room.");
          return;
        }
      }

      const joinData = await this.joinRoom(roomCode, password);

      if (!joinData.ok || !joinData.room || !joinData.messages) {
        await this.setConnectionStatus("disconnected");
        await this.emitError(joinData.error ?? "Error joining room.");
        return;
      }

      const infoMessage: ChatMessage = {
        username: "system",
        content: `Connected to room: ${joinData.room.code}`,
        type: "system",
        created_at: new Date().toISOString(),
      };

      const hydratedMessages = [...joinData.messages, infoMessage];

      await this.replaceMessages(hydratedMessages);

      await this.closeSocket();

      await this.openSocket({
        username,
        roomCode: joinData.room.code,
        password,
      });
    } catch (error) {
      await this.setConnectionStatus("disconnected");
      await this.emitError("Failed to connect to the server.");
      console.error("Simple Chat connect error:");
      console.error(error);
    }
  }

  async reconnectIfNeeded(): Promise<void> {
    const snapshot = this.getSnapshot();
    console.log("[Simple Chat][manager] reconnectIfNeeded snapshot:", snapshot);

    if (!snapshot.shouldReconnect) {
      return;
    }

    if (!snapshot.username.trim() || !snapshot.roomCode.trim()) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    await this.connect({
      username: snapshot.username,
      roomCode: snapshot.roomCode,
      password: snapshot.password,
      mode: snapshot.mode,
    });
  }

  async disconnect(manual = true): Promise<void> {
    if (manual) {
      await this.updateSnapshot(
        {
          shouldReconnect: false,
        },
        { emitSnapshotChanged: true }
      );
    }

    await this.closeSocket();
    await this.setConnectionStatus("disconnected");
  }

  async sendMessage(content: string): Promise<void> {
    const trimmed = content.trim();

    if (!trimmed) {
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.emitError("You are not connected.");
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "chat_message",
        content: trimmed,
      })
    );
  }

  async requestOnlineUsers(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.emitError("You are not connected.");
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "list_users",
      })
    );
  }

  async markViewVisible(isVisible: boolean): Promise<void> {
    const nextUnreadCount = isVisible ? 0 : this.snapshot.unreadCount;

    await this.updateSnapshot(
      {
        isViewVisible: isVisible,
        unreadCount: nextUnreadCount,
      },
      { emitSnapshotChanged: false }
    );
  }

  async clearSession(): Promise<void> {
    await this.closeSocket();
    await this.stateStore.clearSnapshot();
    this.snapshot = this.stateStore.getSnapshot();
    this.emit("snapshot_changed", this.getSnapshot());
    this.emit("connection_status_changed", this.snapshot.connectionStatus);
  }

  private async createRoom(
    roomCode: string,
    password: string
  ): Promise<RoomResponse> {
    const response = await fetch(`${HTTP_BASE_URL}/rooms/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: roomCode,
        password,
      }),
    });

    return (await response.json()) as RoomResponse;
  }

  private async joinRoom(
    roomCode: string,
    password: string
  ): Promise<RoomResponse> {
    const response = await fetch(`${HTTP_BASE_URL}/rooms/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: roomCode,
        password,
      }),
    });

    return (await response.json()) as RoomResponse;
  }

  private async openSocket(params: {
    username: string;
    roomCode: string;
    password: string;
  }): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let settled = false;

      ws.on("open", () => {
        this.ws = ws;

        ws.send(
          JSON.stringify({
            type: "join_room",
            roomCode: params.roomCode,
            username: params.username,
            password: params.password,
          })
        );
      });

      ws.on("message", async (data) => {
        try {
          const parsed = JSON.parse(data.toString()) as ServerWsMessage;

          if (parsed.type === "join_success") {
            await this.setConnectionStatus("connected");

            if (!settled) {
              settled = true;
              resolve();
            }
            return;
          }

          if (parsed.type === "join_error") {
            await this.setConnectionStatus("disconnected");
            await this.emitError(parsed.error);

            if (!settled) {
              settled = true;
              reject(new Error(parsed.error));
            }
            return;
          }

          if (parsed.type === "error") {
            await this.emitError(parsed.error);
            return;
          }

          if (parsed.type === "users_list") {
            this.emit("users_list", parsed.users);
            return;
          }

          if (parsed.type === "new_message") {
            await this.handleIncomingMessage(parsed.message);
            return;
          }

          if (parsed.type === "system") {
            const systemMessage: ChatMessage = {
              username: "system",
              content: parsed.message,
              type: "system",
              created_at: new Date().toISOString(),
            };

            await this.handleIncomingMessage(systemMessage);
          }
        } catch (error) {
          await this.emitError("Invalid message received from server.");
          console.error("Simple Chat socket parse error:");
          console.error(error);
        }
      });

      ws.on("close", async () => {
        this.ws = null;
        await this.setConnectionStatus("disconnected");
      });

      ws.on("error", async (error) => {
        await this.setConnectionStatus("disconnected");

        if (!settled) {
          settled = true;
          reject(error);
        } else {
          await this.emitError("WebSocket connection error.");
        }
      });
    });
  }

  private async handleIncomingMessage(message: ChatMessage): Promise<void> {
    const nextMessages = [...this.snapshot.messages, message];

    const shouldIncrementUnread =
      !this.snapshot.isViewVisible && message.type === "chat";

    const nextUnreadCount = shouldIncrementUnread
      ? this.snapshot.unreadCount + 1
      : this.snapshot.unreadCount;

    await this.updateSnapshot(
      {
        messages: nextMessages,
        unreadCount: nextUnreadCount,
      },
      { emitSnapshotChanged: false }
    );

    this.emit("message_added", message);
  }

  private async replaceMessages(messages: ChatMessage[]): Promise<void> {
    await this.updateSnapshot(
      {
        messages,
        unreadCount: this.snapshot.isViewVisible ? 0 : this.snapshot.unreadCount,
      },
      { emitSnapshotChanged: false }
    );

    this.emit("messages_replaced", [...messages]);
  }

  private async setConnectionStatus(
    status: ChatConnectionStatus
  ): Promise<void> {
    await this.updateSnapshot(
      {
        connectionStatus: status,
      },
      { emitSnapshotChanged: false }
    );

    this.emit("connection_status_changed", status);
  }

  private async emitError(message: string): Promise<void> {
    this.emit("error", message);
  }

  private async closeSocket(): Promise<void> {
    if (!this.ws) {
      return;
    }

    const currentWs = this.ws;
    this.ws = null;

    await new Promise<void>((resolve) => {
      const readyState = currentWs.readyState;

      if (
        readyState === WebSocket.CLOSING ||
        readyState === WebSocket.CLOSED
      ) {
        resolve();
        return;
      }

      currentWs.once("close", () => resolve());

      try {
        currentWs.close();
      } catch {
        resolve();
      }
    });
  }

  private async updateSnapshot(
    partial: Partial<ChatSessionSnapshot>,
    options?: {
      emitSnapshotChanged?: boolean;
    }
  ): Promise<void> {
    console.log("[Simple Chat][manager] updateSnapshot partial:", partial);

    const nextSnapshot = {
      ...this.snapshot,
      ...partial,
      messages: partial.messages ?? this.snapshot.messages,
    };

    this.snapshot = nextSnapshot;
    await this.stateStore.saveSnapshot(nextSnapshot);

    if (options?.emitSnapshotChanged ?? true) {
      this.emit("snapshot_changed", this.getSnapshot());
    }
  }

  private cloneSnapshot(snapshot: ChatSessionSnapshot): ChatSessionSnapshot {
    return {
      ...snapshot,
      messages: [...snapshot.messages],
    };
  }
}