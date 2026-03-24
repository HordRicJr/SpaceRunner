/**
 * ParticleManager.js
 * Centralized particle effect system.
 * Effects: jet trail, death explosion, obstacle impact sparks, power-up collect burst.
 */
import { GameState } from '../game/GameState.js';

export class ParticleManager {
    /**
     * @param {BABYLON.Scene} scene
     */
    constructor(scene) {
        this._scene = scene;
        this._state = GameState.getInstance();

        this._trailSystems   = {};  // keyed by player index
        this._flashLights    = [];  // temporary point lights for flashes

        this._state.on('player:dead', ({ index }) => {
            this._onPlayerDead(index);
        });

        this._state.on('player:jump', ({ index }) => {
            this._onPlayerJump(index);
        });

        this._state.on('powerup:collected', ({ kind }) => {
            // burst handled on demand
        });
    }

    // ---- Jet trail ----

    /**
     * Create a continuous jet trail for a player.
     * @param {Player} player
     */
    createTrail(player) {
        const ps = new BABYLON.ParticleSystem(`trail_${player.index}`, 120, this._scene);

        ps.emitter        = player.root;
        ps.minEmitBox     = new BABYLON.Vector3(-0.08, 0.05, -0.35);
        ps.maxEmitBox     = new BABYLON.Vector3( 0.08, 0.15, -0.35);

        ps.direction1     = new BABYLON.Vector3(-0.1, -0.1, -1);
        ps.direction2     = new BABYLON.Vector3( 0.1,  0.2, -1.5);

        ps.color1         = new BABYLON.Color4(0.1, 0.9, 1.0, 1.0);
        ps.color2         = new BABYLON.Color4(0.0, 0.4, 0.9, 0.8);
        ps.colorDead      = new BABYLON.Color4(0.0, 0.1, 0.6, 0.0);

        ps.minSize        = 0.06;
        ps.maxSize        = 0.22;
        ps.minLifeTime    = 0.12;
        ps.maxLifeTime    = 0.38;
        ps.emitRate       = 90;

        ps.minEmitPower   = 2;
        ps.maxEmitPower   = 5;
        ps.updateSpeed    = 0.016;

        ps.gravity        = new BABYLON.Vector3(0, 0.5, 0);
        ps.blendMode      = BABYLON.ParticleSystem.BLENDMODE_ADD;

        ps.start();
        this._trailSystems[player.index] = ps;
    }

    /**
     * Stop a player's trail.
     * @param {number} playerIndex
     */
    stopTrail(playerIndex) {
        const ps = this._trailSystems[playerIndex];
        if (ps) ps.stop();
    }

    // ---- Jump burst ----

    _onPlayerJump(index) {
        const player = this._registeredPlayers ? this._registeredPlayers[index] : null;
        if (!player) return;
        this._burstAt(player.position.clone(), {
            count:   30,
            color1:  new BABYLON.Color4(0, 0.7, 1, 1),
            color2:  new BABYLON.Color4(0, 0.3, 0.8, 0.5),
            size:    [0.04, 0.14],
            life:    [0.12, 0.3],
            power:   [1.5, 4],
            gravity: new BABYLON.Vector3(0, -6, 0),
            blend:   BABYLON.ParticleSystem.BLENDMODE_ADD
        });
    }

    // ---- Death explosion ----

    _onPlayerDead(index) {
        const player = this._registeredPlayers ? this._registeredPlayers[index] : null;
        if (player) {
            this._explodeAt(player.position.clone());
        }
        this.stopTrail(index);
    }

    _explodeAt(position) {
        // Main burst
        this._burstAt(position, {
            count:   120,
            color1:  new BABYLON.Color4(1, 0.5, 0.0, 1),
            color2:  new BABYLON.Color4(1, 0.1, 0.0, 1),
            size:    [0.08, 0.5],
            life:    [0.4, 1.2],
            power:   [4, 18],
            gravity: new BABYLON.Vector3(0, -9, 0),
            blend:   BABYLON.ParticleSystem.BLENDMODE_ADD
        });

        // Debris
        this._burstAt(position, {
            count:   40,
            color1:  new BABYLON.Color4(0.8, 0.8, 0.9, 1),
            color2:  new BABYLON.Color4(0.4, 0.4, 0.5, 1),
            size:    [0.05, 0.18],
            life:    [0.5, 1.8],
            power:   [2, 10],
            gravity: new BABYLON.Vector3(0, -12, 0),
            blend:   BABYLON.ParticleSystem.BLENDMODE_STANDARD
        });

        // Flash point light
        this._flashLight(position, new BABYLON.Color3(1, 0.4, 0), 0.5);
    }

    // ---- Impact sparks ----

    /**
     * Emit sparks at an impact position.
     * @param {BABYLON.Vector3} position
     */
    spawnImpactSparks(position) {
        this._burstAt(position.clone(), {
            count:   50,
            color1:  new BABYLON.Color4(1, 0.8, 0.1, 1),
            color2:  new BABYLON.Color4(1, 0.3, 0, 0.8),
            size:    [0.03, 0.12],
            life:    [0.2, 0.6],
            power:   [3, 12],
            gravity: new BABYLON.Vector3(0, -8, 0),
            blend:   BABYLON.ParticleSystem.BLENDMODE_ADD
        });
    }

    // ---- Power-up collect burst ----

    /**
     * Visual burst at collection point.
     * @param {BABYLON.Vector3} position
     * @param {string} kind 'shield' | 'slow' | 'multiplier'
     */
    spawnCollectBurst(position, kind) {
        const colors = {
            shield:     [new BABYLON.Color4(0, 0.8, 1, 1),    new BABYLON.Color4(0, 0.4, 1, 0.6)],
            slow:       [new BABYLON.Color4(0.3, 0.7, 1, 1),  new BABYLON.Color4(0.1, 0.4, 1, 0.6)],
            multiplier: [new BABYLON.Color4(1, 0.9, 0, 1),    new BABYLON.Color4(1, 0.5, 0, 0.6)]
        };
        const c = colors[kind] || colors.shield;
        this._burstAt(position, {
            count:   60,
            color1:  c[0],
            color2:  c[1],
            size:    [0.04, 0.2],
            life:    [0.3, 0.8],
            power:   [2, 8],
            gravity: new BABYLON.Vector3(0, -2, 0),
            blend:   BABYLON.ParticleSystem.BLENDMODE_ADD
        });
    }

    // ---- Helpers ----

    _burstAt(position, opts) {
        const ps = new BABYLON.ParticleSystem('burst_tmp', opts.count, this._scene);
        ps.emitter    = position;
        ps.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
        ps.maxEmitBox = new BABYLON.Vector3( 0.1,  0.1,  0.1);
        ps.direction1 = new BABYLON.Vector3(-1, 1, -1);
        ps.direction2 = new BABYLON.Vector3( 1, 3,  1);

        ps.color1     = opts.color1;
        ps.color2     = opts.color2;
        ps.colorDead  = new BABYLON.Color4(0, 0, 0, 0);

        ps.minSize       = opts.size[0];
        ps.maxSize       = opts.size[1];
        ps.minLifeTime   = opts.life[0];
        ps.maxLifeTime   = opts.life[1];
        ps.emitRate      = opts.count * 40;
        ps.minEmitPower  = opts.power[0];
        ps.maxEmitPower  = opts.power[1];
        ps.gravity       = opts.gravity;
        ps.blendMode     = opts.blend;
        ps.updateSpeed   = 0.016;
        ps.targetStopDuration = opts.life[1] * 1.1;

        ps.onStoppedObservable.addOnce(() => ps.dispose());
        ps.start();
    }

    _flashLight(position, color, duration) {
        const light = new BABYLON.PointLight('flash_light', position, this._scene);
        light.diffuse   = color;
        light.intensity = 12;
        light.range     = 20;

        const start = Date.now();
        const obs = this._scene.onBeforeRenderObservable.add(() => {
            const elapsed = (Date.now() - start) / 1000;
            const t = elapsed / duration;
            light.intensity = 12 * Math.max(0, 1 - t);
            if (t >= 1) {
                this._scene.onBeforeRenderObservable.remove(obs);
                light.dispose();
            }
        });
    }

    /**
     * Register players so the manager can react to their events.
     * @param {Player[]} players
     */
    registerPlayers(players) {
        this._registeredPlayers = players;
        players.forEach(p => this.createTrail(p));
    }

    dispose() {
        Object.values(this._trailSystems).forEach(ps => ps.dispose());
        this._trailSystems = {};
    }
}
