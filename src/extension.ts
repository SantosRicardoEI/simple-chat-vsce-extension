import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const provider = new TerminalChatViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('terminalChatView', provider)
  );
}

export function deactivate() { }

class TerminalChatViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) { }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = getWebviewHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'insert_selection') {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          webviewView.webview.postMessage({
            type: 'selection_error',
            error: 'Não há editor activo.',
          });
          return;
        }

        const selectedText = editor.document.getText(editor.selection);

        if (!selectedText.trim()) {
          webviewView.webview.postMessage({
            type: 'selection_error',
            error: 'Não tens nenhum texto seleccionado.',
          });
          return;
        }

        webviewView.webview.postMessage({
          type: 'selection_text',
          text: selectedText,
        });
      }
    });
  }
}

function getWebviewHtml(): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-PT">
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

        .hint {
          font-size: 12px;
          opacity: 0.8;
          margin-top: 8px;
          line-height: 1.4;
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
              <div id="status" class="status disconnected">Desligado</div>
            </div>
            <button id="toggleConnectionBtn" class="toggle-btn" type="button">Ocultar</button>
          </div>

          <div id="connectionBody" class="connection-body">
            <div class="field">
              <label for="username">Username</label>
              <input id="username" type="text" />
            </div>

            <div class="field">
              <label for="mode">Ação</label>
              <select id="mode">
                <option value="join">Entrar em sala</option>
                <option value="create">Criar sala</option>
              </select>
            </div>

            <div class="field">
              <label for="roomCode">Código da sala</label>
              <input id="roomCode" type="text" />
            </div>

            <div class="field">
              <label for="password">Password</label>
              <input id="password" type="password" />
            </div>

            <button id="connectBtn">Ligar</button>
          </div>
        </div>

        <div class="card messages-card">
          <div id="messages"></div>
        </div>

        <div class="card composer-card">
          <textarea id="messageInput" placeholder="Escreve uma mensagem..."></textarea>
          <button id="sendBtn">Enviar</button>
          <div class="bottom-actions">
            <button id="onlineBtn" class="secondary">Ver online</button>
            <button id="insertSelectionBtn" class="secondary">Inserir seleção</button>
          </div>
        </div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        const HTTP_BASE_URL = "https://chat-server-production-1962.up.railway.app";
        const WS_URL = "wss://chat-server-production-1962.up.railway.app";

        let ws = null;
        let connectionCollapsed = false;

        const messagesEl = document.getElementById("messages");
        const connectBtn = document.getElementById("connectBtn");
        const onlineBtn = document.getElementById("onlineBtn");
        const sendBtn = document.getElementById("sendBtn");
        const insertSelectionBtn = document.getElementById("insertSelectionBtn");
        const messageInput = document.getElementById("messageInput");
        const statusEl = document.getElementById("status");
        const toggleConnectionBtn = document.getElementById("toggleConnectionBtn");
        const connectionBody = document.getElementById("connectionBody");

        function setStatus(state, text) {
          statusEl.className = "status " + state;
          statusEl.textContent = text;
        }

        function scrollMessagesToBottom() {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function addInfoMessage(text, kind = "info") {
          const div = document.createElement("div");
          div.className = "message " + kind;
          div.textContent = text;
          messagesEl.appendChild(div);
          scrollMessagesToBottom();
        }

                function escapeHtml(text) {
          return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        }

        function shouldCollapseMessage(content) {
          return content.length > 400 || content.split("\\n").length > 8;
        }

        async function copyText(text, button) {
          try {
            await navigator.clipboard.writeText(text);
            const previousTitle = button.title;
            button.title = "Copiado";
            button.style.opacity = "0.7";

            setTimeout(() => {
              button.title = previousTitle;
              button.style.opacity = "1";
            }, 900);
          } catch {
            addInfoMessage("[erro] Não foi possível copiar a mensagem.", "error");
          }
        }

        function buildMessageActions(content) {
          return \`
            <div class="message-actions">
              <button class="icon-btn copy-btn" type="button" title="Copiar mensagem">
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

          wrapper.dataset.fullContent = fullContent;

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
            tagEl.textContent = "[sistema]";
            meta.appendChild(tagEl);
          } else {
            const userEl = document.createElement("span");
            userEl.className = "username";
            userEl.textContent = msg.username;
            meta.appendChild(userEl);
          }

          header.appendChild(meta);

          const actions = document.createElement("div");
          actions.innerHTML = buildMessageActions(fullContent);
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
            toggleBtn.textContent = "Ver mais";

            toggleBtn.addEventListener("click", () => {
              const isCollapsed = contentEl.classList.contains("collapsed");

              if (isCollapsed) {
                contentEl.classList.remove("collapsed");
                toggleBtn.textContent = "Ver menos";
              } else {
                contentEl.classList.add("collapsed");
                toggleBtn.textContent = "Ver mais";
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
          scrollMessagesToBottom();
        }

        function collapseConnectionPanel() {
          connectionCollapsed = true;
          connectionBody.classList.add("hidden");
          toggleConnectionBtn.textContent = "Mostrar";
        }

        function expandConnectionPanel() {
          connectionCollapsed = false;
          connectionBody.classList.remove("hidden");
          toggleConnectionBtn.textContent = "Ocultar";
        }

        async function connectToRoom() {
          const username = document.getElementById("username").value.trim();
          const mode = document.getElementById("mode").value;
          const roomCode = document.getElementById("roomCode").value.trim();
          const password = document.getElementById("password").value;

          if (!username || !roomCode) {
            addInfoMessage("[erro] Username e código da sala são obrigatórios.", "error");
            return;
          }

          connectBtn.disabled = true;
          setStatus("connecting", "A ligar...");

          try {
            if (mode === "create") {
              const createRes = await fetch(\`\${HTTP_BASE_URL}/rooms/create\`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: roomCode, password })
              });

              const createData = await createRes.json();

              if (!createData.ok) {
                addInfoMessage(\`[erro] \${createData.error}\`, "error");
                setStatus("disconnected", "Desligado");
                connectBtn.disabled = false;
                return;
              }
            }

            const joinRes = await fetch(\`\${HTTP_BASE_URL}/rooms/join\`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: roomCode, password })
            });

            const joinData = await joinRes.json();

            if (!joinData.ok) {
              addInfoMessage(\`[erro] \${joinData.error}\`, "error");
              setStatus("disconnected", "Desligado");
              connectBtn.disabled = false;
              return;
            }

            messagesEl.innerHTML = "";
            addInfoMessage(\`Ligado à sala: \${roomCode}\`, "info");

            for (const msg of joinData.messages || []) {
              renderChatMessage(msg);
            }

            if (ws) {
              try { ws.close(); } catch {}
            }

            ws = new WebSocket(WS_URL);

            ws.onopen = () => {
              ws.send(JSON.stringify({
                type: "join_room",
                roomCode,
                username,
                password
              }));

              setStatus("connected", "Ligado");
              connectBtn.disabled = false;
              collapseConnectionPanel();
            };

            ws.onmessage = (event) => {
              const parsed = JSON.parse(event.data);

              if (parsed.type === "join_success") return;

              if (parsed.type === "join_error" || parsed.type === "error") {
                addInfoMessage(\`[erro] \${parsed.error}\`, "error");
                return;
              }

              if (parsed.type === "users_list") {
                addInfoMessage(\`[online] \${parsed.users.join(", ")}\`, "info");
                return;
              }

              if (parsed.type === "new_message") {
                renderChatMessage(parsed.message);
                return;
              }

              if (parsed.type === "system") {
                addInfoMessage(\`[sistema] \${parsed.message}\`, "info");
              }
            };

            ws.onclose = () => {
              setStatus("disconnected", "Desligado");
              addInfoMessage("[sistema] Ligação fechada.", "info");
            };

            ws.onerror = () => {
              setStatus("disconnected", "Desligado");
              addInfoMessage("[erro] Erro na ligação WebSocket.", "error");
              connectBtn.disabled = false;
            };
          } catch (error) {
            addInfoMessage("[erro] Falha ao ligar ao servidor.", "error");
            setStatus("disconnected", "Desligado");
            connectBtn.disabled = false;
          }
        }

        function sendMessage() {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            addInfoMessage("[erro] Não estás ligado.", "error");
            return;
          }

          const content = messageInput.value;
          if (!content.trim()) return;

          ws.send(JSON.stringify({
            type: "chat_message",
            content
          }));

          messageInput.value = "";
          messageInput.focus();
        }

        connectBtn.addEventListener("click", connectToRoom);

        onlineBtn.addEventListener("click", () => {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            addInfoMessage("[erro] Não estás ligado.", "error");
            return;
          }

          ws.send(JSON.stringify({ type: "list_users" }));
        });

        sendBtn.addEventListener("click", sendMessage);

        insertSelectionBtn.addEventListener("click", () => {
          vscode.postMessage({ type: "insert_selection" });
        });

        window.addEventListener("message", (event) => {
          const message = event.data;

          if (message.type === "selection_error") {
            addInfoMessage(\`[erro] \${message.error}\`, "error");
            return;
          }

          if (message.type === "selection_text") {
            if (messageInput.value.trim()) {
              messageInput.value += "\\n\\n" + message.text;
            } else {
              messageInput.value = message.text;
            }
            messageInput.focus();
          }
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
            sendMessage();
          }
        });
      </script>
    </body>
    </html>
  `;
}