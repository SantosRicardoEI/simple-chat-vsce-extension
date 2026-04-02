import type {
  ChatConnectionStatus,
  ChatMessage,
  ChatMode,
  ChatSessionSnapshot,
} from "./chatType";

/**
 * Messages sent from the webview to the extension.
 */
export type WebviewToExtensionMessage =
  | WebviewReadyMessage
  | ConnectMessage
  | DisconnectMessage
  | SendMessageMessage
  | ListUsersMessage
  | InsertSelectionRequestMessage
  | MarkViewVisibleMessage;

export interface WebviewReadyMessage {
  type: "view_ready";
}

export interface ConnectMessage {
  type: "connect";
  payload: {
    username: string;
    roomCode: string;
    password: string;
    mode: ChatMode;
  };
}

export interface DisconnectMessage {
  type: "disconnect";
}

export interface SendMessageMessage {
  type: "send_message";
  payload: {
    content: string;
  };
}

export interface ListUsersMessage {
  type: "list_users";
}

export interface InsertSelectionRequestMessage {
  type: "insert_selection_request";
}

export interface MarkViewVisibleMessage {
  type: "mark_view_visible";
  payload: {
    isVisible: boolean;
  };
}

/**
 * Messages sent from the extension to the webview.
 */
export type ExtensionToWebviewMessage =
  | HydrateMessage
  | ConnectionStatusMessage
  | MessageAddedMessage
  | MessagesReplacedMessage
  | UsersListMessage
  | SelectionTextMessage
  | ErrorMessage;

export interface HydrateMessage {
  type: "hydrate";
  payload: {
    snapshot: ChatSessionSnapshot;
  };
}

export interface ConnectionStatusMessage {
  type: "connection_status";
  payload: {
    status: ChatConnectionStatus;
  };
}

export interface MessageAddedMessage {
  type: "message_added";
  payload: {
    message: ChatMessage;
  };
}

export interface MessagesReplacedMessage {
  type: "messages_replaced";
  payload: {
    messages: ChatMessage[];
  };
}

export interface UsersListMessage {
  type: "users_list";
  payload: {
    users: string[];
  };
}

export interface SelectionTextMessage {
  type: "selection_text";
  payload: {
    text: string;
  };
}

export interface ErrorMessage {
  type: "error";
  payload: {
    message: string;
  };
}