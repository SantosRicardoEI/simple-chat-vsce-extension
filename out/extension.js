"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const chatStateStore_1 = require("./chat/chatStateStore");
const chatSessionManager_1 = require("./chat/chatSessionManager");
const terminalChatViewProvider_1 = require("./view/terminalChatViewProvider");
let viewProvider = null;
async function activate(context) {
    const stateStore = new chatStateStore_1.ChatStateStore(context);
    const sessionManager = new chatSessionManager_1.ChatSessionManager(stateStore);
    await sessionManager.restoreFromStore();
    viewProvider = new terminalChatViewProvider_1.TerminalChatViewProvider(context, sessionManager);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("terminalChatView", viewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
    }));
}
function deactivate() {
    if (viewProvider) {
        viewProvider.dispose();
        viewProvider = null;
    }
}
//# sourceMappingURL=extension.js.map