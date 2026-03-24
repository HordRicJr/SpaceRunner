/**
 * Scorer.js
 * Manages score, combo multiplier, and localStorage highscore.
 */
import { GameState } from './GameState.js';

const STORAGE_KEY_SOLO  = 'spacerunner_highscore';
const STORAGE_KEY_MULTI = 'spacerunner_highscore_multi';

// Score: 1 point per unit of distance (scaled by multiplier)
const SCORE_PER_UNIT    = 1.0;
const COMBO_THRESHOLD   = 300;   // distance without obstacle hit to level up multiplier
const MAX_MULTIPLIER    = 8;

export class Scorer {
    constructor() {
        this._state     = GameState.getInstance();
        this._scores    = [0, 0];   // [p1, p2]
        this._multipliers = [1, 1];
        this._comboDistance = [0, 0];
        this._multiplayer = false;

        this._highscore = this._loadHighscore(STORAGE_KEY_SOLO);

        // Subscribe to game tick
        this._state.on('game:tick', ({ dt, speed }) => {
            const dist = speed * dt;
            this._addDistance(0, dist);
            if (this._multiplayer) {
                this._addDistance(1, dist);
            }
        });
    }

    _addDistance(playerIndex, dist) {
        this._scores[playerIndex] += dist * SCORE_PER_UNIT * this._multipliers[playerIndex];
        this._comboDistance[playerIndex] += dist;

        // Level up multiplier
        if (this._comboDistance[playerIndex] >= COMBO_THRESHOLD) {
            this._comboDistance[playerIndex] = 0;
            this._incrementMultiplier(playerIndex);
        }

        this._state.emit('score:update', {
            score:      Math.floor(this._scores[playerIndex]),
            multiplier: this._multipliers[playerIndex],
            player:     playerIndex
        });
    }

    /**
     * Called on obstacle hit — resets combo and multiplier for that player.
     * @param {number} playerIndex
     */
    onHit(playerIndex) {
        this._multipliers[playerIndex]    = 1;
        this._comboDistance[playerIndex]  = 0;
        this._state.emit('score:multiplier', {
            multiplier: 1,
            player: playerIndex
        });
    }

    /**
     * Apply external multiplier (power-up).
     * @param {number} playerIndex
     * @param {number} factor
     * @param {number} durationSeconds
     */
    applyMultiplierBoost(playerIndex, factor, durationSeconds) {
        this._multipliers[playerIndex] *= factor;
        this._state.emit('score:multiplier', {
            multiplier: this._multipliers[playerIndex],
            player: playerIndex
        });
        setTimeout(() => {
            this._multipliers[playerIndex] = Math.max(
                1,
                Math.round(this._multipliers[playerIndex] / factor)
            );
            this._state.emit('score:multiplier', {
                multiplier: this._multipliers[playerIndex],
                player: playerIndex
            });
        }, durationSeconds * 1000);
    }

    _incrementMultiplier(playerIndex) {
        if (this._multipliers[playerIndex] < MAX_MULTIPLIER) {
            this._multipliers[playerIndex]++;
            this._state.emit('score:multiplier', {
                multiplier: this._multipliers[playerIndex],
                player:     playerIndex
            });
        }
    }

    /**
     * Save highscore if beaten, returns true if new record.
     */
    saveHighscore() {
        const score = Math.floor(this._scores[0]);
        if (score > this._highscore) {
            this._highscore = score;
            this._storeHighscore(STORAGE_KEY_SOLO, score);
            return true;
        }
        return false;
    }

    _loadHighscore(key) {
        try {
            return parseInt(localStorage.getItem(key) || '0', 10);
        } catch (_) {
            return 0;
        }
    }

    _storeHighscore(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (_) {
            // localStorage unavailable in some contexts
        }
    }

    get score()       { return Math.floor(this._scores[0]); }
    get scoreP2()     { return Math.floor(this._scores[1]); }
    get highscore()   { return this._highscore; }
    get multiplier()  { return this._multipliers[0]; }
    get multiplierP2(){ return this._multipliers[1]; }

    setMultiplayer(on) { this._multiplayer = on; }

    reset() {
        this._scores        = [0, 0];
        this._multipliers   = [1, 1];
        this._comboDistance = [0, 0];
        this._highscore     = this._loadHighscore(STORAGE_KEY_SOLO);
    }
}
