window.onload = function () {
    console.log("--- SCRIPT START --- Window loaded. Initializing game script...");

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const startScreen = document.getElementById('startScreen');
    const startButton = document.getElementById('startButton');
    const gameArea = document.getElementById('gameArea');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const restartButton = document.getElementById('restartButton');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const finalScoreDisplay = document.getElementById('finalScore');
    const bgMusic = document.getElementById('bgMusic');

    const joystickArea = document.getElementById('joystickArea');
    const joystickBase = document.getElementById('joystickBase');
    const joystickKnob = document.getElementById('joystickKnob');

    canvas.width = 800;
    canvas.height = 600;

    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    console.log(`isTouchDevice: ${isTouchDevice}`);

    const MOUSE_IMG_WIDTH = 30;
    const MOUSE_IMG_HEIGHT = 30;

    // --- JOYSTICK ---
    let joystickActive = false; let joystickBaseRect; let joystickKnobRadius; let joystickMaxDist;
    let joystickDX = 0; let joystickDY = 0;
    const MOUSE_SPEED_FROM_JOYSTICK = 2.0; // Tuned for better control
    const JOYSTICK_DEADZONE = 0.15;         // Tuned for less jitter

    // --- SNAKE ---
    const INITIAL_SNAKE_LENGTH = 15;
    const SNAKE_SEGMENT_DIAMETER = 12;
    const SNAKE_HEAD_SCALE = 1.25;
    const SNAKE_TAIL_MIN_SCALE = 0.35;
    const SNAKE_BASE_COLOR = '#2e8b57'; const SNAKE_BODY_HIGHLIGHT_COLOR = '#66CDAA'; const SNAKE_EXTREMITY_HIGHLIGHT_COLOR = '#7FFFD4';
    const SNAKE_OUTLINE_COLOR = 'black'; const SNAKE_OUTLINE_WIDTH = 1; const TAIL_TIP_SAME_COLOR_LENGTH = 3;
    const INITIAL_SNAKE_SPEED = 3.0;
    const SNAKE_SPEED_INCREASE_AMOUNT = 0.1; const SNAKE_SPEED_MAX = 5.0;
    const SNAKE_GROWTH_AMOUNT_TIME = 1;
    const DIFFICULTY_INCREASE_INTERVAL = 8000;

    // --- CHEESE ---
    const CHEESE_WIDTH = 25; const CHEESE_HEIGHT = 25;
    const POINTS_PER_CHEESE = 10;
    const SNAKE_GROWTH_PER_CHEESE = 3;

    // --- GAME STATE ---
    let gameOver = false; let score = 0; let difficultyTimer; let gameRunning = false; let animationFrameId;

    // --- ASSETS ---
    const mouseImage = new Image(); let mouseImageLoaded = false;
    mouseImage.onload = () => { mouseImageLoaded = true; };
    mouseImage.onerror = () => { console.error("ERROR: Failed to load mouse image."); };
    mouseImage.src = 'assets/mouse.png';

    const cheeseImage = new Image(); let cheeseImageLoaded = false;
    cheeseImage.onload = () => { cheeseImageLoaded = true; console.log("Cheese image LOADED."); };
    cheeseImage.onerror = () => { console.error("ERROR: Failed to load cheese image."); };
    cheeseImage.src = 'assets/cheese.png';

    // --- GAME OBJECTS ---
    const mouse = { x: canvas.width / 4, y: canvas.height / 2 };
    const snake = { body: [], speed: INITIAL_SNAKE_SPEED, currentMaxLength: INITIAL_SNAKE_LENGTH, };
    const cheese = { x: 0, y: 0, width: CHEESE_WIDTH, height: CHEESE_HEIGHT };


    // --- JOYSTICK FUNCTIONS ---
    function initJoystick() { if (!isTouchDevice) { joystickArea.classList.add('hidden'); return; } if (!joystickKnob || !joystickBase || !joystickArea) { console.error("initJoystick: Joystick HTML elements not found!"); return; } joystickKnob.style.transform = `translate(0px, 0px)`; joystickBase.addEventListener('touchstart', handleJoystickStart, { passive: false }); window.addEventListener('touchmove', handleJoystickMove, { passive: false }); window.addEventListener('touchend', handleJoystickEnd, { passive: false }); window.addEventListener('touchcancel', handleJoystickEnd, { passive: false }); }
    function calculateJoystickDimensions() { if (!isTouchDevice || !joystickArea || joystickArea.classList.contains('hidden') || !joystickBase || !joystickKnob) { return; } joystickBaseRect = joystickBase.getBoundingClientRect(); joystickKnobRadius = joystickKnob.offsetWidth / 2; joystickMaxDist = joystickBase.offsetWidth / 2 - joystickKnobRadius; if (joystickBaseRect.width === 0 || joystickKnobRadius === 0 || joystickMaxDist < 0) { console.error("calculateJoystickDimensions: Invalid joystick dimensions!"); } }
    function handleJoystickStart(event) { if (!gameRunning || gameOver || !isTouchDevice || !joystickBase || !joystickKnob) return; const touch = event.touches[0]; if (joystickBase.contains(touch.target)) { event.preventDefault(); joystickActive = true; calculateJoystickDimensions(); if (!joystickBaseRect || joystickBaseRect.width === 0) { joystickActive = false; return; } updateJoystickKnob(touch.clientX, touch.clientY); } }
    function handleJoystickMove(event) { if (!joystickActive || !gameRunning || gameOver || !isTouchDevice) return; event.preventDefault(); updateJoystickKnob(event.touches[0].clientX, event.touches[0].clientY); }
    function updateJoystickKnob(clientX, clientY) { if (!joystickBaseRect || joystickBaseRect.width === 0 || joystickMaxDist === undefined) return; const baseXCenter = joystickBaseRect.left + joystickBaseRect.width / 2; const baseYCenter = joystickBaseRect.top + joystickBaseRect.height / 2; let dx = clientX - baseXCenter; let dy = clientY - baseYCenter; const distance = Math.sqrt(dx * dx + dy * dy); if (distance > joystickMaxDist) { dx = (dx / distance) * joystickMaxDist; dy = (dy / distance) * joystickMaxDist; } joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`; if (joystickMaxDist > 0) { joystickDX = dx / joystickMaxDist; joystickDY = dy / joystickMaxDist; } else { joystickDX = 0; joystickDY = 0; } }
    function handleJoystickEnd(event) { if (!joystickActive || !isTouchDevice) return; joystickActive = false; joystickDX = 0; joystickDY = 0; if (joystickKnob) joystickKnob.style.transform = `translate(0px, 0px)`; }

    // --- GAME ITEM FUNCTIONS ---
    function spawnCheese() { const padding = Math.max(cheese.width, cheese.height) + 20; cheese.x = Math.random() * (canvas.width - padding * 2) + padding; cheese.y = Math.random() * (canvas.height - padding * 2) + padding; }
    function drawCheese() { if (cheeseImageLoaded && cheeseImage.naturalWidth > 0) { ctx.drawImage(cheeseImage, cheese.x - cheese.width / 2, cheese.y - cheese.height / 2, cheese.width, cheese.height); } else { ctx.beginPath(); ctx.rect(cheese.x - cheese.width / 2, cheese.y - cheese.height / 2, cheese.width, cheese.height); ctx.fillStyle = '#FFD700'; ctx.fill(); ctx.closePath(); } }

    // --- GAME LOGIC ---
    function startGameLogic() {
        gameRunning = true; gameOver = false;
        startScreen.classList.add('hidden'); gameOverScreen.classList.add('hidden'); gameArea.classList.remove('hidden');
        if (isTouchDevice) { joystickArea.classList.remove('hidden'); setTimeout(calculateJoystickDimensions, 50); joystickActive = false; joystickDX = 0; joystickDY = 0; if (joystickKnob) joystickKnob.style.transform = `translate(0px, 0px)`; } else { joystickArea.classList.add('hidden'); }
        score = 0; scoreDisplay.textContent = `Score: ${score}`;
        bgMusic.currentTime = 0; bgMusic.play().catch(e => console.warn("Music autoplay failed", e));
        
        snake.currentMaxLength = INITIAL_SNAKE_LENGTH;
        snake.speed = INITIAL_SNAKE_SPEED;
        snake.body = [];
        const startX = canvas.width * 0.7; const startY = canvas.height / 2;
        for (let i = 0; i < snake.currentMaxLength; i++) {
            snake.body.push({ x: startX - i * (SNAKE_SEGMENT_DIAMETER * 0.7), y: startY });
        }

        clearInterval(difficultyTimer);
        difficultyTimer = setInterval(() => {
            if (!gameOver && gameRunning) {
                snake.currentMaxLength += SNAKE_GROWTH_AMOUNT_TIME;
                if (snake.speed < SNAKE_SPEED_MAX) { snake.speed += SNAKE_SPEED_INCREASE_AMOUNT; snake.speed = Math.min(snake.speed, SNAKE_SPEED_MAX); }
            }
        }, DIFFICULTY_INCREASE_INTERVAL);
        mouse.x = canvas.width / 4; mouse.y = canvas.height / 2;
        spawnCheese();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        gameLoop();
    }

    startButton.addEventListener('click', startGameLogic); restartButton.addEventListener('click', startGameLogic);

    // --- INPUT & DRAWING ---
    function handleCanvasDirectInteraction(event) { if (isTouchDevice) return; if (!gameRunning || gameOver) return; const rect = canvas.getBoundingClientRect(); if (event.clientX === undefined || event.clientY === undefined) return; let canvasX = (event.clientX - rect.left) * (canvas.width / rect.width); let canvasY = (event.clientY - rect.top) * (canvas.height / rect.height); mouse.x = Math.max(MOUSE_IMG_WIDTH / 2, Math.min(canvasX, canvas.width - MOUSE_IMG_WIDTH / 2)); mouse.y = Math.max(MOUSE_IMG_HEIGHT / 2, Math.min(canvasY, canvas.height - MOUSE_IMG_HEIGHT / 2)); }
    canvas.addEventListener('mousemove', handleCanvasDirectInteraction);
    function clearCanvas() { ctx.fillStyle = '#FFFACD'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    function drawMouse() { if (mouseImageLoaded && mouseImage.naturalWidth > 0) { ctx.drawImage(mouseImage, mouse.x - MOUSE_IMG_WIDTH / 2, mouse.y - MOUSE_IMG_HEIGHT / 2, MOUSE_IMG_WIDTH, MOUSE_IMG_HEIGHT); } else { ctx.beginPath(); ctx.arc(mouse.x, mouse.y, MOUSE_IMG_WIDTH / 2, 0, Math.PI * 2); ctx.fillStyle = 'gray'; ctx.fill(); ctx.closePath(); } }
    function drawRealisticSnake() { if (!snake.body || snake.body.length === 0) return; for (let i = snake.body.length - 1; i >= 1; i--) { const seg = snake.body[i]; if (typeof seg.x !== 'number' || typeof seg.y !== 'number') continue; let t_for_taper = (snake.body.length > 2) ? (i - 1) / (snake.body.length - 2) : (snake.body.length === 2 && i === 1 ? 0 : 0); const scaleFactor = 1 - (1 - SNAKE_TAIL_MIN_SCALE) * Math.min(1, Math.max(0, t_for_taper)); let actualSegmentDiameter = Math.max(SNAKE_SEGMENT_DIAMETER * scaleFactor, SNAKE_SEGMENT_DIAMETER * SNAKE_TAIL_MIN_SCALE * 0.8, 2); const radius = actualSegmentDiameter / 2; ctx.beginPath(); ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2); let currentHighlightColor = (snake.body.length > 1 && i >= (snake.body.length - TAIL_TIP_SAME_COLOR_LENGTH)) ? SNAKE_EXTREMITY_HIGHLIGHT_COLOR : SNAKE_BODY_HIGHLIGHT_COLOR; const gradient = ctx.createRadialGradient(seg.x - radius * 0.2, seg.y - radius * 0.2, radius * 0.1, seg.x, seg.y, radius); gradient.addColorStop(0, currentHighlightColor); gradient.addColorStop(1, SNAKE_BASE_COLOR); ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = SNAKE_OUTLINE_COLOR; ctx.lineWidth = SNAKE_OUTLINE_WIDTH; ctx.stroke(); } const head = snake.body[0]; if (head && typeof head.x === 'number' && typeof head.y === 'number') { const headDiameter = SNAKE_SEGMENT_DIAMETER * SNAKE_HEAD_SCALE; const headRadius = headDiameter / 2; ctx.beginPath(); ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2); const headGradient = ctx.createRadialGradient(head.x - headRadius * 0.2, head.y - headRadius * 0.2, headRadius * 0.1, head.x, head.y, headRadius); headGradient.addColorStop(0, SNAKE_EXTREMITY_HIGHLIGHT_COLOR); headGradient.addColorStop(1, SNAKE_BASE_COLOR); ctx.fillStyle = headGradient; ctx.fill(); ctx.strokeStyle = SNAKE_OUTLINE_COLOR; ctx.lineWidth = SNAKE_OUTLINE_WIDTH; ctx.stroke(); const eyeRadius = Math.max(1.5, headRadius * 0.18); const pupilRadius = Math.max(0.8, eyeRadius * 0.55); const angleToMouse = Math.atan2(mouse.y - head.y, mouse.x - head.x); const eyeDistFromCenter = headRadius * 0.45; const eyeAngleOffset = Math.PI / 4.5; const eye1X = head.x + Math.cos(angleToMouse - eyeAngleOffset) * eyeDistFromCenter; const eye1Y = head.y + Math.sin(angleToMouse - eyeAngleOffset) * eyeDistFromCenter; const eye2X = head.x + Math.cos(angleToMouse + eyeAngleOffset) * eyeDistFromCenter; const eye2Y = head.y + Math.sin(angleToMouse + eyeAngleOffset) * eyeDistFromCenter; ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#113399'; const pupilOffsetAmount = eyeRadius * 0.40; const pupilAngle1 = Math.atan2(mouse.y - eye1Y, mouse.x - eye1X); const pupil1X = eye1X + Math.cos(pupilAngle1) * pupilOffsetAmount; const pupil1Y = eye1Y + Math.sin(pupilAngle1) * pupilOffsetAmount; ctx.beginPath(); ctx.arc(pupil1X, pupil1Y, pupilRadius, 0, Math.PI * 2); ctx.fill(); const pupilAngle2 = Math.atan2(mouse.y - eye2Y, mouse.x - eye2X); const pupil2X = eye2X + Math.cos(pupilAngle2) * pupilOffsetAmount; const pupil2Y = eye2Y + Math.sin(pupilAngle2) * pupilOffsetAmount; ctx.beginPath(); ctx.arc(pupil2X, pupil2Y, pupilRadius, 0, Math.PI * 2); ctx.fill(); } }

    // --- UPDATE FUNCTIONS ---
    function updateMouseFromJoystick() {
        if (!isTouchDevice || !gameRunning || gameOver) return;
        let currentJoystickDX = joystickDX; let currentJoystickDY = joystickDY;
        const magnitude = Math.sqrt(currentJoystickDX * currentJoystickDX + currentJoystickDY * currentJoystickDY);
        if (magnitude < JOYSTICK_DEADZONE) { currentJoystickDX = 0; currentJoystickDY = 0; }
        
        if (currentJoystickDX !== 0 || currentJoystickDY !== 0) {
            let deltaX = currentJoystickDX * MOUSE_SPEED_FROM_JOYSTICK;
            let deltaY = currentJoystickDY * MOUSE_SPEED_FROM_JOYSTICK;
            mouse.x += deltaX; mouse.y += deltaY;
            mouse.x = Math.max(MOUSE_IMG_WIDTH / 2, Math.min(mouse.x, canvas.width - MOUSE_IMG_WIDTH / 2));
            mouse.y = Math.max(MOUSE_IMG_HEIGHT / 2, Math.min(mouse.y, canvas.height - MOUSE_IMG_HEIGHT / 2));
        }
    }

    function updateSnake() {
        if (gameOver || !gameRunning || !snake.body) return;
        let newHeadX, newHeadY;
        if (snake.body.length === 0) { newHeadX = canvas.width / 2; newHeadY = canvas.height / 2; }
        else {
            const head = snake.body[0];
            const dxToMouse = mouse.x - head.x; const dyToMouse = mouse.y - head.y;
            const distToMouse = Math.sqrt(dxToMouse * dxToMouse + dyToMouse * dyToMouse);
            let moveX = 0, moveY = 0;
            if (distToMouse > snake.speed) { moveX = (dxToMouse / distToMouse) * snake.speed; moveY = (dyToMouse / distToMouse) * snake.speed; }
            else if (distToMouse > 0.1) { moveX = dxToMouse; moveY = dyToMouse; }
            newHeadX = head.x + moveX; newHeadY = head.y + moveY;
        }
        snake.body.unshift({ x: newHeadX, y: newHeadY });
        while (snake.body.length > snake.currentMaxLength) { snake.body.pop(); }
    }

    function checkCollisions() {
        if (!snake.body || snake.body.length === 0) return;
        const head = snake.body[0];
        const headDisplayRadius = (SNAKE_SEGMENT_DIAMETER * SNAKE_HEAD_SCALE) / 2;
        const playerMouseRadius = MOUSE_IMG_WIDTH / 2;
        const dxPlayer = head.x - mouse.x; const dyPlayer = head.y - mouse.y;
        const distancePlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);
        if (distancePlayer < headDisplayRadius + playerMouseRadius - (SNAKE_OUTLINE_WIDTH + 2) ) {
            gameOver = true; gameRunning = false; if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } gameArea.classList.add('hidden'); gameOverScreen.classList.remove('hidden'); if (isTouchDevice) joystickArea.classList.add('hidden'); finalScoreDisplay.textContent = `Your Score: ${score}`; clearInterval(difficultyTimer); bgMusic.pause(); return;
        }
        const cheeseCenterX = cheese.x; const cheeseCenterY = cheese.y;
        const dxCheese = mouse.x - cheeseCenterX; const dyCheese = mouse.y - cheeseCenterY;
        const distanceCheese = Math.sqrt(dxCheese*dxCheese + dyCheese*dyCheese);
        if (distanceCheese < playerMouseRadius + Math.max(cheese.width, cheese.height) / 2 * 0.8) {
            score += POINTS_PER_CHEESE;
            scoreDisplay.textContent = `Score: ${score}`;
            snake.currentMaxLength += SNAKE_GROWTH_PER_CHEESE;
            spawnCheese();
        }
    }

    // --- MAIN GAME LOOP ---
    function gameLoop() {
        if (gameOver || !gameRunning) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; return;
        }
        clearCanvas();
        if (isTouchDevice) { updateMouseFromJoystick(); }
        updateSnake();
        drawRealisticSnake(); drawCheese(); drawMouse();
        checkCollisions();
        if (gameRunning && !gameOver) {
            animationFrameId = requestAnimationFrame(gameLoop);
        } else { animationFrameId = null; }
    }

    // --- INITIALIZATION ---
    startScreen.classList.remove('hidden'); gameArea.classList.add('hidden'); gameOverScreen.classList.add('hidden'); joystickArea.classList.add('hidden');
    initJoystick();
    console.log("--- SCRIPT END --- Initialization complete.");
};