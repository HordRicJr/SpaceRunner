/**
 * AudioManager.js
 * Synthetic sounds using Web Audio API — no external files.
 * - Jump, collision, power-up collect, game-over, level-up sounds
 * - Looping background music via oscillator chain
 */
import { GameState, STATE } from '../game/GameState.js';

export class AudioManager {
    constructor() {
        this._ctx       = null;
        this._masterGain = null;
        this._muted      = false;
        this._volume     = 0.55;

        this._musicNodes   = [];
        this._musicPlaying = false;

        // Music note sequence (Hz): pentatonic minor space feel
        this._musicNotes = [
            110, 130.81, 146.83, 164.81, 196,
            220, 164.81, 146.83, 130.81, 110,
            98,  110,    130.81, 98,     110
        ];
        this._musicIndex = 0;
        this._musicTimeout = null;

        // Thruster drone nodes
        this._thrusterNodes = null;

        const gs = GameState.getInstance();
        gs.on('state:PLAYING',  this._onPlaying.bind(this));
        gs.on('state:PAUSED',   this._onPause.bind(this));
        gs.on('state:GAMEOVER', this._onGameOver.bind(this));
        gs.on('state:MENU',     this._onMenu.bind(this));
        gs.on('game:tick',      ({ speed }) => this._updateThruster(speed));
    }

    /** Call on first user gesture to unlock AudioContext */
    unlock() {
        if (this._ctx) return;
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = this._volume;
        this._masterGain.connect(this._ctx.destination);
    }

    _onPlaying() {
        this.startMusic();
    }
    _onPause() {
        this.stopMusic();
    }
    _onGameOver() {
        this.stopMusic();
        this.play('gameover');
    }
    _onMenu() {
        this.stopMusic();
    }

    play(name) {
        if (!this._ctx || this._muted) return;
        switch (name) {
            case 'jump':      this._playJump();     break;
            case 'hit':       this._playHit();      break;
            case 'collect':   this._playCollect();  break;
            case 'gameover':  this._playGameOver(); break;
            case 'levelup':   this._playLevelUp();  break;
            case 'shield':    this._playShield();   break;
            default: break;
        }
    }

    setVolume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this._masterGain) {
            this._masterGain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.05);
        }
    }

    toggleMute() {
        this._muted = !this._muted;
        if (this._masterGain) {
            this._masterGain.gain.setTargetAtTime(
                this._muted ? 0 : this._volume,
                this._ctx.currentTime, 0.05
            );
        }
        return this._muted;
    }

    // ---- SOUNDS ----

    _playJump() {
        const t = this._ctx.currentTime;

        // Layer 1: burst noise (thruster ignition) — short highpass transient
        const bufSize = Math.floor(this._ctx.sampleRate * 0.08);
        const buf     = this._ctx.createBuffer(1, bufSize, this._ctx.sampleRate);
        const data    = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
        }
        const nSrc  = this._ctx.createBufferSource();
        nSrc.buffer = buf;
        const hp    = this._ctx.createBiquadFilter();
        hp.type     = 'highpass';
        hp.frequency.value = 1800;
        const nGain = this._ctx.createGain();
        nGain.gain.setValueAtTime(0.55, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        nSrc.connect(hp);
        hp.connect(nGain);
        nGain.connect(this._masterGain);
        nSrc.start(t);

        // Layer 2: rising sine tone — boost whoosh
        const osc  = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(480, t + 0.16);
        gain.gain.setValueAtTime(0.38, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.23);
    }

    _playShield() {
        // Three staggered harmonic sines — energy field activation
        const freqs = [440, 660, 880];
        const t     = this._ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc  = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const s = t + i * 0.04;
            gain.gain.setValueAtTime(0, s);
            gain.gain.linearRampToValueAtTime(0.18, s + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, s + 0.55);
            osc.start(s);
            osc.stop(s + 0.56);
        });
    }

    _playHit() {
        const bufferSize = this._ctx.sampleRate * 0.25;
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
        const data   = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const source = this._ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this._ctx.createBiquadFilter();
        filter.type            = 'lowpass';
        filter.frequency.value = 200;

        const gain = this._ctx.createGain();
        gain.gain.setValueAtTime(0.7, this._ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.25);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this._masterGain);
        source.start();
    }

    _playCollect() {
        // Pleasant ascending chord
        const freqs = [523.25, 659.25, 783.99];
        const t = this._ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc  = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, t + i * 0.05);
            gain.gain.linearRampToValueAtTime(0.25, t + i * 0.05 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + i * 0.05);
            osc.start(t + i * 0.05);
            osc.stop(t + 0.6 + i * 0.05);
        });
    }

    _playGameOver() {
        // Descending arpeggio
        const freqs = [440, 349.23, 293.66, 220, 174.61];
        const t = this._ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc  = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            const start = t + i * 0.18;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.start(start);
            osc.stop(start + 0.36);
        });
    }

    _playLevelUp() {
        const freqs = [392, 523.25, 659.25, 783.99];
        const t = this._ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc  = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.type = 'square';
            osc.frequency.value = freq;
            const start = t + i * 0.09;
            gain.gain.setValueAtTime(0.2, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
            osc.start(start);
            osc.stop(start + 0.31);
        });
    }

    // ---- BACKGROUND MUSIC ----

    startMusic() {
        if (!this._ctx || this._musicPlaying) return;
        this._musicPlaying = true;
        this._musicIndex   = 0;
        this._startThruster();
        this._stepMusic();
    }

    stopMusic() {
        this._musicPlaying = false;
        if (this._musicTimeout) clearTimeout(this._musicTimeout);
        this._musicTimeout = null;
        this._stopThruster();
        this._musicNodes.forEach(n => {
            try {
                n.gain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.1);
                n.osc.stop(this._ctx.currentTime + 0.3);
            } catch (_) {}
        });
        this._musicNodes = [];
    }

    _stepMusic() {
        if (!this._musicPlaying || !this._ctx) return;

        const freq  = this._musicNotes[this._musicIndex % this._musicNotes.length];
        const osc   = this._ctx.createOscillator();
        const gain  = this._ctx.createGain();
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.type = 'triangle';   // richer than sine
        osc.frequency.value = freq;
        const t = this._ctx.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.07, t + 0.05);
        gain.gain.setValueAtTime(0.07, t + 0.28);
        gain.gain.linearRampToValueAtTime(0, t + 0.38);
        osc.start(t);
        osc.stop(t + 0.42);
        this._musicNodes.push({ osc, gain });

        // Every even step: add a bass sub-note for depth
        if (this._musicIndex % 2 === 0) {
            const bass = this._ctx.createOscillator();
            const bGain = this._ctx.createGain();
            bass.connect(bGain);
            bGain.connect(this._masterGain);
            bass.type = 'sine';
            bass.frequency.value = freq / 4;
            bGain.gain.setValueAtTime(0, t);
            bGain.gain.linearRampToValueAtTime(0.045, t + 0.08);
            bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.80);
            bass.start(t);
            bass.stop(t + 0.82);
            this._musicNodes.push({ osc: bass, gain: bGain });
        }

        if (this._musicNodes.length > 8) this._musicNodes.splice(0, 2);

        this._musicIndex++;
        this._musicTimeout = setTimeout(() => this._stepMusic(), 380);
    }

    // ---- THRUSTER DRONE ----

    _startThruster() {
        if (!this._ctx || this._thrusterNodes) return;

        // Sawtooth drone oscillator
        const osc  = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 55;
        gain.gain.setValueAtTime(0, this._ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.028, this._ctx.currentTime + 0.5);
        osc.connect(gain);

        // Bandpass-filtered noise for turbine texture
        const noiseSize = this._ctx.sampleRate * 2;
        const nBuf  = this._ctx.createBuffer(1, noiseSize, this._ctx.sampleRate);
        const nData = nBuf.getChannelData(0);
        for (let i = 0; i < noiseSize; i++) nData[i] = Math.random() * 2 - 1;
        const nSrc = this._ctx.createBufferSource();
        nSrc.buffer = nBuf;
        nSrc.loop   = true;
        const bp    = this._ctx.createBiquadFilter();
        bp.type     = 'bandpass';
        bp.frequency.value = 280;
        bp.Q.value  = 1.8;
        const nGain = this._ctx.createGain();
        nGain.gain.value = 0.012;
        nSrc.connect(bp);
        bp.connect(nGain);

        gain.connect(this._masterGain);
        nGain.connect(this._masterGain);
        osc.start();
        nSrc.start();

        this._thrusterNodes = { osc, gain, nSrc, bp, nGain };
    }

    _stopThruster() {
        if (!this._thrusterNodes || !this._ctx) return;
        const { osc, gain, nSrc } = this._thrusterNodes;
        const t = this._ctx.currentTime;
        gain.gain.setTargetAtTime(0, t, 0.3);
        try { osc.stop(t + 1.2); } catch (_) {}
        try { nSrc.stop(t + 1.2); } catch (_) {}
        this._thrusterNodes = null;
    }

    _updateThruster(speed) {
        if (!this._thrusterNodes || !this._ctx) return;
        // Map speed 8–32 → freq 55–110 Hz, gain 0.028–0.068, filter 280–1080 Hz
        const t   = this._ctx.currentTime;
        const pct = Math.max(0, Math.min(1, (speed - 8) / 24));
        this._thrusterNodes.osc.frequency.setTargetAtTime(55 + pct * 55, t, 0.8);
        this._thrusterNodes.gain.gain.setTargetAtTime(0.028 + pct * 0.04, t, 0.8);
        this._thrusterNodes.bp.frequency.setTargetAtTime(280 + pct * 800, t, 0.8);
        this._thrusterNodes.nGain.gain.setTargetAtTime(0.012 + pct * 0.018, t, 0.8);
    }
}
