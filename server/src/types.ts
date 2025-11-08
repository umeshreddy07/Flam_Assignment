import { ToolType, Point, DrawAction } from '../../client/src/types';

export interface ServerUser {
    id: string;
    username: string;
    color: string;
    currentTool?: ToolType;
    currentColor?: string;
    currentStrokeWidth?: number;
    cursorPosition: Point;
    isDrawing: boolean;
    lastActivity: number;
}

export interface ServerCanvasState {
    operations: DrawAction[];
    users: Map<string, ServerUser>;
    history: DrawAction[][];
    historyIndex: number;
}

export enum ServerEvents {
    JOIN_ROOM = 'JOIN_ROOM',
    CURSOR_MOVE = 'CURSOR_MOVE',
    DRAW_START = 'DRAW_START',
    DRAW_MOVE = 'DRAW_MOVE',
    DRAW_END = 'DRAW_END',
    UNDO = 'UNDO',
    REDO = 'REDO',
    REQUEST_INITIAL_STATE = 'REQUEST_INITIAL_STATE',
    USER_JOINED_ACK = 'USER_JOINED_ACK',
    OPERATION_APPLIED = 'OPERATION_APPLIED',
}

export enum ClientEvents {
    CONNECTION_ACK = 'CONNECTION_ACK',
    INITIAL_STATE = 'INITIAL_STATE',
    USER_JOINED = 'USER_JOINED',
    USER_LEFT = 'USER_LEFT',
    USER_CURSOR_UPDATE = 'USER_CURSOR_UPDATE',
    DRAW_ACTION = 'DRAW_ACTION',
    OPERATION_APPLIED = 'OPERATION_APPLIED',
    FULL_CANVAS_UPDATE = 'FULL_CANVAS_UPDATE',
}

export interface JoinRoomPayload {
    userId: string;
    username: string;
}

export interface CursorMovePayload {
    userId: string;
    point: Point;
}

export interface DrawStartPayload {
    userId: string;
    tool: ToolType;
    color: string;
    width: number;
}

export interface DrawMovePayload {
    userId: string;
    point: Point;
}

export interface DrawEndPayload extends DrawAction {}

export interface UndoRedoPayload {
    userId: string;
}

export interface InitialStatePayload {
    operations: DrawAction[];
    users: ServerUser[];
}

export interface UserJoinedPayload extends ServerUser {}

export interface UserLeftPayload {
    userId: string;
}

export interface UserCursorUpdatePayload {
    userId: string;
    point: Point;
    isDrawing: boolean;
}

export interface DrawActionPayload extends DrawAction {}

export interface OperationAppliedPayload {
    actionId: string;
    type: string;
}

export interface FullCanvasUpdatePayload {
    operations: DrawAction[];
    users: ServerUser[];
}

