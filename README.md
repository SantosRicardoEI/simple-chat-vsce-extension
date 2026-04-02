# Simple Chat

Simple Chat is a lightweight group chat extension for Visual Studio Code.

It lets you join or create chat rooms directly from the VS Code sidebar, talk in real time, paste code or multi-line text, and quickly copy messages when needed.

## Features

- Sidebar chat view inside Visual Studio Code
- Create a room or join an existing room
- Optional room password
- Real-time messaging with WebSocket
- Persistent room history loaded on connect
- Online users list
- Copy any message with one click
- Collapse and expand long messages with **Show more / Show less**
- Insert the current editor selection into the message box
- Compact layout designed for the VS Code sidebar

## How it works

After installing the extension, open the **Simple Chat** icon in the VS Code Activity Bar.

From there you can:

- enter your username
- choose whether to create or join a room
- enter the room code
- optionally provide a password
- connect and start chatting

The connection panel automatically collapses after a successful connection to leave more space for the conversation.

## Usage

### Connect to a room

1. Open the **Simple Chat** sidebar
2. Enter your **Username**
3. Choose:
   - **Join room**
   - **Create room**
4. Enter the **Room code**
5. Enter the **Password** if needed
6. Click **Connect**

### Send messages

- Type your message in the input box
- Press **Enter** to send
- Press **Shift + Enter** to insert a new line

### Show online users

Click **Show online users** to list currently connected users in the room.

### Insert selected code or text

Click **Insert selection** to insert the currently selected text from the active editor into the message box.

This is useful for:

- sharing code snippets
- sending logs
- discussing errors
- pasting multi-line content

### Copy messages

Each message includes a copy button.

This copies the full original content of the message, including long messages that are currently collapsed in the UI.

### Long messages

Long messages are automatically collapsed for readability.

Use:

- **Show more**
- **Show less**

to expand or collapse them without affecting the copy action.

## Requirements

Simple Chat requires a running backend server.

The current extension is configured to connect to:

- HTTP API
- WebSocket server

through the URLs defined in the extension source code.

If you are running your own backend, update the server URLs inside the extension source before packaging or publishing.

## Extension Settings

This version does not contribute custom VS Code settings yet.

## Known limitations

- The extension depends on the availability of the backend server
- There is currently no built-in server URL configuration in the VS Code settings UI
- Authentication is room-based only
- Messages are displayed as plain chat content, without syntax highlighting

## Release Notes

### 0.0.4

- Published marketplace version
- Sidebar-based chat workflow
- Real-time room chat
- Online users action
- Insert editor selection
- Copy message button
- Long message collapse/expand support
- Automatic connection panel collapse after connect

### 0.0.3

- Initial public packaging improvements
- Cleaner extension package structure

### 0.0.2

- Added sidebar webview container
- Improved layout and interaction

### 0.0.1

- Initial extension version

## Development

### Build

```bash
npm run compile
```
