/**
 * Player.js
 * Builds the 3D astronaut character from procedural meshes.
 * Handles jumping, ducking, animations, and collision bounds.
 *
 * Character types: 'astronaut' | 'alien' | 'robot'
 * Player index:    0 (P1) | 1 (P2)
 */
import { GameState, STATE } from '../game/GameState.js';
import { ACTIONS } from '../core/InputManager.js';

const CFG = {
    JUMP_FORCE:      14,
    GRAVITY:        -30,
    GROUND_Y:        0.85,
    DUCK_SCALE_Y:    0.55,
    MAX_JUMPS:       2,      // double jump

    ANIM_RUN_SPEED:  8,
    TRAIL_OFFSET_Z: -0.6,

    // Lane X offsets per player index
    LANE_X: [0, 0],          // overridden in multi-player mode
    MULTI_LANE_X: [-3.2, 3.2]
};

const CHAR_COLORS = {
    astronaut: { body: '#c0d8ff', helmet: '#e8f4ff', visor: '#00aaff', suit: '#6080b0' },
    alien:     { body: '#80ffb0', helmet: '#40ff80', visor: '#00ff40', suit: '#206040' },
    robot:     { body: '#ffd080', helmet: '#ffb840', visor: '#ff8800', suit: '#886020' }
};

export class Player {
    /**
     * @param {BABYLON.Scene}  scene
     * @param {InputManager}   inputManager
     * @param {number}         playerIndex  0 or 1
     * @param {string}         charType     'astronaut' | 'alien' | 'robot'
     * @param {boolean}        multiplayer
     */
    /**
     * @param {BABYLON.Scene}  scene
     * @param {InputManager}   inputManager
     * @param {number}         playerIndex  0 or 1
     * @param {string}         charType     'astronaut' | 'alien' | 'robot'
     * @param {boolean}        multiplayer
     * @param {object}         opts         { maxJumps: number }
     */
    constructor(scene, inputManager, playerIndex = 0, charType = 'astronaut', multiplayer = false, opts = {}) {
        this._scene         = scene;
        this._input         = inputManager;
        this._state         = GameState.getInstance();
        this._index         = playerIndex;
        this._charType      = charType;
        this._multiplayer   = multiplayer;

        this._velocityY     = 0;
        this._jumpCount     = 0;
        this._isDucking     = false;
        this._isDead        = false;
        this._isShielded    = false;
        this._maxJumps      = opts.maxJumps ?? CFG.MAX_JUMPS;
        this._laneX         = multiplayer ? CFG.MULTI_LANE_X[playerIndex] : CFG.LANE_X[playerIndex];

        this._root          = null;   // parent transform node
        this._meshes        = {};     // named sub-meshes
        this._shieldMesh    = null;
        this._trailSystem   = null;

        // Animated material references
        this._nozzleMat  = null;
        this._antTipMat  = null;
        this._stripeMat  = null;

        this._subs = [];              // input unsubscribe handles

        this._build();
        this._attachInput();

        this._state.on('game:tick', this._onTick.bind(this));
    }

    // ---- Build ----

    _build() {
        this._root = new BABYLON.TransformNode(`player_${this._index}`, this._scene);
        this._root.position.set(this._laneX, CFG.GROUND_Y, 0);

        const colors = CHAR_COLORS[this._charType] || CHAR_COLORS.astronaut;
        const idx    = this._index;

        // ── TORSO / BODY ──────────────────────────────────────────
        const body = BABYLON.MeshBuilder.CreateBox(`body_${idx}`, {
            width: 0.65, height: 0.74, depth: 0.40
        }, this._scene);
        body.parent = this._root;
        body.position.y = 0.375;
        body.material = this._makeMat('bodyMat', colors.body, 24);
        body.receiveShadows = true;

        // Chest life-support disc
        const chest = BABYLON.MeshBuilder.CreateCylinder(`chest_${idx}`, {
            diameter: 0.28, height: 0.06, tessellation: 14
        }, this._scene);
        chest.parent = this._root;
        chest.position.set(0, 0.44, 0.21);
        chest.rotation.x = Math.PI / 2;
        const chestMat = new BABYLON.StandardMaterial(`chestMat_${idx}`, this._scene);
        chestMat.diffuseColor  = BABYLON.Color3.FromHexString('#d8ecff');
        chestMat.emissiveColor = new BABYLON.Color3(0.05, 0.45, 0.80);
        chestMat.specularPower = 80;
        chest.material = chestMat;

        // Waist belt
        const belt = BABYLON.MeshBuilder.CreateBox(`belt_${idx}`, {
            width: 0.68, height: 0.08, depth: 0.42
        }, this._scene);
        belt.parent = this._root;
        belt.position.y = 0.02;
        belt.material = this._makeMat('beltMat', '#1a2540', 64);

        // ── SHOULDERS ─────────────────────────────────────────────
        const shldL = BABYLON.MeshBuilder.CreateBox(`shldL_${idx}`, {
            width: 0.22, height: 0.18, depth: 0.28
        }, this._scene);
        shldL.parent = this._root;
        shldL.position.set(-0.44, 0.62, 0);
        shldL.material = this._makeMat('shldMat', colors.suit, 32);

        const shldR = shldL.clone(`shldR_${idx}`);
        shldR.parent = this._root;
        shldR.position.x = 0.44;

        // ── NECK RING ─────────────────────────────────────────────
        const neckRing = BABYLON.MeshBuilder.CreateCylinder(`neckRing_${idx}`, {
            diameter: 0.35, height: 0.08, tessellation: 14
        }, this._scene);
        neckRing.parent = this._root;
        neckRing.position.y = 0.76;
        neckRing.material = this._makeMat('neckMat', '#b0c0e0', 48);

        // ── HELMET ────────────────────────────────────────────────
        const helmet = BABYLON.MeshBuilder.CreateSphere(`helmet_${idx}`, {
            diameter: 0.60, segments: 14
        }, this._scene);
        helmet.parent = this._root;
        helmet.position.y = 0.97;
        const helmetMat = new BABYLON.StandardMaterial(`helmetMat_${idx}`, this._scene);
        helmetMat.diffuseColor  = BABYLON.Color3.FromHexString(colors.helmet);
        helmetMat.specularColor = new BABYLON.Color3(0.5, 0.6, 0.8);
        helmetMat.specularPower = 64;
        helmet.material = helmetMat;

        // Visor (forward-facing, slight transparency)
        const visor = BABYLON.MeshBuilder.CreateSphere(`visor_${idx}`, {
            diameter: 0.44, segments: 12
        }, this._scene);
        visor.parent = this._root;
        visor.position.set(0, 0.99, 0.12);
        const visorMat = new BABYLON.StandardMaterial(`visorMat_${idx}`, this._scene);
        visorMat.diffuseColor  = BABYLON.Color3.FromHexString(colors.visor);
        visorMat.emissiveColor = BABYLON.Color3.FromHexString(colors.visor).scale(0.45);
        visorMat.specularColor = new BABYLON.Color3(0.9, 0.95, 1.0);
        visorMat.specularPower = 120;
        visorMat.alpha         = 0.72;
        visor.material = visorMat;

        // ── ANTENNA ───────────────────────────────────────────────
        const antBase = BABYLON.MeshBuilder.CreateCylinder(`antBase_${idx}`, {
            diameterTop: 0.03, diameterBottom: 0.045, height: 0.18, tessellation: 8
        }, this._scene);
        antBase.parent = this._root;
        antBase.position.set(0.14, 1.29, 0.08);
        antBase.material = this._makeMat('antMat', '#8890aa', 24);

        const antTip = BABYLON.MeshBuilder.CreateSphere(`antTip_${idx}`, {
            diameter: 0.055, segments: 8
        }, this._scene);
        antTip.parent = this._root;
        antTip.position.set(0.14, 1.40, 0.08);
        this._antTipMat = new BABYLON.StandardMaterial(`antTipMat_${idx}`, this._scene);
        this._antTipMat.emissiveColor = new BABYLON.Color3(1, 0.1, 0.05);
        antTip.material = this._antTipMat;

        // ── ARMS ──────────────────────────────────────────────────
        const armL = BABYLON.MeshBuilder.CreateBox(`armL_${idx}`, {
            width: 0.20, height: 0.44, depth: 0.20
        }, this._scene);
        armL.parent = this._root;
        armL.position.set(-0.46, 0.20, 0);
        armL.material = this._makeMat('armMat', colors.suit, 20);

        const armR = armL.clone(`armR_${idx}`);
        armR.parent = this._root;
        armR.position.x = 0.46;

        // Gloves — parented to each arm, auto-inherit swing
        const gloveL = BABYLON.MeshBuilder.CreateSphere(`gloveL_${idx}`, {
            diameter: 0.18, segments: 8
        }, this._scene);
        gloveL.parent   = armL;                        // child of armL
        gloveL.position.set(0, -0.28, 0);
        gloveL.material = this._makeMat('gloveMat', '#e8eeff', 32);

        const gloveR = gloveL.clone(`gloveR_${idx}`);
        gloveR.parent   = armR;                        // child of armR
        gloveR.position.set(0, -0.28, 0);

        // ── LEGS ──────────────────────────────────────────────────
        const legL = BABYLON.MeshBuilder.CreateBox(`legL_${idx}`, {
            width: 0.24, height: 0.47, depth: 0.24
        }, this._scene);
        legL.parent = this._root;
        legL.position.set(-0.18, -0.24, 0);
        legL.material = this._makeMat('legMat', colors.suit, 20);

        const legR = legL.clone(`legR_${idx}`);
        legR.parent = this._root;
        legR.position.x = 0.18;

        // Boots — parented to each leg, auto-inherit swing
        const bootL = BABYLON.MeshBuilder.CreateBox(`bootL_${idx}`, {
            width: 0.28, height: 0.12, depth: 0.32
        }, this._scene);
        bootL.parent   = legL;                         // child of legL
        bootL.position.set(0, -0.30, 0.04);
        bootL.material = this._makeMat('bootMat', '#263050', 32);

        const bootR = bootL.clone(`bootR_${idx}`);
        bootR.parent   = legR;                         // child of legR
        bootR.position.set(0, -0.30, 0.04);

        // ── JETPACK ───────────────────────────────────────────────
        const pack = BABYLON.MeshBuilder.CreateBox(`pack_${idx}`, {
            width: 0.46, height: 0.54, depth: 0.20
        }, this._scene);
        pack.parent = this._root;
        pack.position.set(0, 0.36, -0.30);
        pack.material = this._makeMat('packMat', '#1e2d4a', 64);
        pack.receiveShadows = true;

        // Emissive suit stripes on jetpack face
        const stripeA = BABYLON.MeshBuilder.CreateBox(`stripeA_${idx}`, {
            width: 0.32, height: 0.04, depth: 0.02
        }, this._scene);
        stripeA.parent = pack;
        stripeA.position.set(0, 0.10, 0.11);
        this._stripeMat = new BABYLON.StandardMaterial(`stripeMat_${idx}`, this._scene);
        this._stripeMat.emissiveColor = new BABYLON.Color3(0, 0.85, 1);
        stripeA.material = this._stripeMat;

        const stripeB = stripeA.clone(`stripeB_${idx}`);
        stripeB.parent = pack;
        stripeB.position.set(0, -0.10, 0.11);
        stripeB.material = this._stripeMat;         // share same material

        // ── DUAL NOZZLES ──────────────────────────────────────────
        const nozzleL = BABYLON.MeshBuilder.CreateCylinder(`nozzleL_${idx}`, {
            diameterTop: 0.10, diameterBottom: 0.14, height: 0.12, tessellation: 10
        }, this._scene);
        nozzleL.parent = this._root;
        nozzleL.position.set(-0.13, 0.12, -0.40);
        this._nozzleMat = new BABYLON.StandardMaterial(`nozzleMat_${idx}`, this._scene);
        this._nozzleMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
        nozzleL.material = this._nozzleMat;

        const nozzleR = nozzleL.clone(`nozzleR_${idx}`);
        nozzleR.parent = this._root;
        nozzleR.position.set(0.13, 0.12, -0.40);
        nozzleR.material = this._nozzleMat;          // share same material

        this._meshes = {
            body, chest, belt,
            shldL, shldR, neckRing,
            helmet, visor,
            antBase, antTip,
            armL, armR,
            legL, legR,
            pack, stripeA, stripeB,
            nozzleL, nozzleR
        };
        // Note: gloves/boots are children of arms/legs — their swing is inherited automatically.

        this._buildShield(colors);
    }

    _buildShield(colors) {
        this._shieldMesh = BABYLON.MeshBuilder.CreateSphere(`shield_${this._index}`, {
            diameter: 2.0, segments: 14
        }, this._scene);
        this._shieldMesh.parent = this._root;
        this._shieldMesh.position.y = 0.5;
        const smat = new BABYLON.StandardMaterial(`shieldMat_${this._index}`, this._scene);
        smat.emissiveColor = new BABYLON.Color3(0, 0.6, 1);
        smat.alpha         = 0;
        smat.wireframe     = true;
        smat.backFaceCulling = false;
        this._shieldMesh.material = smat;
        this._shieldMesh.isVisible = false;
    }

    _makeMat(name, hexDiffuse, specularPower = 24) {
        const mat = new BABYLON.StandardMaterial(`${name}_${this._index}`, this._scene);
        mat.diffuseColor  = BABYLON.Color3.FromHexString(hexDiffuse);
        mat.specularColor = new BABYLON.Color3(0.22, 0.28, 0.42);
        mat.specularPower = specularPower;
        return mat;
    }

    // ---- Input ----

    _attachInput() {
        const jumpAction = this._index === 0 ? ACTIONS.JUMP_P1 : ACTIONS.JUMP_P2;
        const duckAction = this._index === 0 ? ACTIONS.DUCK_P1 : ACTIONS.DUCK_P2;
        const duckRelease = this._index === 0 ? ACTIONS.DUCK_P1_RELEASE : ACTIONS.DUCK_P2_RELEASE;

        this._subs.push(this._input.on(jumpAction, () => this._jump()));
        this._subs.push(this._input.on(duckAction, () => this._startDuck()));
        this._subs.push(this._input.on(duckRelease, () => this._stopDuck()));
    }

    _jump() {
        if (!this._state.is(STATE.PLAYING)) return;
        if (this._isDead) return;
        if (this._jumpCount >= this._maxJumps) return;

        this._velocityY = CFG.JUMP_FORCE;
        this._jumpCount++;

        this._state.emit('player:jump', { index: this._index });
    }

    _startDuck() {
        if (!this._state.is(STATE.PLAYING)) return;
        if (this._isDead || this._isDucking) return;
        this._isDucking = true;
        this._root.scaling.y = CFG.DUCK_SCALE_Y;
        this._root.position.y = CFG.GROUND_Y * CFG.DUCK_SCALE_Y;
        this._state.emit('player:duck', { index: this._index, ducking: true });
    }

    _stopDuck() {
        if (!this._isDucking) return;
        this._isDucking = false;
        this._root.scaling.y = 1;
        this._root.position.y = CFG.GROUND_Y;
        this._state.emit('player:duck', { index: this._index, ducking: false });
    }

    // ---- Update ----

    _onTick({ dt }) {
        if (this._isDead) return;
        if (!this._state.is(STATE.PLAYING)) return;

        this._applyGravity(dt);
        this._animateRun(dt);
        this._animateShield(dt);
    }

    _applyGravity(dt) {
        this._velocityY    += CFG.GRAVITY * dt;
        this._root.position.y += this._velocityY * dt;

        const groundY = this._isDucking
            ? CFG.GROUND_Y * CFG.DUCK_SCALE_Y
            : CFG.GROUND_Y;

        if (this._root.position.y <= groundY) {
            this._root.position.y = groundY;
            this._velocityY       = 0;
            this._jumpCount       = 0;
        }
    }

    _animateRun(dt) {
        const t    = Date.now() * 0.001;
        const freq = CFG.ANIM_RUN_SPEED;
        const phase = Math.sin(t * freq);
        const rise  = Math.abs(phase);
        const bob   = rise * 0.034;

        // Leg swing ± 0.52 rad
        this._meshes.legL.rotation.x =  phase * 0.52;
        this._meshes.legR.rotation.x = -phase * 0.52;

        // Arm counter-swing + outward Z flare
        this._meshes.armL.rotation.x = -phase * 0.40;
        this._meshes.armR.rotation.x =  phase * 0.40;
        this._meshes.armL.rotation.z =  0.08 + rise * 0.05;
        this._meshes.armR.rotation.z = -0.08 - rise * 0.05;

        // Group vertical bob — everything above waist bobS with run
        const m = this._meshes;
        m.body.position.y     = 0.375  + bob;
        m.chest.position.y    = 0.44   + bob;
        m.belt.position.y     = 0.02   + bob * 0.5;
        m.helmet.position.y   = 0.97   + bob;
        m.visor.position.y    = 0.99   + bob;
        m.neckRing.position.y = 0.76   + bob;
        m.shldL.position.y    = 0.62   + bob;
        m.shldR.position.y    = 0.62   + bob;
        m.antBase.position.y  = 1.29   + bob;
        m.antTip.position.y   = 1.40   + bob;
        m.pack.position.y     = 0.36   + bob * 0.7;
        m.nozzleL.position.y  = 0.12   + bob * 0.7;
        m.nozzleR.position.y  = 0.12   + bob * 0.7;

        // Nozzle glow pulse — fast flicker at ~14 Hz
        const nozzleT = Date.now() * 0.014;
        const nozzleIntensity = 0.65 + Math.sin(nozzleT) * 0.35;
        this._nozzleMat.emissiveColor.set(0, nozzleIntensity * 0.9, nozzleIntensity);

        // Antenna blink — 1.8 Hz red blink
        const antBlink = Math.sin(Date.now() * 0.0018 * Math.PI * 2) > 0.5;
        this._antTipMat.emissiveColor.set(antBlink ? 1 : 0.15, 0.05, 0.02);

        // Suit stripe pulse — slow cyan breathe at 3.5 Hz
        const stripeT = Date.now() * 0.0035;
        const stripeIntensity = 0.5 + Math.abs(Math.sin(stripeT)) * 0.5;
        this._stripeMat.emissiveColor.set(0, stripeIntensity * 0.9, stripeIntensity);

        // Subtle forward lean
        this._root.rotation.x = 0.06;
    }

    _animateShield(dt) {
        if (this._isShielded && this._shieldMesh.isVisible) {
            this._shieldMesh.rotation.y += dt * 1.5;
            this._shieldMesh.rotation.x  = Math.sin(Date.now() * 0.0008) * 0.3;
        }
    }

    // ---- Collision bounding box ----

    /**
     * Returns a simple AABB for collision detection.
     * @returns {{ min: BABYLON.Vector3, max: BABYLON.Vector3 }}
     */
    getBounds() {
        const pos = this._root.absolutePosition;
        const halfW  = 0.38;
        const halfH  = this._isDucking ? 0.5 : 1.0;
        const halfD  = 0.25;
        return {
            min: new BABYLON.Vector3(pos.x - halfW, pos.y - 0.1,  pos.z - halfD),
            max: new BABYLON.Vector3(pos.x + halfW, pos.y + halfH, pos.z + halfD)
        };
    }

    // ---- Events ----

    onHit() {
        if (this._isShielded) {
            this._state.emit('player:shield_hit', { index: this._index });
            this.deactivateShield();
            return false;   // absorbed by shield, still alive
        }
        this._die();
        return true;        // player is now dead
    }

    _die() {
        this._isDead = true;
        // Tumble forward animation
        const endRotation = new BABYLON.Vector3(Math.PI, this._root.rotation.y, 0.5);
        const anim = new BABYLON.Animation(
            'deathAnim', 'rotation', 60,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        anim.setKeys([
            { frame: 0,  value: this._root.rotation.clone() },
            { frame: 20, value: endRotation }
        ]);
        this._root.animations = [anim];
        this._scene.beginAnimation(this._root, 0, 20, false);

        this._state.emit('player:dead', { index: this._index });
    }

    activateShield(duration = 5) {
        this._isShielded           = true;
        this._shieldMesh.isVisible = true;
        this._shieldMesh.material.alpha = 0.22;
        setTimeout(() => {
            this.deactivateShield();
        }, duration * 1000);
    }

    deactivateShield() {
        this._isShielded            = false;
        this._shieldMesh.isVisible  = false;
        this._shieldMesh.material.alpha = 0;
    }

    // ---- Getters ----

    get root()     { return this._root; }
    get isDead()   { return this._isDead; }
    get position() { return this._root.absolutePosition; }
    get index()    { return this._index; }

    reset() {
        this._isDead      = false;
        this._isDucking   = false;
        this._isShielded  = false;
        this._velocityY   = 0;
        this._jumpCount   = 0;
        this._root.position.set(this._laneX, CFG.GROUND_Y, 0);
        this._root.rotation.setAll(0);
        this._root.scaling.setAll(1);
        this.deactivateShield();
    }

    dispose() {
        this._subs.forEach(unsub => unsub());
        Object.values(this._meshes).forEach(m => m.dispose());
        if (this._shieldMesh) this._shieldMesh.dispose();
        if (this._root) this._root.dispose();
    }
}
