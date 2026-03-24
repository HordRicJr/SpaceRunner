/**
 * GameLoop.js
 * Central update loop. Manages game speed progression, delta time capping,
 * and per-tick update dispatch via GameState event bus.
 */
import { GameState, STATE } from './GameState.js';

// Configuration
const CFG = {
    SPEED_INITIAL:   8,       // world units per second
    SPEED_MAX:       32,
    SPEED_INCREMENT: 0.0018,  // added to speed per frame
    DELTA_CAP:       0.1      // cap delta at 100ms to avoid spiral-of-death
};

export class GameLoop {
    constructor() {
        this._state      = GameState.getInstance();
        this._speed      = CFG.SPEED_INITIAL;
        this._speedMult  = 1;
        this._distance   = 0;
        this._tick       = 0;
        this._observer   = null;
        this._scene      = null;
        this._multiplayer = false;
    }

    /**
     * Attach to the Babylon.js scene's before-render observable.
     * @param {BABYLON.Scene} scene
     */
    attach(scene) {
        this._scene = scene;
        this._observer = scene.onBeforeRenderObservable.add(() => {
            if (!this._state.is(STATE.PLAYING)) return;

            const rawDelta = scene.getEngine().getDeltaTime() / 1000;
            const dt = Math.min(rawDelta, CFG.DELTA_CAP);

            this._update(dt);
        });
    }

    _update(dt) {
        // Increment speed (rate scaled by mode multiplier)
        if (this._speed < CFG.SPEED_MAX) {
            this._speed += CFG.SPEED_INCREMENT * this._speedMult;
        }

        this._distance += this._speed * dt;
        this._tick++;

        // Publish tick data for all subscribers
        this._state.emit('game:tick', {
            dt,
            speed:    this._speed,
            distance: this._distance,
            tick:     this._tick
        });
    }

    get speed()    { return this._speed; }
    get distance() { return this._distance; }

    /**
     * Normalize speed 0-1 for UI speed bar.
     */
    get speedNormalized() {
        return (this._speed - CFG.SPEED_INITIAL) / (CFG.SPEED_MAX - CFG.SPEED_INITIAL);
    }

    /**
     * Apply a temporary speed modifier.
     * @param {number} factor - multiplier (e.g. 0.5 for slow)
     * @param {number} duration - seconds
     */
    applySpeedModifier(factor, duration) {
        const originalSpeed = this._speed;
        this._speed *= factor;
        setTimeout(() => {
            this._speed = Math.max(this._speed, originalSpeed);
        }, duration * 1000);
    }

    reset(opts = {}) {
        this._speed    = opts.initialSpeed ?? CFG.SPEED_INITIAL;
        this._speedMult = opts.speedMult  ?? 1;
        this._distance = 0;
        this._tick     = 0;
    }

    detach() {
        if (this._scene && this._observer) {
            this._scene.onBeforeRenderObservable.remove(this._observer);
            this._observer = null;
        }
    }
}
