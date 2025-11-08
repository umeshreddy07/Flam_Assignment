import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import {
    ClientToServerEvents,
    ServerToClientEvents,
    DrawAction,
    User,
    Point,
    ToolType
} from './types';

interface WebSocketClientOptions {
    onInitialState: (operations: DrawAction[], users: User[]) => void;
    onUserJoined: (user: User) => void;
    onUserLeft: (userId: string) => void;
    onCursorUpdate: (userId: string, point: Point, isDrawing: boolean) => void;
    onDrawAction: (action: DrawAction) => void;
    onOperationConfirmed: (actionId: string, isNewAction: boolean) => void;
    onConnectionStatus: (status: string) => void;
}

export class WebSocketClient extends EventEmitter {
    private socket: Socket | null = null;
    private options: WebSocketClientOptions;
    private userId: string | null = null;
    private username: string = 'Anonymous';
    private serverUrl: string;

    constructor(serverUrl: string, options: WebSocketClientOptions) {
        super();
        this.serverUrl = serverUrl;
        this.options = options;
    }

    public get socketInstance(): Socket | null {
        return this.socket;
    }

    public connect() {
        this.options.onConnectionStatus('Connecting...');
        this.socket = io(this.serverUrl, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.socket!.on('connect', () => {
            this.userId = this.socket!.id;
            this.options.onConnectionStatus('Connected');
            console.log('Connected to server with ID:', this.userId);

            this.emit(ClientToServerEvents.REQUEST_INITIAL_STATE);
            this.emit(ClientToServerEvents.JOIN_ROOM, { userId: this.userId, username: this.username });
        });

        this.socket!.on('disconnect', (reason) => {
            this.options.onConnectionStatus(`Disconnected: ${reason}`);
            console.log('Disconnected:', reason);
            this.userId = null;
        });

        this.socket!.on('connect_error', (err) => {
            this.options.onConnectionStatus('Connection Error');
            console.error('Connection error:', err);
        });

        this.socket!.on(ServerToClientEvents.CONNECTION_ACK, (data: { userId: string, username: string }) => {
            this.userId = data.userId;
            this.username = data.username;
            console.log(`Connection acknowledged. Assigned ID: ${this.userId}, Username: ${this.username}`);
            this.options.onConnectionStatus('Connected');
            this.emit(ServerToClientEvents.CONNECTION_ACK, data);
        });

        this.socket!.on(ServerToClientEvents.INITIAL_STATE, (data: { operations: DrawAction[], users: User[] }) => {
            console.log('Received initial state:', data);
            this.options.onInitialState(data.operations, data.users);
        });

        this.socket!.on(ServerToClientEvents.USER_JOINED, (user: User) => {
            console.log('User joined:', user);
            this.options.onUserJoined(user);
        });

        this.socket!.on(ServerToClientEvents.USER_LEFT, (userId: string) => {
            console.log('User left:', userId);
            this.options.onUserLeft(userId);
        });

        this.socket!.on(ServerToClientEvents.USER_CURSOR_UPDATE, (data: { userId: string, point: Point, isDrawing: boolean }) => {
            this.options.onCursorUpdate(data.userId, data.point, data.isDrawing);
        });

        this.socket!.on(ServerToClientEvents.DRAW_ACTION, (action: DrawAction) => {
            console.log('Received draw action:', action);
            this.options.onDrawAction(action);
            this.socket!.emit(ClientToServerEvents.OPERATION_APPLIED, { actionId: action.id, type: 'DRAW_ACTION' });
        });

        this.socket!.on(ServerToClientEvents.OPERATION_APPLIED, (data: { actionId: string, type: string }) => {
            console.log(`Server confirmed ${data.type} for action: ${data.actionId}`);
            if (data.type === 'DRAW_ACTION') {
                this.options.onOperationConfirmed(data.actionId, false);
            }
        });

        this.socket!.on(ServerToClientEvents.FULL_CANVAS_UPDATE, (data: { operations: DrawAction[], users: User[] }) => {
            console.log('Received full canvas update:', data);
            this.options.onInitialState(data.operations, data.users);
        });
    }

    public emitDrawStart(tool: ToolType, color: string, width: number) {
        if (!this.socket) return;
        const localUserId = this.userId!;
        this.socket.emit(ClientToServerEvents.DRAW_START, { userId: localUserId, tool, color, width });
    }

    public emitDrawMove(point: Point) {
        if (!this.socket || !this.userId) return;
        this.socket.emit(ClientToServerEvents.DRAW_MOVE, { userId: this.userId, point });
    }

    public emitDrawEnd(action: DrawAction) {
        if (!this.socket || !this.userId) return;
        this.socket.emit(ClientToServerEvents.DRAW_END, action);
    }

    public emitCursorMove(point: Point) {
        if (!this.socket || !this.userId) return;
        this.socket.emit(ClientToServerEvents.CURSOR_MOVE, { userId: this.userId, point });
    }

    public emitUndo() {
        if (!this.socket || !this.userId) return;
        this.socket.emit(ClientToServerEvents.UNDO, { userId: this.userId });
    }

    public emitRedo() {
        if (!this.socket || !this.userId) return;
        this.socket.emit(ClientToServerEvents.REDO, { userId: this.userId });
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.options.onConnectionStatus('Disconnected');
        }
    }
}

