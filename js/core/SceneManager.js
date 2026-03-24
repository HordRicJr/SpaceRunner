/**
 * SceneManager.js
 * Creates and manages the main Babylon.js Scene, camera, and base lighting.
 * The scene is shared across all game modules via this singleton.
 */
export class SceneManager {
    constructor() {
        if (SceneManager._instance) {
            return SceneManager._instance;
        }
        SceneManager._instance = this;

        this._scene    = null;
        this._camera   = null;
        this._ambientLight = null;
        this._sunLight     = null;
    }

    static getInstance() {
        if (!SceneManager._instance) {
            new SceneManager();
        }
        return SceneManager._instance;
    }

    /**
     * Build the scene from the given Babylon.js engine.
     * @param {BABYLON.Engine} babylonEngine
     */
    create(babylonEngine) {
        this._scene = new BABYLON.Scene(babylonEngine);
        this._scene.clearColor = new BABYLON.Color4(0.0, 0.008, 0.025, 1);
        this._scene.fogMode    = BABYLON.Scene.FOGMODE_NONE;

        // Gravity for potential physics (not applied by default)
        this._scene.gravity = new BABYLON.Vector3(0, -20, 0);

        this._setupCamera();
        this._setupLights();

        return this._scene;
    }

    _setupCamera() {
        // Side-scrolling perspective camera with a slight upward tilt
        this._camera = new BABYLON.FreeCamera(
            'mainCamera',
            new BABYLON.Vector3(0, 5, -18),
            this._scene
        );
        this._camera.setTarget(new BABYLON.Vector3(0, 2, 20));
        this._camera.fov   = 1.1;
        this._camera.minZ  = 0.1;
        this._camera.maxZ  = 1400;

        // Prevent user from moving camera
        this._camera.inputs.clear();
    }

    _setupLights() {
        // Ambient hemisphere light — sky (cool blue) / ground (dark)
        this._ambientLight = new BABYLON.HemisphericLight(
            'ambientLight',
            new BABYLON.Vector3(0, 1, 0),
            this._scene
        );
        this._ambientLight.diffuse       = new BABYLON.Color3(0.15, 0.25, 0.55);
        this._ambientLight.groundColor   = new BABYLON.Color3(0.02, 0.02, 0.08);
        this._ambientLight.specular      = new BABYLON.Color3(0, 0, 0);
        this._ambientLight.intensity     = 0.7;

        // Main sun/directional light for shadows
        this._sunLight = new BABYLON.DirectionalLight(
            'sunLight',
            new BABYLON.Vector3(-0.3, -1, 0.5),
            this._scene
        );
        this._sunLight.diffuse   = new BABYLON.Color3(0.6, 0.7, 1.0);
        this._sunLight.specular  = new BABYLON.Color3(0.3, 0.4, 0.8);
        this._sunLight.intensity = 1.2;
        this._sunLight.position  = new BABYLON.Vector3(10, 40, -20);

        // Accent fill light from below (rim lighting)
        const fillLight = new BABYLON.PointLight(
            'fillLight',
            new BABYLON.Vector3(0, -2, 0),
            this._scene
        );
        fillLight.diffuse    = new BABYLON.Color3(0.0, 0.4, 0.6);
        fillLight.intensity  = 0.4;
        fillLight.range      = 40;
    }

    /**
     * Smoothly transition the sky color (day/night cycle).
     * @param {BABYLON.Color4} targetColor
     * @param {number} durationSeconds
     */
    transitionSkyColor(targetColor, durationSeconds) {
        const start = this._scene.clearColor.clone();
        let elapsed = 0;
        const obs = this._scene.onBeforeRenderObservable.add(() => {
            elapsed += this._scene.getEngine().getDeltaTime() / 1000;
            const t = Math.min(elapsed / durationSeconds, 1);
            this._scene.clearColor = BABYLON.Color4.Lerp(start, targetColor, t);
            if (t >= 1) {
                this._scene.onBeforeRenderObservable.remove(obs);
            }
        });
    }

    get scene()      { return this._scene; }
    get camera()     { return this._camera; }
    get sunLight()   { return this._sunLight; }
    get ambientLight(){ return this._ambientLight; }

    dispose() {
        if (this._scene) {
            this._scene.dispose();
            this._scene = null;
        }
        SceneManager._instance = null;
    }
}

SceneManager._instance = null;
