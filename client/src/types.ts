// --- General Types ---
export interface Point {
    x: number;
    y: number;
}

export interface User {
    id: string;
    username: string;
    color: string; // Assigned color for cursors/indicators
}

// --- Canvas Drawing Types ---
export type ToolType = 'brush' | 'eraser' | 'rect' | 'circle'; // Expand as needed

export interface DrawAction {
    id: string; // Unique ID for the operation for potential deduplication/ordering
    userId: string;
    type: ToolType;
    color?: string;     // For brush
    width: number;      // For brush and eraser
    points?: Point[];   // For brush, path-based tools
    startPoint?: Point; // For shape tools
    endPoint?: Point;   // For shape tools
    fill?: boolean;     // For shape tools
}

export interface ServerCanvasState {
    operations: DrawAction[];
    users: User[];
    // Add other global state if needed, e.g., current canvas background color
}

// --- WebSocket Message Types ---
// Client -> Server
export enum ClientToServerEvents {
    JOIN_ROOM = 'JOIN_ROOM',
    CURSOR_MOVE = 'CURSOR_MOVE',
    DRAW_START = 'DRAW_START',
    DRAW_MOVE = 'DRAW_MOVE',
    DRAW_END = 'DRAW_END',
    UNDO = 'UNDO',
    REDO = 'REDO',
    REQUEST_INITIAL_STATE = 'REQUEST_INITIAL_STATE',
}

// Server -> Client
export enum ServerToClientEvents {
    CONNECTION_ACK = 'CONNECTION_ACK', // For initial connection confirmation
    INITIAL_STATE = 'INITIAL_STATE',
    USER_JOINED = 'USER_JOINED',
    USER_LEFT = 'USER_LEFT',
    USER_CURSOR_UPDATE = 'USER_CURSOR_UPDATE',
    DRAW_ACTION = 'DRAW_ACTION', // Broadcasts new drawing actions
    OPERATION_APPLIED = 'OPERATION_APPLIED', // Server confirms action, e.g., 'DRAW_ACTION_CONFIRMED', 'UNDO_REDO_SUCCESS'
    FULL_CANVAS_UPDATE = 'FULL_CANVAS_UPDATE', // Sent after undo/redo or when consistency is critical
}

// Custom events for internal client/server communication
export enum InternalEvents {
    RESIZE_CANVAS = 'RESIZE_CANVAS',
    REDRAW_CANVAS = 'REDRAW_CANVAS',
    UPDATE_USER_LIST = 'UPDATE_USER_LIST',
    UPDATE_CURSOR = 'UPDATE_CURSOR',
    SET_TOOL = 'SET_TOOL',
    SET_COLOR = 'SET_COLOR',
    SET_STROKE_WIDTH = 'SET_STROKE_WIDTH',
    DRAW_START = 'DRAW_START',
    DRAW_MOVE = 'DRAW_MOVE',
    DRAW_END = 'DRAW_END',
    UNDO = 'UNDO',
    REDO = 'REDO',
}

