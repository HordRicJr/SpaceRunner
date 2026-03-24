/**
 * Engine.js
 * Singleton wrapper around Babylon.js Engine.
 * Handles creation, resize, and disposal.
 */
export class Engine {
    constructor() {
        if (Engine._instance) {
            return Engine._instance;
        }
        Engine._instance = this;

        this._engine = null;
        this._canvas = null;
    }

    static getInstance() {
        if (!Engine._instance) {
            new Engine();
        }
        return Engine._instance;
    }

    /**
     * Initialize the Babylon engine on the given canvas.
     * @param {HTMLCanvasElement} canvas
     */
    init(canvas) {
        this._canvas = canvas;
        this._engine = new BABYLON.Engine(canvas, true, {
            antialias: true,
            adaptToDeviceRatio: true,
            preserveDrawingBuffer: false,
            stencil: true
        });

        this._engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

        window.addEventListener('resize', () => {
            this._engine.resize();
        });

        return this._engine;
    }

    /**
     * Returns the raw Babylon.js Engine.
     */
    get raw() {
        return this._engine;
    }

    get canvas() {
        return this._canvas;
    }

    /**
     * Start the render loop with the given render function.
     * @param {Function} renderFn
     */
    startRenderLoop(renderFn) {
        this._engine.runRenderLoop(renderFn);
    }

    stopRenderLoop() {
        this._engine.stopRenderLoop();
    }

    dispose() {
        if (this._engine) {
            this._engine.dispose();
            this._engine = null;
        }
        Engine._instance = null;
    }
}

Engine._instance = null;
