# Real-Time Collaborative Drawing Canvas

## 🚀 Setup and Running

This project implements a real-time collaborative drawing application using Node.js, Express, Socket.IO, and vanilla HTML5 Canvas.

**Prerequisites:**

*   [Node.js](https://nodejs.org/) (version 14 or higher recommended)
*   [npm](https://docs.npmjs.com/cli/v8/commands/npm-install) (comes with Node.js)

**Installation:**

1.  Clone this repository:

    ```bash
    git clone <your-repo-url>
    cd collaborative-canvas
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

**Running the Application:**

1.  Start the server:

    ```bash
    npm start
    ```

    This will start the Node.js server on `http://localhost:3000`.

2.  Open your web browser and navigate to:

    `http://localhost:3000`

**Testing with Multiple Users:**

To test with multiple users, simply open `http://localhost:3000` in different browser tabs or on different devices connected to the same network. Each new tab/device will connect as a separate user. You should see drawings and cursors from other users appear in real-time.

**Features:**

*   **Global Stroke-Based Undo/Redo**: Fully synchronized undo/redo system that works across all users. Undo removes the last complete stroke for everyone instantly, and redo restores the last undone stroke globally. The server maintains authoritative undo/redo state.

*   **Smooth Drawing**: Drawing operations are throttled to ~60fps (16ms) for optimal performance and smoothness. Each stroke is grouped with a unique ID, allowing for full-stroke undo operations.

*   **Smooth Cursor Movement**: Cursor updates are throttled to 50ms (~20 updates/second) to prevent lag while maintaining responsiveness.

*   **Real-Time Collaboration**: Multiple users can draw simultaneously with real-time synchronization of drawings and cursor positions.

**Known Limitations & Bugs:**

*   **Conflict Resolution**: Basic conflict resolution is implicitly handled by the server broadcasting operations. If two users draw at the exact same pixel simultaneously, the one whose event arrives at the server and is broadcast first will appear "on top" or be rendered. No explicit merging or conflict resolution strategy is implemented beyond this.

*   **Performance**: For very large canvases or a high number of concurrent users, performance might degrade. Drawing and cursor updates are throttled for optimal performance, but further optimization is possible for extreme scenarios.

*   **Eraser**: The eraser works by using `destination-out`, which makes parts of the canvas transparent. This is different from simply drawing "white" and can have subtle interactions with overlapping drawings.

*   **Cursor Display**: Cursors are basic colored circles. Usernames are truncated IDs.

*   **No Persistence**: Drawings are not saved and will be lost when the server restarts.

*   **Error Handling**: Basic error handling is in place, but edge cases might not be fully covered.

**Time Spent:**

This project was developed over approximately **4-5 days**.

---

## 🎯 Key Features

### Stroke-Based Undo/Redo
- Each drawing stroke is assigned a unique ID
- Undo removes the last complete stroke (not individual segments)
- Redo restores the last undone stroke
- All operations are synchronized across all connected users
- Server maintains authoritative state to prevent desynchronization

### Performance Optimizations
- Drawing segments throttled to 16ms intervals (~60fps)
- Cursor movement throttled to 50ms intervals (~20 updates/second)
- Local rendering for immediate user feedback
- Server-side state management for consistency

## 📝 ARCHITECTURE.md

Please refer to the `ARCHITECTURE.md` file for detailed documentation on the architecture, data flow, and technical decisions.
