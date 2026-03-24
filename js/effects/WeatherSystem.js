/**
 * WeatherSystem.js
 * - Automatic day/night cycle (color transition every 60s)
 * - Asteroid rain storms (periodic particle bursts from above)
 * - Ionic lightning strikes (flash PointLight + LineSystem ray)
 */
import { GameState, STATE } from '../game/GameState.js';

const DAY_NIGHT_DURATION  = 60;   // seconds per half-cycle
const STORM_INTERVAL_MIN  = 30;   // seconds
const STORM_INTERVAL_MAX  = 70;
const LIGHTNING_INTERVAL  = 8;    // seconds between strikes during storm
const STORM_DURATION      = 12;   // seconds

const SKY_COLORS = {
    day:  new BABYLON.Color4(0.01, 0.02, 0.07, 1),
    dawn: new BABYLON.Color4(0.05, 0.02, 0.06, 1),
    night: new BABYLON.Color4(0.0,  0.0,  0.02, 1)
};

const LIGHT_COLORS = {
    day:  { ambient: new BABYLON.Color3(0.15, 0.25, 0.55), sun: new BABYLON.Color3(0.6, 0.7, 1.0) },
    night: { ambient: new BABYLON.Color3(0.04, 0.06, 0.18), sun: new BABYLON.Color3(0.1, 0.1, 0.3) }
};

export class WeatherSystem {
    /**
     * @param {BABYLON.Scene}   scene
     * @param {SceneManager}    sceneManager
     * @param {Environment}     environment
     */
    constructor(scene, sceneManager, environment) {
        this._scene       = scene;
        this._sceneManager = sceneManager;
        this._env         = environment;
        this._state       = GameState.getInstance();

        this._isDay         = true;
        this._dayNightTimer = 0;
        this._stormTimer    = STORM_INTERVAL_MIN + Math.random() * (STORM_INTERVAL_MAX - STORM_INTERVAL_MIN);
        this._inStorm       = false;
        this._stormTime     = 0;
        this._lightningTimer = 0;

        this._rainSystem = null;
        this._buildRain();

        this._state.on('game:tick', this._onTick.bind(this));
    }

    _buildRain() {
        // Asteroid rain particles
        this._rainSystem = new BABYLON.ParticleSystem('asteroidRain', 200, this._scene);
        this._rainSystem.emitter    = new BABYLON.Vector3(0, 0, 60);
        this._rainSystem.minEmitBox = new BABYLON.Vector3(-8, 0, -5);
        this._rainSystem.maxEmitBox = new BABYLON.Vector3( 8, 0, 50);

        this._rainSystem.direction1 = new BABYLON.Vector3(-0.3, -1.8, -0.2);
        this._rainSystem.direction2 = new BABYLON.Vector3( 0.3, -2.5,  0.2);

        this._rainSystem.color1    = new BABYLON.Color4(0.6, 0.5, 0.4, 0.9);
        this._rainSystem.color2    = new BABYLON.Color4(0.4, 0.3, 0.2, 0.6);
        this._rainSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);

        this._rainSystem.minSize       = 0.06;
        this._rainSystem.maxSize       = 0.22;
        this._rainSystem.minLifeTime   = 0.8;
        this._rainSystem.maxLifeTime   = 2.0;
        this._rainSystem.emitRate      = 0;   // started on-demand
        this._rainSystem.minEmitPower  = 8;
        this._rainSystem.maxEmitPower  = 18;
        this._rainSystem.gravity       = new BABYLON.Vector3(0, -9, 0);
        this._rainSystem.blendMode     = BABYLON.ParticleSystem.BLENDMODE_ADD;
        this._rainSystem.updateSpeed   = 0.016;
        this._rainSystem.start();
    }

    _onTick({ dt }) {
        if (!this._state.is(STATE.PLAYING)) return;

        this._updateDayNight(dt);
        this._updateStorm(dt);
    }

    _updateDayNight(dt) {
        this._dayNightTimer += dt;
        if (this._dayNightTimer >= DAY_NIGHT_DURATION) {
            this._dayNightTimer = 0;
            this._isDay = !this._isDay;
            this._transitionDayNight();
        }
    }

    _transitionDayNight() {
        const targetSky = this._isDay ? SKY_COLORS.day : SKY_COLORS.night;
        const lightColors = this._isDay ? LIGHT_COLORS.day : LIGHT_COLORS.night;

        this._sceneManager.transitionSkyColor(targetSky, 8);

        const ambLight = this._sceneManager.ambientLight;
        const sunLight = this._sceneManager.sunLight;

        if (ambLight) ambLight.diffuse = lightColors.ambient;
        if (sunLight) sunLight.diffuse = lightColors.sun;

        this._env.setDayNight(this._isDay ? 'day' : 'night');

        this._state.emit('weather:daynightchange', { isDay: this._isDay });
    }

    _updateStorm(dt) {
        if (!this._inStorm) {
            this._stormTimer -= dt;
            if (this._stormTimer <= 0) {
                this._startStorm();
            }
        } else {
            this._stormTime    += dt;
            this._lightningTimer -= dt;

            if (this._lightningTimer <= 0) {
                this._lightningTimer = LIGHTNING_INTERVAL * (0.7 + Math.random() * 0.6);
                this._triggerLightning();
            }

            if (this._stormTime >= STORM_DURATION) {
                this._endStorm();
            }
        }
    }

    _startStorm() {
        this._inStorm        = true;
        this._stormTime      = 0;
        this._lightningTimer = 1.5;

        // Darken sky
        this._sceneManager.transitionSkyColor(SKY_COLORS.dawn, 3);

        // Enable rain
        this._rainSystem.emitRate = 120;

        this._state.emit('weather:storm_start', {});
    }

    _endStorm() {
        this._inStorm    = false;
        this._stormTimer = STORM_INTERVAL_MIN + Math.random() * (STORM_INTERVAL_MAX - STORM_INTERVAL_MIN);

        // Restore sky
        const targetSky = this._isDay ? SKY_COLORS.day : SKY_COLORS.night;
        this._sceneManager.transitionSkyColor(targetSky, 5);

        // Stop rain
        this._rainSystem.emitRate = 0;

        this._state.emit('weather:storm_end', {});
    }

    _triggerLightning() {
        // Random position above scene
        const x = (Math.random() - 0.5) * 12;
        const z = 20 + Math.random() * 60;

        // Flash point light
        const light = new BABYLON.PointLight('lightning_light', new BABYLON.Vector3(x, 15, z), this._scene);
        light.diffuse   = new BABYLON.Color3(0.7, 0.9, 1.0);
        light.intensity = 20;
        light.range     = 80;

        // Lightning bolt ray (LineSystem)
        const segments = 8;
        const lines    = [];
        const startY   = 15;
        const endY     = 0.2;
        const stepY    = (endY - startY) / segments;
        let currentX   = x;
        let currentZ   = z;
        for (let i = 0; i < segments; i++) {
            const fromY = startY + stepY * i;
            const toY   = startY + stepY * (i + 1);
            lines.push([
                new BABYLON.Vector3(currentX, fromY, currentZ),
                new BABYLON.Vector3(
                    currentX + (Math.random() - 0.5) * 0.8,
                    toY,
                    currentZ + (Math.random() - 0.5) * 0.8
                )
            ]);
            currentX += (Math.random() - 0.5) * 0.5;
            currentZ += (Math.random() - 0.5) * 0.5;
        }

        const bolt = BABYLON.MeshBuilder.CreateLineSystem('lightning_bolt', {
            lines, updatable: false
        }, this._scene);
        bolt.color = new BABYLON.Color3(0.8, 0.9, 1.0);

        // Fade and remove
        const start = Date.now();
        const duration = 0.25;
        const obs = this._scene.onBeforeRenderObservable.add(() => {
            const t = (Date.now() - start) / 1000 / duration;
            light.intensity = 20 * Math.max(0, 1 - t);
            if (t >= 1) {
                this._scene.onBeforeRenderObservable.remove(obs);
                bolt.dispose();
                light.dispose();
            }
        });

        this._state.emit('weather:lightning', { x, z });
    }

    dispose() {
        if (this._rainSystem) this._rainSystem.dispose();
    }
}
