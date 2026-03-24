/**
 * PostProcessing.js
 * Sets up Bloom and GlowLayer on the scene for cinematic visual effects.
 */

export class PostProcessing {
    /**
     * @param {BABYLON.Scene}  scene
     * @param {BABYLON.Camera} camera
     */
    constructor(scene, camera) {
        this._scene  = scene;
        this._camera = camera;

        this._glowLayer  = null;
        this._pipeline   = null;

        this._build();
    }

    _build() {
        // GlowLayer — makes emissive surfaces bleed light
        this._glowLayer = new BABYLON.GlowLayer('glowLayer', this._scene, {
            mainTextureFixedSize: 512,
            blurKernelSize:       64
        });
        this._glowLayer.intensity = 0.9;

        // Rendering pipeline for bloom-like HDR
        try {
            this._pipeline = new BABYLON.DefaultRenderingPipeline(
                'pipeline', true, this._scene, [this._camera]
            );
            this._pipeline.bloomEnabled     = true;
            this._pipeline.bloomThreshold   = 0.5;
            this._pipeline.bloomWeight      = 0.5;
            this._pipeline.bloomKernel      = 64;
            this._pipeline.bloomScale       = 0.6;

            this._pipeline.chromaticAberrationEnabled = true;
            this._pipeline.chromaticAberration.aberrationAmount = 1.5;

            this._pipeline.grainEnabled       = true;
            this._pipeline.grain.intensity    = 6;
            this._pipeline.grain.animated     = true;

            this._pipeline.fxaaEnabled = true;

            // Vignette for cinematic space feel
            this._pipeline.imageProcessingEnabled = true;
            this._pipeline.imageProcessing.vignetteEnabled   = true;
            this._pipeline.imageProcessing.vignetteWeight    = 3.5;
            this._pipeline.imageProcessing.vignetteCameraFov = 0.5;
            this._pipeline.imageProcessing.vignetteBlendMode =
                BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
        } catch (e) {
            // DefaultRenderingPipeline may not be available in all Babylon builds
            console.warn('PostProcessing pipeline unavailable:', e.message);
        }
    }

    get glowLayer() { return this._glowLayer; }

    /**
     * Animate bloom intensity for impact flash effect.
     * @param {number} targetIntensity
     * @param {number} durationMs
     */
    bloomFlash(targetIntensity, durationMs) {
        if (!this._pipeline || !this._pipeline.bloomEnabled) return;
        const original = this._pipeline.bloomWeight;
        this._pipeline.bloomWeight = targetIntensity;
        setTimeout(() => {
            this._pipeline.bloomWeight = original;
        }, durationMs);
    }

    dispose() {
        if (this._glowLayer)  this._glowLayer.dispose();
        if (this._pipeline)   this._pipeline.dispose();
    }
}
