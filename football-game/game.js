const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const ballsDisplay = document.getElementById('balls');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');
const finalLevelDisplay = document.getElementById('finalLevel');

// Audio manager
class AudioManager {
    constructor() {
        this.sounds = {};
        this.audioContext = null;
    }

    loadSound(name, filePath) {
        const audio = new Audio(filePath);
        audio.crossOrigin = 'anonymous';

        audio.addEventListener('canplaythrough', () => {
            console.log(`✓ Sound loaded successfully: ${name} (${filePath})`);
        }, { once: true });

        audio.addEventListener('loadstart', () => {
            console.log(`Loading sound: ${name} from ${filePath}`);
        }, { once: true });

        audio.addEventListener('error', (e) => {
            const errorTypes = {
                1: 'MEDIA_ERR_ABORTED',
                2: 'MEDIA_ERR_NETWORK',
                3: 'MEDIA_ERR_DECODE',
                4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
            };
            const errorType = errorTypes[audio.error?.code] || 'UNKNOWN';
            console.warn(`✗ Failed to load sound: ${name}`);
            console.warn(`  File: ${filePath}`);
            console.warn(`  Error code: ${errorType}`);
            console.warn(`  → Check that the file exists and path is correct`);
        });

        audio.src = filePath;
        audio.load();
        this.sounds[name] = audio;
    }

    play(name) {
        if (this.sounds[name]) {
            try {
                const sound = this.sounds[name];
                // Reset and play
                sound.currentTime = 0;
                sound.volume = 0.3;
                const playPromise = sound.play();
                if (playPromise !== undefined) {
                    playPromise.catch((err) => {
                        console.warn(`Could not play sound: ${name}`, err.message);
                    });
                }
            } catch (e) {
                console.warn(`Error playing sound: ${name}`, e.message);
            }
        }
    }


    // Procedural sounds using Web Audio API
    playBeep(frequency = 800, duration = 100) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioContext;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = frequency;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration / 1000);
        } catch (e) {}
    }

    playSwoosh() {
        this.playBeep(300, 100);
    }

    playBlast() {
        this.playBeep(200, 150);
    }

    playChime() {
        this.playBeep(800, 200);
    }
}

const audioManager = new AudioManager();

// Particle system
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 2;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
        this.size = Math.random() * 4 + 2;
        this.color = ['#FF3333', '#FF6B35', '#FFD700', '#FF88CC'][Math.floor(Math.random() * 4)];
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isAlive() {
        return this.life > 0;
    }
}

// Game variables
let score = 0;
let balls = 10;
let targetsCaughtThisLevel = 0;
let targetsNeededToLevelUp = 5;
let currentLevel = 0;
let gameActive = true;
let football = null;
let targets = [];
let particles = [];
let lastVelocity = { x: 0, y: 0 };
let mousePos = { x: 0, y: 0 };
let lastMouseMovePos = { x: 0, y: 0 };
let isMouseDown = false;
let lastMousePos = { x: 0, y: 0 };
let releaseGate = canvas.width / 4; // Left boundary at 1/4 from left
let lastLevelShown = -1;

// Football class
class Football {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 8;
        this.isHeld = false;
        this.isThrown = false;
        this.gravity = 0.3;
        this.damping = 0.985;
    }

    update() {
        if (this.isHeld) {
            this.x = mousePos.x;
            this.y = mousePos.y;
            this.vx = 0;
            this.vy = 0;
        } else if (this.isThrown) {
            this.vy += this.gravity;
            this.x += this.vx;
            this.y += this.vy;

            // Apply damping
            this.vx *= this.damping;
            this.vy *= this.damping;

            // Bounce off walls
            if (this.x - this.radius < 0) {
                this.x = this.radius;
                this.vx = Math.abs(this.vx) * 0.7;
            }
            if (this.x + this.radius > canvas.width) {
                this.x = canvas.width - this.radius;
                this.vx = -Math.abs(this.vx) * 0.7;
            }
            if (this.y - this.radius < 0) {
                this.y = this.radius;
                this.vy = Math.abs(this.vy) * 0.7;
            }
        }
    }

    draw() {
        // Football shape
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.isThrown) {
            const angle = Math.atan2(this.vy, this.vx);
            ctx.rotate(angle);
        }

        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 2.5, this.radius * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Laces
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(this.radius, 0);
        ctx.stroke();

        ctx.restore();

        // Highlight when held
        if (this.isHeld) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    reset() {
        this.x = 100;
        this.y = canvas.height - 100;
        this.vx = 0;
        this.vy = 0;
        this.isHeld = false;
        this.isThrown = false;
    }
}

// Target class
class Target {
    constructor(level) {
        this.level = level;

        // Playable area: from release gate to right edge
        const playableLeft = releaseGate + 40;
        const playableRight = canvas.width - 40;
        const playableWidth = playableRight - playableLeft;

        // Position progression: start near center of playable area, move right as difficulty increases
        if (level < 2) {
            this.baseX = playableLeft + playableWidth * 0.3;
        } else if (level < 4) {
            this.baseX = playableLeft + playableWidth * 0.5;
        } else if (level < 6) {
            this.baseX = playableLeft + playableWidth * 0.7;
        } else {
            this.baseX = playableLeft + playableWidth * 0.85;
        }

        this.x = this.baseX;
        this.y = Math.random() * (canvas.height - 60) + 30;
        this.baseY = this.y;

        // Size progression: large -> small
        if (level < 2) {
            this.radius = 30;
        } else if (level < 4) {
            this.radius = 26;
        } else if (level < 6) {
            this.radius = 22;
        } else {
            this.radius = Math.max(18 - ((level - 6) * 0.5), 6);
        }

        // Speed progression: slow -> fast
        if (level < 2) {
            this.speed = 1.0;
        } else if (level < 4) {
            this.speed = 1.5;
        } else if (level < 6) {
            this.speed = 1.8;
        } else {
            this.speed = 2.0 + (level - 6) * 0.2;
        }

        this.time = 0;
        this.patternIndex = Math.floor(Math.random() * this.getPatternCount(level));
        this.playableLeft = playableLeft;
        this.playableRight = playableRight;
        this.vx = 0;
        this.vy = 0;
        this.gravity = 0.25;
        this.dirX = 1; // Direction multiplier for horizontal reflection
        this.dirY = 1; // Direction multiplier for vertical reflection
    }

    getPatternCount(level) {
        if (level < 2) return 1; // Simple vertical only
        if (level < 4) return 2; // Add gentle circular
        if (level < 6) return 3; // Add figure-8
        return 4; // Add spiral and complex patterns
    }

    update() {
        this.time += this.speed * 0.01;

        const pattern = this.patternIndex;
        const oscillationAmount = this.radius + 10; // Safe oscillation range

        if (pattern === 0) {
            // Simple vertical oscillation (up and down)
            this.x = this.baseX;
            this.y = this.baseY + Math.sin(this.time * 0.3) * 100 * this.dirY;
        } else if (pattern === 1) {
            // Gentle circular or sinusoidal movement
            if (this.level < 4) {
                // Gentle sine wave for early levels
                const centerY = canvas.height / 2;
                this.y = centerY + Math.sin(this.time * 0.5) * 80 * this.dirY;
                this.x = this.baseX + Math.cos(this.time * 0.3) * 30 * this.dirX;
            } else {
                // Circular movement for mid levels
                const centerY = canvas.height / 2;
                const radius = 80;
                this.y = centerY + Math.sin(this.time) * radius * this.dirY;
                this.x = this.baseX + Math.cos(this.time * 0.8) * 40 * this.dirX;
            }
        } else if (pattern === 2) {
            // Figure-8 pattern with acceleration
            const centerY = canvas.height / 2;
            this.y = centerY + Math.sin(this.time) * 80 * this.dirY;
            this.x = this.baseX + Math.sin(this.time * 0.5) * oscillationAmount * this.dirX;

            // Add acceleration effect for higher levels
            if (this.level >= 6) {
                const speedMod = 1 + Math.sin(this.time * 0.3) * 0.5;
                this.time += this.speed * 0.005 * speedMod;
            }
        } else if (pattern === 3) {
            // Spiral with stop-start for high levels
            const centerY = canvas.height / 2;
            let radius = 40 + this.time * 1.5;

            // Stop-start pattern for highest levels
            if (this.level >= 8) {
                const stopStart = Math.sin(this.time * 0.2);
                if (Math.abs(stopStart) < 0.3) {
                    radius = 40 + (this.time - 30) * 1.5;
                }
            }

            this.y = centerY + Math.sin(this.time) * Math.min(radius, 100) * this.dirY;
            this.x = this.baseX + Math.cos(this.time) * Math.min(radius * 0.4, 50) * this.dirX;
            if (radius > 150) {
                this.time = 0;
            }
        }

        // Keep in bounds within playable area with smooth reflection
        if (this.x - this.radius < this.playableLeft) {
            const overshoot = this.playableLeft - (this.x - this.radius);
            this.x = this.playableLeft + this.radius + overshoot;
            this.dirX *= -1;
        }
        if (this.x + this.radius > this.playableRight) {
            const overshoot = (this.x + this.radius) - this.playableRight;
            this.x = this.playableRight - this.radius - overshoot;
            this.dirX *= -1;
        }

        // Keep y in bounds with smooth reflection
        if (this.y - this.radius < 0) {
            const overshoot = this.radius - this.y;
            this.y = this.radius + overshoot;
            this.dirY *= -1;
        }
        if (this.y + this.radius > canvas.height) {
            const overshoot = (this.y + this.radius) - canvas.height;
            this.y = canvas.height - this.radius - overshoot;
            this.dirY *= -1;
        }
    }

    draw() {
        ctx.fillStyle = '#FF3333';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Target rings
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#FF3333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.3, 0, Math.PI * 2);
        ctx.stroke();
    }

    checkCatch(ball) {
        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < ball.radius + this.radius;
    }
}

// Mouse events
document.addEventListener('mousedown', (e) => {
    if (!gameActive) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - football.x;
    const dy = y - football.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < football.radius + 20) {
        football.isHeld = true;
        isMouseDown = true;
        lastMousePos = { x, y };
        lastMouseMovePos = { x, y };
        lastVelocity = { x: 0, y: 0 };
    }
});

document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    // Calculate continuous velocity for smooth throwing
    if (isMouseDown && football.isHeld) {
        lastVelocity.x = (mousePos.x - lastMouseMovePos.x) * 0.2;
        lastVelocity.y = (mousePos.y - lastMouseMovePos.y) * 0.2;

        // Force release if cursor crosses left boundary
        if (mousePos.x > releaseGate) {
            football.isHeld = false;
            football.isThrown = true;
            football.vx = lastVelocity.x;
            football.vy = lastVelocity.y;
            isMouseDown = false;
            audioManager.playSwoosh();
        }
    }

    lastMouseMovePos = { ...mousePos };
});

document.addEventListener('mouseup', (e) => {
    if (!gameActive) return;

    if (football.isHeld) {
        // Use accumulated velocity from mousemove tracking
        football.isHeld = false;
        football.isThrown = true;
        football.vx = lastVelocity.x;
        football.vy = lastVelocity.y;
        isMouseDown = false;
        audioManager.playSwoosh();
    }
});

// Initialize game
function init() {
    football = new Football(100, canvas.height - 100);
    targets = [];
    createTarget();
    score = 0;
    balls = 10;
    targetsCaughtThisLevel = 0;
    currentLevel = 0;
    gameActive = true;
    gameOverScreen.style.display = 'none';
    scoreDisplay.textContent = `Score: 0`;
    levelDisplay.textContent = `Level: 0`;
    ballsDisplay.textContent = `Balls: 10`;
}

function createTarget() {
    const level = Math.floor(score / 5); // Increase difficulty every 5 catches
    targets.push(new Target(level));
}

// Screen navigation functions
function startGame() {
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    init();
    gameLoop();
}

function showCredits() {
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('creditsScreen').style.display = 'flex';
}

function hideCredits() {
    document.getElementById('creditsScreen').style.display = 'none';
    document.getElementById('titleScreen').style.display = 'flex';
}

function goToMainMenu() {
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('titleScreen').style.display = 'flex';
    gameActive = false;
}

function restartLevel() {
    gameOverScreen.style.display = 'none';
    gameActive = true;
    init();
    gameLoop();
}

// Game loop
function gameLoop() {
    // Clear canvas with field background
    ctx.fillStyle = '#2D5016';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw football field yard lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += canvas.width / 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }

    // Draw yard numbers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    for (let i = canvas.width / 10; i < canvas.width-1; i += canvas.width / 10) {
        ctx.fillText(Math.floor((i / 100))*10 % 100, i, canvas.height / 2 + 15);
    }

    // Draw left release gate boundary
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 8]);
    ctx.beginPath();
    ctx.moveTo(releaseGate, 0);
    ctx.lineTo(releaseGate, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Update and draw football
    football.update();
    football.draw();

    // Update and draw targets
    for (let i = targets.length - 1; i >= 0; i--) {
        targets[i].update();
        targets[i].draw();

        // Check collision with football
        if (football.isThrown && targets[i].checkCatch(football)) {
            score++;
            targetsCaughtThisLevel++;

            // Create confetti explosion
            for (let p = 0; p < 12; p++) {
                particles.push(new Particle(targets[i].x, targets[i].y));
            }

            audioManager.playBlast();

            scoreDisplay.textContent = `Score: ${score}`;
            targets.splice(i, 1);
            football.reset();

            // Check if level completed
            if (targetsCaughtThisLevel >= targetsNeededToLevelUp) {
                // Level up!
                currentLevel++;
                targetsCaughtThisLevel = 0;
                balls = 10;
                ballsDisplay.textContent = `Balls: ${balls}`;
                levelDisplay.textContent = `Level: ${currentLevel}`;
                audioManager.playChime();
            }

            createTarget();
        }
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);

        if (!particles[i].isAlive()) {
            particles.splice(i, 1);
        }
    }

    // Check if player missed (ball fell off screen)
    if (football.y > canvas.height + 50 && !football.isHeld && football.isThrown) {
        balls--;
        ballsDisplay.textContent = `Balls: ${balls}`;
        football.reset();
        football.isThrown = false;

        // Check if out of balls
        if (balls <= 0) {
            gameActive = false;
            gameOverScreen.style.display = 'block';
            finalScoreDisplay.textContent = `Final Score: ${score}`;
            finalLevelDisplay.textContent = `Level Reached: ${currentLevel}`;
        }
    }

    if (gameActive) {
        requestAnimationFrame(gameLoop);
    }
}
