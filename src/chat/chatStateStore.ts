import * as vscode from "vscode";
import {
  ChatSessionSnapshot,
  DEFAULT_CHAT_SESSION_SNAPSHOT,
} from "./chatType";

const CHAT_SESSION_STATE_KEY = "simpleChat.sessionState";

export class ChatStateStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getSnapshot(): ChatSessionSnapshot {
    const stored =
      this.context.globalState.get<ChatSessionSnapshot>(CHAT_SESSION_STATE_KEY);

    if (!stored) {
      return this.cloneDefaultSnapshot();
    }

    return this.mergeWithDefaults(stored);
  }

  async saveSnapshot(snapshot: ChatSessionSnapshot): Promise<void> {
    const normalized = this.mergeWithDefaults(snapshot);
    await this.context.globalState.update(CHAT_SESSION_STATE_KEY, normalized);
  }

  async updateSnapshot(
    updater: (current: ChatSessionSnapshot) => ChatSessionSnapshot
  ): Promise<ChatSessionSnapshot> {
    const current = this.getSnapshot();
    const next = this.mergeWithDefaults(updater(current));

    await this.context.globalState.update(CHAT_SESSION_STATE_KEY, next);

    return next;
  }

  async clearSnapshot(): Promise<void> {
    await this.context.globalState.update(
      CHAT_SESSION_STATE_KEY,
      this.cloneDefaultSnapshot()
    );
  }

  private mergeWithDefaults(
    snapshot: Partial<ChatSessionSnapshot>
  ): ChatSessionSnapshot {
    return {
      ...this.cloneDefaultSnapshot(),
      ...snapshot,
      messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
    };
  }

  private cloneDefaultSnapshot(): ChatSessionSnapshot {
    return {
      ...DEFAULT_CHAT_SESSION_SNAPSHOT,
      messages: [...DEFAULT_CHAT_SESSION_SNAPSHOT.messages],
    };
  }
}