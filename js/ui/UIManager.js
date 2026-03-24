/**
 * UIManager.js
 * Manages all DOM overlays: loading screen, menu, HUD, pause, game-over.
 * Wires UI events (button clicks, character selection) to GameState.
 */
import { GameState, STATE } from '../game/GameState.js';

export class UIManager {
    /**
     * @param {AudioManager} audioManager
     */
    constructor(audioManager) {
        this._gs    = GameState.getInstance();
        this._audio = audioManager;

        this._selectedChars  = [0, 0];   // [p1CharIndex, p2CharIndex]
        this._currentMode    = 'solo';   // 'solo' | 'multi'
        this._selectedGameMode = 'classic';
        this._multiScore     = [0, 0];
        this._powerupTimer   = null;
        this._speedInterval  = null;

        this._el = {
            loading:         document.getElementById('screen-loading'),
            menu:            document.getElementById('screen-menu'),
            hud:             document.getElementById('screen-hud'),
            pause:           document.getElementById('screen-pause'),
            gameover:        document.getElementById('screen-gameover'),

            loadBar:         document.getElementById('loading-bar-fill'),
            loadText:        document.getElementById('loading-text'),

            btnSolo:         document.getElementById('btn-solo'),
            btnMulti:        document.getElementById('btn-multi'),
            charOptions:     document.querySelectorAll('.char-option'),

            hudScore:        document.getElementById('hud-score'),
            hudBest:         document.getElementById('hud-best'),
            hudMultiplier:   document.getElementById('hud-multiplier'),
            hudMult2:        null,
            speedFill:       document.getElementById('speed-fill'),
            hudPowerup:      document.getElementById('hud-powerup'),
            powerupFill:     document.getElementById('powerup-timer-fill'),
            powerupIcon:     document.getElementById('powerup-icon'),
            hudScoreP1:      document.getElementById('hud-score-p1'),
            hudScoreP2:      document.getElementById('hud-score-p2'),
            hudMultiPanel:   document.getElementById('hud-multi'),

            btnResume:       document.getElementById('btn-resume'),
            btnQuit:         document.getElementById('btn-quit-pause'),

            goScore:         document.getElementById('go-score'),
            goBest:          document.getElementById('go-best'),
            goNewRecord:     document.getElementById('go-newrecord'),
            goScoreP1:       document.getElementById('go-p1'),
            goScoreP2:       document.getElementById('go-p2'),
            goMultiResult:   document.getElementById('go-multi'),
            goWinner:        document.getElementById('go-winner'),
            btnRetry:        document.getElementById('btn-retry'),
            btnMenu:         document.getElementById('btn-menu'),

            hudTimer:        document.getElementById('hud-timer'),
            hudTimerValue:   document.getElementById('hud-timer-value')
        };

        this._bindButtons();
        this._bindEvents();
    }

    // ----------------------
    // Event subscriptions
    // ----------------------

    _bindEvents() {
        this._gs.on('score:update',      this._onScoreUpdate.bind(this));
        this._gs.on('score:multiplier',  this._onMultiplierUpdate.bind(this));
        this._gs.on('powerup:collected', this._onPowerupCollected.bind(this));
        this._gs.on('game:tick',         this._onTick.bind(this));
        this._gs.on('state:change',      ({ to }) => this._syncScreens(to));
    }

    // ----------------------
    // Button wiring
    // ----------------------

    _bindButtons() {
        // Mode selection
        if (this._el.btnSolo) {
            this._el.btnSolo.addEventListener('click', () => {
                this._setMode('solo');
                this._gs.emit('ui:start', { mode: 'solo', chars: this._selectedChars, gameMode: this._selectedGameMode });
            });
        }

        if (this._el.btnMulti) {
            this._el.btnMulti.addEventListener('click', () => {
                this._setMode('multi');
                this._gs.emit('ui:start', { mode: 'multi', chars: this._selectedChars, gameMode: this._selectedGameMode });
            });
        }

        // Character selection
        if (this._el.charOptions) {
            this._el.charOptions.forEach(opt => {
                opt.addEventListener('click', () => {
                    const charIndex  = parseInt(opt.dataset.char, 10);
                    const playerSlot = parseInt(opt.dataset.player || '1', 10) - 1;
                    this._selectChar(opt, playerSlot, charIndex);
                });
            });
        }

        // Game mode selection
        document.querySelectorAll('.gamemode-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.gamemode-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this._selectedGameMode = opt.dataset.gamemode;
            });
        });

        // Pause screen
        if (this._el.btnResume) {
            this._el.btnResume.addEventListener('click', () => {
                this._gs.emit('ui:resume');
            });
        }

        if (this._el.btnQuit) {
            this._el.btnQuit.addEventListener('click', () => {
                this._gs.emit('ui:quit');
            });
        }

        // Game-over screen
        if (this._el.btnRetry) {
            this._el.btnRetry.addEventListener('click', () => {
                this._gs.emit('ui:retry');
            });
        }

        if (this._el.btnMenu) {
            this._el.btnMenu.addEventListener('click', () => {
                this._gs.emit('ui:menu');
            });
        }

        // Audio unlock on any click
        document.addEventListener('click', () => {
            if (this._audio) this._audio.unlock();
        }, { once: true });
    }

    _selectChar(element, playerSlot, charIndex) {
        // Remove active from same player slot only
        document.querySelectorAll(`.char-option[data-player="${playerSlot + 1}"]`).forEach(el => {
            el.classList.remove('active');
        });
        element.classList.add('active');
        this._selectedChars[playerSlot] = charIndex;
    }

    _setMode(mode) {
        this._currentMode = mode;
        if (this._el.btnSolo)  this._el.btnSolo.classList.toggle('btn-primary', mode === 'solo');
        if (this._el.btnMulti) this._el.btnMulti.classList.toggle('btn-primary', mode === 'multi');
    }

    // ----------------------
    // Screen management
    // ----------------------

    showScreen(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }

    hideScreen(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    }

    hideAllScreens() {
        ['screen-loading', 'screen-menu', 'screen-hud', 'screen-pause', 'screen-gameover']
            .forEach(id => this.hideScreen(id));
    }

    _syncScreens(state) {
        switch (state) {
            case STATE.LOADING:
                this.hideAllScreens();
                this.showScreen('screen-loading');
                break;
            case STATE.MENU:
                this.hideAllScreens();
                this.showScreen('screen-menu');
                break;
            case STATE.PLAYING:
                this.hideAllScreens();
                this.showScreen('screen-hud');
                this._showModeHUD(this._currentMode);
                break;
            case STATE.PAUSED:
                this.showScreen('screen-pause');
                break;
            case STATE.GAMEOVER:
                this.hideScreen('screen-pause');
                this.showScreen('screen-gameover');
                break;
            default:
                break;
        }
    }

    _showModeHUD(mode) {
        const multi = this._el.hudMultiPanel;
        if (multi) multi.style.display = mode === 'multi' ? 'flex' : 'none';
    }

    // ----------------------
    // Loading screen
    // ----------------------

    updateLoading(percent, text) {
        if (this._el.loadBar)  this._el.loadBar.style.width  = `${Math.min(100, percent)}%`;
        if (this._el.loadText) this._el.loadText.textContent = text || '';
    }

    // ----------------------
    // HUD updates
    // ----------------------

    _onScoreUpdate({ score, player }) {
        const rounded = Math.floor(score);
        if (this._currentMode === 'solo') {
            if (this._el.hudScore) this._el.hudScore.textContent = String(rounded).padStart(6, '0');
        } else {
            this._multiScore[player] = rounded;
            if (player === 0 && this._el.hudScoreP1) {
                this._el.hudScoreP1.textContent = String(rounded).padStart(5, '0');
            } else if (player === 1 && this._el.hudScoreP2) {
                this._el.hudScoreP2.textContent = String(rounded).padStart(5, '0');
            }
        }
    }

    _onMultiplierUpdate({ multiplier, player }) {
        const text = `x${multiplier.toFixed(1)}`;
        if (player === 0 && this._el.hudMultiplier) {
            this._el.hudMultiplier.textContent = text;
            this._el.hudMultiplier.classList.remove('multiplier-bump');
            void this._el.hudMultiplier.offsetWidth;
            this._el.hudMultiplier.classList.add('multiplier-bump');
        } else if (player === 1 && this._el.hudMult2) {
            this._el.hudMult2.textContent = text;
        }
    }

    _onTick({ speed }) {
        if (this._el.speedFill) {
            const speedMax  = 32;
            const speedInit = 8;
            const pct = Math.min(100, ((speed - speedInit) / (speedMax - speedInit)) * 100);
            this._el.speedFill.style.width = `${pct}%`;
        }
    }

    _onPowerupCollected({ kind, duration }) {
        if (!this._el.hudPowerup) return;

        // Remove old timer
        if (this._powerupTimer) clearTimeout(this._powerupTimer);

        const fill = this._el.powerupFill;
        const icon = this._el.powerupIcon;

        this._el.hudPowerup.style.display = 'flex';
        if (icon) {
            icon.className = `powerup-icon powerup-${kind}`;
            icon.textContent = kind.charAt(0).toUpperCase() + kind.slice(1);
        }

        if (fill) {
            fill.style.transition = 'none';
            fill.style.width = '100%';
            // Trigger reflow before transition
            void fill.offsetWidth;
            fill.style.transition = `width ${duration}s linear`;
            fill.style.width = '0%';
        }

        this._powerupTimer = setTimeout(() => {
            if (this._el.hudPowerup) this._el.hudPowerup.style.display = 'none';
        }, duration * 1000);
    }

    // ----------------------
    // Game-over screen
    // ----------------------

    showGameOver({ score, best, isNewRecord, isMulti, scores, winner }) {
        const soloEls  = [this._el.goScore, this._el.goBest, this._el.goNewRecord];
        const multiEl  = this._el.goMultiResult;

        // Show/hide multi-player result block
        if (multiEl) multiEl.style.display = isMulti ? 'block' : 'none';

        if (!isMulti) {
            if (this._el.goScore) this._el.goScore.textContent = String(Math.floor(score)).padStart(6, '0');
            if (this._el.goBest)  this._el.goBest.textContent  = String(Math.floor(best)).padStart(6, '0');
            if (this._el.goNewRecord) {
                this._el.goNewRecord.classList.toggle('hidden', !isNewRecord);
            }
        } else {
            if (this._el.goScoreP1) this._el.goScoreP1.textContent = String(Math.floor(scores[0])).padStart(5, '0');
            if (this._el.goScoreP2) this._el.goScoreP2.textContent = String(Math.floor(scores[1])).padStart(5, '0');
            if (this._el.goWinner) {
                if (winner === -1) {
                    this._el.goWinner.textContent = 'Draw!';
                } else {
                    this._el.goWinner.textContent = `Player ${winner + 1} wins!`;
                }
            }
        }
    }

    updateBest(best) {
        if (this._el.hudBest) this._el.hudBest.textContent = String(Math.floor(best)).padStart(6, '0');
    }

    // ----------------------
    // Timer (Time Attack)
    // ----------------------

    showTimer(seconds) {
        if (this._el.hudTimer) {
            this._el.hudTimer.classList.remove('hidden');
            this.updateTimer(seconds);
        }
    }

    hideTimer() {
        if (this._el.hudTimer) this._el.hudTimer.classList.add('hidden');
    }

    updateTimer(seconds) {
        const secs = Math.max(0, Math.ceil(seconds));
        if (this._el.hudTimerValue) this._el.hudTimerValue.textContent = String(secs);
        if (this._el.hudTimer) {
            this._el.hudTimer.classList.toggle('urgent', secs <= 15);
        }
    }

    get selectedMode()  { return this._currentMode; }
    get selectedChars() { return this._selectedChars; }
}
