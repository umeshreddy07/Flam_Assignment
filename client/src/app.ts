import { CanvasManager } from './canvasManager';
import { WebSocketClient } from './websocketClient';
import { UiControls } from './uiControls';
import { UserList } from './userList';
import { Point, DrawAction, User, ToolType, InternalEvents, ClientToServerEvents, ServerToClientEvents } from './types';

const SERVER_URL = process.env.NODE_ENV === 'production' ? 'wss://your-production-server.com' : 'http://localhost:3000';
const RECENT_COLORS_STORAGE_KEY = 'collaborativeCanvasRecentColors';

export class App {
    private canvasManager: CanvasManager;
    private websocketClient: WebSocketClient;
    private uiControls: UiControls;
    private userList: UserList;

    private localUserId: string | null = null;
    private localUsername: string = 'Anonymous';

    constructor() {
        const canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
        const cursorOverlayElement = document.getElementById('cursor-overlay')!;
        const userListElement = document.getElementById('user-list')!;

        if (!canvasElement || !cursorOverlayElement || !userListElement) {
            throw new Error("Missing essential DOM elements.");
        }

        this.websocketClient = new WebSocketClient(SERVER_URL, {
            onInitialState: (operations, users) => this.handleInitialState(operations, users),
            onUserJoined: (user) => this.handleUserJoined(user),
            onUserLeft: (userId) => this.handleUserLeft(userId),
            onCursorUpdate: (userId, point, isDrawing) => this.handleCursorUpdate(userId, point, isDrawing),
            onDrawAction: (action) => this.handleDrawAction(action),
            onOperationConfirmed: (actionId, isNewAction) => this.handleOperationConfirmed(actionId, isNewAction),
            onConnectionStatus: (status) => {
                if (this.uiControls) {
                    this.uiControls.updateConnectionStatus(status);
                }
            },
        });

        this.canvasManager = new CanvasManager({
            canvasElement: canvasElement,
            cursorOverlayElement: cursorOverlayElement,
            onActionDraw: (action) => this.handleLocalDrawAction(action),
            onRedraw: () => { }
        });

        this.uiControls = new UiControls({
            canvasManager: this.canvasManager,
            recentColorsStorageKey: RECENT_COLORS_STORAGE_KEY,
        });

        this.userList = new UserList({ userListElement: userListElement });

        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.uiControls.on(InternalEvents.SET_TOOL, (tool: ToolType) => this.canvasManager.emit(InternalEvents.SET_TOOL, tool));
        this.uiControls.on(InternalEvents.SET_COLOR, (color: string) => this.canvasManager.emit(InternalEvents.SET_COLOR, color));
        this.uiControls.on(InternalEvents.SET_STROKE_WIDTH, (width: number) => this.canvasManager.emit(InternalEvents.SET_STROKE_WIDTH, width));

        this.uiControls.on(InternalEvents.UNDO, () => this.websocketClient.emitUndo());
        this.uiControls.on(InternalEvents.REDO, () => this.websocketClient.emitRedo());

        this.canvasManager.on(InternalEvents.DRAW_START, (data: { tool: ToolType, color: string, width: number }) => {
            this.websocketClient.emitDrawStart(data.tool, data.color, data.width);
        });
        this.canvasManager.on(InternalEvents.DRAW_MOVE, (point: Point) => {
            this.websocketClient.emitDrawMove(point);
            this.websocketClient.emitCursorMove(point);
        });
        this.canvasManager.on(InternalEvents.DRAW_END, (action: DrawAction) => {
            this.websocketClient.emitDrawEnd(action);
        });

        this.canvasManager.on(InternalEvents.UNDO, () => {
            console.log("Local UNDO action initiated. Waiting for server update.");
        });
        this.canvasManager.on(InternalEvents.REDO, () => {
            console.log("Local REDO action initiated. Waiting for server update.");
        });

        this.websocketClient.on(ServerToClientEvents.CONNECTION_ACK, (data: { userId: string, username: string }) => {
            this.localUserId = data.userId;
            this.localUsername = data.username;
            this.canvasManager.setLocalUserId(this.localUserId);
        });
    }

    private handleInitialState(operations: DrawAction[], users: User[]) {
        this.canvasManager.setCanvasState(operations, users);
        this.userList.render();
        this.uiControls.enableActions();
        console.log("Canvas and user state initialized.");
    }

    private handleUserJoined(user: User) {
        this.userList.updateUser(user);
        this.updateUserCount();
        console.log(`User joined: ${user.username}`);
        if (!this.localUserId && user.id === this.websocketClient.socketInstance?.id) {
            this.localUserId = user.id;
            this.localUsername = user.username;
            this.canvasManager.setLocalUserId(this.localUserId);
        }
    }

    private handleUserLeft(userId: string) {
        this.userList.removeUser(userId);
        this.updateUserCount();
        console.log(`User left: ${userId}`);
    }

    private handleCursorUpdate(userId: string, point: Point, isDrawing: boolean) {
        if (userId !== this.localUserId) {
            this.canvasManager.updateRemoteCursorDrawingStatus(userId, isDrawing);
            this.canvasManager.updateRemoteCursorPosition(userId, point);
        }
    }

    private handleDrawAction(action: DrawAction) {
        this.canvasManager.applyRemoteAction(action);
    }

    private handleOperationConfirmed(actionId: string, isNewAction: boolean) {
        console.log(`Operation confirmed by server: ${actionId} (New: ${isNewAction})`);
    }

    private handleLocalDrawAction(action: DrawAction) {
        if (this.localUserId) {
            action.userId = this.localUserId;
            this.websocketClient.emitDrawEnd(action);
        } else {
            console.error("Cannot send drawing action: Local user ID not set.");
        }
    }

    private updateUserCount() {
        const userCount = this.userList.getUsers().length;
        this.uiControls.updateUserCount(userCount);
    }

    public start() {
        this.websocketClient.connect();
        this.uiControls.enableActions();
    }

    public stop() {
        this.websocketClient.disconnect();
        this.canvasManager.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.start();

    window.addEventListener('beforeunload', () => {
        app.stop();
    });
});

