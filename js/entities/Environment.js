/**
 * Environment.js
 * Procedural deep-space environment:
 *   - Scrolling floor tiles with edge glow lines
 *   - Multi-layer starfield (background static + warp-speed stream)
 *   - 8 procedural planets with atmospheres, rings, and moons
 *   - Nebula cloud planes
 *   - Spiral galaxy disc
 *   - Multi-color tunnel rings
 */
import { GameState } from '../game/GameState.js';

const CFG = {
    TILE_DEPTH:   12,
    TILE_COUNT:   14,
    TILE_Y:       -0.05,

    STAR_COUNT:       4000,
    STAR_RADIUS:       450,
    WARP_STAR_COUNT:   900,

    RING_COUNT:   12,
    RING_SPACING: 30,

    PLANET_PARALLAX:  0.50,
    NEBULA_PARALLAX:  0.14,
    GALAXY_PARALLAX:  0.04,

    PLANET_RECYCLE_Z: -150,
    PLANET_RESET_Z:   1400,
};

export class Environment {
    /**
     * @param {BABYLON.Scene} scene
     */
    constructor(scene) {
        this._scene   = scene;
        this._state   = GameState.getInstance();

        this._tiles         = [];
        this._rings         = [];
        this._planets       = [];
        this._nebulas       = [];
        this._galaxy        = null;
        this._starfield     = null;
        this._warpParticles = null;

        this._build();

        this._state.on('game:tick', this._onTick.bind(this));
    }

    _build() {
        this._buildFloor();
        this._buildStarfield();
        this._buildWarpStream();
        this._buildTunnelRings();
        this._buildSideGlow();
        this._buildPlanets();
        this._buildNebula();
        this._buildGalaxy();
    }

    // ── Floor tiles ─────────────────────────────────────────────────────────────

    _buildFloor() {
        const mat = new BABYLON.StandardMaterial('floorMat', this._scene);
        mat.diffuseColor  = new BABYLON.Color3(0.04, 0.08, 0.22);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.05, 0.15);
        mat.specularColor = new BABYLON.Color3(0.05, 0.1,  0.3);

        for (let i = 0; i < CFG.TILE_COUNT; i++) {
            const tile = BABYLON.MeshBuilder.CreateBox(`tile_${i}`, {
                width: 10, height: 0.15, depth: CFG.TILE_DEPTH
            }, this._scene);
            tile.position.y = CFG.TILE_Y;
            tile.position.z = i * CFG.TILE_DEPTH;

            const m = mat.clone(`floorMat_${i}`);
            if (i % 2 === 0) m.emissiveColor = new BABYLON.Color3(0.03, 0.06, 0.18);
            tile.material = m;
            tile.receiveShadows = true;

            const edgeL = BABYLON.MeshBuilder.CreateBox(`edgeL_${i}`, {
                width: 0.06, height: 0.05, depth: CFG.TILE_DEPTH
            }, this._scene);
            edgeL.position.set(-5, CFG.TILE_Y + 0.1, i * CFG.TILE_DEPTH);
            const edgeR = edgeL.clone(`edgeR_${i}`);
            edgeR.position.x = 5;

            const edgeMat = new BABYLON.StandardMaterial(`edgeMat_${i}`, this._scene);
            edgeMat.emissiveColor   = new BABYLON.Color3(0, 0.6, 1);
            edgeMat.disableLighting = true;
            edgeL.material = edgeMat;
            edgeR.material = edgeMat.clone(`edgeMat_r_${i}`);

            this._tiles.push({ tile, edgeL, edgeR });
        }
    }

    // ── Background starfield ─────────────────────────────────────────────────────

    _buildStarfield() {
        const stars = new BABYLON.ParticleSystem('starfield', CFG.STAR_COUNT, this._scene);
        stars.emitter    = new BABYLON.Vector3(0, 0, 100);
        stars.minEmitBox = new BABYLON.Vector3(-CFG.STAR_RADIUS, -CFG.STAR_RADIUS, -200);
        stars.maxEmitBox = new BABYLON.Vector3( CFG.STAR_RADIUS,  CFG.STAR_RADIUS,  CFG.STAR_RADIUS);

        stars.color1    = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0);
        stars.color2    = new BABYLON.Color4(0.6, 0.75, 1.0, 0.8);
        stars.colorDead = new BABYLON.Color4(0, 0, 0, 0);

        stars.minSize      = 0.10;
        stars.maxSize      = 0.55;
        stars.minLifeTime  = 9999;
        stars.maxLifeTime  = 9999;
        stars.emitRate     = CFG.STAR_COUNT;
        stars.gravity      = BABYLON.Vector3.Zero();
        stars.minEmitPower = 0;
        stars.maxEmitPower = 0;
        stars.updateSpeed  = 0;
        stars.isLocal      = true;
        stars.blendMode    = BABYLON.ParticleSystem.BLENDMODE_ADD;

        stars.start();
        this._starfield = stars;
    }

    // ── Warp-speed star stream ────────────────────────────────────────────────────

    _buildWarpStream() {
        const warp = new BABYLON.ParticleSystem('warpStream', CFG.WARP_STAR_COUNT, this._scene);
        warp.emitter    = new BABYLON.Vector3(0, 5, 50);
        warp.minEmitBox = new BABYLON.Vector3(-90, -60, 0);
        warp.maxEmitBox = new BABYLON.Vector3( 90,  60, 300);

        warp.color1    = new BABYLON.Color4(0.85, 0.95, 1.0, 1.0);
        warp.color2    = new BABYLON.Color4(0.50, 0.80, 1.0, 0.7);
        warp.colorDead = new BABYLON.Color4(0, 0, 0, 0);

        warp.minSize      = 0.06;
        warp.maxSize      = 0.32;
        warp.minLifeTime  = 0.35;
        warp.maxLifeTime  = 1.1;
        warp.emitRate     = 280;
        warp.direction1   = new BABYLON.Vector3(-0.10, -0.06, -1);
        warp.direction2   = new BABYLON.Vector3( 0.10,  0.06, -1);
        warp.minEmitPower = 2;
        warp.maxEmitPower = 7;
        warp.updateSpeed  = 0.02;
        warp.blendMode    = BABYLON.ParticleSystem.BLENDMODE_ADD;

        warp.start();
        this._warpParticles = warp;
    }

    // ── Tunnel rings ─────────────────────────────────────────────────────────────

    _buildTunnelRings() {
        const ringColors = [
            new BABYLON.Color3(0.0,  0.35, 0.7),
            new BABYLON.Color3(0.1,  0.5,  0.85),
            new BABYLON.Color3(0.4,  0.1,  0.8),
            new BABYLON.Color3(0.0,  0.6,  0.5),
            new BABYLON.Color3(0.6,  0.2,  0.0),
            new BABYLON.Color3(0.0,  0.4,  0.4),
        ];

        for (let i = 0; i < CFG.RING_COUNT; i++) {
            const c = ringColors[i % ringColors.length];
            const ring = BABYLON.MeshBuilder.CreateTorus(`ring_${i}`, {
                diameter: 13, thickness: 0.12, tessellation: 36
            }, this._scene);
            ring.rotation.x = Math.PI / 2;
            ring.position.z = i * CFG.RING_SPACING + 30;
            ring.position.y = 3;

            const mat = new BABYLON.StandardMaterial(`ringMat_${i}`, this._scene);
            mat.emissiveColor   = c.clone();
            mat.disableLighting = true;
            ring.material = mat;
            ring.metadata = { baseBrightness: 0.3 + (i % 3) * 0.06 };

            this._rings.push(ring);
        }
    }

    // ── Side ambient glow ─────────────────────────────────────────────────────────

    _buildSideGlow() {
        const glowMat = new BABYLON.StandardMaterial('sideGlow', this._scene);
        glowMat.emissiveColor   = new BABYLON.Color3(0, 0.15, 0.4);
        glowMat.backFaceCulling = false;
        glowMat.alpha           = 0.12;
        glowMat.disableLighting = true;

        const L = BABYLON.MeshBuilder.CreatePlane('glowL', { width: 0.5, height: 200 }, this._scene);
        L.position.set(-5.2, 3, 80);
        L.rotation.y = Math.PI / 2;
        L.material   = glowMat;

        const R = L.clone('glowR');
        R.position.x = 5.2;
        R.rotation.y = -Math.PI / 2;
        R.material   = glowMat.clone('sideGlowR');
    }

    // ── Planets ───────────────────────────────────────────────────────────────────

    _buildPlanets() {
        // Moon — very close, dramatic flyby
        this._addPlanet({
            name: 'moon',
            pos: { x: -22, y: 7, z: 175 },
            diam: 10,
            diff: new BABYLON.Color3(0.45, 0.45, 0.45),
            emis: new BABYLON.Color3(0.08, 0.08, 0.08),
            rotY: 0.00005,
        });
        // Earth + cloud + atmosphere (close dramatic pass)
        this._addPlanet({
            name: 'earth',
            pos: { x: -40, y: 20, z: 215 },
            diam: 32,
            diff: new BABYLON.Color3(0.08, 0.30, 0.55),
            emis: new BABYLON.Color3(0.04, 0.12, 0.25),
            rotY: 0.00012,
            atmo:   { diam: 35,   color: new BABYLON.Color3(0.2, 0.5, 0.9),   alpha: 0.18 },
            clouds: { diam: 33.5, color: new BABYLON.Color3(0.85, 0.9, 0.95), alpha: 0.30 },
        });
        // Mars
        this._addPlanet({
            name: 'mars',
            pos: { x: 50, y: 18, z: 295 },
            diam: 22,
            diff: new BABYLON.Color3(0.62, 0.22, 0.06),
            emis: new BABYLON.Color3(0.15, 0.04, 0.01),
            rotY: 0.00014,
            atmo: { diam: 24, color: new BABYLON.Color3(0.8, 0.4, 0.2), alpha: 0.12 },
        });
        // Saturn with rings
        this._addPlanet({
            name: 'saturn',
            pos: { x: 90, y: 30, z: 380 },
            diam: 36,
            diff: new BABYLON.Color3(0.82, 0.72, 0.50),
            emis: new BABYLON.Color3(0.10, 0.08, 0.03),
            rotY: 0.00018,
            ring: { diam: 92, color: new BABYLON.Color3(0.75, 0.62, 0.38), alpha: 0.55 },
        });
        // Jupiter with equatorial bands
        this._addPlanet({
            name: 'jupiter',
            pos: { x: -82, y: 38, z: 460 },
            diam: 54,
            diff: new BABYLON.Color3(0.72, 0.52, 0.32),
            emis: new BABYLON.Color3(0.10, 0.06, 0.02),
            rotY: 0.00025,
            bands: true,
        });
        // Neptune
        this._addPlanet({
            name: 'neptune',
            pos: { x: -55, y: 44, z: 560 },
            diam: 26,
            diff: new BABYLON.Color3(0.10, 0.20, 0.75),
            emis: new BABYLON.Color3(0.02, 0.05, 0.22),
            rotY: 0.00016,
            atmo: { diam: 28, color: new BABYLON.Color3(0.15, 0.35, 0.9), alpha: 0.22 },
        });
        // Purple gas giant
        this._addPlanet({
            name: 'gasGiant',
            pos: { x: -112, y: 52, z: 640 },
            diam: 44,
            diff: new BABYLON.Color3(0.38, 0.08, 0.58),
            emis: new BABYLON.Color3(0.12, 0.02, 0.20),
            rotY: 0.00020,
            atmo: { diam: 47, color: new BABYLON.Color3(0.55, 0.1, 0.8), alpha: 0.24 },
        });
        // Pulsar star
        this._addPlanet({
            name: 'pulsar',
            pos: { x: 34, y: 62, z: 710 },
            diam: 12,
            diff: new BABYLON.Color3(0.8,  0.9, 1.0),
            emis: new BABYLON.Color3(0.6,  0.8, 1.0),
            rotY: 0.0008,
            isPulsar: true,
        });
        // Ice world (new)
        this._addPlanet({
            name: 'iceWorld',
            pos: { x: 72, y: 28, z: 820 },
            diam: 24,
            diff: new BABYLON.Color3(0.75, 0.90, 1.0),
            emis: new BABYLON.Color3(0.10, 0.22, 0.40),
            rotY: 0.00010,
            atmo: { diam: 26, color: new BABYLON.Color3(0.7, 0.88, 1.0), alpha: 0.22 },
        });
        // Lava / volcanic planet (new)
        this._addPlanet({
            name: 'lava',
            pos: { x: -42, y: 22, z: 940 },
            diam: 20,
            diff: new BABYLON.Color3(0.70, 0.12, 0.02),
            emis: new BABYLON.Color3(0.55, 0.08, 0.01),
            rotY: 0.00022,
            atmo: { diam: 22, color: new BABYLON.Color3(1.0, 0.3, 0.05), alpha: 0.30 },
        });
        // Red giant star (new — enormous)
        this._addPlanet({
            name: 'redGiant',
            pos: { x: 28, y: 58, z: 1080 },
            diam: 64,
            diff: new BABYLON.Color3(0.85, 0.18, 0.03),
            emis: new BABYLON.Color3(0.60, 0.10, 0.02),
            rotY: 0.00006,
            atmo: { diam: 70, color: new BABYLON.Color3(1.0, 0.35, 0.05), alpha: 0.30 },
        });
        // Alien cyan striped world (new)
        this._addPlanet({
            name: 'alienWorld',
            pos: { x: -90, y: 36, z: 1200 },
            diam: 30,
            diff: new BABYLON.Color3(0.02, 0.60, 0.55),
            emis: new BABYLON.Color3(0.01, 0.18, 0.18),
            rotY: 0.00017,
            bands: true,
        });
    }

    _addPlanet(opts) {
        const sphere = BABYLON.MeshBuilder.CreateSphere(opts.name, {
            diameter: opts.diam, segments: 18
        }, this._scene);
        sphere.position.set(opts.pos.x, opts.pos.y, opts.pos.z);

        const mat = new BABYLON.StandardMaterial(`pmat_${opts.name}`, this._scene);
        mat.diffuseColor  = opts.diff;
        mat.emissiveColor = opts.emis;
        mat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        sphere.material   = mat;

        const entry = {
            mesh:     sphere,
            rotY:     opts.rotY,
            children: [],
            cloudMesh: null,
            ringMesh:  null,
            isPulsar:  !!opts.isPulsar,
        };

        // Atmosphere shell
        if (opts.atmo) {
            const atmo = BABYLON.MeshBuilder.CreateSphere(`${opts.name}_a`, {
                diameter: opts.atmo.diam, segments: 14
            }, this._scene);
            atmo.position.set(opts.pos.x, opts.pos.y, opts.pos.z);
            const am = new BABYLON.StandardMaterial(`amat_${opts.name}`, this._scene);
            am.emissiveColor   = opts.atmo.color;
            am.backFaceCulling = false;
            am.alpha           = opts.atmo.alpha;
            am.disableLighting = true;
            atmo.material = am;
            entry.children.push(atmo);
        }

        // Cloud layer (Earth)
        if (opts.clouds) {
            const clouds = BABYLON.MeshBuilder.CreateSphere(`${opts.name}_c`, {
                diameter: opts.clouds.diam, segments: 14
            }, this._scene);
            clouds.position.set(opts.pos.x, opts.pos.y, opts.pos.z);
            const cm = new BABYLON.StandardMaterial(`cmat_${opts.name}`, this._scene);
            cm.emissiveColor   = opts.clouds.color;
            cm.backFaceCulling = false;
            cm.alpha           = opts.clouds.alpha;
            cm.disableLighting = true;
            clouds.material    = cm;
            entry.children.push(clouds);
            entry.cloudMesh = clouds;
        }

        // Planetary ring (Saturn-style flat cylinder)
        if (opts.ring) {
            const ring = BABYLON.MeshBuilder.CreateCylinder(`${opts.name}_r`, {
                diameter: opts.ring.diam, height: 0.3, tessellation: 64
            }, this._scene);
            ring.position.set(opts.pos.x, opts.pos.y, opts.pos.z);
            ring.rotation.x = 1.25;
            const rm = new BABYLON.StandardMaterial(`rmat_${opts.name}`, this._scene);
            rm.emissiveColor   = opts.ring.color;
            rm.backFaceCulling = false;
            rm.alpha           = opts.ring.alpha;
            rm.disableLighting = true;
            ring.material  = rm;
            entry.children.push(ring);
            entry.ringMesh = ring;
        }

        // Jupiter equatorial band cylinders
        if (opts.bands) {
            const bandColors = [
                new BABYLON.Color3(0.50, 0.28, 0.10),
                new BABYLON.Color3(0.42, 0.20, 0.05),
                new BABYLON.Color3(0.60, 0.34, 0.14),
            ];
            for (let b = 0; b < 3; b++) {
                const yOff = (b - 1) * 9;
                const band = BABYLON.MeshBuilder.CreateCylinder(`${opts.name}_b${b}`, {
                    diameter: opts.diam + 1, height: 3, tessellation: 48
                }, this._scene);
                band.position.set(opts.pos.x, opts.pos.y + yOff, opts.pos.z);
                const bm = new BABYLON.StandardMaterial(`bmat_${opts.name}_${b}`, this._scene);
                bm.emissiveColor   = bandColors[b];
                bm.alpha           = 0.30;
                bm.backFaceCulling = false;
                bm.disableLighting = true;
                band.material = bm;
                band.metadata = { yOffset: yOff };
                entry.children.push(band);
            }
        }

        this._planets.push(entry);
        return entry;
    }

    // ── Nebula clouds ─────────────────────────────────────────────────────────────

    _buildNebula() {
        const defs = [
            { x: -120, y:  40, z: 500, w: 300, h: 200, ry: -0.20, r: 0.40, g: 0.10, b: 0.60, a: 0.070 },
            { x:  150, y:  60, z: 420, w: 250, h: 180, ry:  0.15, r: 0.00, g: 0.50, b: 0.60, a: 0.062 },
            { x:  -80, y:  80, z: 650, w: 200, h: 300, ry: -0.35, r: 0.60, g: 0.05, b: 0.10, a: 0.055 },
            { x:  200, y:  20, z: 380, w: 280, h: 220, ry:  0.25, r: 0.05, g: 0.20, b: 0.70, a: 0.058 },
            { x:  -30, y: 100, z: 720, w: 320, h: 260, ry: -0.10, r: 0.30, g: 0.00, b: 0.50, a: 0.052 },
            { x:  100, y:  55, z: 580, w: 240, h: 200, ry:  0.30, r: 0.00, g: 0.40, b: 0.40, a: 0.055 },
            { x: -160, y:  70, z: 820, w: 350, h: 280, ry: -0.18, r: 0.15, g: 0.40, b: 0.80, a: 0.048 },
            { x:  130, y:  90, z: 970, w: 300, h: 240, ry:  0.22, r: 0.50, g: 0.00, b: 0.30, a: 0.045 },
            { x:  -60, y: 120, z:1120, w: 380, h: 300, ry: -0.08, r: 0.05, g: 0.55, b: 0.45, a: 0.042 },
        ];

        for (const n of defs) {
            const plane = BABYLON.MeshBuilder.CreatePlane(`neb_${n.z}`, {
                width: n.w, height: n.h
            }, this._scene);
            plane.position.set(n.x, n.y, n.z);
            plane.rotation.y = n.ry;

            const mat = new BABYLON.StandardMaterial(`nebm_${n.z}`, this._scene);
            mat.emissiveColor   = new BABYLON.Color3(n.r, n.g, n.b);
            mat.backFaceCulling = false;
            mat.alpha           = n.a;
            mat.disableLighting = true;
            plane.material = mat;

            this._nebulas.push(plane);
        }
    }

    // ── Galaxy disc ───────────────────────────────────────────────────────────────

    _buildGalaxy() {
        const gx = 60, gy = 35, gz = 720;

        const disc = BABYLON.MeshBuilder.CreateDisc('galaxyDisc', {
            radius: 140, tessellation: 64
        }, this._scene);
        disc.position.set(gx, gy, gz);
        disc.rotation.x = 1.1;

        const dm = new BABYLON.StandardMaterial('gDiscMat', this._scene);
        dm.emissiveColor   = new BABYLON.Color3(0.28, 0.10, 0.48);
        dm.backFaceCulling = false;
        dm.alpha           = 0.20;
        dm.disableLighting = true;
        disc.material = dm;

        const core = BABYLON.MeshBuilder.CreateSphere('galaxyCore', {
            diameter: 20, segments: 12
        }, this._scene);
        core.position.set(gx, gy, gz);

        const cm = new BABYLON.StandardMaterial('gCoreMat', this._scene);
        cm.emissiveColor   = new BABYLON.Color3(0.9, 0.7, 1.0);
        cm.disableLighting = true;
        core.material = cm;

        this._galaxy = { disc, core };
    }

    // ── Tick ─────────────────────────────────────────────────────────────────────

    _onTick({ dt, speed }) {
        const step = speed * dt;
        const now  = Date.now() * 0.001;

        // Floor tiles
        for (const t of this._tiles) {
            t.tile.position.z  -= step;
            t.edgeL.position.z -= step;
            t.edgeR.position.z -= step;

            if (t.tile.position.z < -CFG.TILE_DEPTH * 2) {
                const maxZ = Math.max(...this._tiles.map(x => x.tile.position.z));
                const nz   = maxZ + CFG.TILE_DEPTH;
                t.tile.position.z  = nz;
                t.edgeL.position.z = nz;
                t.edgeR.position.z = nz;
            }
        }

        // Tunnel rings
        for (const ring of this._rings) {
            ring.position.z -= step;
            if (ring.position.z < -20) {
                const maxZ = Math.max(...this._rings.map(r => r.position.z));
                ring.position.z = maxZ + CFG.RING_SPACING;
            }
            const base  = ring.metadata?.baseBrightness ?? 0.3;
            const pulse = Math.sin(now + ring.position.z * 0.05) * 0.1;
            ring.material.emissiveColor.g = base + pulse;
        }

        // Planets (parallax scroll + self-rotation + special effects)
        const pStep = speed * dt * CFG.PLANET_PARALLAX;
        for (const entry of this._planets) {
            entry.mesh.position.z -= pStep;
            entry.mesh.rotation.y += entry.rotY * 1000 * dt;

            // Cloud layer counter-rotates for realism
            if (entry.cloudMesh) {
                entry.cloudMesh.rotation.y -= entry.rotY * 600 * dt;
                entry.cloudMesh.position.z  = entry.mesh.position.z;
                entry.cloudMesh.position.x  = entry.mesh.position.x;
                entry.cloudMesh.position.y  = entry.mesh.position.y;
            }

            // Ring stays centered on planet, gentle tilt oscillation
            if (entry.ringMesh) {
                entry.ringMesh.position.z = entry.mesh.position.z;
                entry.ringMesh.position.x = entry.mesh.position.x;
                entry.ringMesh.position.y = entry.mesh.position.y;
                entry.ringMesh.rotation.z = Math.sin(now * 0.1) * 0.04;
            }

            // Sync remaining children (atmosphere / band cylinders)
            for (const child of entry.children) {
                if (child === entry.cloudMesh || child === entry.ringMesh) continue;
                child.position.z = entry.mesh.position.z;
                child.position.x = entry.mesh.position.x;
                child.position.y = entry.mesh.position.y +
                    (child.metadata?.yOffset ?? 0);
            }

            // Pulsar: rapid glow pulse
            if (entry.isPulsar) {
                const p = 0.5 + Math.sin(now * 8) * 0.5;
                entry.mesh.material.emissiveColor.r = 0.4 + p * 0.6;
                entry.mesh.material.emissiveColor.g = 0.5 + p * 0.5;
                entry.mesh.material.emissiveColor.b = 1.0;
            }

            // Recycle planet back to far distance; shift X to avoid static lanes
            if (entry.mesh.position.z < CFG.PLANET_RECYCLE_Z) {
                const dz = CFG.PLANET_RESET_Z;
                entry.mesh.position.z += dz;
                const xShift = (Math.random() - 0.5) * 40;
                entry.mesh.position.x += xShift;
                for (const child of entry.children) {
                    child.position.z += dz;
                    child.position.x = entry.mesh.position.x;
                }
            }
        }

        // Nebulas (very slow parallax)
        const nStep = speed * dt * CFG.NEBULA_PARALLAX;
        for (const neb of this._nebulas) {
            neb.position.z -= nStep;
            if (neb.position.z < -200) neb.position.z += 1400;
        }

        // Galaxy (minimal parallax, extremely distant)
        if (this._galaxy) {
            const gStep = speed * dt * CFG.GALAXY_PARALLAX;
            this._galaxy.disc.position.z -= gStep;
            this._galaxy.core.position.z -= gStep;
            this._galaxy.disc.rotation.y += 0.000015 * 1000 * dt;

            const cp = 0.7 + Math.sin(now * 0.5) * 0.3;
            this._galaxy.core.material.emissiveColor.r = 0.7 + cp * 0.2;
            this._galaxy.core.material.emissiveColor.g = 0.5 + cp * 0.2;
            this._galaxy.core.material.emissiveColor.b = 1.0;

            if (this._galaxy.disc.position.z < -500) {
                this._galaxy.disc.position.z += 1800;
                this._galaxy.core.position.z += 1800;
            }
        }

        // Warp stream: scale emit power with game speed
        if (this._warpParticles) {
            const t  = Math.min(Math.max((speed - 8) / 24, 0), 1);
            const pw = 2 + t * 22;
            this._warpParticles.minEmitPower = pw * 0.4;
            this._warpParticles.maxEmitPower = pw;
        }
    }

    /**
     * Tint the floor for day/night cycle.
     * @param {'day'|'night'} mode
     */
    setDayNight(mode) {
        const c = mode === 'night'
            ? new BABYLON.Color3(0, 0.08, 0.25)
            : new BABYLON.Color3(0.04, 0.08, 0.22);
        for (const t of this._tiles) t.tile.material.diffuseColor = c;
    }

    dispose() {
        for (const t of this._tiles) {
            t.tile.dispose();
            t.edgeL.dispose();
            t.edgeR.dispose();
        }
        for (const r of this._rings) r.dispose();
        for (const e of this._planets) {
            e.mesh.dispose();
            for (const c of e.children) c.dispose();
        }
        for (const n of this._nebulas) n.dispose();
        if (this._galaxy) {
            this._galaxy.disc.dispose();
            this._galaxy.core.dispose();
        }
        if (this._starfield)     this._starfield.dispose();
        if (this._warpParticles) this._warpParticles.dispose();
    }
}
