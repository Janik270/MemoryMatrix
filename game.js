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

    // === COLOR ENGINE ===
    function hsv_to_rgb(h, s, v) {
        let i = Math.floor(h * 6);
        let f = (h * 6) - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);
        i %= 6;
        let r, g, b;
        if (i === 0) { r=v; g=t; b=p; }
        else if (i === 1) { r=q; g=v; b=p; }
        else if (i === 2) { r=p; g=v; b=t; }
        else if (i === 3) { r=p; g=q; b=v; }
        else if (i === 4) { r=t; g=p; b=v; }
        else { r=v; g=p; b=q; }
        return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
    }

    // ================= 1024 COLOR PALETTE =================
    const PALETTE = [];
    for(let i=0; i<1024; i++) {
        PALETTE.push(hsv_to_rgb(i / 1024.0, 1.0, 1.0));
    }

    function getRandomTarget() {
        return PALETTE[Math.floor(Math.random() * 1024)];
    }

    // === STATE ===
    let hue = 0.0;
    let playerColor = [0, 0, 0];
    let targetColor = [0, 0, 0];

    let gameState = "BOOT";
    let memoryStart = 0;
    let memoryTime = 2.5;

    let rating = 0;
    let deltaQueue = 0;
    let btnPressed = false;
    
    let lastInputTime = 0;
    let standbyStage = 0;
    let standbyStart = 0;
    
    let animStart = 0;

    // === HELPERS ===
    function setPx(x, y, color) {
        if (x >= 0 && x < 8 && y >= 0 && y < 8) {
            const index = y * 8 + x;
            const r = color[0];
            const g = color[1];
            const b = color[2];
            
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
        const maxDist = 441.6;
        let score = Math.round(8 * (1 - (dist / maxDist)));
        return Math.max(1, Math.min(8, score));
    }

    function ratingColor(i, rating) {
        if (i < rating) {
            let t = i / 7.0;
            return [Math.floor(255 * (1 - t)), Math.floor(255 * t), 0];
        }
        return [10, 10, 10];
    }

    function standbyWave(t) {
        const cx = 3.5, cy = 3.5;
        const speed = 3.0;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                let dx = x - cx;
                let dy = y - cy;
                let dist = Math.sqrt(dx*dx + dy*dy);
                let pulse = Math.sin(dist - t * speed);
                let v = Math.max(0, pulse) * Math.max(0, 1 - dist / 5);
                
                let colorIdx = Math.floor((dist * 30 + t * 80)) % 1024;
                if (colorIdx < 0) colorIdx += 1024;
                let color = PALETTE[colorIdx];
                setPx(x, y, hsv_to_rgb(color[0] / 255.0, 1, v));
            }
        }
    }

    // === INPUT ===
    function onEncoderTurn(delta) {
        deltaQueue += delta;
    }

    function onBtnPress() {
        btnPressed = true;
    }

    encoderBtn.addEventListener('mousedown', onBtnPress);
    
    // Support mouse wheel over the rotary area or screen
    document.querySelector('.simulator-container').addEventListener('wheel', (e) => {
        // Debounce slightly to make selection easier
        if (e.deltaY < 0) onEncoderTurn(1);
        else if (e.deltaY > 0) onEncoderTurn(-1);
        e.preventDefault();
    }, { passive: false });

    upBtn.addEventListener('mousedown', () => onEncoderTurn(1));
    downBtn.addEventListener('mousedown', () => onEncoderTurn(-1));

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') onEncoderTurn(1);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') onEncoderTurn(-1);
        if (e.key === 'Enter' || e.key === ' ') onBtnPress();
    });

    let startTimestamp = null;

    function gameLoop(timestamp) {
        if (!startTimestamp) {
            startTimestamp = timestamp;
            lastInputTime = timestamp / 1000;
            animStart = timestamp / 1000;
        }
        const now = (timestamp - startTimestamp) / 1000;

        let delta = deltaQueue;
        deltaQueue = 0;
        let btn = btnPressed;
        btnPressed = false;

        if (delta || btn) {
            lastInputTime = now;
            standbyStage = 0;
        }

        // --- STANDBY ---
        if (gameState !== "BOOT" && gameState !== "PERFECT" && now - lastInputTime > 60) {
            if (standbyStage === 0) {
                standbyStage = 1;
                standbyStart = now;
            }
            if (standbyStage === 1) {
                let t = now - standbyStart;
                standbyWave(t);
                if (t > 4) {
                    clear();
                    standbyStage = 2;
                }
            } else if (standbyStage === 2) {
                clear();
            }
            requestAnimationFrame(gameLoop);
            return; // Skip normal game logic
        }

        clear();

        // --- BOOT ---
        if (gameState === "BOOT") {
            let elapsed = now - animStart;
            // 64 pixels, 0.01s per pixel = 0.64s total
            let pxCount = Math.floor(elapsed / 0.01);
            if (pxCount > 64) {
                gameState = "IDLE";
            } else {
                for (let i = 0; i < pxCount; i++) {
                    let index = (i * 8) % 1024;
                    let x = i % 8;
                    let y = Math.floor(i / 8);
                    setPx(x, y, PALETTE[index]);
                }
            }
        }

        // --- IDLE ---
        else if (gameState === "IDLE") {
            let glow = (Math.sin(now * 3) + 1) / 2 * 40;
            let c = Math.floor(glow);
            for (let x = 0; x < 8; x++) {
                for (let y = 0; y < 8; y++) {
                    setPx(x, y, [c, c, c]);
                }
            }

            if (btn) {
                targetColor = getRandomTarget();
                memoryStart = now;
                gameState = "MEMORY";
            }
        }

        // --- MEMORY ---
        else if (gameState === "MEMORY") {
            let elapsed = now - memoryStart;
            drawRect(0, 0, 7, 7, targetColor);

            let bar = Math.floor((1 - elapsed / memoryTime) * 8);
            for (let x = 0; x < bar; x++) {
                setPx(x, 7, [255, 255, 255]);
            }

            if (elapsed >= memoryTime) {
                hue = 0.0;
                gameState = "COARSE";
            }
        }

        // --- COARSE ---
        else if (gameState === "COARSE") {
            if (delta) {
                hue = (hue + delta * 0.02) % 1.0;
                if (hue < 0) hue += 1.0;
            }

            let candidate = hsv_to_rgb(hue, 1.0, 1.0);

            for (let x = 0; x < 8; x++) {
                let h = (hue + (x - 4) * 0.02) % 1.0;
                if (h < 0) h += 1.0;
                setPx(x, 0, hsv_to_rgb(h, 1.0, 1.0));
            }

            setPx(4, 0, [255, 255, 255]);
            drawRect(0, 2, 7, 7, candidate);

            if (btn) {
                playerColor = candidate;
                let dist = colorDistance(playerColor, targetColor);
                rating = calculateRating(dist);

                if (rating === 8) {
                    gameState = "PERFECT";
                    animStart = now;
                } else {
                    gameState = "RATING";
                }
            }
        }

        // --- PERFECT ---
        else if (gameState === "PERFECT") {
            let elapsed = now - animStart;
            // 3 flashes of 0.2s each (0.1 on, 0.1 off)
            if (elapsed < 0.6) {
                let phase = elapsed % 0.2;
                if (phase < 0.1) {
                    drawRect(0, 0, 7, 7, [255, 255, 255]);
                }
            } else {
                // Rainbow sweep
                let sweepElapsed = elapsed - 0.6;
                // 25 iterations of 0.03s = 0.75s
                let j = Math.floor(sweepElapsed / 0.03);
                if (j >= 25) {
                    gameState = "RATING";
                } else {
                    for (let i = 0; i < 64; i++) {
                        let colorIdx = (i * 10 + j) % 1024;
                        let x = i % 8;
                        let y = Math.floor(i / 8);
                        setPx(x, y, PALETTE[colorIdx]);
                    }
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
                let rc = ratingColor(i, rating);
                setPx(i, 6, rc);
                setPx(i, 7, rc);
            }

            if (btn) {
                gameState = "IDLE";
            }
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
});
