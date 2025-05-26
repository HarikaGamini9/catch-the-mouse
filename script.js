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

    let joystickActive = false;
    let joystickBaseRect;
    let joystickKnobRadius;
    let joystickMaxDist;
    let joystickDX = 0;
    let joystickDY = 0;
    const MOUSE_SPEED_FROM_JOYSTICK = 3.5;

    // --- SNAKE, EGG, GAME STATE (condensed for brevity, ensure these are your values) ---
    const INITIAL_SNAKE_LENGTH = 30, SNAKE_SEGMENT_DIAMETER = 12, SNAKE_HEAD_SCALE = 1.25, SNAKE_TAIL_MIN_SCALE = 0.35, SEGMENT_OVERLAP_FACTOR = 0.55;
    const SNAKE_BASE_COLOR = '#2e8b57', SNAKE_BODY_HIGHLIGHT_COLOR = '#66CDAA', SNAKE_EXTREMITY_HIGHLIGHT_COLOR = '#7FFFD4', SNAKE_OUTLINE_COLOR = 'black', SNAKE_OUTLINE_WIDTH = 1;
    const TAIL_TIP_SAME_COLOR_LENGTH = 3, INITIAL_SNAKE_SPEED = 2.5, SNAKE_SPEED_INCREASE_AMOUNT = 0.1, SNAKE_SPEED_MAX = 4.8, SNAKE_GROWTH_AMOUNT_TIME = 1, DIFFICULTY_INCREASE_INTERVAL = 8000;
    const EGG_RADIUS = 10, EGG_COLOR = '#FFB6C1', POINTS_PER_EGG = 10;
    let gameOver = false, score = 0, difficultyTimer, gameRunning = false, animationFrameId;
    const mouseImage = new Image(); let mouseImageLoaded = false; mouseImage.onload = () => { mouseImageLoaded = true; console.log("Mouse image LOADED."); }; mouseImage.onerror = () => { mouseImageLoaded = false; console.error("ERROR: Failed to load mouse image."); }; mouseImage.src = 'assets/mouse.png';
    const mouse = { x: canvas.width / 4, y: canvas.height / 2 };
    const snake = { body: [], segmentDiameter: SNAKE_SEGMENT_DIAMETER, speed: INITIAL_SNAKE_SPEED, currentMaxLength: INITIAL_SNAKE_LENGTH, };
    const egg = { x: 0, y: 0, radius: EGG_RADIUS, color: EGG_COLOR };
    // --- END OF CONDENSED VARS ---

    function initJoystick() {
        if (!isTouchDevice) {
            console.log("initJoystick: Not a touch device. Skipping joystick setup.");
            joystickArea.classList.add('hidden'); // Ensure it's hidden
            return;
        }
        console.log("initJoystick: Is a touch device. Setting up joystick.");

        // Dimensions are best calculated when joystick is visible and game starts,
        // but initial knob radius can be set if CSS is loaded.
        joystickKnobRadius = joystickKnob.offsetWidth / 2;
        console.log(`initJoystick: Initial joystickKnobRadius = ${joystickKnobRadius}`);
        if (joystickKnobRadius === 0) {
            console.warn("initJoystick: joystickKnob.offsetWidth is 0. CSS might not be loaded or joystick is display:none.");
        }
        joystickKnob.style.transform = `translate(0px, 0px)`;

        joystickBase.addEventListener('touchstart', handleJoystickStart, { passive: false });
        window.addEventListener('touchmove', handleJoystickMove, { passive: false });
        window.addEventListener('touchend', handleJoystickEnd, { passive: false });
        window.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
        console.log("initJoystick: Joystick event listeners attached.");
    }

    function calculateJoystickDimensions() {
        if (!isTouchDevice || !joystickArea || joystickArea.classList.contains('hidden')) return;

        joystickBaseRect = joystickBase.getBoundingClientRect();
        joystickKnobRadius = joystickKnob.offsetWidth / 2; // Recalculate
        joystickMaxDist = joystickBase.offsetWidth / 2 - joystickKnobRadius;
        console.log(`calculateJoystickDimensions: BaseRect:`, joystickBaseRect, `KnobRadius: ${joystickKnobRadius}, MaxDist: ${joystickMaxDist}`);
        if (joystickBaseRect.width === 0 || joystickKnobRadius === 0 || joystickMaxDist < 0) {
            console.error("calculateJoystickDimensions: Invalid joystick dimensions! Check visibility and CSS.");
        }
    }


    function handleJoystickStart(event) {
        if (!gameRunning || gameOver || !isTouchDevice) {
            // console.log("handleJoystickStart: Bailed (game not running, over, or not touch device).");
            return;
        }
        console.log("handleJoystickStart: Touch detected on joystickBase.");

        const touch = event.touches[0];
        // Ensure the touch actually started on the joystick elements.
        // Even though listener is on joystickBase, event could bubble from knob.
        if (touch.target === joystickKnob || touch.target === joystickBase || joystickBase.contains(touch.target)) {
            console.log("handleJoystickStart: Touch confirmed on joystick element. Target:", touch.target);
            event.preventDefault();
            joystickActive = true;

            // Recalculate dimensions here as joystick is now definitely visible and interactive
            calculateJoystickDimensions();
            if (!joystickBaseRect || joystickBaseRect.width === 0) { // Double check after calculation
                 console.error("handleJoystickStart: joystickBaseRect is STILL invalid after calculateJoystickDimensions! Aborting joystick activation.");
                 joystickActive = false;
                 return;
            }

            updateJoystickKnob(touch.clientX, touch.clientY);
        } else {
            console.log("handleJoystickStart: Touch was NOT on joystick knob or base. Target:", touch.target);
        }
    }

    function handleJoystickMove(event) {
        if (!joystickActive || !gameRunning || gameOver || !isTouchDevice) return;
        // console.log("handleJoystickMove: Active."); // Can be very noisy
        event.preventDefault();
        const touch = event.touches[0];
        updateJoystickKnob(touch.clientX, touch.clientY);
    }

    function updateJoystickKnob(clientX, clientY) {
        if (!joystickBaseRect || joystickBaseRect.width === 0) {
            console.error("updateJoystickKnob: joystickBaseRect is invalid. Cannot update knob.");
            return;
        }
        const baseXCenter = joystickBaseRect.left + joystickBaseRect.width / 2;
        const baseYCenter = joystickBaseRect.top + joystickBaseRect.height / 2;

        let dx = clientX - baseXCenter;
        let dy = clientY - baseYCenter;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > joystickMaxDist) {
            dx = (dx / distance) * joystickMaxDist;
            dy = (dy / distance) * joystickMaxDist;
        }

        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

        if (joystickMaxDist > 0) {
            joystickDX = dx / joystickMaxDist;
            joystickDY = dy / joystickMaxDist;
        } else {
            joystickDX = 0;
            joystickDY = 0;
        }
        // console.log(`updateJoystickKnob: dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}, joystickDX=${joystickDX.toFixed(2)}, joystickDY=${joystickDY.toFixed(2)}`); // Noisy
    }

    function handleJoystickEnd(event) {
        if (!joystickActive || !isTouchDevice) return;
        console.log("handleJoystickEnd: Resetting joystick.");
        // event.preventDefault(); // Usually not needed for touchend
        joystickActive = false;
        joystickDX = 0;
        joystickDY = 0;
        joystickKnob.style.transform = `translate(0px, 0px)`;
    }

    function spawnEgg() { /* ... same ... */
        const padding = EGG_RADIUS + 20; egg.x = Math.random() * (canvas.width - padding * 2) + padding; egg.y = Math.random() * (canvas.height - padding * 2) + padding;
    }
    function drawEgg() { /* ... same ... */
        ctx.beginPath(); ctx.arc(egg.x, egg.y, egg.radius, 0, Math.PI * 2); ctx.fillStyle = egg.color; ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.fill(); ctx.closePath(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    }

    function startGameLogic() {
        console.log("startGameLogic: Starting/Restarting game.");
        gameRunning = true;
        gameOver = false;
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        gameArea.classList.remove('hidden');

        if (isTouchDevice) {
            console.log("startGameLogic: Is touch device. Showing joystick and calculating dimensions.");
            joystickArea.classList.remove('hidden');
            // Delay slightly to ensure CSS has applied and it's in the layout flow
            setTimeout(calculateJoystickDimensions, 50); // Calculate/Recalculate dimensions now that it's visible
            joystickActive = false;
            joystickDX = 0;
            joystickDY = 0;
            if (joystickKnob) joystickKnob.style.transform = `translate(0px, 0px)`;
        } else {
            console.log("startGameLogic: Not a touch device. Hiding joystick.");
            joystickArea.classList.add('hidden');
        }

        score = 0; scoreDisplay.textContent = `Score: 0`;
        bgMusic.currentTime = 0; bgMusic.play().catch(e => console.warn("Music autoplay failed", e));
        snake.currentMaxLength = INITIAL_SNAKE_LENGTH; snake.speed = INITIAL_SNAKE_SPEED;
        clearInterval(difficultyTimer);
        difficultyTimer = setInterval(() => { /* ... difficulty increase ... */
            if (!gameOver && gameRunning) { snake.currentMaxLength += SNAKE_GROWTH_AMOUNT_TIME; if (snake.speed < SNAKE_SPEED_MAX) { snake.speed += SNAKE_SPEED_INCREASE_AMOUNT; snake.speed = Math.min(snake.speed, SNAKE_SPEED_MAX); } }
        }, DIFFICULTY_INCREASE_INTERVAL);
        snake.body = []; const startX = canvas.width * 0.7, startY = canvas.height / 2; for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) { snake.body.push({ x: startX - i * (snake.segmentDiameter * SEGMENT_OVERLAP_FACTOR), y: startY }); }
        mouse.x = canvas.width / 4; mouse.y = canvas.height / 2;
        spawnEgg();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        gameLoop();
    }

    startButton.addEventListener('click', startGameLogic);
    restartButton.addEventListener('click', startGameLogic);

    // This function handles direct canvas interaction (intended for DESKTOP MOUSE)
    function handleCanvasDirectInteraction(event) {
        if (isTouchDevice) {
            console.log("handleCanvasDirectInteraction: IS TOUCH DEVICE. Event type:", event.type, ". Ignoring for direct mouse control via canvas.");
            // On touch devices, canvas interaction should NOT directly move the mouse sprite.
            // The joystick is responsible for that.
            return;
        }

        // If it's NOT a touch device, this is for desktop mouse:
        console.log("handleCanvasDirectInteraction: NOT touch device. Event type:", event.type, ". Processing as desktop mouse.");
        if (!gameRunning || gameOver) return;

        // For mousemove, we want to prevent default if we are, for example,
        // implementing a drag selection. Here, it's just for cursor position.
        // event.preventDefault(); // Usually not needed for simple mouse tracking unless it interferes

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (event.clientX !== undefined && event.clientY !== undefined) {
            clientX = event.clientX;
            clientY = event.clientY;
        } else {
            console.warn("handleCanvasDirectInteraction: No clientX/Y in event. Cannot process.");
            return; // Not a valid mouse-like event
        }

        let canvasX = (clientX - rect.left) * (canvas.width / rect.width);
        let canvasY = (clientY - rect.top) * (canvas.height / rect.height);

        mouse.x = Math.max(MOUSE_IMG_WIDTH / 2, Math.min(canvasX, canvas.width - MOUSE_IMG_WIDTH / 2));
        mouse.y = Math.max(MOUSE_IMG_HEIGHT / 2, Math.min(canvasY, canvas.height - MOUSE_IMG_HEIGHT / 2));
        // console.log(`handleCanvasDirectInteraction: Mouse sprite at ${mouse.x}, ${mouse.y}`);
    }

    // ADD LISTENER FOR DESKTOP MOUSE (conditionally ignored for touch inside function)
    canvas.addEventListener('mousemove', handleCanvasDirectInteraction);

    // IMPORTANT: Ensure NO OTHER touch listeners are on the CANVAS that directly move the mouse.
    // If you had old `canvas.addEventListener('touchmove', someOldFunction)` or
    // `canvas.addEventListener('touchstart', someOldFunction)` that moved `mouse.x` and `mouse.y`
    // directly, they MUST be removed or commented out.
    // The `handleCanvasDirectInteraction` function's `if (isTouchDevice)` check is the main guard now.

    function updateMouseFromJoystick() {
        if (!isTouchDevice || !joystickActive || !gameRunning || gameOver) return;
        // console.log(`updateMouseFromJoystick: Active. DX=${joystickDX.toFixed(2)}, DY=${joystickDY.toFixed(2)}`); // Noisy

        mouse.x += joystickDX * MOUSE_SPEED_FROM_JOYSTICK;
        mouse.y += joystickDY * MOUSE_SPEED_FROM_JOYSTICK;

        mouse.x = Math.max(MOUSE_IMG_WIDTH / 2, Math.min(mouse.x, canvas.width - MOUSE_IMG_WIDTH / 2));
        mouse.y = Math.max(MOUSE_IMG_HEIGHT / 2, Math.min(mouse.y, canvas.height - MOUSE_IMG_HEIGHT / 2));
    }

    function clearCanvas() { /* ... same ... */ ctx.fillStyle = '#FFFACD'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    function drawMouse() { /* ... same ... */ if (mouseImageLoaded && mouseImage.naturalWidth > 0) { ctx.drawImage(mouseImage, mouse.x - MOUSE_IMG_WIDTH / 2, mouse.y - MOUSE_IMG_HEIGHT / 2, MOUSE_IMG_WIDTH, MOUSE_IMG_HEIGHT); } else { ctx.beginPath(); ctx.arc(mouse.x, mouse.y, MOUSE_IMG_WIDTH / 2, 0, Math.PI * 2); ctx.fillStyle = 'gray'; ctx.fill(); ctx.closePath(); } }
    function drawRealisticSnake() { /* ... same (very long, keeping it condensed) ... */ if (!snake.body || snake.body.length === 0) return; for (let i = snake.body.length - 1; i >= 1; i--) { const seg = snake.body[i]; if (typeof seg.x !== 'number' || typeof seg.y !== 'number') { continue; } let t_for_taper = (snake.body.length > 2) ? (i - 1) / (snake.body.length - 2) : (snake.body.length === 2 && i === 1 ? 0 : 0); const scaleFactor = 1 - (1 - SNAKE_TAIL_MIN_SCALE) * Math.min(1, Math.max(0, t_for_taper)); let actualSegmentDiameter = Math.max(snake.segmentDiameter * scaleFactor, snake.segmentDiameter * SNAKE_TAIL_MIN_SCALE * 0.8, 2); const radius = actualSegmentDiameter / 2; ctx.beginPath(); ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2); let currentHighlightColor = (snake.body.length > 1 && i >= (snake.body.length - TAIL_TIP_SAME_COLOR_LENGTH)) ? SNAKE_EXTREMITY_HIGHLIGHT_COLOR : SNAKE_BODY_HIGHLIGHT_COLOR; const gradient = ctx.createRadialGradient(seg.x - radius * 0.2, seg.y - radius * 0.2, radius * 0.1, seg.x, seg.y, radius); gradient.addColorStop(0, currentHighlightColor); gradient.addColorStop(1, SNAKE_BASE_COLOR); ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = SNAKE_OUTLINE_COLOR; ctx.lineWidth = SNAKE_OUTLINE_WIDTH; ctx.stroke(); } const head = snake.body[0]; if (head && typeof head.x === 'number' && typeof head.y === 'number') { const headDiameter = snake.segmentDiameter * SNAKE_HEAD_SCALE; const headRadius = headDiameter / 2; ctx.beginPath(); ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2); const headGradient = ctx.createRadialGradient(head.x - headRadius * 0.2, head.y - headRadius * 0.2, headRadius * 0.1, head.x, head.y, headRadius); headGradient.addColorStop(0, SNAKE_EXTREMITY_HIGHLIGHT_COLOR); headGradient.addColorStop(1, SNAKE_BASE_COLOR); ctx.fillStyle = headGradient; ctx.fill(); ctx.strokeStyle = SNAKE_OUTLINE_COLOR; ctx.lineWidth = SNAKE_OUTLINE_WIDTH; ctx.stroke(); const eyeRadius = Math.max(1.5, headRadius * 0.18); const pupilRadius = Math.max(0.8, eyeRadius * 0.55); const angleToMouse = Math.atan2(mouse.y - head.y, mouse.x - head.x); const eyeDistFromCenter = headRadius * 0.45; const eyeAngleOffset = Math.PI / 4.5; const eye1X = head.x + Math.cos(angleToMouse - eyeAngleOffset) * eyeDistFromCenter; const eye1Y = head.y + Math.sin(angleToMouse - eyeAngleOffset) * eyeDistFromCenter; const eye2X = head.x + Math.cos(angleToMouse + eyeAngleOffset) * eyeDistFromCenter; const eye2Y = head.y + Math.sin(angleToMouse + eyeAngleOffset) * eyeDistFromCenter; ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#113399'; const pupilOffsetAmount = eyeRadius * 0.40; const pupilAngle1 = Math.atan2(mouse.y - eye1Y, mouse.x - eye1X); const pupil1X = eye1X + Math.cos(pupilAngle1) * pupilOffsetAmount; const pupil1Y = eye1Y + Math.sin(pupilAngle1) * pupilOffsetAmount; ctx.beginPath(); ctx.arc(pupil1X, pupil1Y, pupilRadius, 0, Math.PI * 2); ctx.fill(); const pupilAngle2 = Math.atan2(mouse.y - eye2Y, mouse.x - eye2X); const pupil2X = eye2X + Math.cos(pupilAngle2) * pupilOffsetAmount; const pupil2Y = eye2Y + Math.sin(pupilAngle2) * pupilOffsetAmount; ctx.beginPath(); ctx.arc(pupil2X, pupil2Y, pupilRadius, 0, Math.PI * 2); ctx.fill(); } }
    function updateSnake() { /* ... same ... */ if (gameOver || !gameRunning || !snake.body || snake.body.length === 0) return; const currentHeadX = snake.body[0].x; const currentHeadY = snake.body[0].y; const dx = mouse.x - currentHeadX; const dy = mouse.y - currentHeadY; const distance = Math.sqrt(dx * dx + dy * dy); let moveX = 0, moveY = 0; if (distance > snake.speed) { moveX = (dx / distance) * snake.speed; moveY = (dy / distance) * snake.speed; } else if (distance > 1) { moveX = dx; moveY = dy; } const newHead = { x: currentHeadX + moveX, y: currentHeadY + moveY }; snake.body.unshift(newHead); while (snake.body.length > snake.currentMaxLength) { snake.body.pop(); } }
    function checkCollisions() { /* ... same ... */ if (!snake.body || snake.body.length === 0) return; const head = snake.body[0]; const headDisplayRadius = (snake.segmentDiameter * SNAKE_HEAD_SCALE) / 2; const playerMouseRadius = MOUSE_IMG_WIDTH / 2; const dxPlayer = head.x - mouse.x; const dyPlayer = head.y - mouse.y; const distancePlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer); if (distancePlayer < headDisplayRadius + playerMouseRadius - (SNAKE_OUTLINE_WIDTH + 2) ) { gameOver = true; gameRunning = false; if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } gameArea.classList.add('hidden'); gameOverScreen.classList.remove('hidden'); if (isTouchDevice) joystickArea.classList.add('hidden'); finalScoreDisplay.textContent = `Your Score: ${score}`; clearInterval(difficultyTimer); bgMusic.pause(); return; } const dxEgg = mouse.x - egg.x; const dyEgg = mouse.y - egg.y; const distanceEgg = Math.sqrt(dxEgg * dxEgg + dyEgg * dyEgg); if (distanceEgg < playerMouseRadius + egg.radius) { score += POINTS_PER_EGG; scoreDisplay.textContent = `Score: ${score}`; spawnEgg(); } }

    function gameLoop() {
        if (gameOver || !gameRunning) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; return;
        }
        clearCanvas();
        if (isTouchDevice && joystickActive) { // Only update from joystick if it's active
            updateMouseFromJoystick();
        }
        updateSnake();
        drawRealisticSnake(); drawEgg(); drawMouse();
        checkCollisions();
        if (gameRunning && !gameOver) {
            animationFrameId = requestAnimationFrame(gameLoop);
        } else { animationFrameId = null; }
    }

    console.log("Initial setup: Setting screen visibility.");
    startScreen.classList.remove('hidden');
    gameArea.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    joystickArea.classList.add('hidden'); // Start hidden, shown in startGameLogic if touch

    initJoystick(); // Initialize joystick (conditionally runs setup)
    console.log("--- SCRIPT END --- Initialization complete.");
};