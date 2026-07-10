// ── 09-controls-main.js ──────────────────────────────────────
// restartGame(), обработка нажатий/тача/клавиатуры, bindControls(),
// и САМ ЗАПУСК игры (initMountains(), requestAnimationFrame(animate)).
// Грузится ПОСЛЕДНИМ — тут выполняется код верхнего уровня, который
// вызывает функции из всех остальных файлов.

    // управление
    function restartGame() {
        gameRunning = true;
        isDying = false;
        deathTimer = 0;
        score = 0;
        resetPlayerPos();
        player.vx = 3.8;
        player.vy = 0;
        player.angle = 0;
        player.radius = 9;
        cameraX = 0;
        cameraYOffset = 0;
        thermals = [];
        downdrafts = [];
        windParticles = [];
        sparkParticles = [];
        isPressing = false;
        diffLevel = 0;
        THERMAL_GEN_RATE   = THERMAL_GEN_BASE;
        THERMAL_MAX        = THERMAL_MAX_BASE;
        DOWNDRAFT_GEN_RATE = DOWNDRAFT_GEN_BASE;
        DOWNDRAFT_MAX      = DOWNDRAFT_MAX_BASE;
        diffNoticeTimer    = 0;
        windMilestoneIndex = 0;
        windNoticeTimer    = 0;
        MAX_VX_GROWTH      = Math.max(8, settingsMaxSpeed);
        biomIndex          = 0;
        biomTransition     = 1;
        biomNoticeTimer    = 0;
        biomParticles      = [];
        initMountains();
        for (let i = 0; i < 2; i++) addThermalIfNeeded();
    }
    
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ

    function getCanvasPos(e) {
        // rect уже в CSS-пикселях = logical coords (ctx масштабирован через DPR)
        let rect = canvas.getBoundingClientRect();
        let clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function getSliderHit(cx, cy) {
        const s = UI_SCALE;
        let px = LOGICAL_W - Math.round(240 * s);
        let py = LOGICAL_H / 2 - Math.round(60 * s);
        let pw = Math.round(210 * s);
        if (cx >= px - 10 && cx <= px + pw + 10) {
            if (cy >= py + Math.round(16*s) && cy <= py + Math.round(44*s)) return 'volume';
            if (cy >= py + Math.round(82*s) && cy <= py + Math.round(110*s)) return 'speed';
        }
        return null;
    }

    function applySliderDrag(slider, cx) {
        const s = UI_SCALE;
        let px = LOGICAL_W - Math.round(240 * s);
        let pw = Math.round(210 * s);
        let t = Math.max(0, Math.min(1, (cx - px) / pw));
        if (slider === 'volume') {
            settingsVolume = t;
        } else if (slider === 'speed') {
            settingsMaxSpeed = Math.round(8 + t * 12);
            MAX_VX_GROWTH = settingsMaxSpeed;
        }
    }

    let activeSlider = null;
    let isPortrait = false;

    function handleOrientationChange() {
        const portrait = window.innerHeight > window.innerWidth;
        if (portrait === isPortrait) return;
        isPortrait = portrait;

        let overlay = document.querySelector('.rotate-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'rotate-overlay';
            overlay.innerHTML = `
                <div class="rotate-message">
                    <div class="rotate-icon">📱</div>
                    <div class="rotate-text">ПОВЕРНИТЕ ТЕЛЕФОН</div>
                    <div class="rotate-hint">Игра оптимизирована для горизонтального экрана</div>
                    <div class="rotate-sub">ROTATE TO PLAY</div>
                </div>`;
            document.body.appendChild(overlay);
        }

        if (portrait) {
            overlay.style.display = 'flex';
            isPressing = false;
        } else {
            overlay.style.display = 'none';
        }
    }

    function handlePressStart(e) {
        if (isPortrait) return;
        initAudio();

        if (showWelcome) {
            let pos = getCanvasPos(e);
            let hit = getSliderHit(pos.x, pos.y);
            if (hit) {
                activeSlider = hit;
                applySliderDrag(hit, pos.x);
                e.preventDefault();
                return;
            }
            startGameFromWelcome();
            e.preventDefault();
            return;
        }

        if (!gameRunning) { restartGame(); return; }
        isPressing = true;
        e.preventDefault();
    }

    function handlePressMove(e) {
        if (!activeSlider) return;
        let pos = getCanvasPos(e);
        applySliderDrag(activeSlider, pos.x);
        e.preventDefault();
    }

    function handlePressEnd(e) {
        if (activeSlider) {
            activeSlider = null;
            e.preventDefault();
            return;
        }
        if (showWelcome) return;
        if (!gameRunning) return;
        isPressing = false;
        e.preventDefault();
    }

    function bindControls() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') { e.preventDefault(); handlePressStart(e); }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') { e.preventDefault(); handlePressEnd(e); }
        });
        canvas.addEventListener('mousedown', handlePressStart);
        window.addEventListener('mousemove', handlePressMove);
        window.addEventListener('mouseup', handlePressEnd);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handlePressStart(e); }, { passive: false });
        window.addEventListener('touchmove', (e) => { e.preventDefault(); handlePressMove(e); }, { passive: false });
        window.addEventListener('touchend', (e) => { e.preventDefault(); handlePressEnd(e); }, { passive: false });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // запуск
    resizeCanvas();
    resetPlayerPos();
    window.addEventListener('resize', () => {
        resizeCanvas();
        handleOrientationChange();
    });
    initMountains();
    bindControls();
    handleOrientationChange();

    function animate(timestamp) {
        requestAnimationFrame(animate);
        if (timestamp - lastUpdate >= FRAME_TIME) {
            let delta = Math.min(0.05, (timestamp - lastUpdate) / 1000);
            lastUpdate = timestamp;
            if (gameRunning && !showWelcome) updateGame(delta);
        }
        draw();
    }
    requestAnimationFrame(animate);
