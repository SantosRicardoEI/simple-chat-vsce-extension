import * as vscode from "vscode";
import { ChatSessionManager } from "../chat/chatSessionManager";
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "../chat/webviewProtocol";

export class TerminalChatViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly sessionManager: ChatSessionManager
  ) {
    this.registerManagerListeners();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    console.log("[Simple Chat][provider] resolveWebviewView called");
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        await this.handleWebviewMessage(message);
      }
    );

    const visibilityDisposable = webviewView.onDidChangeVisibility(async () => {
      const isVisible = webviewView.visible;
      await this.sessionManager.markViewVisible(isVisible);

      if (isVisible) {
        this.postMessage({
          type: "hydrate",
          payload: {
            snapshot: this.sessionManager.getSnapshot(),
          },
        });
      }
    });

    const disposeDisposable = webviewView.onDidDispose(() => {
      this.view = null;
    });

    this.disposables.push(
      messageDisposable,
      visibilityDisposable,
      disposeDisposable
    );

    webviewView.webview.html = this.getWebviewHtml();
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  private registerManagerListeners(): void {
    this.sessionManager.on("snapshot_changed", (snapshot) => {
      this.postMessage({
        type: "hydrate",
        payload: {
          snapshot,
        },
      });
    });

    this.sessionManager.on("connection_status_changed", (status) => {
      this.postMessage({
        type: "connection_status",
        payload: {
          status,
        },
      });
    });

    this.sessionManager.on("message_added", (message) => {
      this.postMessage({
        type: "message_added",
        payload: {
          message,
        },
      });
    });

    this.sessionManager.on("messages_replaced", (messages) => {
      this.postMessage({
        type: "messages_replaced",
        payload: {
          messages,
        },
      });
    });

    this.sessionManager.on("users_list", (users: string[]) => {
      this.postMessage({
        type: "users_list",
        payload: {
          users,
        },
      });
    });

    this.sessionManager.on("error", (message: string) => {
      this.postMessage({
        type: "error",
        payload: {
          message,
        },
      });
    });
  }

  private async handleWebviewMessage(
    message: WebviewToExtensionMessage
  ): Promise<void> {
    console.log("[Simple Chat][provider] received from webview:", message);

    switch (message.type) {
      case "view_ready": {
        const isVisible = this.view?.visible ?? false;
        await this.sessionManager.markViewVisible(isVisible);

        this.postMessage({
          type: "hydrate",
          payload: {
            snapshot: this.sessionManager.getSnapshot(),
          },
        });

        await this.sessionManager.reconnectIfNeeded();
        return;
      }

      case "connect": {
        await this.sessionManager.connect(message.payload);
        return;
      }

      case "disconnect": {
        await this.sessionManager.disconnect(true);
        return;
      }

      case "send_message": {
        await this.sessionManager.sendMessage(message.payload.content);
        return;
      }

      case "list_users": {
        await this.sessionManager.requestOnlineUsers();
        return;
      }

      case "insert_selection_request": {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          this.postMessage({
            type: "error",
            payload: {
              message: "There is no active editor.",
            },
          });
          return;
        }

        const selectedText = editor.document.getText(editor.selection);

        if (!selectedText.trim()) {
          this.postMessage({
            type: "error",
            payload: {
              message: "No text is currently selected.",
            },
          });
          return;
        }

        this.postMessage({
          type: "selection_text",
          payload: {
            text: selectedText,
          },
        });
        return;
      }

      case "mark_view_visible": {
        await this.sessionManager.markViewVisible(message.payload.isVisible);
        return;
      }
    }
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    console.log("[Simple Chat][provider] sending to webview:", message);

    if (!this.view) {
      console.log("[Simple Chat][provider] no active view, message skipped");
      return;
    }

    void this.view.webview.postMessage(message);
  }

  private getWebviewHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Simple Chat</title>
        <style>
          :root {
            color-scheme: light dark;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            height: 100%;
          }

          body {
            margin: 0;
            padding: 12px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
          }

          .app {
            height: calc(100vh - 24px);
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 12px;
          }

          .card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 10px;
            padding: 12px;
            min-height: 0;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
          }

          .title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
          }

          h1 {
            margin: 0;
            font-size: 16px;
            line-height: 1.1;
          }

          .status {
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
          }

          .disconnected {
            color: #ff8080;
          }

          .connecting {
            color: #e2c08d;
          }

          .connected {
            color: #7fd18b;
          }

          .connection-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
          }

          .connection-body.hidden {
            display: none;
          }

          .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 10px;
          }

          label {
            font-size: 12px;
            opacity: 0.9;
          }

          input, select, textarea, button {
            width: 100%;
            font: inherit;
            color: var(--vscode-input-foreground);
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 8px 10px;
            outline: none;
          }

          textarea {
            resize: vertical;
            min-height: 88px;
            max-height: 180px;
            line-height: 1.4;
            font-family: var(--vscode-editor-font-family, monospace);
          }

          button {
            cursor: pointer;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            margin-top: 8px;
          }

          button:hover {
            background: var(--vscode-button-hoverBackground);
          }

          button.secondary,
          .toggle-btn {
            background: transparent;
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-panel-border);
          }

          button.secondary:hover,
          .toggle-btn:hover {
            background: var(--vscode-list-hoverBackground);
          }

          .toggle-btn {
            width: auto;
            padding: 6px 10px;
            margin-top: 0;
            white-space: nowrap;
          }

          .messages-card {
            min-height: 0;
            display: flex;
            flex-direction: column;
          }

          #messages {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding: 8px;
            border-radius: 8px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
          }

          .message {
            margin-bottom: 8px;
            padding: 8px 10px;
            border-radius: 8px;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid transparent;
          }

          .chat {
            background: var(--vscode-textBlockQuote-background);
            border-color: var(--vscode-panel-border);
          }

          .system {
            background: rgba(128, 128, 128, 0.12);
            border-color: var(--vscode-panel-border);
            font-style: italic;
          }

          .error {
            background: rgba(255, 80, 80, 0.12);
            border-color: rgba(255, 80, 80, 0.35);
          }

          .info {
            background: rgba(80, 160, 255, 0.12);
            border-color: rgba(80, 160, 255, 0.35);
          }

          .meta {
            display: flex;
            gap: 8px;
            font-size: 12px;
            margin-bottom: 4px;
            align-items: center;
          }

          .time {
            color: #e0b84f;
            font-weight: 600;
          }

          .username {
            color: #58a6ff;
            font-weight: 700;
          }

          .system-tag {
            color: #c586c0;
            font-weight: 700;
          }

          .composer-card {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .bottom-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .bottom-actions button {
            margin-top: 0;
          }

          .message-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 4px;
          }

          .message-actions {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
          }

          .icon-btn {
            width: 28px;
            height: 28px;
            min-width: 28px;
            padding: 0;
            margin-top: 0;
            border-radius: 6px;
            background: transparent;
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-panel-border);
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .icon-btn:hover {
            background: var(--vscode-list-hoverBackground);
          }

          .copy-icon {
            position: relative;
            width: 14px;
            height: 14px;
          }

          .copy-icon::before,
          .copy-icon::after {
            content: "";
            position: absolute;
            border: 1.6px solid currentColor;
            border-radius: 2px;
            width: 10px;
            height: 10px;
            background: transparent;
          }

          .copy-icon::before {
            top: 0;
            left: 3px;
          }

          .copy-icon::after {
            top: 3px;
            left: 0;
          }

          .message-content {
            white-space: pre-wrap;
            word-break: break-word;
          }

          .message-content.collapsed {
            display: -webkit-box;
            -webkit-line-clamp: 6;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .message-footer {
            margin-top: 8px;
            display: flex;
            justify-content: flex-start;
          }

          .text-btn {
            width: auto;
            margin-top: 0;
            padding: 0;
            border: none;
            background: transparent;
            color: #58a6ff;
            cursor: pointer;
          }

          .text-btn:hover {
            text-decoration: underline;
            background: transparent;
          }
        </style>
      </head>
      <body>
        <div class="app">
          <div class="card">
            <div class="connection-header">
              <div class="title-row" style="margin-bottom: 0; flex: 1;">
                <h1>Simple Chat</h1>
                <div id="status" class="status disconnected">Disconnected</div>
              </div>
              <button id="toggleConnectionBtn" class="toggle-btn" type="button">Hide</button>
            </div>

            <div id="connectionBody" class="connection-body">
              <div class="field">
                <label for="username">Username</label>
                <input id="username" type="text" />
              </div>

              <div class="field">
                <label for="mode">Action</label>
                <select id="mode">
                  <option value="join">Join room</option>
                  <option value="create">Create room</option>
                </select>
              </div>

              <div class="field">
                <label for="roomCode">Room code</label>
                <input id="roomCode" type="text" />
              </div>

              <div class="field">
                <label for="password">Password</label>
                <input id="password" type="password" />
              </div>

              <button id="connectBtn" type="button">Connect</button>
            </div>
          </div>

          <div class="card messages-card">
            <div id="messages"></div>
          </div>

          <div class="card composer-card">
            <textarea id="messageInput" placeholder="Write a message..."></textarea>
            <button id="sendBtn" type="button">Send</button>
            <div class="bottom-actions">
              <button id="onlineBtn" class="secondary" type="button">Show online users</button>
              <button id="insertSelectionBtn" class="secondary" type="button">Insert selection</button>
            </div>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          let connectionCollapsed = false;
          let currentConnectionStatus = "disconnected";

          const messagesEl = document.getElementById("messages");
          const connectBtn = document.getElementById("connectBtn");
          const onlineBtn = document.getElementById("onlineBtn");
          const sendBtn = document.getElementById("sendBtn");
          const insertSelectionBtn = document.getElementById("insertSelectionBtn");
          const messageInput = document.getElementById("messageInput");
          const statusEl = document.getElementById("status");
          const toggleConnectionBtn = document.getElementById("toggleConnectionBtn");
          const connectionBody = document.getElementById("connectionBody");
          const usernameInput = document.getElementById("username");
          const modeSelect = document.getElementById("mode");
          const roomCodeInput = document.getElementById("roomCode");
          const passwordInput = document.getElementById("password");

          function sendToExtension(message) {
            console.log("[Simple Chat][webview] sending to extension:", message);
            vscode.postMessage(message);
          }

          function setStatus(state, text) {
            currentConnectionStatus = state;
            statusEl.className = "status " + state;
            statusEl.textContent = text;
            syncPrimaryButton();
          }

          function syncPrimaryButton() {
            if (currentConnectionStatus === "connected") {
              connectBtn.textContent = "Disconnect";
              connectBtn.disabled = false;
              return;
            }

            if (currentConnectionStatus === "connecting") {
              connectBtn.textContent = "Connecting...";
              connectBtn.disabled = true;
              return;
            }

            connectBtn.textContent = "Connect";
            connectBtn.disabled = false;
          }

          function scrollMessagesToBottom() {
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }

          function clearMessages() {
            messagesEl.innerHTML = "";
          }

          function addInfoMessage(text, kind = "info") {
            const div = document.createElement("div");
            div.className = "message " + kind;
            div.textContent = text;
            messagesEl.appendChild(div);
            scrollMessagesToBottom();
          }

          function shouldCollapseMessage(content) {
            return content.length > 400 || content.split("\\n").length > 8;
          }

          async function copyText(text, button) {
            try {
              await navigator.clipboard.writeText(text);
              const previousTitle = button.title;
              button.title = "Copied";
              button.style.opacity = "0.7";

              setTimeout(() => {
                button.title = previousTitle;
                button.style.opacity = "1";
              }, 900);
            } catch {
              addInfoMessage("[error] Could not copy the message.", "error");
            }
          }

          function buildMessageActions() {
            return \`
              <div class="message-actions">
                <button class="icon-btn copy-btn" type="button" title="Copy message">
                  <span class="copy-icon"></span>
                </button>
              </div>
            \`;
          }

          function renderChatMessage(msg) {
            const wrapper = document.createElement("div");
            wrapper.className = "message " + (msg.type === "system" ? "system" : "chat");

            const time = new Date(msg.created_at).toLocaleTimeString();
            const fullContent = msg.content ?? "";
            const collapsed = shouldCollapseMessage(fullContent);

            const header = document.createElement("div");
            header.className = "message-header";

            const meta = document.createElement("div");
            meta.className = "meta";

            const timeEl = document.createElement("span");
            timeEl.className = "time";
            timeEl.textContent = time;
            meta.appendChild(timeEl);

            if (msg.type === "system") {
              const tagEl = document.createElement("span");
              tagEl.className = "system-tag";
              tagEl.textContent = "[system]";
              meta.appendChild(tagEl);
            } else {
              const userEl = document.createElement("span");
              userEl.className = "username";
              userEl.textContent = msg.username;
              meta.appendChild(userEl);
            }

            header.appendChild(meta);

            const actions = document.createElement("div");
            actions.innerHTML = buildMessageActions();
            header.appendChild(actions.firstElementChild);

            const contentEl = document.createElement("div");
            contentEl.className = "message-content";
            if (collapsed) {
              contentEl.classList.add("collapsed");
            }
            contentEl.textContent = fullContent;

            wrapper.appendChild(header);
            wrapper.appendChild(contentEl);

            if (collapsed) {
              const footer = document.createElement("div");
              footer.className = "message-footer";

              const toggleBtn = document.createElement("button");
              toggleBtn.type = "button";
              toggleBtn.className = "text-btn";
              toggleBtn.textContent = "Show more";

              toggleBtn.addEventListener("click", () => {
                const isCollapsed = contentEl.classList.contains("collapsed");

                if (isCollapsed) {
                  contentEl.classList.remove("collapsed");
                  toggleBtn.textContent = "Show less";
                } else {
                  contentEl.classList.add("collapsed");
                  toggleBtn.textContent = "Show more";
                }
              });

              footer.appendChild(toggleBtn);
              wrapper.appendChild(footer);
            }

            const copyBtn = wrapper.querySelector(".copy-btn");
            if (copyBtn) {
              copyBtn.addEventListener("click", () => {
                copyText(fullContent, copyBtn);
              });
            }

            messagesEl.appendChild(wrapper);
          }

          function renderMessages(messages) {
            clearMessages();
            for (const msg of messages) {
              renderChatMessage(msg);
            }
            scrollMessagesToBottom();
          }

          function collapseConnectionPanel() {
            connectionCollapsed = true;
            connectionBody.classList.add("hidden");
            toggleConnectionBtn.textContent = "Show";
          }

          function expandConnectionPanel() {
            connectionCollapsed = false;
            connectionBody.classList.remove("hidden");
            toggleConnectionBtn.textContent = "Hide";
          }

          function applyConnectionStatus(status) {
            if (status === "connected") {
              setStatus("connected", "Connected");
              collapseConnectionPanel();
              return;
            }

            if (status === "connecting") {
              setStatus("connecting", "Connecting...");
              return;
            }

            setStatus("disconnected", "Disconnected");
          }

          function hydrate(snapshot) {
            usernameInput.value = snapshot.username ?? "";
            modeSelect.value = snapshot.mode ?? "join";
            roomCodeInput.value = snapshot.roomCode ?? "";
            passwordInput.value = snapshot.password ?? "";

            renderMessages(snapshot.messages ?? []);
            applyConnectionStatus(snapshot.connectionStatus ?? "disconnected");
          }

          function handlePrimaryButtonClick() {
            if (currentConnectionStatus === "connected") {
              sendToExtension({
                type: "disconnect",
              });
              return;
            }

            sendToExtension({
              type: "connect",
              payload: {
                username: usernameInput.value.trim(),
                roomCode: roomCodeInput.value.trim(),
                password: passwordInput.value,
                mode: modeSelect.value,
              },
            });
          }

          function sendChatMessage() {
            const content = messageInput.value;

            if (!content.trim()) {
              return;
            }

            sendToExtension({
              type: "send_message",
              payload: {
                content,
              },
            });

            messageInput.value = "";
            messageInput.focus();
          }

          connectBtn.addEventListener("click", handlePrimaryButtonClick);
          sendBtn.addEventListener("click", sendChatMessage);

          onlineBtn.addEventListener("click", () => {
            sendToExtension({
              type: "list_users",
            });
          });

          insertSelectionBtn.addEventListener("click", () => {
            sendToExtension({
              type: "insert_selection_request",
            });
          });

          toggleConnectionBtn.addEventListener("click", () => {
            if (connectionCollapsed) {
              expandConnectionPanel();
            } else {
              collapseConnectionPanel();
            }
          });

          messageInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendChatMessage();
            }
          });

          window.addEventListener("focus", () => {
            sendToExtension({
              type: "mark_view_visible",
              payload: {
                isVisible: true,
              },
            });
          });

          window.addEventListener("blur", () => {
            sendToExtension({
              type: "mark_view_visible",
              payload: {
                isVisible: false,
              },
            });
          });

          window.addEventListener("message", (event) => {
            const message = event.data;
            console.log("[Simple Chat][webview] received from extension:", message);

            if (!message || typeof message.type !== "string") {
              return;
            }

            switch (message.type) {
              case "hydrate":
                hydrate(message.payload.snapshot);
                return;

              case "connection_status":
                applyConnectionStatus(message.payload.status);
                return;

              case "message_added":
                renderChatMessage(message.payload.message);
                scrollMessagesToBottom();
                return;

              case "messages_replaced":
                renderMessages(message.payload.messages);
                return;

              case "users_list":
                addInfoMessage("[online] " + message.payload.users.join(", "), "info");
                return;

              case "selection_text":
                if (messageInput.value.trim()) {
                  messageInput.value += "\\n\\n" + message.payload.text;
                } else {
                  messageInput.value = message.payload.text;
                }
                messageInput.focus();
                return;

              case "error":
                addInfoMessage("[error] " + message.payload.message, "error");
                return;
            }
          });

          console.log("[Simple Chat][webview] script loaded");
          syncPrimaryButton();

          setTimeout(() => {
            console.log("[Simple Chat][webview] sending initial boot messages");

            sendToExtension({
              type: "view_ready",
            });

            sendToExtension({
              type: "mark_view_visible",
              payload: {
                isVisible: true,
              },
            });
          }, 0);
        </script>
      </body>
      </html>
    `;
  }
}