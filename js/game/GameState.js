/**
 * GameState.js
 * Finite state machine for the game lifecycle.
 * Also serves as a lightweight event bus for cross-module communication.
 *
 * States: LOADING -> MENU -> PLAYING -> PAUSED -> GAMEOVER
 */

export const STATE = {
    LOADING:  'LOADING',
    MENU:     'MENU',
    PLAYING:  'PLAYING',
    PAUSED:   'PAUSED',
    GAMEOVER: 'GAMEOVER'
};

export class GameState {
    constructor() {
        if (GameState._instance) {
            return GameState._instance;
        }
        GameState._instance = this;

        this._current  = STATE.LOADING;
        this._previous = null;
        this._channels = {};
    }

    static getInstance() {
        if (!GameState._instance) {
            new GameState();
        }
        return GameState._instance;
    }

    get current() { return this._current; }
    get previous() { return this._previous; }

    /**
     * Transition to a new state. Emits 'state:change' event.
     * @param {string} newState
     */
    transition(newState) {
        if (!Object.values(STATE).includes(newState)) {
            console.warn('GameState: unknown state', newState);
            return;
        }
        if (this._current === newState) return;

        this._previous = this._current;
        this._current  = newState;

        this.emit('state:change', { from: this._previous, to: this._current });
        this.emit(`state:${newState}`, { from: this._previous });
    }

    is(state)  { return this._current === state; }
    was(state) { return this._previous === state; }

    // ---- Mini Event Bus ----

    /**
     * Subscribe to a channel.
     * @param {string} channel
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    on(channel, callback) {
        if (!this._channels[channel]) {
            this._channels[channel] = [];
        }
        this._channels[channel].push(callback);
        return () => this.off(channel, callback);
    }

    off(channel, callback) {
        if (!this._channels[channel]) return;
        this._channels[channel] = this._channels[channel].filter(fn => fn !== callback);
    }

    /**
     * Emit an event on a channel with optional data.
     * @param {string} channel
     * @param {*} data
     */
    emit(channel, data) {
        const cbs = this._channels[channel];
        if (cbs) cbs.forEach(fn => fn(data));
    }

    /**
     * One-time subscription.
     */
    once(channel, callback) {
        const unsub = this.on(channel, (data) => {
            unsub();
            callback(data);
        });
        return unsub;
    }

    reset() {
        this._current  = STATE.LOADING;
        this._previous = null;
    }

    dispose() {
        this._channels = {};
        GameState._instance = null;
    }
}

GameState._instance = null;
