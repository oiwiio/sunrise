(function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Динамическое логическое разрешение — подстраивается под экран
    const BASE_W = 1600;
    const BASE_H = 800;

    let LOGICAL_W = BASE_W;
    let LOGICAL_H = BASE_H;
    let UI_SCALE  = 1;

    function resizeCanvas() {
        const DPR = window.devicePixelRatio || 1;

        const viewW = window.innerWidth;
        const viewH = window.innerHeight;

        // Канвас на весь экран, без чёрных полос
        canvas.style.width  = viewW + 'px';
        canvas.style.height = viewH + 'px';

        // Логическое разрешение = реальные CSS-пиксели
        LOGICAL_W = viewW;
        LOGICAL_H = viewH;

        // Буфер под retina
        canvas.width  = Math.round(LOGICAL_W * DPR);
        canvas.height = Math.round(LOGICAL_H * DPR);

        // Рисуем в логических координатах
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.imageSmoothingEnabled = true;

        // UI_SCALE: 1.0 при BASE_W×BASE_H, меньше на маленьких экранах
        UI_SCALE = Math.max(0.38, Math.min(LOGICAL_W / BASE_W, LOGICAL_H / BASE_H));
    }

    let gameRunning = true;
    let score = 0;
    let highScore = 0;

    let highScorePosition = 0; 
    let showFlag = false;        
    let highScorePositionY = 0;
    
    // облака - препядствия 
    let clouds = []; 
    const CLOUD_MAX = 6;  
    
    // след от параплана
    let trailPoints = [];   // точки для линии следа
    let lastTrailX = 0;     // для проверки, когда добавлять новую точку
    let lastTrailY = 0;

    //привественный экран
    let showWelcome = true;  // показываем только при первой загрузке
    
    // игрок с полной физикой (двигается и по X, и по Y)
    let player = {
        x: 0, // будет выставлено в resetPlayerPos() после resizeCanvas
        y: 0,
        vx: 5.2,
        vy: 0,
        angle: 0,
        radius: 9
    };

    function resetPlayerPos() {
        player.x = LOGICAL_W * 0.35;
        player.y = LOGICAL_H * 0.55;
    }
    
    let cameraX = 0;  // камера следует за игроком
    let isPressing = false;
    
    const GRAVITY = 0.06;
    const DIVE_FORCE = 0.18;
    const LIFT_FORCE = 0.11;
    const MAX_VY = 3.8;
    let MAX_VX_GROWTH = 8;
    let settingsVolume = 0.5;
    let settingsMaxSpeed = 8;
    const WIND_BOOST = 0.009; // ускорение от ветра

    // Пороги увеличения максимальной скорости ветра
    // { score: очки, speed: новый лимит }
    const WIND_MILESTONES = [
        { score:  5000, speed: 10 },
        { score: 10000, speed: 12 },
        { score: 15000, speed: 14 },
        { score: 20000, speed: 16 },
        { score: 25000, speed: 18 },
        { score: 30000, speed: 20 },
    ];
    let windMilestoneIndex = 0; // следующий не пройденный порог
    
    let mountainSegments = [];
    const segmentWidth = 210;
    
    let thermals = [];
    let downdrafts = [];

    const THERMAL_GEN_BASE   = 85;
    const THERMAL_MAX_BASE   = 7;
    const DOWNDRAFT_GEN_BASE = 110;
    const DOWNDRAFT_MAX_BASE = 4;

    let THERMAL_GEN_RATE   = THERMAL_GEN_BASE;
    let THERMAL_MAX        = THERMAL_MAX_BASE;
    let DOWNDRAFT_GEN_RATE = DOWNDRAFT_GEN_BASE;
    let DOWNDRAFT_MAX      = DOWNDRAFT_MAX_BASE;
    let diffLevel          = 0;
    let diffNoticeTimer    = 0;
    let diffNoticeLevel    = 0;
    
    let windParticles = [];
    let sparkParticles = [];
    let frame = 0;
    const FRAME_TIME = 1000 / 60;
    let lastUpdate = 0;

    //звук
    let audioCtx = null;
    let windGain = null, windFilterHigh = null;
    let windNode = null;
    let audioReady = false;

    function makeWindNode() {
        // белый шум через ScriptProcessor — бесконечный поток случайных сэмплов
        let bufferSize = 4096;
        let node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        node.onaudioprocess = function(e) {
            let out = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;
        };
        return node;
    }

    function initAudio() {
        if (audioReady) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // белый шум → bandpass (вырезает узкую полосу "свиста") → lowpass (срезает визг) → gain
            windNode = makeWindNode();

            // bandpass — даёт характерный "шелест" ветра
            let bandpass = audioCtx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.value = 600;
            bandpass.Q.value = 0.8;

            // lowpass — убирает всё резкое сверху
            windFilterHigh = audioCtx.createBiquadFilter();
            windFilterHigh.type = 'lowpass';
            windFilterHigh.frequency.value = 1200;

            windGain = audioCtx.createGain();
            windGain.gain.value = 0;

            windNode.connect(bandpass);
            bandpass.connect(windFilterHigh);
            windFilterHigh.connect(windGain);
            windGain.connect(audioCtx.destination);

            audioReady = true;
        } catch(e) {}
    }

    // обновляем шум ветра каждый кадр
    function updateWindSound() {
        if (!audioReady || !gameRunning) return;
        if (!isFinite(player.vx)) return;
        let t = audioCtx.currentTime;
        let speed = Math.max(0, Math.min(1, player.vx / MAX_VX_GROWTH));
        // громкость растёт со скоростью
        windGain.gain.setTargetAtTime((0.04 + speed * 0.13) * settingsVolume, t, 0.5);
        // фильтр открывается на высокой скорости — ветер становится "острее"
        windFilterHigh.frequency.setTargetAtTime(800 + speed * 1400, t, 0.5);
    }

    // короткий звук термика — нарастающий свист вверх
    function playThermalSound() {
        if (!audioReady) return;
        let t = audioCtx.currentTime;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(620, t + 0.35);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
        gain.gain.linearRampToValueAtTime(0, t + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
    }

    // удар об облако — глухой шлепок (белый шум + фильтр)
    function playCloudHitSound() {
        if (!audioReady) return;
        let t = audioCtx.currentTime;
        let bufSize = audioCtx.sampleRate * 0.18;
        let buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        let data = buffer.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
        let noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        let filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 280;
        filter.Q.value = 0.8;
        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(t);
        noise.stop(t + 0.19);
    }

    // смерть — низкий нисходящий тон
    function playDeathSound() {
        if (!audioReady) return;
        let t = audioCtx.currentTime;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.6);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.6);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.61);
    }
    

    
    //рекорд
    try {
        let saved = localStorage.getItem('sunrise_lightness');
        if (saved && !isNaN(parseInt(saved))) highScore = parseInt(saved);
    } catch(e) {}
    
    // запуск игры с экрана привествия
    function startGameFromWelcome() {
        showWelcome = false;
        gameRunning = true;
        restartGame();
    }
    
    //горы
    function initMountains() {
        mountainSegments = [];
        let lastHeight = LOGICAL_H - 85;
        for (let i = 0; i < 20; i++) {
            let variation = (Math.random() - 0.5) * 42;
            let newHeight = lastHeight + variation;
            newHeight = Math.min(LOGICAL_H - 35, Math.max(LOGICAL_H - 180, newHeight));
            mountainSegments.push({
                x: i * segmentWidth,
                y: newHeight,
                width: segmentWidth
            });
            lastHeight = newHeight;
        }
    }

    function extendWorld() {
        if (mountainSegments.length === 0) {
            initMountains();
            return;
        }
        let lastSeg = mountainSegments[mountainSegments.length - 1];
        let lastY = lastSeg.y;
        let variation = (Math.random() - 0.5) * 48;
        let newY = lastY + variation;
        newY = Math.min(LOGICAL_H - 35, Math.max(LOGICAL_H - 190, newY));
        mountainSegments.push({
            x: lastSeg.x + segmentWidth,
            y: newY,
            width: segmentWidth
        });
        //удаление сегментов позади
        while (mountainSegments.length > 0 && mountainSegments[0].x + segmentWidth < cameraX - 300) {
            mountainSegments.shift();
        }
    }

    //термики
    function addThermalIfNeeded() {
        if (thermals.length >= THERMAL_MAX) return;
        if (Math.random() * 300 < THERMAL_GEN_RATE) {
            thermals.push({
                x: cameraX + LOGICAL_W + 40 + Math.random() * 180,
                y: 70 + Math.random() * (LOGICAL_H - 150),
                radius: 32 + Math.random() * 18,
                pulse: Math.random() * Math.PI * 2,
                strength: 0.28 + Math.random() * 0.18
            });
        }
    }
    
    function addDowndraftIfNeeded() {
        if (downdrafts.length >= DOWNDRAFT_MAX) return;
        if (Math.random() * 350 < DOWNDRAFT_GEN_RATE) {
            downdrafts.push({
                x: cameraX + LOGICAL_W + 30 + Math.random() * 200,
                y: 50 + Math.random() * (LOGICAL_H - 100),
                radius: 35 + Math.random() * 20,
                strength: -0.22 - Math.random() * 0.15
            });
        }
    }

    //облака - препятствия
    function addCloudPoof(x, y, size) {
        for (let i = 0; i < 12; i++) {
            sparkParticles.push({
                x: x - cameraX + (Math.random() - 0.5) * size,
                y: y - getCameraY() + (Math.random() - 0.5) * size * 0.6,
                vx: (Math.random() - 0.5) * 2.5,
                vy: (Math.random() - 0.5) * 2 - 1,
                life: 0.8,
                size: 3 + Math.random() * 6,
                isCloud: true
            });
        }
    }

    function addCloudIfNeeded() {
        if (clouds.length >= 4) return;
        if (Math.random() * 300 < 5) return;
        
        clouds.push({
            x: cameraX + LOGICAL_W + 50 + Math.random() * 200,
            y: 60 + Math.random() * (LOGICAL_H - 120), 
            width: 35 + Math.random() * 25,   
            height: 20 + Math.random() * 15, 
            speedY: (Math.random() - 0.5) * 0.3,
            opacity: 0.7 + Math.random() * 0.3
        });
    }
    
    
    // обычные частицы ветра (слабая турбулентность)
    function addWindParticleNormal() {
        let intensity = Math.min(0.8, player.vx / 12);
        if (Math.random() > 0.2 + intensity * 0.15) return;
        
        windParticles.push({
            x: LOGICAL_W + 10 + Math.random() * 80,
            y: Math.random() * LOGICAL_H,
            length: 12 + Math.random() * 20,
            width: 0.8 + Math.random() * 1.2,
            life: 0.6 + Math.random() * 0.5,
            vx: -(2 + Math.random() * 6 + player.vx * 0.4),
            vy: (Math.random() - 0.5) * 0.6,
            opacity: 0.15 + Math.random() * 0.25
        });
    }

    // линии ветра (только на максимальной скорости)
    function addWindParticleMaxSpeed() {
        let isMaxSpeed = (player.vx > MAX_VX_GROWTH - 0.8);
        if (!isMaxSpeed) return;
        
        if (Math.random() > 0.12) return;
        
        windParticles.push({
            x: LOGICAL_W + 40 + Math.random() * 120,
            y: Math.random() * LOGICAL_H,
            length: 35 + Math.random() * 50,
            width: 1.8 + Math.random() * 2.5,
            life: 0.9 + Math.random() * 0.6,
            vx: -(5 + Math.random() * 12 + player.vx * 0.9),
            vy: (Math.random() - 0.5) * 0.9,
            opacity: 0.4 + Math.random() * 0.4
        });
    }

    // общий вызов частиц ветра
    function addWindParticle() {
        addWindParticleNormal();      // всегда (но редко)
        addWindParticleMaxSpeed();    // только на макс. скорости
    }

    function addLightnessSpark(x, y) {
        for (let i = 0; i < 6; i++) {
            sparkParticles.push({
                x: x - cameraX + (Math.random() - 0.5) * 18,
                y: y - getCameraY() + (Math.random() - 0.5) * 18,
                vx: (Math.random() - 0.5) * 2.2,
                vy: (Math.random() - 0.5) * 2 - 1,
                life: 0.9,
                size: 2 + Math.random() * 4
            });
        }
    }
    
    function updateParticles() {
        for (let i = 0; i < windParticles.length; i++) {
            let p = windParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.008;
            if (p.x < -100 || p.life <= 0) {
                windParticles.splice(i, 1);
                i--;
            }
        }
        for (let i = 0; i < sparkParticles.length; i++) {
            let s = sparkParticles[i];
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.08;
            s.life -= 0.025;
            if (s.life <= 0 || s.y > LOGICAL_H + 50) {
                sparkParticles.splice(i, 1);
                i--;
            }
        }
        for (let i = 0; i < trailPoints.length; i++) {
            trailPoints[i].life -= 0.025;
            if (trailPoints[i].life <= 0) {
                trailPoints.splice(i, 1);
                i--;
            }
        }
    }
    
    //Y камеры (камера следует за Y игрока)
    let cameraYOffset = 0;
    function updateCameraY() {
        let targetCamY = player.y - LOGICAL_H / 2;
        cameraYOffset += (targetCamY - cameraYOffset) * 0.05;
    }
    function getCameraY() {
        return cameraYOffset;
    }
    

    function showDiffNotice(level) {
        diffNoticeLevel = level;
        diffNoticeTimer = 180;
    }

    let windNoticeTimer = 0;
    let windNoticeSpeed = 0;

    function showWindSpeedNotice(speed) {
        windNoticeSpeed = speed;
        windNoticeTimer = 220;
    }

    function updateDifficulty() {
        // 10 уровней сложности растянуты до 30 000 очков — по 3 000 на уровень
        let newLevel = Math.min(10, Math.floor(score / 3000));
        if (newLevel !== diffLevel) {
            diffLevel = newLevel;
            let t = diffLevel / 10;
            THERMAL_GEN_RATE   = THERMAL_GEN_BASE   * (1 - t * 0.55);
            THERMAL_MAX        = Math.max(2, Math.round(THERMAL_MAX_BASE   * (1 - t * 0.5)));
            DOWNDRAFT_GEN_RATE = DOWNDRAFT_GEN_BASE * (1 + t * 1.8);
            DOWNDRAFT_MAX      = Math.min(10, Math.round(DOWNDRAFT_MAX_BASE * (1 + t * 1.5)));
            showDiffNotice(diffLevel);
        }

        // Постепенное увеличение потолка скорости ветра по очкам
        while (
            windMilestoneIndex < WIND_MILESTONES.length &&
            score >= WIND_MILESTONES[windMilestoneIndex].score
        ) {
            let ms = WIND_MILESTONES[windMilestoneIndex];
            // Повышаем только если игрок не выставил меньше в настройках
            MAX_VX_GROWTH = Math.max(ms.speed, settingsMaxSpeed);
            showWindSpeedNotice(ms.speed);
            windMilestoneIndex++;
        }
    }

    //обновление
    function updateGame(delta) {
        if (!gameRunning) return;
        
        // нормализуем delta (чтобы при 60 FPS всё работало как раньше)
        let dt = Math.min(1.5, delta * 60);
        
        //управление по вертикали
        if (isPressing) {
            //пикирование
            player.vy += 0.32 * dt;
            player.angle = Math.min(0.65, player.angle + 0.04 * dt); 
        } else {
            player.vy -= 0.13 * dt;
            player.angle = Math.max(-0.45, player.angle - 0.03 * dt); 
        }
        
        player.vy += GRAVITY * dt;
        if (player.vy > MAX_VY) player.vy = MAX_VY;
        if (player.vy < -4.6) player.vy = -4.6;
        player.y += player.vy * dt;
        
        //горизонтальное движение
        player.vx += WIND_BOOST * dt;
        if (player.vx > MAX_VX_GROWTH) player.vx = MAX_VX_GROWTH;
        player.x += player.vx * dt;
        
        //камера за игроком
        cameraX = player.x - LOGICAL_W * 0.35;
        if (cameraX < 0) cameraX = 0;
        
        //границы по вертикали
        if (player.y < 32) {
            gameRunning = false;
            playDeathSound();
            return;
        }

        // след
        let dist = Math.hypot(player.x - lastTrailX, player.y - lastTrailY);
        if (dist > 12 * dt) {
            trailPoints.push({ x: player.x, y: player.y, life: 1.0 });
            lastTrailX = player.x;
            lastTrailY = player.y;
        }
        while (trailPoints.length > 35) trailPoints.shift();
        
        // столкновение с горами
        let groundCollision = false;
        for (let seg of mountainSegments) {
            let worldX = seg.x;
            if (player.x + 10 > worldX && player.x - 10 < worldX + segmentWidth) {
                let groundY = seg.y - 9;
                if (player.y + 9 >= groundY) {
                    groundCollision = true;
                    break;
                }
            }
        }
        if (player.y + 12 >= LOGICAL_H - 18) groundCollision = true;
        if (groundCollision) {
            gameRunning = false;
            playDeathSound();
            return;
        }
        
        // термики
        for (let i = 0; i < thermals.length; i++) {
            let t = thermals[i];
            let dx = player.x - t.x;
            let dy = player.y - t.y;
            if (Math.hypot(dx, dy) < t.radius + 9) {
                player.vy -= t.strength * 1.2 * dt;
                score += 12;
                addLightnessSpark(t.x, t.y);
                playThermalSound();
                thermals.splice(i, 1);
                i--;
                continue;
            }
            if (t.x < cameraX - 200) {
                thermals.splice(i, 1);
                i--;
            }
        }

        function addNegativeSpark(x, y) {
        for (let i = 0; i < 4; i++) {
            sparkParticles.push({
                x: x - cameraX + (Math.random() - 0.5) * 18,
                y: y - getCameraY() + (Math.random() - 0.5) * 18,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2 - 0.5,
                life: 0.7,
                size: 2 + Math.random() * 3,
                isNegative: true  // метка для отрисовки
            });
        }
    }
        
        //потоки
        for (let i = 0; i < downdrafts.length; i++) {
            let d = downdrafts[i];
            let dx = player.x - d.x;
            let dy = player.y - d.y;
            if (Math.hypot(dx, dy) < d.radius + 9) {
                player.vy += Math.abs(d.strength) * 0.55;
                score = Math.max(0, score - 5);
                addNegativeSpark(d.x, d.y);
                downdrafts.splice(i, 1);
                i--;
                continue;
            }
            if (d.x < cameraX - 200) {
                downdrafts.splice(i, 1);
                i--;
            }
        }
        
        //генерация
        addThermalIfNeeded();
        addDowndraftIfNeeded();
        
        // генерация гор
        if (mountainSegments.length > 0) {
            let lastBlock = mountainSegments[mountainSegments.length - 1];
            if (lastBlock.x < cameraX + LOGICAL_W + 200) {
                extendWorld();
            }
        } else {
            initMountains();
        }

        // облака
        for (let i = 0; i < clouds.length; i++) {
            let c = clouds[i];
            c.x -= player.vx * 0.55 * dt;
            c.y += c.speedY * dt;
            
            let dx = player.x - c.x;
            let dy = player.y - c.y;
            let collisionDist = (c.width / 2) + 12;
            if (Math.abs(dx) < collisionDist && Math.abs(dy) < (c.height / 2) + 10) {
                player.vx *= 0.85;
                score = Math.max(0, score - 15);
                addCloudPoof(c.x, c.y, c.width);
                playCloudHitSound();
                clouds.splice(i, 1);
                i--;
                continue;
            }
            
            if (c.x + c.width < cameraX - 100) {
                clouds.splice(i, 1);
                i--;
            }
        }
        addCloudIfNeeded();
        
        updateDifficulty();

        // счёт
        let isMaxSpeed = (player.vx > MAX_VX_GROWTH - 0.8);
        if (isMaxSpeed) {
            score += 0.5 * dt;
            let speedBonus = Math.floor(player.vx * 0.3 * dt);
            score += Math.min(2, speedBonus);
        }
        
        //плавный возврат угла
       player.angle *= Math.pow(0.98, dt);
        
        //частицы
        addWindParticle();
        updateParticles();
        
        //рекорд
        if (Math.floor(score) > highScore) {
            highScore = Math.floor(score);
            highScorePosition = player.x;
            highScorePositionY = player.y;
            showFlag = true;
            try { localStorage.setItem('sunrise_lightness', highScore); } catch(e) {}
        }
        
        updateWindSound();
        updateCameraY();
    }

    
    // привественный экран
    function drawWelcomeScreen() {
        // тёмный градиентный фон
        let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#2B1F3D');
        grad.addColorStop(1, '#0a0c14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // рассветное солнце
        ctx.beginPath();
        ctx.arc(canvas.width - 60, 70, 38, 0, Math.PI * 2);
        ctx.fillStyle = '#FFA471';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width - 60, 70, 28, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD89C';
        ctx.fill();
        
        // силуэты гор на фоне
        ctx.fillStyle = '#1D142B';
        for (let i = 0; i < 5; i++) {
            let x = i * 180 - (frame * 0.3) % 180;
            ctx.beginPath();
            ctx.moveTo(x, canvas.height);
            ctx.lineTo(x + 60, canvas.height - 40);
            ctx.lineTo(x + 120, canvas.height - 20);
            ctx.lineTo(x + 180, canvas.height);
            ctx.fill();
        }
        
        // заголовок
        const s = UI_SCALE;
        ctx.font = `bold ${Math.round(56*s)}px "Segoe UI", "Courier New", monospace`;
        ctx.fillStyle = '#FFF9E8';
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText('SUNRISE', canvas.width / 2 - Math.round(130*s), canvas.height / 2 - Math.round(80*s));
        ctx.shadowBlur = 0;
        
        // подзаголовок
        ctx.font = `${Math.round(18*s)}px monospace`;
        ctx.fillStyle = '#FFD6A5';
        ctx.fillText('', canvas.width / 2 - Math.round(85*s), canvas.height / 2 - Math.round(30*s));
        
        // описание управления
        ctx.font = `${Math.round(14*s)}px monospace`;
        ctx.fillStyle = '#ffd9b5';
        ctx.fillText('ЗАЖМИ — ПИКИРУЙ', canvas.width / 2 - Math.round(100*s), canvas.height / 2 + Math.round(40*s));
        ctx.fillText('ОТПУСТИ — ПАРИ', canvas.width / 2 - Math.round(90*s), canvas.height / 2 + Math.round(68*s));
        
        // подсказка для мобильных
        ctx.fillText('ПОВЕРНИТЕ ТЕЛЕФОН', canvas.width / 2 - Math.round(100*s), canvas.height / 2 + Math.round(105*s));
        ctx.fillText('ДЛЯ КОМФОРТНОЙ ИГРЫ', canvas.width / 2 - Math.round(100*s), canvas.height / 2 + Math.round(125*s));
    
        // визуальная подсказка
        ctx.font = `bold ${Math.round(18*s)}px monospace`;
        ctx.fillStyle = '#FFCF9A';
        ctx.fillText('--> ЛЮБОЕ НАЖАТИЕ <--', canvas.width / 2 - Math.round(110*s), canvas.height / 2 + Math.round(165*s));
        
        // рекорд
        if (highScore > 0) {
            ctx.font = `${Math.round(13*s)}px monospace`;
            ctx.fillStyle = '#c9b28b';
            ctx.fillText(`лучший полёт: ${highScore} ✦`, canvas.width / 2 - Math.round(80*s), canvas.height - Math.round(60*s));
        }

        
        // парящие частицы
        for (let i = 0; i < 12; i++) {
            let x = (frame * 0.2 + i * 37) % (canvas.width + 100) - 50;
            let y = 80 + Math.sin(frame * 0.02 + i) * 25;
            ctx.fillStyle = `rgba(255, 215, 150, ${0.2 + Math.sin(frame * 0.05 + i) * 0.1})`;
            ctx.beginPath();
            ctx.arc(x, y, 2 + Math.sin(frame * 0.07 + i) * 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // панель настроек
        drawSettingsPanel();
    }

    function drawSlider(x, y, w, t, s) {
        s = s || 1;
        const h = Math.round(6*s);
        const r = Math.round(3*s);
        const knob = Math.round(9*s);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fillStyle = 'rgba(255,217,181,0.14)';
        ctx.fill();
        if (t > 0) {
            ctx.beginPath();
            ctx.roundRect(x, y, w * t, h, r);
            ctx.fillStyle = 'rgba(255,185,100,0.75)';
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x + w * t, y + h/2, knob, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD6A5';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function drawSettingsPanel() {
        const s = UI_SCALE;
        let pw = Math.round(210 * s);
        let px = canvas.width - Math.round(248 * s);
        let py = canvas.height / 2 - Math.round(60 * s);

        // подложка
        ctx.fillStyle = 'rgba(10, 12, 20, 0.6)';
        ctx.beginPath();
        ctx.roundRect(px - Math.round(16*s), py - Math.round(32*s), pw + Math.round(32*s), Math.round(190*s), Math.round(14*s));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 217, 181, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold ${Math.round(11*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.45)';
        ctx.fillText('⚙  НАСТРОЙКИ', px, py - Math.round(12*s));

        ctx.font = `${Math.round(12*s)}px monospace`;
        ctx.fillStyle = '#ffd9b5';
        ctx.fillText('ЗВУК', px, py + Math.round(14*s));
        ctx.font = `${Math.round(11*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.5)';
        ctx.fillText(Math.round(settingsVolume * 100) + '%', px + pw - Math.round(28*s), py + Math.round(14*s));
        drawSlider(px, py + Math.round(22*s), pw, settingsVolume, s);

        ctx.font = `${Math.round(12*s)}px monospace`;
        ctx.fillStyle = '#ffd9b5';
        ctx.fillText('МАКС. СКОРОСТЬ', px, py + Math.round(80*s));
        ctx.font = `${Math.round(11*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.5)';
        ctx.fillText('' + settingsMaxSpeed, px + pw - Math.round(18*s), py + Math.round(80*s));
        let speedT = (settingsMaxSpeed - 8) / 12;
        drawSlider(px, py + Math.round(88*s), pw, speedT, s);

        ctx.font = `${Math.round(10*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.3)';
        ctx.fillText('8', px, py + Math.round(118*s));
        ctx.fillText('20', px + pw - Math.round(14*s), py + Math.round(118*s));
    }

    //флажек рекорда
    function drawRecordFlag(currentX, camY) {
        if (!showFlag) return;
        
        // флаг появляется только если игрок ещё не прошел это место
        if (player.x < highScorePosition - 50) return;
        
        const screenX = highScorePosition - cameraX;
        
        // Не рисуем, если флаг далеко за пределами экрана
        if (screenX < -50 || screenX > canvas.width + 50) return;
        
        // древко флага
        ctx.beginPath();
        ctx.moveTo(screenX, 50 - camY);
        ctx.lineTo(screenX, 150 - camY);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFD966';
        ctx.stroke();
        
        // полотнище флага
        ctx.beginPath();
        ctx.moveTo(screenX, 50 - camY);
        ctx.lineTo(screenX + 35, 65 - camY);
        ctx.lineTo(screenX, 80 - camY);
        ctx.fillStyle = '#FFA471';
        ctx.fill();
        
        // звездочка/символ рекорда на флаге
        ctx.font = '20px monospace';
        ctx.fillStyle = '#FFF9E8';
        ctx.fillText('✦', screenX + 8, 73 - camY);
        
        // маленькая табличка с числом
        ctx.font = '10px monospace';
        ctx.fillStyle = '#FFD6A5';
        ctx.shadowBlur = 0;
        ctx.fillText(`${highScore}`, screenX + 12, 97 - camY);
        
        // эффект пульсации
        let distance = Math.abs(player.x - highScorePosition);
        if (distance < 150) {
            let pulse = 0.8 + Math.sin(Date.now() * 0.008) * 0.2;
            ctx.beginPath();
            ctx.arc(screenX, 65 - camY, 20 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 215, 150, ${0.15 * (1 - distance/150)})`;
            ctx.fill();
        }
    }
    
    //отрисовка
    function draw() {
        // если показываем приветственный экран — рисуем его и выходим
        if (showWelcome) {
            drawWelcomeScreen();
            frame++;
            return;
        }
        
        const camY = getCameraY();
        
        //небо
        let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#FFA471');
        grad.addColorStop(0.62, '#784BA0');
        grad.addColorStop(1, '#2B1F3D');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        //граница
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, 32 - camY);
        ctx.lineTo(canvas.width, 32 - camY);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '12px monospace';
        if (24 - camY > 20 && 24 - camY < canvas.height - 20) {
            ctx.fillText('ПРЕДЕЛ ВЫСОТЫ', canvas.width - 160, 24 - camY);
        }
        
    //солнце
    let sunX = canvas.width - 90;
    let sunY = 78;

    let pulse = 0.95 + Math.sin(frame * 0.03) * 0.05;
    let rayRotation = frame * 0.01;
    let rayRotation2 = -frame * 0.006;

    //атмосферное свечение (бледнее)
    let atmosphere = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 180);
    atmosphere.addColorStop(0, 'rgba(255,220,150,0.08)');   
    atmosphere.addColorStop(0.5, 'rgba(255,170,90,0.04)'); 
    atmosphere.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 180, 0, Math.PI * 2);
    ctx.fill();

    //лучи
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(rayRotation);
    for (let i = 0; i < 10; i++) {
        let angle = (i / 10) * Math.PI * 2;
        ctx.save();
        ctx.rotate(angle);
        let len = 95 + Math.sin(frame * 0.04 + i) * 12;
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(len, -5);
        ctx.lineTo(len, 5);
        ctx.fillStyle = `rgba(255,220,150,${0.1 + Math.sin(frame * 0.02 + i) * 0.05})`;
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();

    //лучи
    ctx.save(); 
    ctx.translate(sunX, sunY);
    ctx.rotate(rayRotation2);
    for (let i = 0; i < 6; i++) {
        let angle = (i / 6) * Math.PI * 2;
        ctx.save();
        ctx.rotate(angle);
        let len = 65 + Math.sin(frame * 0.05 + i) * 8;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(len, -3);
        ctx.lineTo(len, 3);
        ctx.fillStyle = `rgba(255,245,200,${0.12 + Math.sin(frame * 0.03 + i) * 0.04})`;
        ctx.fill();
        ctx.restore();
    }
        ctx.restore();

    //внешний ореол
    let outer = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 85);
    outer.addColorStop(0, 'rgba(255,235,180,0.35)'); 
    outer.addColorStop(0.6, 'rgba(255,180,110,0.1)');
    outer.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 85 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    //ядро солнца
    let core = ctx.createRadialGradient(sunX - 5, sunY - 5, 0, sunX, sunY, 38);
    core.addColorStop(0, '#fffef0');   
    core.addColorStop(0.25, '#ffe6b0');   
    core.addColorStop(0.7, '#ffbc60');    
    core.addColorStop(1, '#ff9028');      
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();

    //центральная яркая точка
    ctx.beginPath();
    ctx.arc(sunX, sunY, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,240,0.85)';
    ctx.fill();

    //крест-блик
    ctx.beginPath();
    ctx.moveTo(sunX - 18, sunY);
    ctx.lineTo(sunX + 18, sunY);
    ctx.moveTo(sunX, sunY - 18);
    ctx.lineTo(sunX, sunY + 18);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,210,0.35)';
    ctx.stroke();

    //парящие частицы
    for (let i = 0; i < 8; i++) {
        let angle = (i / 8) * Math.PI * 2 + frame * 0.01;
        let radius = 48 + Math.sin(frame * 0.03 + i) * 8;
        let px = sunX + Math.cos(angle) * radius;
        let py = sunY + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(px, py, 1.8 + Math.sin(frame * 0.04 + i) * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,230,160,${0.2 + Math.sin(frame * 0.05 + i) * 0.1})`;
        ctx.fill();
    }
        
    //дальние горы
    ctx.fillStyle = '#3E2C49';

    for (let seg of mountainSegments) {
        let screenX = seg.x - cameraX;
        let y = seg.y - camY;

        if (screenX + segmentWidth > -50 && screenX < canvas.width + 100) { 
            ctx.beginPath();
            ctx.moveTo(screenX, canvas.height);
            ctx.lineTo(screenX, y - 20);

            ctx.quadraticCurveTo(
                screenX + segmentWidth * 0.18,y - 44,
                screenX + segmentWidth * 0.3,y - 38
            );
            ctx.quadraticCurveTo(
                screenX + segmentWidth * 0.45,y - 18,
                screenX + segmentWidth * 0.55,y - 28
            );
            ctx.quadraticCurveTo(
                screenX + segmentWidth * 0.72,y - 36,
                screenX + segmentWidth * 0.8,y - 18
            );
            ctx.quadraticCurveTo(
                screenX + segmentWidth * 0.92,y - 10,
                screenX + segmentWidth,y - 14
            );
            ctx.lineTo(screenX + segmentWidth, canvas.height);
            ctx.fill();
        }
        }


    //ближние горы
    ctx.fillStyle = '#1D142B';

    for (let seg of mountainSegments) {
        let screenX = seg.x - cameraX;
        let y = seg.y - camY;

        if (screenX + segmentWidth > -50 && screenX < canvas.width + 100) {
            ctx.beginPath();
            ctx.moveTo(screenX, canvas.height);
            ctx.lineTo(screenX, y);
            ctx.quadraticCurveTo(
                screenX + segmentWidth * 0.15,y - 20,
                screenX + segmentWidth * 0.25,y - 14
            );
            ctx.quadraticCurveTo(
                screenX + segmentWidth * 0.38, y - 34,
                screenX + segmentWidth * 0.45, y - 24
            );
            ctx.quadraticCurveTo(
                screenX + segmentWidth * 0.58,y - 10,
                screenX + segmentWidth * 0.65,y - 18
            );
            ctx.quadraticCurveTo(
                screenX + segmentWidth * 0.82,y - 20,
                screenX + segmentWidth,y - 6
            );
            ctx.lineTo(screenX + segmentWidth, canvas.height);
            ctx.fill();
        }
    }

        // облака
        for (let c of clouds) {
            let x = c.x - cameraX;
            let y = c.y - camY;
            let w = c.width;
            let h = c.height;
            
            if (!isFinite(x) || !isFinite(y) || !w || !h) continue;
            // лёгкая дымка вокруг облака
            let glow = ctx.createRadialGradient(x, y, h * 0.2, x, y, w * 0.9);

                

            glow.addColorStop(0, 'rgba(255, 240, 220, 0.08)');
            glow.addColorStop(1, 'rgba(255, 240, 220, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.ellipse(x, y, w, h * 0.9, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // силуэт нижних "пухов" (тень)
            ctx.fillStyle = 'rgba(180, 190, 210, 0.16)';
            ctx.beginPath();
            ctx.arc(x - w * 0.38, y + 8, h * 0.42, 0, Math.PI * 2);
            ctx.arc(x + w * 0.3, y + 10, h * 0.4, 0, Math.PI * 2);
            ctx.arc(x, y + 4, h * 0.52, 0, Math.PI * 2);
            ctx.fill();
            
            // основное тело облака (градиент)
            let body = ctx.createLinearGradient(x, y - h, x, y + h);
            body.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
            body.addColorStop(1, 'rgba(230, 235, 245, 0.72)');
            ctx.fillStyle = body;
            ctx.beginPath();
            ctx.arc(x - w * 0.42, y, h * 0.46, 0, Math.PI * 2);
            ctx.arc(x - w * 0.1, y - h * 0.18, h * 0.56, 0, Math.PI * 2); 
            ctx.arc(x + w * 0.22, y - h * 0.08, h * 0.5, 0, Math.PI * 2);
            ctx.arc(x + w * 0.45, y + h * 0.04, h * 0.38, 0, Math.PI * 2);
            ctx.fill();
            
            // рассветная подсветка сверху
            let highlight = ctx.createLinearGradient(x, y - h, x, y);
            highlight.addColorStop(0, 'rgba(255, 220, 170, 0.28)');
            highlight.addColorStop(1, 'rgba(255, 220, 170, 0)');
            ctx.fillStyle = highlight;
            ctx.beginPath();
            ctx.arc(x - w * 0.15, y - h * 0.2, h * 0.28, 0, Math.PI * 2);
            ctx.arc(x + w * 0.15, y - h * 0.16, h * 0.24, 0, Math.PI * 2);
            ctx.fill();
            
            // лёгкая обводка (воздушность)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x - w * 0.42, y, h * 0.46, 0, Math.PI * 2);
            ctx.arc(x - w * 0.1, y - h * 0.18, h * 0.56, 0, Math.PI * 2);
            ctx.arc(x + w * 0.22, y - h * 0.08, h * 0.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        //термики
        for (let t of thermals) {
            let screenX = t.x - cameraX;
            let screenY = t.y - camY;
            ctx.beginPath();
            let pulseScale = 0.85 + Math.sin(frame * 0.025 + t.pulse) * 0.1;
            ctx.arc(screenX, screenY, t.radius * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 215, 150, ${0.24 + Math.sin(Date.now() * 0.005) * 0.08})`;
            ctx.fill();
        }
        
        // турбулентность (только рендер)
        for (let d of downdrafts) {
            let screenX = d.x - cameraX;
            let screenY = d.y - camY;
            ctx.beginPath();
            ctx.arc(screenX, screenY, d.radius - 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(90, 110, 150, 0.24)';
            ctx.fill();
        }
        
        //отрисовка флага рекорда
        // drawRecordFlag(player.x, camY);


        // индикатор максимальной скорости
        let isMaxSpeed = (player.vx > MAX_VX_GROWTH - 0.8);
        if (isMaxSpeed) {
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = '#FFD966';
            ctx.fillText(' MAX SPEED ', canvas.width - 130, 58);
        }

        // тонкий след от параплана (конденсация)
        if (trailPoints.length > 1) {
            ctx.beginPath();
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            for (let i = 0; i < trailPoints.length - 1; i++) {
                let p1 = trailPoints[i];
                let p2 = trailPoints[i + 1];
                
                // преобразуем абсолютные координаты в экранные
                let screenX1 = p1.x - cameraX;
                let screenY1 = p1.y - camY;
                let screenX2 = p2.x - cameraX;
                let screenY2 = p2.y - camY;
                
                // плавное исчезновение
                let opacity = p1.life * 0.4;
                
                ctx.beginPath();
                ctx.moveTo(screenX1, screenY1);
                ctx.lineTo(screenX2, screenY2);
                ctx.strokeStyle = `rgba(255, 255, 240, ${opacity})`;
                ctx.stroke();
            }
        }

        // линии ветра
        for (let p of windParticles) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.length, p.y - p.vy * 2);
            ctx.lineWidth = p.width;
            ctx.strokeStyle = `rgba(255, 255, 210, ${p.life * p.opacity * 0.6})`;
            ctx.stroke();
        }

    //игрок
    ctx.save();
    ctx.translate(player.x - cameraX, player.y - camY);
    ctx.rotate(player.angle);

    let flap = Math.sin(frame * 0.18) * 0.8;
    let scarfSwing = Math.max(-14, Math.min(14, -player.vy * 2.2));

    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(0,0,0,0.18)';

    //крыло
    let wingGrad = ctx.createLinearGradient(-12, -10, 18, 6);
    wingGrad.addColorStop(0, '#FFF7EA');
    wingGrad.addColorStop(0.45, '#FFE1B6');
    wingGrad.addColorStop(1, '#FFC97A');

    ctx.beginPath();
    ctx.moveTo(18, -4);
    ctx.quadraticCurveTo(8, -16 - flap, -6, -11);
    ctx.quadraticCurveTo(-13, -2, -10, 5);
    ctx.quadraticCurveTo(2, 2 + flap * 0.3, 18, -4);
    ctx.fillStyle = wingGrad;
    ctx.fill();

    //нижняя тень крыла 
    ctx.beginPath();
    ctx.moveTo(12, -3);
    ctx.quadraticCurveTo(2, 1, -6, 3);
    ctx.quadraticCurveTo(2, 4, 12, -3);
    ctx.fillStyle = 'rgba(140, 90, 40, 0.14)';
    ctx.fill();

    //стропы
    ctx.beginPath();
    ctx.moveTo(-2, -8); ctx.lineTo(-6, 4);
    ctx.moveTo(4, -9);  ctx.lineTo(-1, 5);
    ctx.moveTo(10, -6); ctx.lineTo(4, 5);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#B78D62';
    ctx.stroke();

    //тело
    let bodyGrad = ctx.createLinearGradient(-5, 0, 4, 10);
    bodyGrad.addColorStop(0, '#F3C98E');
    bodyGrad.addColorStop(1, '#C9975E');

    ctx.beginPath();
    ctx.ellipse(-1, 5, 4, 5.5, 0.12, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
        
    //голова
    let headGrad = ctx.createRadialGradient(-4, 0, 1, -2, 2, 5);
    headGrad.addColorStop(0, '#FFE2B7');
    headGrad.addColorStop(1, '#D9A66C');

    ctx.beginPath();
    ctx.arc(-2.8, 1.8, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.fill();

    //шарф
    ctx.beginPath();
    ctx.moveTo(1, 4);
    ctx.quadraticCurveTo(-10, 5 + scarfSwing * 0.2, -18, 8 + scarfSwing);
    ctx.quadraticCurveTo(-12, 7 + scarfSwing * 0.45, -2, 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#FFF1D6';
    ctx.stroke();

    //глаз
    ctx.beginPath();
    ctx.arc(-4.4, 1.2, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-4.7, 1.1, 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
        ctx.fill();

    //улыбка
    ctx.beginPath();
    ctx.arc(-3.2, 2.4, 1.2, 0.2, Math.PI - 0.2);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#8B5A2B';
    ctx.stroke();

    //ноги
    ctx.beginPath();
    ctx.moveTo(-3, 9);  
    ctx.lineTo(-7, 13 + flap * 0.2);
    ctx.moveTo(1, 9);
    ctx.lineTo(4, 12);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#C79C6B';
    ctx.stroke();

    //свет сверху
    ctx.beginPath();
    ctx.moveTo(12, -5);
    ctx.quadraticCurveTo(2, -12, -5, -8);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();

        // искры (жёлтые, синие, облачные)
        for (let s of sparkParticles) {
            let color;
            if (s.isCloud) {
                color = `rgba(240, 248, 255, ${s.life * 0.8})`;
            } else if (s.isNegative) {
                color = `rgba(100, 150, 200, ${s.life * 0.9})`;
            } else {
                color = `rgba(255, 220, 140, ${s.life * 0.9})`;
            }
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        //ui
        const s = UI_SCALE;
        if (diffNoticeTimer > 0) {
            diffNoticeTimer--;
            let alpha = Math.min(1, diffNoticeTimer / 40);
            let msgs = ['','ВЕТЕР УСИЛИВАЕТСЯ...','НЕБО МЕНЯЕТСЯ','ТРУДНЕЕ...',
                        'ОПАСНЫЕ ПОТОКИ','ТЕРМИКОВ МЕНЬШЕ','ДЕРЖИСЬ!',
                        'ШТОРМ БЛИЗКО','КРИТИЧЕСКАЯ ЗОНА','НА ПРЕДЕЛЕ','МАКСИМАЛЬНАЯ БУРЯ'];
            ctx.save();
            ctx.font = `bold ${Math.round(16*UI_SCALE)}px monospace`;
            ctx.fillStyle = 'rgba(255, 160, 80, ' + alpha + ')';
            ctx.textAlign = 'center';
            ctx.fillText(msgs[diffNoticeLevel] || '', canvas.width / 2, canvas.height / 2 - 80);
            ctx.textAlign = 'left';
            ctx.restore();
        }

        // уведомление о росте потолка скорости ветра
        if (windNoticeTimer > 0) {
            windNoticeTimer--;
            let alpha = Math.min(1, windNoticeTimer / 40);
            ctx.save();
            ctx.font = `bold ${Math.round(15*UI_SCALE)}px monospace`;
            ctx.fillStyle = `rgba(255, 230, 100, ${alpha})`;
            ctx.textAlign = 'center';
            ctx.fillText(`⚡ ВЕТЕР КРЕПЧАЕТ — МАКС. ${windNoticeSpeed}`, canvas.width / 2, canvas.height / 2 - Math.round(55*UI_SCALE));
            ctx.textAlign = 'left';
            ctx.restore();
        }
        ctx.font = `bold ${Math.round(28*s)}px "Segoe UI", "Courier New", monospace`;
        ctx.fillStyle = '#FFF9E8';
        ctx.fillText('✦ ' + Math.floor(score), Math.round(28*s), Math.round(58*s));
        ctx.font = `${Math.round(14*s)}px monospace`;
        ctx.fillStyle = '#FFD6A5';
        ctx.fillText(`РЕКОРД ${highScore}`, Math.round(28*s), Math.round(96*s));
        
        let windPercent = Math.min(100, Math.floor((player.vx - 3) / 6 * 100));
        const barX = Math.round(28*s), barY = Math.round(115*s), barW = Math.round(120*s), barH = Math.round(8*s);
        const filled = Math.max(Math.round(10*s), Math.round(windPercent * 1.2 * s));
        ctx.fillStyle = '#FFF2BF';
        ctx.fillRect(barX, barY, filled, barH);
        ctx.fillStyle = '#D9C291';
        ctx.fillRect(barX + filled, barY, barW - filled, barH);
        ctx.fillStyle = '#FFEFC0';
        ctx.font = `${Math.round(10*s)}px monospace`;
        ctx.fillText(`ВЕТЕР ↑`, Math.round(32*s), Math.round(133*s));
        
        ctx.font = 'italic 12px monospace';
        ctx.fillStyle = "#f7e5c2";
        
        
        if (!gameRunning) {
            ctx.font = `bold ${Math.round(34*s)}px monospace`;
            ctx.fillStyle = '#FFF3DF';
            ctx.fillText('ПОКИНУЛ НЕБО', canvas.width / 2 - Math.round(150*s), canvas.height / 2 - Math.round(40*s));
            ctx.font = `${Math.round(18*s)}px monospace`;
            ctx.fillStyle = '#FFCF9A';
            ctx.fillText('НАЖМИ ПРОБЕЛ / КЛИК / ТАП → НОВЫЙ ПОЛЁТ', canvas.width / 2 - Math.round(210*s), canvas.height / 2 + Math.round(40*s));
            
            // звезда на месте рекорда
            if (highScorePosition > 0) {
                const starX = highScorePosition - cameraX;
                const starY = highScorePositionY - camY;  // нужна будет отдельная переменная
                
                if (starX > -50 && starX < canvas.width + 50) {
                    ctx.font = '24px monospace';
                    ctx.fillStyle = '#FFD966';
                    ctx.shadowBlur = 4;
                    ctx.fillText('✦', starX - 10, starY - 20);
                    
                    ctx.font = '10px monospace';
                    ctx.fillStyle = '#c9b28b';
                    ctx.fillText('рекорд был здесь', starX - 55, starY - 5);
                    ctx.shadowBlur = 0;
                }
            }
        }

        // эффект рассвета (линзовые блики + дымка)
        // теплая дымка поверх неба (мягкий градиент)
        let hazeGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        hazeGrad.addColorStop(0, 'rgba(255, 220, 150, 0.12)');
        hazeGrad.addColorStop(0.5, 'rgba(255, 180, 100, 0.05)');
        hazeGrad.addColorStop(1, 'rgba(255, 140, 80, 0)');
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // линзовый блик
        let flareX = canvas.width - 80;
        let flareY = 60;        
        
        // основной блик (яркое пятно)
        let mainFlare = ctx.createRadialGradient(flareX, flareY, 5, flareX, flareY, 45);
        mainFlare.addColorStop(0, 'rgba(255, 240, 200, 0.25)');
        mainFlare.addColorStop(0.6, 'rgba(255, 200, 100, 0.1)');
        mainFlare.addColorStop(1, 'rgba(255, 160, 80, 0)');
        ctx.fillStyle = mainFlare;
        ctx.beginPath();
        ctx.arc(flareX, flareY, 60, 0, Math.PI * 2);
        ctx.fill();
        
        // маленький яркий центр
        ctx.fillStyle = 'rgba(255, 255, 220, 0.2)';
        ctx.beginPath();
        ctx.arc(flareX, flareY, 18, 0, Math.PI * 2);
        ctx.fill();
        
        // горизонтальный блик
        ctx.fillStyle = 'rgba(255, 200, 120, 0.06)';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(flareX + (i - 1) * 35, flareY + 12, 20, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

    }


    //управление
    function restartGame() {
        gameRunning = true;
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
        initMountains();
        for (let i = 0; i < 2; i++) addThermalIfNeeded();
    }
    
    // ========= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ =========

    function getCanvasPos(e) {
        let rect = canvas.getBoundingClientRect();
        let scaleX = canvas.width / rect.width;
        let scaleY = canvas.height / rect.height;
        let clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function getSliderHit(cx, cy) {
        const s = UI_SCALE;
        let px = canvas.width - Math.round(240 * s);
        let py = canvas.height / 2 - Math.round(60 * s);
        let pw = Math.round(210 * s);
        if (cx >= px - 10 && cx <= px + pw + 10) {
            if (cy >= py + Math.round(16*s) && cy <= py + Math.round(44*s)) return 'volume';
            if (cy >= py + Math.round(82*s) && cy <= py + Math.round(110*s)) return 'speed';
        }
        return null;
    }

    function applySliderDrag(slider, cx) {
        const s = UI_SCALE;
        let px = canvas.width - Math.round(240 * s);
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

    //запуск
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
})();