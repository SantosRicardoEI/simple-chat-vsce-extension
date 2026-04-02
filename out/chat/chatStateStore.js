"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatStateStore = void 0;
const chatType_1 = require("./chatType");
const CHAT_SESSION_STATE_KEY = "simpleChat.sessionState";
class ChatStateStore {
    context;
    constructor(context) {
        this.context = context;
    }
    getSnapshot() {
        const stored = this.context.globalState.get(CHAT_SESSION_STATE_KEY);
        if (!stored) {
            return this.cloneDefaultSnapshot();
        }
        return this.mergeWithDefaults(stored);
    }
    async saveSnapshot(snapshot) {
        const normalized = this.mergeWithDefaults(snapshot);
        await this.context.globalState.update(CHAT_SESSION_STATE_KEY, normalized);
    }
    async updateSnapshot(updater) {
        const current = this.getSnapshot();
        const next = this.mergeWithDefaults(updater(current));
        await this.context.globalState.update(CHAT_SESSION_STATE_KEY, next);
        return next;
    }
    async clearSnapshot() {
        await this.context.globalState.update(CHAT_SESSION_STATE_KEY, this.cloneDefaultSnapshot());
    }
    mergeWithDefaults(snapshot) {
        return {
            ...this.cloneDefaultSnapshot(),
            ...snapshot,
            messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
        };
    }
    cloneDefaultSnapshot() {
        return {
            ...chatType_1.DEFAULT_CHAT_SESSION_SNAPSHOT,
            messages: [...chatType_1.DEFAULT_CHAT_SESSION_SNAPSHOT.messages],
        };
    }
}
exports.ChatStateStore = ChatStateStore;
//# sourceMappingURL=chatStateStore.js.map