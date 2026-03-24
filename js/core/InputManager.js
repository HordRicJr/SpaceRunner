/**
 * InputManager.js
 * Unified keyboard + touch input handler.
 * Translates raw events into named actions dispatched to subscribers.
 *
 * Actions: JUMP_P1, DUCK_P1, JUMP_P2, DUCK_P2, PAUSE
 */

const ACTIONS = {
    JUMP_P1:  'JUMP_P1',
    DUCK_P1:  'DUCK_P1',
    DUCK_P1_RELEASE: 'DUCK_P1_RELEASE',
    JUMP_P2:  'JUMP_P2',
    DUCK_P2:  'DUCK_P2',
    DUCK_P2_RELEASE: 'DUCK_P2_RELEASE',
    PAUSE:    'PAUSE',
    CONFIRM:  'CONFIRM'
};

export class InputManager {
    constructor() {
        if (InputManager._instance) {
            return InputManager._instance;
        }
        InputManager._instance = this;

        this._listeners = {};
        this._active    = false;

        // Touch tracking
        this._touchStartY = 0;
        this._touchStartX = 0;

        Object.values(ACTIONS).forEach(a => { this._listeners[a] = []; });
    }

    static getInstance() {
        if (!InputManager._instance) {
            new InputManager();
        }
        return InputManager._instance;
    }

    /**
     * Attach all DOM event listeners.
     * @param {HTMLElement} target - element for touch events (canvas)
     */
    attach(target) {
        if (this._active) return;
        this._active = true;
        this._target = target;

        this._onKeyDown   = this._handleKeyDown.bind(this);
        this._onKeyUp     = this._handleKeyUp.bind(this);
        this._onTouchStart = this._handleTouchStart.bind(this);
        this._onTouchEnd   = this._handleTouchEnd.bind(this);
        this._onClick      = this._handleClick.bind(this);

        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup',   this._onKeyUp);
        target.addEventListener('touchstart', this._onTouchStart, { passive: false });
        target.addEventListener('touchend',   this._onTouchEnd,   { passive: false });
        target.addEventListener('click',      this._onClick);
    }

    detach() {
        if (!this._active) return;
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup',   this._onKeyUp);
        if (this._target) {
            this._target.removeEventListener('touchstart', this._onTouchStart);
            this._target.removeEventListener('touchend',   this._onTouchEnd);
            this._target.removeEventListener('click',      this._onClick);
        }
        this._active = false;
    }

    /**
     * Subscribe to a named action.
     * @param {string} action - one of the ACTIONS values
     * @param {Function} callback
     * @returns {Function} unsubscribe function
     */
    on(action, callback) {
        if (!this._listeners[action]) {
            this._listeners[action] = [];
        }
        this._listeners[action].push(callback);
        return () => this.off(action, callback);
    }

    off(action, callback) {
        if (!this._listeners[action]) return;
        this._listeners[action] = this._listeners[action].filter(fn => fn !== callback);
    }

    _emit(action) {
        const cbs = this._listeners[action];
        if (cbs) cbs.forEach(fn => fn());
    }

    _handleKeyDown(e) {
        switch (e.code) {
            case 'Space':
            case 'ArrowUp':
                e.preventDefault();
                this._emit(ACTIONS.JUMP_P1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this._emit(ACTIONS.DUCK_P1);
                break;
            case 'KeyW':
                this._emit(ACTIONS.JUMP_P2);
                break;
            case 'KeyS':
                this._emit(ACTIONS.DUCK_P2);
                break;
            case 'Escape':
            case 'KeyP':
                this._emit(ACTIONS.PAUSE);
                break;
            case 'Enter':
                this._emit(ACTIONS.CONFIRM);
                break;
        }
    }

    _handleKeyUp(e) {
        switch (e.code) {
            case 'ArrowDown':
                this._emit(ACTIONS.DUCK_P1_RELEASE);
                break;
            case 'KeyS':
                this._emit(ACTIONS.DUCK_P2_RELEASE);
                break;
        }
    }

    _handleTouchStart(e) {
        const touch = e.touches[0];
        this._touchStartX = touch.clientX;
        this._touchStartY = touch.clientY;
    }

    _handleTouchEnd(e) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this._touchStartX;
        const dy = touch.clientY - this._touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDy > 40 && absDy > absDx) {
            // Swipe down = duck
            if (dy > 0) {
                this._emit(ACTIONS.DUCK_P1);
                setTimeout(() => this._emit(ACTIONS.DUCK_P1_RELEASE), 500);
            } else {
                // Swipe up = jump
                this._emit(ACTIONS.JUMP_P1);
            }
        } else {
            // Tap = jump
            this._emit(ACTIONS.JUMP_P1);
        }
        e.preventDefault();
    }

    _handleClick() {
        this._emit(ACTIONS.JUMP_P1);
        this._emit(ACTIONS.CONFIRM);
    }

    dispose() {
        this.detach();
        Object.keys(this._listeners).forEach(k => { this._listeners[k] = []; });
        InputManager._instance = null;
    }
}

InputManager._instance = null;
export { ACTIONS };
