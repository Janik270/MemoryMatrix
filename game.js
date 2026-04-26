document.addEventListener("DOMContentLoaded", () => {
    // === UI Elements ===
    const matrixContainer = document.getElementById('led-matrix');
    const encoderBtn = document.getElementById('encoder-button');
    const upBtn = document.getElementById('encoder-up');
    const downBtn = document.getElementById('encoder-down');

    // Create 64 LEDs
    const leds = [];
    for (let i = 0; i < 64; i++) {
        const led = document.createElement('div');
        led.className = 'led';
        matrixContainer.appendChild(led);
        leds.push(led);
    }

    // === GAME LOGIC ===
    const BASE_PALETTE = [
        [255, 0, 0],     // Red
        [0, 255, 0],     // Green
        [0, 0, 255],     // Blue
        [255, 255, 0],   // Yellow
        [255, 0, 255],   // Magenta
        [0, 255, 255],   // Cyan
        [255, 128, 0],   // Orange
        [128, 0, 255],   // Purple
    ];

    let gameState = "IDLE";
    let targetColor = [0, 0, 0];
    let playerColor = [0, 0, 0];
    let playerCoarseIdx = 0;
    let fineChannel = 0; // 0=R, 1=G, 2=B
    let memoryStart = 0;
    let memoryTime = 3.0; // Seconds
    let rating = 0;

    let deltaQueue = 0;
    let btnPressed = false;

    // Helpers
    function setPx(x, y, color) {
        if (x >= 0 && x < 8 && y >= 0 && y < 8) {
            const index = y * 8 + x;
            const r = Math.min(255, Math.max(0, color[0]));
            const g = Math.min(255, Math.max(0, color[1]));
            const b = Math.min(255, Math.max(0, color[2]));
            
            // Apply color and glow
            if (r > 0 || g > 0 || b > 0) {
                leds[index].style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                leds[index].style.boxShadow = `0 0 8px rgb(${r}, ${g}, ${b}), inset 0 0 2px rgba(0,0,0,0.5)`;
            } else {
                leds[index].style.backgroundColor = '#111';
                leds[index].style.boxShadow = 'inset 0 0 2px rgba(0,0,0,0.5)';
            }
        }
    }

    function clear() {
        for (let i = 0; i < 64; i++) {
            leds[i].style.backgroundColor = '#111';
            leds[i].style.boxShadow = 'inset 0 0 2px rgba(0,0,0,0.5)';
        }
    }

    function drawRect(x1, y1, x2, y2, color) {
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                setPx(x, y, color);
            }
        }
    }

    function colorDistance(c1, c2) {
        let sum = 0;
        for (let i = 0; i < 3; i++) {
            sum += Math.pow(c1[i] - c2[i], 2);
        }
        return Math.sqrt(sum);
    }

    function calculateRating(dist) {
        const maxDist = 442.0;
        let score = Math.floor(8 * (1 - (dist / maxDist)));
        return Math.max(1, Math.min(8, score));
    }

    function clamp(v) {
        return Math.max(0, Math.min(255, Math.floor(v)));
    }

    // Input Simulation
    function onEncoderTurn(delta) {
        deltaQueue += delta;
    }

    function onBtnPress() {
        btnPressed = true;
    }

    // Event Listeners for UI
    encoderBtn.addEventListener('mousedown', onBtnPress);
    
    // Support mouse wheel over the rotary area or screen
    document.querySelector('.simulator-container').addEventListener('wheel', (e) => {
        // Debounce slightly to make selection easier
        if (e.deltaY < 0) onEncoderTurn(-1);
        else if (e.deltaY > 0) onEncoderTurn(1);
        e.preventDefault();
    }, { passive: false });

    upBtn.addEventListener('mousedown', () => onEncoderTurn(-1));
    downBtn.addEventListener('mousedown', () => onEncoderTurn(1));

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') onEncoderTurn(-1);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') onEncoderTurn(1);
        if (e.key === 'Enter' || e.key === ' ') onBtnPress();
    });

    // Game Loop
    let startTimestamp = null;

    function gameLoop(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const now = (timestamp - startTimestamp) / 1000; // time in seconds

        let delta = deltaQueue;
        deltaQueue = 0;
        let btn = btnPressed;
        btnPressed = false;

        clear();

        // --- IDLE ---
        if (gameState === "IDLE") {
            const brightness = (Math.sin(now * 3) + 1) / 2 * 30 + 5;
            for (let x = 2; x < 6; x++) {
                for (let y = 2; y < 6; y++) {
                    setPx(x, y, [brightness, brightness, brightness]);
                }
            }

            if (btn) {
                targetColor = BASE_PALETTE[Math.floor(Math.random() * BASE_PALETTE.length)];
                gameState = "MEMORY";
                memoryStart = now;
            }
        }
        
        // --- MEMORY ---
        else if (gameState === "MEMORY") {
            const elapsed = now - memoryStart;
            if (elapsed >= memoryTime) {
                gameState = "COARSE";
                playerCoarseIdx = 0;
            } else {
                drawRect(0, 0, 7, 7, targetColor);
            }
        }

        // --- COARSE ---
        else if (gameState === "COARSE") {
            if (delta) {
                // Determine step sign
                const step = delta > 0 ? 1 : -1;
                playerCoarseIdx = (playerCoarseIdx + step) % BASE_PALETTE.length;
                if (playerCoarseIdx < 0) playerCoarseIdx += BASE_PALETTE.length;
            }

            const candidate = BASE_PALETTE[playerCoarseIdx];

            for (let i = 0; i < BASE_PALETTE.length; i++) {
                let dotColor = [...BASE_PALETTE[i]];
                if (i === playerCoarseIdx) {
                    const s = (Math.sin(now * 10) + 1) / 2;
                    dotColor = dotColor.map(c => c * (0.5 + 0.5 * s));
                }
                setPx(i, 0, dotColor);
            }

            drawRect(0, 2, 7, 7, candidate);

            if (btn) {
                playerColor = [...candidate];
                gameState = "FINE";
                fineChannel = 0;
            }
        }

        // --- FINE ---
        else if (gameState === "FINE") {
            if (delta) {
                // Make wheel scroll a bit smoother, map 1 wheel tick to a small jump
                const step = delta > 0 ? 1 : -1;
                playerColor[fineChannel] = clamp(playerColor[fineChannel] + step * 8); 
            }

            for (let i = 0; i < 3; i++) {
                let c = [[255, 0, 0], [0, 255, 0], [0, 0, 255]][i];
                if (i === fineChannel) {
                    if (Math.floor(now * 5) % 2 === 0) c = [255, 255, 255];
                }
                setPx(i + 2, 0, c);
            }

            const valWidth = Math.floor((playerColor[fineChannel] / 255) * 8);
            for (let x = 0; x < valWidth; x++) {
                setPx(x, 1, [[200,0,0], [0,200,0], [0,0,200]][fineChannel]);
            }

            drawRect(0, 3, 7, 7, playerColor);

            if (btn) {
                fineChannel++;
                if (fineChannel > 2) {
                    const dist = colorDistance(targetColor, playerColor);
                    rating = calculateRating(dist);
                    gameState = "RATING";
                }
            }
        }

        // --- RATING ---
        else if (gameState === "RATING") {
            for (let x = 0; x < 4; x++) {
                for (let y = 0; y < 4; y++) {
                    setPx(x, y, targetColor);
                    setPx(x + 4, y, playerColor);
                }
            }

            for (let i = 0; i < 8; i++) {
                let c = [40, 40, 0];
                if (i < rating) c = [255, 255, 0];
                setPx(i, 6, c);
                setPx(i, 7, c);
            }

            if (btn) {
                gameState = "IDLE";
            }
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
});
