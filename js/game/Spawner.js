/**
 * Spawner.js
 * Object pool manager for obstacles and power-ups.
 * Recycles meshes to avoid garbage collection spikes.
 */
import { GameState } from './GameState.js';

// Spawn configuration
const CFG = {
    // Distance between spawn checks
    OBSTACLE_INTERVAL_MIN: 18,
    OBSTACLE_INTERVAL_MAX: 36,
    POWERUP_INTERVAL_MIN:  80,
    POWERUP_INTERVAL_MAX:  160,

    // Z position where objects spawn (ahead of camera)
    SPAWN_Z:    120,
    DESPAWN_Z:  -20,

    // Lanes: X offsets (solo = 1 lane centered, multi = 2 lanes)
    LANES_SOLO:  [0],
    LANES_MULTI: [-3.2, 3.2],

    POOL_SIZE_OBSTACLE: 16,
    POOL_SIZE_POWERUP:  6
};

export class Spawner {
    /**
     * @param {BABYLON.Scene} scene
     * @param {boolean} multiplayer
     */
    constructor(scene, multiplayer = false) {
        this._scene       = scene;
        this._multiplayer = multiplayer;
        this._state       = GameState.getInstance();

        this._lanes = multiplayer ? CFG.LANES_MULTI : CFG.LANES_SOLO;

        this._obstaclePool = [];
        this._powerupPool  = [];

        this._activeObstacles = [];
        this._activePowerups  = [];

        this._nextObstacleDist = CFG.OBSTACLE_INTERVAL_MIN;
        this._nextPowerupDist  = CFG.POWERUP_INTERVAL_MIN + 30;

        this._buildPools();

        this._state.on('game:tick', this._onTick.bind(this));
    }

    // ---- Pool construction ----

    _buildPools() {
        for (let i = 0; i < CFG.POOL_SIZE_OBSTACLE; i++) {
            this._obstaclePool.push(this._createObstacleMesh(i));
        }
        for (let i = 0; i < CFG.POOL_SIZE_POWERUP; i++) {
            this._powerupPool.push(this._createPowerupMesh(i));
        }
    }

    _createObstacleMesh(index) {
        // Placeholder: a simple box — replaced with styled mesh in Obstacle.js
        const mesh = BABYLON.MeshBuilder.CreateBox(`obs_pool_${index}`, { size: 1 }, this._scene);
        mesh.setEnabled(false);
        mesh.isPickable = false;
        mesh.metadata = { poolIndex: index, type: 'obstacle', active: false, kind: 'asteroid' };
        return mesh;
    }

    _createPowerupMesh(index) {
        const mesh = BABYLON.MeshBuilder.CreateSphere(`pu_pool_${index}`, { diameter: 0.9 }, this._scene);
        mesh.setEnabled(false);
        mesh.isPickable = false;
        mesh.metadata = { poolIndex: index, type: 'powerup', active: false, kind: 'shield' };
        return mesh;
    }

    // ---- Tick ----

    _onTick({ dt, speed, distance }) {
        this._moveActives(dt, speed);
        this._despawnOutOfRange();
        this._trySpawnObstacle(distance, speed);
        this._trySpawnPowerup(distance, speed);
    }

    _moveActives(dt, speed) {
        const step = speed * dt;
        for (const mesh of this._activeObstacles) {
            mesh.position.z -= step;
            // Rotation for asteroids
            if (mesh.metadata.kind === 'asteroid') {
                mesh.rotation.x += dt * 1.2;
                mesh.rotation.y += dt * 0.8;
            }
        }
        for (const mesh of this._activePowerups) {
            mesh.position.z -= step;
            mesh.rotation.y += dt * 2;
            // Float animation
            mesh.position.y = 1.2 + Math.sin(Date.now() * 0.002 + mesh.metadata.poolIndex) * 0.25;
        }
    }

    _despawnOutOfRange() {
        for (let i = this._activeObstacles.length - 1; i >= 0; i--) {
            if (this._activeObstacles[i].position.z < CFG.DESPAWN_Z) {
                this._returnObstacle(this._activeObstacles[i]);
                this._activeObstacles.splice(i, 1);
            }
        }
        for (let i = this._activePowerups.length - 1; i >= 0; i--) {
            if (this._activePowerups[i].position.z < CFG.DESPAWN_Z) {
                this._returnPowerup(this._activePowerups[i]);
                this._activePowerups.splice(i, 1);
            }
        }
    }

    _trySpawnObstacle(distance, speed) {
        if (distance < this._nextObstacleDist) return;

        const kind = this._randomObstacleKind(speed);

        if (this._multiplayer) {
            // In multi mode: spawn one obstacle per lane so each player faces one
            for (const lane of this._lanes) {
                const mesh = this._getFromPool(this._obstaclePool);
                if (!mesh) continue;
                mesh.metadata.kind = kind;
                this._configureObstacle(mesh, kind, lane);
                mesh.setEnabled(true);
                mesh.metadata.active = true;
                this._activeObstacles.push(mesh);
                this._state.emit('spawner:obstacle', { mesh, kind, lane });
            }
        } else {
            const lane = this._lanes[Math.floor(Math.random() * this._lanes.length)];
            const mesh = this._getFromPool(this._obstaclePool);
            if (!mesh) return;
            mesh.metadata.kind = kind;
            this._configureObstacle(mesh, kind, lane);
            mesh.setEnabled(true);
            mesh.metadata.active = true;
            this._activeObstacles.push(mesh);
            this._state.emit('spawner:obstacle', { mesh, kind, lane });
        }

        const interval = this._rnd(CFG.OBSTACLE_INTERVAL_MIN, CFG.OBSTACLE_INTERVAL_MAX);
        this._nextObstacleDist = distance + interval;
    }

    _trySpawnPowerup(distance, speed) {
        if (distance < this._nextPowerupDist) return;

        const lane = this._lanes[Math.floor(Math.random() * this._lanes.length)];
        const kind = this._randomPowerupKind();
        const mesh = this._getFromPool(this._powerupPool);
        if (!mesh) return;

        mesh.metadata.kind = kind;
        this._configurePowerup(mesh, kind, lane);
        mesh.setEnabled(true);
        mesh.metadata.active = true;
        this._activePowerups.push(mesh);

        const interval = this._rnd(CFG.POWERUP_INTERVAL_MIN, CFG.POWERUP_INTERVAL_MAX);
        this._nextPowerupDist = distance + interval;

        this._state.emit('spawner:powerup', { mesh, kind, lane });
    }

    _configureObstacle(mesh, kind, laneX) {
        const heights = { asteroid: 1.2, satellite: 0.8, debris: 1.8 };
        mesh.position.set(laneX, heights[kind] || 1.0, CFG.SPAWN_Z);
        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
    }

    _configurePowerup(mesh, kind, laneX) {
        mesh.position.set(laneX, 1.2, CFG.SPAWN_Z);
        mesh.rotation.setAll(0);
    }

    _randomObstacleKind(speed) {
        const r = Math.random();
        if (speed < 14) return r < 0.6 ? 'asteroid' : 'satellite';
        if (speed < 22) return r < 0.5 ? 'asteroid' : r < 0.8 ? 'satellite' : 'debris';
        const kinds = ['asteroid', 'satellite', 'debris'];
        return kinds[Math.floor(r * kinds.length)];
    }

    _randomPowerupKind() {
        const r = Math.random();
        if (r < 0.38) return 'shield';
        if (r < 0.72) return 'slow';
        return 'multiplier';
    }

    _getFromPool(pool) {
        return pool.find(m => !m.metadata.active) || null;
    }

    _returnObstacle(mesh) {
        mesh.setEnabled(false);
        mesh.metadata.active = false;
    }

    _returnPowerup(mesh) {
        mesh.setEnabled(false);
        mesh.metadata.active = false;
    }

    _rnd(min, max) {
        return min + Math.random() * (max - min);
    }

    /**
     * Remove a specific mesh from active lists (on collection/collision).
     */
    removeActive(mesh) {
        if (mesh.metadata.type === 'obstacle') {
            const i = this._activeObstacles.indexOf(mesh);
            if (i !== -1) {
                this._activeObstacles.splice(i, 1);
                this._returnObstacle(mesh);
            }
        } else if (mesh.metadata.type === 'powerup') {
            const i = this._activePowerups.indexOf(mesh);
            if (i !== -1) {
                this._activePowerups.splice(i, 1);
                this._returnPowerup(mesh);
            }
        }
    }

    /**
     * Update lane configuration for multi-player mode.
     * Must be called before reset() when switching modes.
     * @param {boolean} isMulti
     */
    setMultiplayer(isMulti) {
        this._multiplayer = isMulti;
        this._lanes = isMulti ? CFG.LANES_MULTI : CFG.LANES_SOLO;
    }

    get activeObstacles() { return this._activeObstacles; }
    get activePowerups()  { return this._activePowerups; }

    reset(opts = {}) {
        [...this._activeObstacles].forEach(m => this._returnObstacle(m));
        [...this._activePowerups].forEach(m  => this._returnPowerup(m));
        this._activeObstacles = [];
        this._activePowerups  = [];
        this._nextObstacleDist = opts.firstObstacleDist ?? CFG.OBSTACLE_INTERVAL_MIN;
        this._nextPowerupDist  = CFG.POWERUP_INTERVAL_MIN + 30;
    }

    dispose() {
        this.reset();
        this._obstaclePool.forEach(m => m.dispose());
        this._powerupPool.forEach(m  => m.dispose());
        this._obstaclePool = [];
        this._powerupPool  = [];
    }
}
