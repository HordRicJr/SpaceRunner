/**
 * main.js — Bootstrap entry point
 * Initializes all modules, wires events, runs the game loop.
 */
import { Engine }          from './core/Engine.js';
import { SceneManager }    from './core/SceneManager.js';
import { InputManager }    from './core/InputManager.js';
import { GameState, STATE } from './game/GameState.js';
import { GameLoop }        from './game/GameLoop.js';
import { Scorer }          from './game/Scorer.js';
import { Spawner }         from './game/Spawner.js';
import { Environment }     from './entities/Environment.js';
import { Player }          from './entities/Player.js';
import { ObstacleManager } from './entities/Obstacle.js';
import { PowerUpManager }  from './entities/PowerUp.js';
import { ParticleManager } from './effects/ParticleManager.js';
import { PostProcessing }  from './effects/PostProcessing.js';
import { WeatherSystem }   from './effects/WeatherSystem.js';
import { AudioManager }    from './audio/AudioManager.js';
import { UIManager }       from './ui/UIManager.js';

// ---- Singletons ----
const gs    = GameState.getInstance();
const input = InputManager.getInstance();

// ---- Module references (populated after init) ----
let engine, sceneManager, scene;
let gameLoop, scorer, spawner;
let environment;
let players    = [];
let obstacles, powerUps;
let particles, postFX, weather;
let audio;
let ui;
let isMulti     = false;
let gameStarted = false;
let _paused     = false;
let currentGameMode      = 'classic';
let timeAttackRemaining  = 0;
const TIME_ATTACK_SECS   = 90;

// ---- Init sequence ----
async function init() {
    gs.transition(STATE.LOADING);

    audio = new AudioManager();

    // UI needs audio for mute button
    ui = new UIManager(audio);
    ui.updateLoading(10, 'Initializing engine...');

    const canvas = document.getElementById('renderCanvas');
    engine       = Engine.getInstance();
    engine.init(canvas);

    ui.updateLoading(25, 'Building scene...');
    sceneManager = SceneManager.getInstance();
    scene        = sceneManager.create(engine.raw);

    ui.updateLoading(40, 'Loading environment...');
    environment  = new Environment(scene);

    ui.updateLoading(55, 'Preparing game systems...');
    gameLoop     = new GameLoop();
    gameLoop.attach(scene);
    scorer       = new Scorer();
    spawner      = new Spawner(scene);

    ui.updateLoading(70, 'Building obstacle pool...');
    obstacles = new ObstacleManager(scene);
    // PowerUpManager needs spawner reference — created after spawner is ready
    powerUps  = new PowerUpManager(scene, spawner);

    ui.updateLoading(80, 'Setting up effects...');
    particles = new ParticleManager(scene);
    postFX    = new PostProcessing(scene);
    weather   = new WeatherSystem(scene, sceneManager, environment);

    ui.updateLoading(90, 'Wiring input...');
    input.attach(canvas);

    // Wire pause toggle
    input.on('PAUSE', () => {
        if (gs.current === STATE.PLAYING) {
            _paused = true;
            gs.transition(STATE.PAUSED);
        } else if (gs.current === STATE.PAUSED) {
            _paused = false;
            gs.transition(STATE.PLAYING);
        }
    });

    ui.updateLoading(100, 'Ready!');

    // Wire UI button actions
    gs.on('ui:start',  onUIStart);
    gs.on('ui:resume', onUIResume);
    gs.on('ui:retry',  onUIRetry);
    gs.on('ui:quit',   onUIQuit);
    gs.on('ui:menu',   onUIMenu);

    // Wire game tick for collision + collection
    gs.on('game:tick', onGameTick);

    // Wire scorer highscore update in hud
    gs.on('score:update', ({ score, player }) => {
        if (player === 0) {
            ui.updateBest(scorer.highscore);
        }
    });

    // Wire powerup collected audio
    gs.on('powerup:collected', ({ kind }) => {
        audio.play('collect');
    });

    // Wire player dead
    gs.on('player:dead', onPlayerDead);

    // Transition to menu after short delay
    setTimeout(() => gs.transition(STATE.MENU), 600);

    // Start render loop
    engine.startRenderLoop(() => scene.render());
}

// ---- Game flow ----

function onUIStart({ mode, chars, gameMode }) {
    isMulti = (mode === 'multi');
    currentGameMode = gameMode || 'classic';
    startGame(chars);
}

const CHAR_TYPES = ['astronaut', 'alien', 'robot'];

function startGame(charIndices) {
    // Clean up previous session
    destroyPlayers();
    spawner.reset();

    const char0 = CHAR_TYPES[charIndices[0]] || 'astronaut';
    const char1 = CHAR_TYPES[charIndices[1]] || 'astronaut';

    // Mode-specific configuration
    const isHardcore    = currentGameMode === 'hardcore';
    const isTimeAttack  = currentGameMode === 'timeattack';
    const loopOpts      = isHardcore
        ? { initialSpeed: 16, speedMult: 2.2 }
        : {};
    const playerOpts    = isHardcore ? { maxJumps: 1 } : {};

    // Create players
    if (isMulti) {
        players = [
            new Player(scene, input, 0, char0, true, playerOpts),
            new Player(scene, input, 1, char1, true, playerOpts)
        ];
    } else {
        players = [new Player(scene, input, 0, char0, false, playerOpts)];
    }

    // Init particle trails
    particles.registerPlayers(players);

    // Scorer reset
    scorer.reset();
    scorer.setMultiplayer(isMulti);

    // GameLoop reset with mode opts
    gameLoop.reset(loopOpts);
    _paused     = false;
    gameStarted = true;

    // Time Attack: init countdown
    if (isTimeAttack) {
        timeAttackRemaining = TIME_ATTACK_SECS;
        ui.showTimer(TIME_ATTACK_SECS);
    } else {
        ui.hideTimer();
    }

    gs.transition(STATE.PLAYING);
    audio.unlock();
    audio.startMusic();
}

function onUIResume() {
    if (gs.current === STATE.PAUSED) {
        _paused = false;
        gs.transition(STATE.PLAYING);
    }
}

function onUIRetry() {
    const chars = ui.selectedChars;
    startGame(chars);
}

function onUIQuit() {
    gameStarted = false;
    spawner.reset();
    gs.transition(STATE.MENU);
}

function onUIMenu() {
    spawner.reset();
    destroyPlayers();
    gameStarted = false;
    gs.transition(STATE.MENU);
}

// ---- Per-tick logic ----

function onGameTick({ dt, speed }) {
    if (!gameStarted || _paused) return;

    // Time Attack countdown
    if (currentGameMode === 'timeattack') {
        timeAttackRemaining -= dt;
        ui.updateTimer(timeAttackRemaining);
        if (timeAttackRemaining <= 0) {
            triggerGameOver();
            return;
        }
    }

    // Collision check (skipped in Zen mode)
    // NOTE: obstacle movement is handled by Spawner._moveActives().
    if (currentGameMode !== 'zen') {
        const active = spawner.activeObstacles.slice();
        for (let i = 0; i < active.length; i++) {
            const obs = active[i];
            for (const player of players) {
                if (player.isDead) continue;
                if (ObstacleManager.checkCollision(obs, player)) {
                    handlePlayerHit(player, obs);
                    spawner.removeActive(obs);
                    break;
                }
            }
        }
    }

    // Power-up collection
    powerUps.checkCollections(players, gameLoop, scorer);

    // Check if all players are dead
    if (gameStarted && players.length > 0 && players.every(p => p.isDead)) {
        triggerGameOver();
    }
}

function handlePlayerHit(player, obsMesh) {
    const idx  = player._index;
    const died = player.onHit();

    particles.spawnImpactSparks(player.position);
    postFX.bloomFlash(1.5, 250);
    scorer.onHit(idx);
    audio.play('hit');

    if (died) {
        // Player._die() already emits 'player:dead' via GameState;
        // explosion visual only
        particles._explodeAt(player.position.clone());
    }
}

function onPlayerDead({ playerIndex }) {
    // In solo mode, instant game over
    if (!isMulti) {
        triggerGameOver();
        return;
    }
    // In multi mode, wait for all players dead (handled in onGameTick)
}

function triggerGameOver() {
    if (gs.current === STATE.GAMEOVER) return;
    gameStarted = false;

    const scores  = [scorer.score, scorer.scoreP2];
    const isNewRecord = scorer.saveHighscore();
    let winner = -1;
    if (isMulti) {
        if      (scores[0] > scores[1]) winner = 0;
        else if (scores[1] > scores[0]) winner = 1;
    }

    ui.showGameOver({
        score: scores[0],
        best: scorer.highscore,
        isNewRecord,
        isMulti,
        scores,
        winner
    });

    gs.transition(STATE.GAMEOVER);
    audio.play('gameover');
}

// ---- Utilities ----

function destroyPlayers() {
    players.forEach(p => p.dispose());
    players = [];
}

// ---- Bootstrap ----
init().catch(err => {
    console.error('Initialization failed:', err);
});
