import * as vscode from "vscode";
import { ChatStateStore } from "./chat/chatStateStore";
import { ChatSessionManager } from "./chat/chatSessionManager";
import { TerminalChatViewProvider } from "./view/terminalChatViewProvider";

let viewProvider: TerminalChatViewProvider | null = null;

export async function activate(context: vscode.ExtensionContext) {
  const stateStore = new ChatStateStore(context);
  const sessionManager = new ChatSessionManager(stateStore);

  await sessionManager.restoreFromStore();

  viewProvider = new TerminalChatViewProvider(context, sessionManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("terminalChatView", viewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );
}

export function deactivate() {
  if (viewProvider) {
    viewProvider.dispose();
    viewProvider = null;
  }
}