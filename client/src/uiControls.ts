import { EventEmitter } from 'events';
import { ToolType, InternalEvents } from './types';

interface UiControlsOptions {
    canvasManager: EventEmitter;
    recentColorsStorageKey?: string;
}

export class UiControls extends EventEmitter {
    private canvasManager: EventEmitter;
    private options: UiControlsOptions;

    private toolButtons: NodeListOf<HTMLButtonElement>;
    private colorPickerElement: HTMLElement;
    private customColorInput: HTMLInputElement;
    private recentColorsContainer: HTMLElement;
    private strokeWidthSlider: HTMLInputElement;
    private strokeWidthPreview: HTMLElement;
    private undoButton: HTMLButtonElement;
    private redoButton: HTMLButtonElement;
    private connectionStatusElement: HTMLElement;
    private userCountIndicator: HTMLElement;

    private selectedTool: ToolType = 'brush';
    private selectedColor: string = '#000000';
    private strokeWidth: number = 5;
    private recentColors: string[] = [];
    private readonly MAX_RECENT_COLORS = 8;

    constructor(options: UiControlsOptions) {
        super();
        this.canvasManager = options.canvasManager;
        this.options = options;

        this.initUIElements();
        this.loadRecentColors();
        this.setupEventListeners();
        this.updateUIState();
    }

    private initUIElements() {
        this.toolButtons = document.querySelectorAll('.tool-button');
        this.colorPickerElement = document.getElementById('color-picker')!;
        this.customColorInput = document.getElementById('custom-color-input') as HTMLInputElement;
        this.recentColorsContainer = document.getElementById('recent-colors-container')!;
        this.strokeWidthSlider = document.getElementById('stroke-width-slider') as HTMLInputElement;
        this.strokeWidthPreview = document.getElementById('stroke-width-preview')!;
        this.undoButton = document.getElementById('undo-button') as HTMLButtonElement;
        this.redoButton = document.getElementById('redo-button') as HTMLButtonElement;
        this.connectionStatusElement = document.getElementById('connection-status')!;
        this.userCountIndicator = document.getElementById('user-count-indicator')!;
    }

    private loadRecentColors() {
        const storedColors = localStorage.getItem(this.options.recentColorsStorageKey || 'recentColors');
        if (storedColors) {
            this.recentColors = JSON.parse(storedColors);
        }
        this.renderRecentColors();
    }

    private saveRecentColors() {
        localStorage.setItem(this.options.recentColorsStorageKey || 'recentColors', JSON.stringify(this.recentColors));
    }

    private addRecentColor(color: string) {
        if (this.recentColors.includes(color)) {
            this.recentColors = this.recentColors.filter(c => c !== color);
        }
        this.recentColors.unshift(color);
        if (this.recentColors.length > this.MAX_RECENT_COLORS) {
            this.recentColors.pop();
        }
        this.saveRecentColors();
        this.renderRecentColors();
    }

    private renderRecentColors() {
        this.recentColorsContainer.innerHTML = '';
        this.recentColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'recent-color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.addEventListener('click', () => {
                this.selectColor(color);
            });
            this.recentColorsContainer.appendChild(swatch);
        });
    }

    private setupEventListeners() {
        this.toolButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tool = button.dataset.tool as ToolType;
                this.selectTool(tool);
            });
        });

        this.colorPickerElement.addEventListener('click', () => {
            this.customColorInput.click();
        });
        this.customColorInput.addEventListener('input', (e) => {
            const color = (e.target as HTMLInputElement).value;
            this.selectColor(color);
        });

        this.strokeWidthSlider.addEventListener('input', (e) => {
            this.strokeWidth = parseInt((e.target as HTMLInputElement).value, 10);
            this.updateStrokeWidthPreview();
            this.canvasManager.emit(InternalEvents.SET_STROKE_WIDTH, this.strokeWidth);
        });

        this.undoButton.addEventListener('click', () => {
            this.emit(InternalEvents.UNDO);
        });
        this.redoButton.addEventListener('click', () => {
            this.emit(InternalEvents.REDO);
        });

        this.canvasManager.on(InternalEvents.SET_TOOL, (tool: ToolType) => this.selectTool(tool));
        this.canvasManager.on(InternalEvents.SET_COLOR, (color: string) => this.selectColor(color));
        this.canvasManager.on(InternalEvents.SET_STROKE_WIDTH, (width: number) => this.setStrokeWidth(width));
    }

    private selectTool(tool: ToolType) {
        this.selectedTool = tool;
        this.toolButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tool === tool);
        });
        this.canvasManager.emit(InternalEvents.SET_TOOL, tool);
    }

    private selectColor(color: string) {
        this.selectedColor = color.toUpperCase();
        this.addRecentColor(this.selectedColor);
        this.updateUIState();
        this.canvasManager.emit(InternalEvents.SET_COLOR, this.selectedColor);
    }

    private setStrokeWidth(width: number) {
        this.strokeWidth = width;
        this.strokeWidthSlider.value = width.toString();
        this.updateStrokeWidthPreview();
        this.canvasManager.emit(InternalEvents.SET_STROKE_WIDTH, this.strokeWidth);
    }

    private updateStrokeWidthPreview() {
        this.strokeWidthPreview.style.width = `${this.strokeWidth}px`;
        this.strokeWidthPreview.style.height = `${this.strokeWidth}px`;
        this.strokeWidthPreview.style.backgroundColor = this.selectedColor;
    }

    private updateUIState() {
        this.toolButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tool === this.selectedTool);
        });

        this.customColorInput.value = this.selectedColor;
        this.updateStrokeWidthPreview();
    }

    public updateConnectionStatus(status: string) {
        this.connectionStatusElement.textContent = status;
        if (status === 'Connected') {
            this.connectionStatusElement.style.color = '#4CAF50';
        } else if (status === 'Connecting...') {
            this.connectionStatusElement.style.color = '#FFC107';
        } else {
            this.connectionStatusElement.style.color = '#F44336';
        }
    }

    public updateUserCount(count: number) {
        this.userCountIndicator.textContent = `${count}`;
    }

    public disableActions() {
        this.undoButton.disabled = true;
        this.redoButton.disabled = true;
        this.toolButtons.forEach(btn => btn.disabled = true);
    }

    public enableActions() {
        this.undoButton.disabled = false;
        this.redoButton.disabled = false;
        this.toolButtons.forEach(btn => btn.disabled = false);
    }
}

