import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { StateManager } from './stateManager';
import {
    ServerEvents,
    ClientEvents,
    JoinRoomPayload,
    CursorMovePayload,
    DrawStartPayload,
    DrawMovePayload,
    DrawEndPayload,
    UndoRedoPayload,
    UserJoinedPayload,
    UserCursorUpdatePayload,
    DrawActionPayload,
    OperationAppliedPayload,
    FullCanvasUpdatePayload,
    ServerUser
} from './types';

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.NODE_ENV === 'production' ? 'https://your-frontend-url.com' : 'http://localhost:5173';

export class AppServer {
    private app: express.Express;
    private server: http.Server;
    private io: Server;
    private stateManager: StateManager;

    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: CORS_ORIGIN,
                methods: ['GET', 'POST'],
                transports: ['websocket', 'polling'],
                allowEIO3: true,
            },
            pingInterval: 10000,
            pingTimeout: 5000,
        });
        this.stateManager = new StateManager();

        this.configureMiddleware();
        this.setupWebSocketEvents();
        this.setupRoutes();
    }

    private configureMiddleware() {
        this.app.use(cors({ origin: CORS_ORIGIN }));
        this.app.use(express.json());
    }

    private setupRoutes() {
        this.app.get('/', (req, res) => {
            res.send('Collaborative Canvas Server is running!');
        });
    }

    private setupWebSocketEvents() {
        this.io.on('connection', (socket: Socket) => {
            console.log(`A user connected: ${socket.id}`);

            const newUser = this.stateManager.addUser(socket.id, `User_${socket.id.substring(0, 4)}`, '#ABCDEF');
            const initialState = this.stateManager.getCanvasState();
            socket.emit(ClientEvents.CONNECTION_ACK, { userId: socket.id, username: newUser.username });
            socket.emit(ClientEvents.INITIAL_STATE, initialState);

            const userJoinedPayload: UserJoinedPayload = { ...newUser, cursorPosition: newUser.cursorPosition, isDrawing: newUser.isDrawing, lastActivity: newUser.lastActivity };
            this.io.sockets.sockets.forEach((otherSocket, otherSocketId) => {
                if (otherSocketId !== socket.id) {
                    otherSocket.emit(ClientEvents.USER_JOINED, userJoinedPayload);
                }
            });

            socket.on(ServerEvents.JOIN_ROOM, (payload: JoinRoomPayload) => {
                console.log(`User ${socket.id} joined room.`);
                const existingUser = this.stateManager.getUser(socket.id);
                if (existingUser && payload.username && payload.username !== existingUser.username) {
                    existingUser.username = payload.username;
                    this.io.sockets.sockets.forEach((otherSocket, otherSocketId) => {
                        if (otherSocketId !== socket.id) {
                            otherSocket.emit(ClientEvents.USER_CURSOR_UPDATE, { userId: existingUser.id, point: existingUser.cursorPosition, isDrawing: existingUser.isDrawing });
                        }
                    });
                }
            });

            socket.on(ServerEvents.CURSOR_MOVE, (payload: CursorMovePayload) => {
                this.stateManager.updateUserCursor(payload.userId, payload.point);
            });

            socket.on(ServerEvents.DRAW_START, (payload: DrawStartPayload) => {
                this.stateManager.updateUserToolSettings(payload.userId, payload.tool, payload.color, payload.width);
                this.stateManager.processClientDrawEvent(ServerEvents.DRAW_START, payload);
            });

            socket.on(ServerEvents.DRAW_MOVE, (payload: DrawMovePayload) => {
                this.stateManager.processClientDrawEvent(ServerEvents.DRAW_MOVE, payload);
            });

            socket.on(ServerEvents.DRAW_END, (payload: DrawEndPayload) => {
                this.stateManager.processClientDrawEvent(ServerEvents.DRAW_END, payload);
            });

            socket.on(ServerEvents.UNDO, (payload: UndoRedoPayload) => {
                const operations = this.stateManager.undoLastOperation(payload.userId);
                if (operations) {
                    socket.emit(ClientEvents.OPERATION_APPLIED, { actionId: 'undo_request', type: 'UNDO' });
                } else {
                    socket.emit(ClientEvents.OPERATION_APPLIED, { actionId: 'undo_request', type: 'UNDO_FAILED' });
                }
            });

            socket.on(ServerEvents.REDO, (payload: UndoRedoPayload) => {
                const operations = this.stateManager.redoLastOperation(payload.userId);
                if (operations) {
                    socket.emit(ClientEvents.OPERATION_APPLIED, { actionId: 'redo_request', type: 'REDO' });
                } else {
                    socket.emit(ClientEvents.OPERATION_APPLIED, { actionId: 'redo_request', type: 'REDO_FAILED' });
                }
            });

            socket.on(ServerEvents.REQUEST_INITIAL_STATE, () => {
                const state = this.stateManager.getCanvasState();
                socket.emit(ClientEvents.INITIAL_STATE, state);
                console.log(`Sent initial state to ${socket.id}`);
            });

            socket.on('disconnect', (reason) => {
                console.log(`User disconnected: ${socket.id} (${reason})`);
                this.stateManager.removeUser(socket.id);
            });
        });

        this.stateManager.on(ClientEvents.USER_JOINED, (user: ServerUser) => {
            this.io.emit(ClientEvents.USER_JOINED, user);
        });
        this.stateManager.on(ClientEvents.USER_LEFT, (userId: string) => {
            this.io.emit(ClientEvents.USER_LEFT, userId);
        });
        this.stateManager.on(ClientEvents.USER_CURSOR_UPDATE, (data: UserCursorUpdatePayload) => {
            this.io.emit(ClientEvents.USER_CURSOR_UPDATE, data);
        });
        this.stateManager.on(ClientEvents.DRAW_ACTION, (action: DrawActionPayload) => {
            this.io.emit(ClientEvents.DRAW_ACTION, action);
        });
        this.stateManager.on(ClientEvents.FULL_CANVAS_UPDATE, (data: FullCanvasUpdatePayload) => {
            this.io.emit(ClientEvents.FULL_CANVAS_UPDATE, data);
        });
    }

    public start(): void {
        this.server.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
            console.log(`CORS Origin configured for: ${CORS_ORIGIN}`);
        });
    }
}

const server = new AppServer();
server.start();

