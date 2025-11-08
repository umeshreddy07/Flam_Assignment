# Architecture Documentation: Real-Time Collaborative Canvas

This document outlines the architectural design, data flow, and key technical decisions for the Real-Time Collaborative Canvas application.

## 🏗️ Overall Architecture

The application follows a client-server architecture.

*   **Frontend (Client):** Implemented using Vanilla JavaScript/TypeScript, HTML5 Canvas, and CSS. It handles user interactions, local drawing, rendering, and communication with the backend via WebSockets.

*   **Backend (Server):** Implemented using Node.js, Express, and Socket.IO. It manages the global canvas state, handles WebSocket connections, synchronizes drawing actions, and orchestrates real-time updates across all connected clients.

## 🌊 Data Flow Diagram

```
User Interaction (Mouse/Touch)
    ↓
Client: Event Listeners
    ↓
CanvasManager
    ├── Local Drawing → Render locally
    └── Action Data → WebSocketClient
            ↓
Backend: WebSocket Server
    ↓
StateManager
    ├── Update State → Store operations, history
    └── Broadcast Events → WebSocket Server
            ↓
Broadcast to all clients
    ↓
WebSocketClient receives
    ├── DRAW_ACTION → CanvasManager
    ├── FULL_CANVAS_UPDATE → CanvasManager
    └── USER_JOINED, USER_LEFT, USER_CURSOR_UPDATE → App → Update UI
            ↓
CanvasManager renders → Canvas Element
```

**Explanation:**

1.  **User Interaction:** A user interacts with the canvas (e.g., moves the mouse, clicks).

2.  **Client Event Listeners:** These events are captured by `CanvasManager`.

3.  **CanvasManager:**
    *   If drawing, it predicts locally for immediate feedback and starts emitting `DRAW_START`, `DRAW_MOVE` events.
    *   It sends the complete `DrawAction` on `DRAW_END`.
    *   It also handles remote cursor updates and sends local cursor positions.

4.  **WebSocketClient:**
    *   Receives drawing events from `CanvasManager` and forwards them to the backend.
    *   Receives state updates (initial state, drawing actions, user updates) from the backend and passes them to `CanvasManager` and `App` for rendering and UI updates.

5.  **Backend WebSocket Server:**
    *   Receives events from clients.
    *   Routes events to the `StateManager`.

6.  **StateManager:**
    *   The single source of truth for the canvas state.
    *   Applies drawing actions, manages user presence, handles undo/redo.
    *   Emits state changes (`DRAW_ACTION`, `FULL_CANVAS_UPDATE`, `USER_JOINED`, etc.) back to the WebSocket Server for broadcasting.

7.  **Broadcasting:** The WebSocket Server broadcasts state changes to all connected clients.

8.  **Client Updates:** `WebSocketClient` receives broadcasts and:
    *   Passes drawing actions to `CanvasManager` for rendering.
    *   Passes user/state updates to `App` which then updates `CanvasManager` and `UserList` / `UiControls`.

9.  **Rendering:** `CanvasManager` redraws the canvas and cursors based on the received state.

## 📨 WebSocket Protocol

All messages are JSON-based for simplicity.

### Client to Server Events

| Event Name                     | Payload Description                                                               | Notes                                                                 |
| :----------------------------- | :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| `REQUEST_INITIAL_STATE`        | `{}`                                                                              | Client requests the current canvas state upon connecting.             |
| `JOIN_ROOM`                    | `{ userId: string, username: string }`                                            | User joins the default room (or a specific room if implemented).      |
| `CURSOR_MOVE`                  | `{ userId: string, point: Point }`                                                | User's cursor position update.                                        |
| `DRAW_START`                   | `{ userId: string, tool: ToolType, color: string, width: number }`                | User starts a drawing action.                                         |
| `DRAW_MOVE`                    | `{ userId: string, point: Point }`                                                | User's cursor is moving while drawing.                                |
| `DRAW_END`                     | `{ id: string, userId: string, type: ToolType, color?: string, width: number, points?: Point[], startPoint?: Point, endPoint?: Point }` | User finishes a drawing action, sending the complete `DrawAction`. |
| `UNDO`                         | `{ userId: string }`                                                              | User requests to undo the last operation.                             |
| `REDO`                         | `{ userId: string }`                                                              | User requests to redo the last undone operation.                      |
| `OPERATION_APPLIED`            | `{ actionId: string, type: string }`                                              | Client acknowledges server confirmation of an operation.              |

### Server to Client Events

| Event Name               | Payload Description                                                                                                                                                                             | Notes                                                                                                                                                                        |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONNECTION_ACK`         | `{ userId: string, username: string }`                                                                                                                                                          | Server acknowledges connection and provides client's ID and assigned username.                                                                                               |
| `INITIAL_STATE`          | `{ operations: DrawAction[], users: User[] }`                                                                                                                                                   | Sent to a new client. Contains all current drawing operations and list of connected users.                                                                                   |
| `USER_JOINED`            | `ServerUser` (full object including `cursorPosition`, `isDrawing`, etc.)                                                                                                                        | A new user has connected.                                                                                                                                                    |
| `USER_LEFT`              | `userId: string`                                                                                                                                                                                | A user has disconnected.                                                                                                                                                     |
| `USER_CURSOR_UPDATE`     | `{ userId: string, point: Point, isDrawing: boolean }`                                                                                                                                          | User's cursor position and drawing status update. Sent to all clients (except perhaps the sender for efficiency).                                                             |
| `DRAW_ACTION`            | `DrawAction` (full object with server-assigned `id`)                                                                                                                                            | A new drawing action has been applied to the canvas. Sent to all clients.                                                                                                    |
| `FULL_CANVAS_UPDATE`     | `{ operations: DrawAction[], users: ServerUser[] }`                                                                                                                                             | Sent after UNDO/REDO or critical state synchronization events. Represents the definitive state of the canvas and users. Clients should re-render their canvas based on this. |
| `OPERATION_APPLIED`      | `{ actionId: string, type: string }`                                                                                                                                                            | Server confirmation of an action it processed. Used for client-side feedback.                                                                                                |

## 🔄 Undo/Redo Strategy

The undo/redo mechanism is primarily handled by the **server** to ensure global consistency.

1.  **Client Draws:** When a user draws, the client may predict the action locally for immediate feedback. The complete `DrawAction` is sent to the server on `DRAW_END`.

2.  **Server Receives Action:** The server's `StateManager` receives the `DrawAction`.

3.  **Server State Update:**
    *   If it's a new drawing action, it's added to the `state.operations` array.
    *   Crucially, *before* applying the new operation, a snapshot of the current `state.operations` is pushed into `state.history`.
    *   The `historyIndex` is updated to point to the newly added state.
    *   If `state.history` exceeds `MAX_HISTORY_SIZE`, the oldest snapshot is removed.

4.  **Broadcasting:** The server then broadcasts the new `DrawAction` to all clients (except potentially the sender if it was a local prediction).

5.  **Client Receives Action:** Clients receive the `DRAW_ACTION` and apply it to their local `CanvasManager`.

6.  **Undo Request:** When a user clicks "Undo", the client sends an `UNDO` event to the server.

7.  **Server Handles Undo:**
    *   The `StateManager` decrements `state.historyIndex`.
    *   It retrieves the *previous* set of operations from `state.history` at the new `historyIndex`.
    *   The server's `state.operations` array is completely replaced with this retrieved set of operations.
    *   A `FULL_CANVAS_UPDATE` message containing the new `operations` and `users` state is broadcast to **all clients**.

8.  **Client Handles Full Update:** Clients receiving `FULL_CANVAS_UPDATE` clear their local canvas and re-render it entirely based on the new operations list from the server. This ensures all clients are synchronized to the exact same state.

9.  **Redo:** Works symmetrically: `REDO` increments `historyIndex`, applies the corresponding state from history, and broadcasts `FULL_CANVAS_UPDATE`.

**Conflict Resolution for Undo/Redo:** The server's state manager is the single source of truth. When an undo/redo occurs, the server dictates the new canvas state to all clients, resolving any potential conflicts that might arise from concurrent user actions.

## 🚀 Performance Decisions

*   **Client-Side Prediction:** Drawing actions are rendered immediately on the client when the user draws (`CanvasManager.applyLocalAction`). This provides a responsive feel, hiding network latency for the drawing itself.

*   **WebSocket Message Batching (Considered):** For `mousemove` events, instead of sending every point, we *could* batch them. However, for optimal real-time feel, individual `DRAW_MOVE` events are sent, but the `StateManager` on the server might batch these further before applying if performance becomes an issue. For this assignment, immediate broadcast of `DRAW_MOVE` is acceptable.

*   **Efficient Canvas Redrawing:**
    *   `CanvasManager` redraws the entire canvas on `FULL_CANVAS_UPDATE` for simplicity and guaranteed synchronization.
    *   For individual `DRAW_ACTION` broadcasts, `CanvasManager.applyRemoteAction` adds the action to its list and redraws. A more advanced approach would involve "dirty rectangles" to only redraw affected areas.

*   **Smooth Cursor Animation:** Remote cursors are animated using `requestAnimationFrame` with linear interpolation (`lerp`) to smooth out jerky movements caused by discrete WebSocket updates.

*   **Inactivity Timeouts:** Server-side `cleanupInactiveUsers` removes users who haven't sent events for a configured period, reducing server load and cleaning up stale state.

*   **JSON Serialization:** For this scale, JSON is sufficient. For extremely high-frequency data or massive amounts of data, binary serialization (e.g., MessagePack) could be considered.

## ⚖️ Conflict Resolution

*   **Overlapping Drawing Strokes:** When multiple users draw on the same pixel, the server applies drawing actions in the order they are received and processed. The last action applied to a pixel wins. The server's ordering ensures a consistent outcome.

*   **Concurrent Actions:** The server acts as an authoritative mediator. Any action received from a client is processed sequentially. If two clients send actions nearly simultaneously, the server determines the order of processing.

*   **Undo/Redo Conflicts:** As detailed in the "Undo/Redo Strategy," conflicts are resolved by the server broadcasting the definitive canvas state after an undo/redo operation, forcing all clients to synchronize to that state.

*   **User State:** User cursor positions and drawing statuses are updated via `USER_CURSOR_UPDATE` events. Conflicts here are minimal, as each client primarily updates its *own* cursor. Remote cursor updates are broadcasts, and the client interpolates them.

## 🧰 Future Scalability Considerations

*   **Horizontal Scaling:** The Node.js server can be scaled horizontally behind a load balancer.

*   **State Sharding:** For a large number of users or many canvases, the `StateManager` could be sharded. This might involve:
    *   **Rooms:** Each room has its own `StateManager`.
    *   **Distributed State:** Using a distributed key-value store (like Redis) for canvas operations or state snapshots. Redis Pub/Sub can also be used for broadcasting messages across multiple server instances.

*   **Optimized Communication:**
    *   Using binary protocols for WebSocket messages.
    *   More aggressive batching of `DRAW_MOVE` events.

*   **Canvas Rendering:** For complex scenarios, consider WebGL for higher performance rendering.

