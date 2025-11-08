import { Point, DrawAction, User, ToolType, InternalEvents } from './types';
import { EventEmitter } from 'events';

interface CanvasManagerOptions {
    canvasElement: HTMLCanvasElement;
    cursorOverlayElement: HTMLElement;
    onActionDraw: (action: DrawAction) => void; // Callback to send action to server
    onRedraw: () => void; // Callback to tell app to redraw everything
}

export class CanvasManager extends EventEmitter {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private cursorOverlay: HTMLElement;

    private actions: DrawAction[] = []; // All drawing operations applied to the canvas
    private history: DrawAction[][] = []; // Stack for undo/redo (array of action lists)
    private historyIndex = -1; // Current position in history
    private nextActionId = 0; // To generate unique action IDs

    private currentTool: ToolType = 'brush';
    private currentColor: string = '#000000';
    private currentStrokeWidth: number = 5;

    private isDrawing = false;
    private startPoint: Point | null = null;
    private currentPoints: Point[] = []; // For path drawing
    private lastRenderedActionId: string | null = null; // To avoid re-rendering unchanged actions

    // For smooth cursor interpolation
    public remoteCursors: Map<string, { target: Point, current: Point, color: string, username: string, isDrawing: boolean }> = new Map();
    private cursorAnimationFrame: number | null = null;

    private onActionDraw: (action: DrawAction) => void;
    private onRedraw: () => void;

    private localUserId: string | null = null;

    // Helper to get timestamp of last cursor movement/update
    private cursorTimestamps: Map<string, number> = new Map();

    constructor(options: CanvasManagerOptions) {
        super();
        this.canvas = options.canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true })!;
        this.cursorOverlay = options.cursorOverlayElement;
        this.onActionDraw = options.onActionDraw;
        this.onRedraw = options.onRedraw;

        this.setupCanvasResizing();
        this.setupCanvasEventListeners();
        this.setupCursorOverlay();

        // Initial setup
        this.resizeCanvas();
    }

    public setLocalUserId(userId: string) {
        this.localUserId = userId;
    }

    private setupCanvasResizing() {
        // Update canvas size when the window resizes
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }

    private resizeCanvas() {
        const container = this.canvas.parentElement!;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.canvas.width = width;
        this.canvas.height = height;

        this.emit(InternalEvents.RESIZE_CANVAS, { width, height });
        this.redrawCanvas(); // Redraw after resizing
    }

    private setupCanvasEventListeners() {
        // Local drawing events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.handleMouseOut.bind(this));

        // Prevent default drag behavior
        this.canvas.addEventListener('dragstart', (e) => e.preventDefault());

        // Handle touch events for mobile/tablet
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this));

        // Listen for internal events
        this.on(InternalEvents.SET_TOOL, (tool: ToolType) => this.setTool(tool));
        this.on(InternalEvents.SET_COLOR, (color: string) => this.setColor(color));
        this.on(InternalEvents.SET_STROKE_WIDTH, (width: number) => this.setStrokeWidth(width));
    }

    // --- Event Handlers ---
    private handleMouseDown(event: MouseEvent) {
        if (event.button !== 0) return; // Only primary button

        this.isDrawing = true;
        this.startPoint = { x: event.offsetX, y: event.offsetY };
        this.currentPoints = [{ x: event.offsetX, y: event.offsetY }];
        this.canvas.style.cursor = 'crosshair';

        // Emit event to inform UI/WebSocket client to start sending
        this.emit(InternalEvents.DRAW_START, { tool: this.currentTool, color: this.currentColor, width: this.currentStrokeWidth });
    }

    private handleMouseMove(event: MouseEvent) {
        if (!this.isDrawing) {
            // Update remote cursor position even when not drawing locally
            this.updateRemoteCursor({ x: event.offsetX, y: event.offsetY });
            return;
        }

        this.currentPoints.push({ x: event.offsetX, y: event.offsetY });
        this.emit(InternalEvents.DRAW_MOVE, { x: event.offsetX, y: event.offsetY });
    }

    private handleMouseUp(event: MouseEvent) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Final point for path
        if (this.currentPoints.length > 0) {
            this.currentPoints.push({ x: event.offsetX, y: event.offsetY });
        }

        // Create and dispatch the final drawing action
        const action: DrawAction = {
            id: `action_${this.nextActionId++}`,
            userId: this.localUserId || 'local_user_id',
            type: this.currentTool,
            color: this.currentTool === 'eraser' ? '#ffffff' : this.currentColor,
            width: this.currentStrokeWidth,
            points: this.currentPoints,
            startPoint: this.startPoint,
            endPoint: { x: event.offsetX, y: event.offsetY },
        };

        this.onActionDraw(action);
        this.applyLocalAction(action);
        this.emit(InternalEvents.DRAW_END, action);

        this.startPoint = null;
        this.currentPoints = [];
        this.canvas.style.cursor = 'crosshair';
    }

    private handleMouseOut(event: MouseEvent) {
        if (this.isDrawing) {
            this.handleMouseUp(event as any);
        }
    }

    // --- Touch Event Handlers ---
    private handleTouchStart(event: TouchEvent) {
        event.preventDefault();
        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        this.isDrawing = true;
        this.startPoint = { x, y };
        this.currentPoints = [{ x, y }];
        this.emit(InternalEvents.DRAW_START, { tool: this.currentTool, color: this.currentColor, width: this.currentStrokeWidth });
    }

    private handleTouchMove(event: TouchEvent) {
        event.preventDefault();
        if (!this.isDrawing) {
            const touch = event.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.updateRemoteCursor({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
            return;
        }

        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.currentPoints.push({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
        this.emit(InternalEvents.DRAW_MOVE, { x: touch.clientX - rect.left, y: touch.clientY - rect.top });
    }

    private handleTouchEnd(event: TouchEvent) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const rect = this.canvas.getBoundingClientRect();
        const touch = event.changedTouches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        if (this.currentPoints.length > 0) {
            this.currentPoints.push({ x, y });
        }

        const action: DrawAction = {
            id: `action_${this.nextActionId++}`,
            userId: this.localUserId || 'local_user_id',
            type: this.currentTool,
            color: this.currentTool === 'eraser' ? '#ffffff' : this.currentColor,
            width: this.currentStrokeWidth,
            points: this.currentPoints,
            startPoint: this.startPoint,
            endPoint: { x, y },
        };

        this.onActionDraw(action);
        this.applyLocalAction(action);
        this.emit(InternalEvents.DRAW_END, action);

        this.startPoint = null;
        this.currentPoints = [];
    }

    // --- Drawing Logic ---
    private applyLocalAction(action: DrawAction) {
        this.actions.push(action);
        this.history.splice(this.historyIndex + 1);
        this.history.push([...this.actions]);
        this.historyIndex = this.history.length - 1;

        this.redrawCanvas();
    }

    public applyRemoteAction(action: DrawAction) {
        if (this.actions.some(a => a.id === action.id)) {
            console.warn(`Action ${action.id} already exists, skipping.`);
            return;
        }
        this.actions.push(action);
        this.lastRenderedActionId = null;
        this.redrawCanvas();
    }

    public setCanvasState(operations: DrawAction[], users: User[]) {
        this.actions = [...operations];
        this.history = [operations];
        this.historyIndex = 0;
        this.lastRenderedActionId = null;

        this.updateRemoteCursors(users);
        this.redrawCanvas();
    }

    public redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        for (const action of this.actions) {
            this.drawAction(action);
            this.lastRenderedActionId = action.id;
        }
        this.redrawRemoteCursors();
    }

    private drawAction(action: DrawAction) {
        this.ctx.save();
        this.ctx.beginPath();

        const { type, width, points, color, startPoint, endPoint } = action;

        this.ctx.lineWidth = width;

        if (type === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = color || '#000';
        }

        if (points && points.length > 0) {
            this.ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.ctx.lineTo(points[i].x, points[i].y);
            }
            this.ctx.stroke();
        } else if (startPoint && endPoint) {
            if (type === 'rect' && startPoint && endPoint) {
                this.ctx.rect(startPoint.x, startPoint.y, endPoint.x - startPoint.x, endPoint.y - startPoint.y);
                if (action.fill) this.ctx.fill(); else this.ctx.stroke();
            }
        }
        this.ctx.restore();
    }

    // --- Undo/Redo ---
    public undo() {
        if (this.historyIndex <= 0) return;

        this.historyIndex--;
        this.actions = [...this.history[this.historyIndex]];
        this.redrawCanvas();
        this.emit(InternalEvents.UNDO);
    }

    public redo() {
        if (this.historyIndex >= this.history.length - 1) return;

        this.historyIndex++;
        this.actions = [...this.history[this.historyIndex]];
        this.redrawCanvas();
        this.emit(InternalEvents.REDO);
    }

    // --- Tool, Color, Stroke Width Management ---
    public setTool(tool: ToolType) {
        this.currentTool = tool;
        console.log(`Tool set to: ${tool}`);
    }

    public setColor(color: string) {
        this.currentColor = color;
        console.log(`Color set to: ${color}`);
    }

    public setStrokeWidth(width: number) {
        this.currentStrokeWidth = width;
        console.log(`Stroke width set to: ${width}`);
    }

    // --- Remote Cursor Management ---
    private setupCursorOverlay() {
        this.cursorAnimationFrame = requestAnimationFrame(this.animateCursors.bind(this));
    }

    private updateRemoteCursor(point: Point) {
        const localUserId = this.localUserId || 'local_user_id';
        const localUser = { id: localUserId, username: 'You', color: '#ffffff' };

        if (this.remoteCursors.has(localUserId)) {
            const cursor = this.remoteCursors.get(localUserId)!;
            cursor.target = point;
            cursor.isDrawing = this.isDrawing;
        } else {
            this.remoteCursors.set(localUserId, {
                target: point,
                current: point,
                color: localUser.color,
                username: localUser.username,
                isDrawing: this.isDrawing
            });
        }
    }

    public updateRemoteCursors(users: User[]) {
        const currentUserIds = new Set(users.map(u => u.id));
        const existingCursorIds = new Set(this.remoteCursors.keys());

        existingCursorIds.forEach(userId => {
            if (!currentUserIds.has(userId)) {
                this.remoteCursors.delete(userId);
            }
        });

        users.forEach(user => {
            if (!this.remoteCursors.has(user.id)) {
                this.remoteCursors.set(user.id, {
                    target: { x: -100, y: -100 },
                    current: { x: -100, y: -100 },
                    color: user.color,
                    username: user.username,
                    isDrawing: false
                });
            } else {
                const cursor = this.remoteCursors.get(user.id)!;
                cursor.color = user.color;
                cursor.username = user.username;
            }
        });

        if (this.remoteCursors.size > 0 && !this.cursorAnimationFrame) {
            this.setupCursorOverlay();
        } else if (this.remoteCursors.size === 0 && this.cursorAnimationFrame) {
            cancelAnimationFrame(this.cursorAnimationFrame);
            this.cursorAnimationFrame = null;
            this.cursorOverlay.innerHTML = '';
        }
    }

    private animateCursors() {
        if (this.remoteCursors.size === 0) {
            this.cursorAnimationFrame = null;
            this.cursorOverlay.innerHTML = '';
            return;
        }

        const animationFrameId = requestAnimationFrame(this.animateCursors.bind(this));
        this.cursorAnimationFrame = animationFrameId;

        for (const [userId, cursor] of this.remoteCursors.entries()) {
            let cursorElement = this.cursorOverlay.querySelector(`[data-user-id="${userId}"]`) as HTMLElement;

            if (cursor.isDrawing) {
                cursor.target = { ...cursor.current };
            } else {
                cursor.target = cursor.current;
            }

            const lerpFactor = 0.2;
            cursor.current.x += (cursor.target.x - cursor.current.x) * lerpFactor;
            cursor.current.y += (cursor.target.y - cursor.current.y) * lerpFactor;

            const posX = Math.round(cursor.current.x);
            const posY = Math.round(cursor.current.y);

            if (!cursorElement) {
                cursorElement = document.createElement('div');
                cursorElement.className = 'remote-cursor';
                cursorElement.setAttribute('data-user-id', userId);

                const dotElement = document.createElement('div');
                dotElement.className = 'dot';
                dotElement.style.backgroundColor = cursor.color;
                dotElement.style.boxShadow = `0 0 8px ${cursor.color}`;

                const usernameElement = document.createElement('span');
                usernameElement.className = 'username';
                usernameElement.textContent = cursor.username;

                cursorElement.appendChild(dotElement);
                cursorElement.appendChild(usernameElement);
                this.cursorOverlay.appendChild(cursorElement);
            }

            cursorElement.style.left = `${posX}px`;
            cursorElement.style.top = `${posY}px`;
            (cursorElement.querySelector('.dot') as HTMLElement).style.backgroundColor = cursor.color;
            (cursorElement.querySelector('.username') as HTMLElement).textContent = cursor.username;

            const inactivityThreshold = 1000;
            const timeSinceLastMove = Date.now() - this.getCursorTimestamp(userId);
            const opacity = cursor.isDrawing || timeSinceLastMove < inactivityThreshold ? 1 : 0.3;
            cursorElement.style.opacity = opacity.toString();
        }
    }

    private getCursorTimestamp(userId: string): number {
        if (!this.cursorTimestamps.has(userId)) {
            this.cursorTimestamps.set(userId, Date.now());
        }
        return this.cursorTimestamps.get(userId)!;
    }

    public reportLocalCursorUpdate(point: Point) {
        const localUserId = this.localUserId || 'local_user_id';
        this.cursorTimestamps.set(localUserId, Date.now());
        if (this.remoteCursors.has(localUserId)) {
            const cursor = this.remoteCursors.get(localUserId)!;
            cursor.target = point;
            cursor.isDrawing = this.isDrawing;
        } else {
            this.remoteCursors.set(localUserId, {
                target: point,
                current: point,
                color: '#ffffff',
                username: 'You',
                isDrawing: this.isDrawing
            });
        }
    }

    public updateRemoteCursorDrawingStatus(userId: string, isDrawing: boolean) {
        if (this.remoteCursors.has(userId)) {
            this.remoteCursors.get(userId)!.isDrawing = isDrawing;
            this.cursorTimestamps.set(userId, Date.now());
        }
    }

    public updateRemoteCursorPosition(userId: string, point: Point) {
        if (this.remoteCursors.has(userId)) {
            const cursor = this.remoteCursors.get(userId)!;
            cursor.target = point;
            this.cursorTimestamps.set(userId, Date.now());
        }
    }

    private redrawRemoteCursors() {
        // Cursors are handled by animateCursors, this is a placeholder
    }

    // --- Cleanup ---
    public destroy() {
        window.removeEventListener('resize', this.resizeCanvas.bind(this));
        if (this.cursorAnimationFrame) {
            cancelAnimationFrame(this.cursorAnimationFrame);
        }
        this.removeAllListeners();
    }
}

