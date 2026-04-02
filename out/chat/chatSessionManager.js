"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSessionManager = void 0;
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
const HTTP_BASE_URL = "https://chat-server-production-1962.up.railway.app";
const WS_URL = "wss://chat-server-production-1962.up.railway.app";
class ChatSessionManager extends events_1.EventEmitter {
    stateStore;
    snapshot;
    ws = null;
    constructor(stateStore) {
        super();
        this.stateStore = stateStore;
        this.snapshot = this.stateStore.getSnapshot();
    }
    getSnapshot() {
        return this.cloneSnapshot(this.snapshot);
    }
    async restoreFromStore() {
        this.snapshot = this.stateStore.getSnapshot();
        this.emit("snapshot_changed", this.getSnapshot());
        this.emit("connection_status_changed", this.snapshot.connectionStatus);
    }
    async connect(request) {
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
        await this.updateSnapshot({
            username,
            roomCode,
            password,
            mode,
            shouldReconnect: true,
        }, { emitSnapshotChanged: true });
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
            const infoMessage = {
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
        }
        catch (error) {
            await this.setConnectionStatus("disconnected");
            await this.emitError("Failed to connect to the server.");
            console.error("Simple Chat connect error:");
            console.error(error);
        }
    }
    async reconnectIfNeeded() {
        const snapshot = this.getSnapshot();
        console.log("[Simple Chat][manager] reconnectIfNeeded snapshot:", snapshot);
        if (!snapshot.shouldReconnect) {
            return;
        }
        if (!snapshot.username.trim() || !snapshot.roomCode.trim()) {
            return;
        }
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            return;
        }
        await this.connect({
            username: snapshot.username,
            roomCode: snapshot.roomCode,
            password: snapshot.password,
            mode: snapshot.mode,
        });
    }
    async disconnect(manual = true) {
        if (manual) {
            await this.updateSnapshot({
                shouldReconnect: false,
            }, { emitSnapshotChanged: true });
        }
        await this.closeSocket();
        await this.setConnectionStatus("disconnected");
    }
    async sendMessage(content) {
        const trimmed = content.trim();
        if (!trimmed) {
            return;
        }
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            await this.emitError("You are not connected.");
            return;
        }
        this.ws.send(JSON.stringify({
            type: "chat_message",
            content: trimmed,
        }));
    }
    async requestOnlineUsers() {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            await this.emitError("You are not connected.");
            return;
        }
        this.ws.send(JSON.stringify({
            type: "list_users",
        }));
    }
    async markViewVisible(isVisible) {
        const nextUnreadCount = isVisible ? 0 : this.snapshot.unreadCount;
        await this.updateSnapshot({
            isViewVisible: isVisible,
            unreadCount: nextUnreadCount,
        }, { emitSnapshotChanged: false });
    }
    async clearSession() {
        await this.closeSocket();
        await this.stateStore.clearSnapshot();
        this.snapshot = this.stateStore.getSnapshot();
        this.emit("snapshot_changed", this.getSnapshot());
        this.emit("connection_status_changed", this.snapshot.connectionStatus);
    }
    async createRoom(roomCode, password) {
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
        return (await response.json());
    }
    async joinRoom(roomCode, password) {
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
        return (await response.json());
    }
    async openSocket(params) {
        await new Promise((resolve, reject) => {
            const ws = new ws_1.default(WS_URL);
            let settled = false;
            ws.on("open", () => {
                this.ws = ws;
                ws.send(JSON.stringify({
                    type: "join_room",
                    roomCode: params.roomCode,
                    username: params.username,
                    password: params.password,
                }));
            });
            ws.on("message", async (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
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
                        const systemMessage = {
                            username: "system",
                            content: parsed.message,
                            type: "system",
                            created_at: new Date().toISOString(),
                        };
                        await this.handleIncomingMessage(systemMessage);
                    }
                }
                catch (error) {
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
                }
                else {
                    await this.emitError("WebSocket connection error.");
                }
            });
        });
    }
    async handleIncomingMessage(message) {
        const nextMessages = [...this.snapshot.messages, message];
        const shouldIncrementUnread = !this.snapshot.isViewVisible && message.type === "chat";
        const nextUnreadCount = shouldIncrementUnread
            ? this.snapshot.unreadCount + 1
            : this.snapshot.unreadCount;
        await this.updateSnapshot({
            messages: nextMessages,
            unreadCount: nextUnreadCount,
        }, { emitSnapshotChanged: false });
        this.emit("message_added", message);
    }
    async replaceMessages(messages) {
        await this.updateSnapshot({
            messages,
            unreadCount: this.snapshot.isViewVisible ? 0 : this.snapshot.unreadCount,
        }, { emitSnapshotChanged: false });
        this.emit("messages_replaced", [...messages]);
    }
    async setConnectionStatus(status) {
        await this.updateSnapshot({
            connectionStatus: status,
        }, { emitSnapshotChanged: false });
        this.emit("connection_status_changed", status);
    }
    async emitError(message) {
        this.emit("error", message);
    }
    async closeSocket() {
        if (!this.ws) {
            return;
        }
        const currentWs = this.ws;
        this.ws = null;
        await new Promise((resolve) => {
            const readyState = currentWs.readyState;
            if (readyState === ws_1.default.CLOSING ||
                readyState === ws_1.default.CLOSED) {
                resolve();
                return;
            }
            currentWs.once("close", () => resolve());
            try {
                currentWs.close();
            }
            catch {
                resolve();
            }
        });
    }
    async updateSnapshot(partial, options) {
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
    cloneSnapshot(snapshot) {
        return {
            ...snapshot,
            messages: [...snapshot.messages],
        };
    }
}
exports.ChatSessionManager = ChatSessionManager;
//# sourceMappingURL=chatSessionManager.js.map