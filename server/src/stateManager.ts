import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    DrawAction,
    ServerUser,
    ServerCanvasState,
    ServerEvents,
    ClientEvents,
    User,
    Point,
    ToolType
} from './types';

const MAX_HISTORY_SIZE = 50;
const INACTIVITY_TIMEOUT = 60000;
const MAX_USERS_PER_ROOM = 100;

export class StateManager extends EventEmitter {
    private state: ServerCanvasState = {
        operations: [],
        users: new Map<string, ServerUser>(),
        history: [],
        historyIndex: -1,
    };

    private nextOperationId = 0;

    constructor() {
        super();
        setInterval(() => this.cleanupInactiveUsers(), INACTIVITY_TIMEOUT);
    }

    public addUser(userId: string, username: string, color: string): ServerUser {
        const newUser: ServerUser = {
            id: userId,
            username: username || `User_${userId.substring(0, 4)}`,
            color: color || this.generateUserColor(),
            currentTool: 'brush',
            currentColor: '#000000',
            currentStrokeWidth: 5,
            cursorPosition: { x: 0, y: 0 },
            isDrawing: false,
            lastActivity: Date.now(),
        };
        this.state.users.set(userId, newUser);
        console.log(`User added: ${newUser.username} (${userId})`);
        this.emit(ClientEvents.USER_JOINED, newUser);
        return newUser;
    }

    public removeUser(userId: string) {
        if (this.state.users.has(userId)) {
            const user = this.state.users.get(userId)!;
            this.state.users.delete(userId);
            console.log(`User removed: ${user.username} (${userId})`);
            this.emit(ClientEvents.USER_LEFT, userId);
        }
    }

    public getUser(userId: string): ServerUser | undefined {
        return this.state.users.get(userId);
    }

    public getAllUsers(): ServerUser[] {
        return Array.from(this.state.users.values());
    }

    public updateUserCursor(userId: string, point: Point) {
        const user = this.state.users.get(userId);
        if (user) {
            user.cursorPosition = point;
            user.lastActivity = Date.now();
            this.emit(ClientEvents.USER_CURSOR_UPDATE, { userId: userId, point: point, isDrawing: user.isDrawing });
        }
    }

    public updateUserDrawingStatus(userId: string, isDrawing: boolean) {
        const user = this.state.users.get(userId);
        if (user) {
            user.isDrawing = isDrawing;
            user.lastActivity = Date.now();
            this.emit(ClientEvents.USER_CURSOR_UPDATE, { userId: userId, point: user.cursorPosition, isDrawing: user.isDrawing });
        }
    }

    public updateUserToolSettings(userId: string, tool: ToolType, color: string, width: number) {
        const user = this.state.users.get(userId);
        if (user) {
            user.currentTool = tool;
            user.currentColor = color;
            user.currentStrokeWidth = width;
            user.lastActivity = Date.now();
        }
    }

    public getCanvasState(): { operations: DrawAction[], users: ServerUser[] } {
        return {
            operations: [...this.state.operations],
            users: this.getAllUsers(),
        };
    }

    public applyDrawingAction(action: DrawAction) {
        if (!action.id) {
            action.id = `server_action_${uuidv4()}`;
        }

        if (this.state.operations.some(op => op.id === action.id)) {
            console.warn(`Received duplicate action ID ${action.id}, skipping.`);
            return action.id;
        }

        this.state.operations.push(action);
        this.recordHistory();

        const user = this.state.users.get(action.userId);
        if (user) {
            user.lastActivity = Date.now();
            user.isDrawing = false;
            this.emit(ClientEvents.USER_CURSOR_UPDATE, { userId: user.id, point: user.cursorPosition, isDrawing: user.isDrawing });
        }

        console.log(`Action applied: ${action.id} by ${action.userId}`);
        this.emit(ClientEvents.DRAW_ACTION, action);
        return action.id;
    }

    public undoLastOperation(userId: string) {
        if (this.state.historyIndex <= 0) {
            console.log("Cannot undo: No history available.");
            return null;
        }

        this.state.historyIndex--;
        const previousOperations = this.state.history[this.state.historyIndex];
        this.state.operations = [...previousOperations];
        console.log(`Undo performed. History index: ${this.state.historyIndex}`);

        this.emit(ClientEvents.FULL_CANVAS_UPDATE, this.getCanvasState());

        const user = this.state.users.get(userId);
        if (user) user.lastActivity = Date.now();

        return this.state.operations;
    }

    public redoLastOperation(userId: string) {
        if (this.state.historyIndex >= this.state.history.length - 1) {
            console.log("Cannot redo: No redo history available.");
            return null;
        }

        this.state.historyIndex++;
        const nextOperations = this.state.history[this.state.historyIndex];
        this.state.operations = [...nextOperations];
        console.log(`Redo performed. History index: ${this.state.historyIndex}`);

        this.emit(ClientEvents.FULL_CANVAS_UPDATE, this.getCanvasState());

        const user = this.state.users.get(userId);
        if (user) user.lastActivity = Date.now();

        return this.state.operations;
    }

    private recordHistory() {
        this.state.history.push([...this.state.operations]);

        if (this.state.history.length > MAX_HISTORY_SIZE) {
            this.state.history.shift();
        }
        this.state.historyIndex = this.state.history.length - 1;
    }

    private cleanupInactiveUsers() {
        const now = Date.now();
        for (const [userId, user] of this.state.users.entries()) {
            if (now - user.lastActivity > INACTIVITY_TIMEOUT) {
                console.log(`User ${user.username} (${userId}) timed out due to inactivity.`);
                this.removeUser(userId);
            }
        }
    }

    private generateUserColor(): string {
        const colors = [
            '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
            '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
            '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
        ];
        const index = Math.floor(Math.random() * colors.length);
        return colors[index];
    }

    public processClientDrawEvent(event: ServerEvents, payload: any) {
        const userId = payload.userId;
        const user = this.state.users.get(userId);

        if (!user) {
            console.warn(`Received event from unknown user: ${userId}`);
            return;
        }
        user.lastActivity = Date.now();

        switch (event) {
            case ServerEvents.DRAW_START:
                user.currentTool = payload.tool;
                user.currentColor = payload.color;
                user.currentStrokeWidth = payload.width;
                user.isDrawing = true;
                this.emit(ClientEvents.USER_CURSOR_UPDATE, { userId: user.id, point: user.cursorPosition, isDrawing: user.isDrawing });
                break;
            case ServerEvents.DRAW_MOVE:
                user.cursorPosition = payload.point;
                if (user.isDrawing) {
                    this.emit(ClientEvents.USER_CURSOR_UPDATE, { userId: user.id, point: user.cursorPosition, isDrawing: user.isDrawing });
                }
                break;
            case ServerEvents.DRAW_END:
                const action: DrawAction = { ...payload };
                const appliedActionId = this.applyDrawingAction(action);
                this.emit(ClientEvents.OPERATION_APPLIED, { actionId: appliedActionId, type: 'DRAW_ACTION' });
                break;
            case ServerEvents.UNDO:
                this.undoLastOperation(userId);
                this.emit(ClientEvents.OPERATION_APPLIED, { actionId: 'undo_request', type: 'UNDO' });
                break;
            case ServerEvents.REDO:
                this.redoLastOperation(userId);
                this.emit(ClientEvents.OPERATION_APPLIED, { actionId: 'redo_request', type: 'REDO' });
                break;
            case ServerEvents.REQUEST_INITIAL_STATE:
                break;
            default:
                console.warn(`Unhandled server event: ${event}`);
        }
    }
}

