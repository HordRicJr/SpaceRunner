/**
 * Obstacle.js
 * Styles and manages the visual representation of obstacle meshes
 * spawned by Spawner.js. Also handles AABB collision detection.
 *
 * Obstacle kinds: 'asteroid' | 'satellite' | 'debris'
 */
import { GameState } from '../game/GameState.js';

export class ObstacleManager {
    /**
     * @param {BABYLON.Scene} scene
     * @param {Spawner}        spawner
     */
    constructor(scene, spawner) {
        this._scene   = scene;
        this._spawner = spawner;
        this._state   = GameState.getInstance();

        this._materials = this._buildMaterials();

        this._state.on('spawner:obstacle', ({ mesh, kind }) => {
            this._styleObstacle(mesh, kind);
        });
    }

    _buildMaterials() {
        const asteroid = new BABYLON.StandardMaterial('mat_asteroid', this._scene);
        asteroid.diffuseColor  = new BABYLON.Color3(0.35, 0.28, 0.22);
        asteroid.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        asteroid.specularPower = 4;

        const satellite = new BABYLON.StandardMaterial('mat_satellite', this._scene);
        satellite.diffuseColor  = new BABYLON.Color3(0.5, 0.55, 0.65);
        satellite.specularColor = new BABYLON.Color3(0.5, 0.5, 0.6);
        satellite.specularPower = 40;

        const debris = new BABYLON.StandardMaterial('mat_debris', this._scene);
        debris.diffuseColor  = new BABYLON.Color3(0.15, 0.4, 0.65);
        debris.emissiveColor = new BABYLON.Color3(0, 0.1, 0.3);
        debris.specularColor = new BABYLON.Color3(0.3, 0.5, 0.8);
        debris.specularPower = 80;

        return { asteroid, satellite, debris };
    }

    _styleObstacle(mesh, kind) {
        switch (kind) {
            case 'asteroid':
                this._makeAsteroid(mesh);
                break;
            case 'satellite':
                this._makeSatellite(mesh);
                break;
            case 'debris':
                this._makeDebris(mesh);
                break;
        }
    }

    _makeAsteroid(mesh) {
        // Style the existing pool mesh — never dispose pooled meshes
        const scale = 0.9 + Math.random() * 0.5;
        mesh.scaling.setAll(scale);
        const mat = this._materials.asteroid.clone('mat_ast_' + mesh.metadata.poolIndex);
        mat.diffuseColor = new BABYLON.Color3(
            0.28 + Math.random() * 0.15,
            0.22 + Math.random() * 0.1,
            0.15 + Math.random() * 0.1
        );
        mesh.material        = mat;
        mesh.receiveShadows  = true;
    }

    _makeSatellite(mesh) {
        // Central box body
        mesh.scaling.set(1.1, 0.4, 0.6);
        mesh.material = this._materials.satellite.clone('mat_sat_inst');

        // Solar panels (two thin boxes on sides)
        const panelMat = new BABYLON.StandardMaterial('panelMat', this._scene);
        panelMat.diffuseColor  = new BABYLON.Color3(0.1, 0.15, 0.4);
        panelMat.emissiveColor = new BABYLON.Color3(0, 0.05, 0.2);

        [-1, 1].forEach((side, i) => {
            const panel = BABYLON.MeshBuilder.CreateBox(`panel_${mesh.name}_${i}`, {
                width: 0.12, height: 0.6, depth: 1.0
            }, this._scene);
            panel.parent   = mesh;
            panel.position.x = side * 1.1;
            panel.material = panelMat;
        });
    }

    _makeDebris(mesh) {
        mesh.scaling.set(0.4, 1.6, 0.4);
        mesh.material = this._materials.debris.clone('mat_deb_inst');

        // Glowing core
        const glow = BABYLON.MeshBuilder.CreateSphere(`glow_${mesh.name}`, {
            diameter: 0.3
        }, this._scene);
        glow.parent   = mesh;
        const gmat    = new BABYLON.StandardMaterial(`gmat_${mesh.name}`, this._scene);
        gmat.emissiveColor = new BABYLON.Color3(0, 0.6, 1);
        glow.material = gmat;
    }

    /**
     * Test AABB overlap between an obstacle and a player.
     * @param {BABYLON.Mesh}   obsMesh
     * @param {Player}         player
     * @returns {boolean}
     */
    static checkCollision(obsMesh, player) {
        const pBounds = player.getBounds();
        const oPos    = obsMesh.absolutePosition;
        const oInfo   = obsMesh.getBoundingInfo();
        const oMin    = oInfo.boundingBox.minimumWorld;
        const oMax    = oInfo.boundingBox.maximumWorld;

        return (
            pBounds.min.x < oMax.x && pBounds.max.x > oMin.x &&
            pBounds.min.y < oMax.y && pBounds.max.y > oMin.y &&
            pBounds.min.z < oMax.z && pBounds.max.z > oMin.z
        );
    }
}
