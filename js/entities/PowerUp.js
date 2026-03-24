/**
 * PowerUp.js
 * Styles and manages visual representation of power-up meshes.
 * Also handles collection detection and applies effects to players/scorer.
 *
 * Power-up kinds: 'shield' | 'slow' | 'multiplier'
 */
import { GameState } from '../game/GameState.js';

const POWERUP_CFG = {
    shield: {
        duration:   5,
        color:      new BABYLON.Color3(0, 0.8, 1.0),
        emissive:   new BABYLON.Color3(0, 0.4, 0.8),
        label:      'SHIELD'
    },
    slow: {
        duration:   4,
        speedFactor: 0.5,
        color:      new BABYLON.Color3(0.33, 0.78, 1.0),
        emissive:   new BABYLON.Color3(0.1, 0.3, 0.7),
        label:      'SLOW'
    },
    multiplier: {
        duration:   6,
        factor:     3,
        color:      new BABYLON.Color3(1.0, 0.85, 0.0),
        emissive:   new BABYLON.Color3(0.6, 0.4, 0.0),
        label:      'x3 SCORE'
    }
};

const COLLECT_RADIUS_SQ = 0.9; // squared distance threshold for collection

export class PowerUpManager {
    /**
     * @param {BABYLON.Scene} scene
     * @param {Spawner}        spawner
     */
    constructor(scene, spawner) {
        this._scene   = scene;
        this._spawner = spawner;
        this._state   = GameState.getInstance();

        this._glowLayer = null;

        this._state.on('spawner:powerup', ({ mesh, kind }) => {
            this._stylePowerup(mesh, kind);
        });
    }

    /**
     * Pass the GlowLayer from PostProcessing so power-ups integrate with it.
     * @param {BABYLON.GlowLayer} glowLayer
     */
    setGlowLayer(glowLayer) {
        this._glowLayer = glowLayer;
    }

    _stylePowerup(mesh, kind) {
        const cfg = POWERUP_CFG[kind] || POWERUP_CFG.shield;

        mesh.scaling.setAll(1);

        const mat = new BABYLON.StandardMaterial(`pumat_${mesh.name}`, this._scene);
        mat.diffuseColor  = cfg.color;
        mat.emissiveColor = cfg.emissive;
        mat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
        mat.specularPower = 64;
        mesh.material = mat;

        if (this._glowLayer) {
            this._glowLayer.addIncludedOnlyMesh(mesh);
        }

        // Outer ring halo
        const ring = BABYLON.MeshBuilder.CreateTorus(`puring_${mesh.name}`, {
            diameter: 1.4, thickness: 0.08, tessellation: 24
        }, this._scene);
        ring.parent   = mesh;
        ring.rotation.x = Math.PI / 2;
        const rmat = mat.clone(`puring_mat_${mesh.name}`);
        rmat.emissiveColor = cfg.emissive;
        ring.material = rmat;
        mesh.metadata.ringMesh = ring;
    }

    /**
     * Test proximity between player and all active power-ups.
     * Applies effect on collection.
     * @param {Player[]}  players
     * @param {GameLoop}  gameLoop
     * @param {Scorer}    scorer
     */
    checkCollections(players, gameLoop, scorer) {
        const activePUs = [...this._spawner.activePowerups];
        for (const pu of activePUs) {
            for (const player of players) {
                if (player.isDead) continue;
                const dist = BABYLON.Vector3.DistanceSquared(
                    pu.absolutePosition,
                    player.position
                );
                if (dist < COLLECT_RADIUS_SQ) {
                    this._collect(pu, player, gameLoop, scorer);
                }
            }
        }
    }

    _collect(puMesh, player, gameLoop, scorer) {
        const kind = puMesh.metadata.kind;
        const cfg  = POWERUP_CFG[kind];
        if (!cfg) return;

        // Remove from spawner immediately
        this._spawner.removeActive(puMesh);
        if (puMesh.metadata.ringMesh) puMesh.metadata.ringMesh.dispose();

        // Apply effect
        switch (kind) {
            case 'shield':
                player.activateShield(cfg.duration);
                break;
            case 'slow':
                gameLoop.applySpeedModifier(cfg.speedFactor, cfg.duration);
                break;
            case 'multiplier':
                scorer.applyMultiplierBoost(player.index, cfg.factor, cfg.duration);
                break;
        }

        this._state.emit('powerup:collected', {
            kind,
            duration: cfg.duration,
            player:   player.index,
            label:    cfg.label
        });
    }

    dispose() {
        // Managed by Spawner dispose
    }
}
