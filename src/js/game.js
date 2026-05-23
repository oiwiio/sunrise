(function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 1000;
    canvas.height = 600;

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
        x: canvas.width * 0.35,
        y: canvas.height * 0.55,
        vx: 5.2,
        vy: 0,
        angle: 0,
        radius: 9
    };
    
    let cameraX = 0;  // камера следует за игроком
    let isPressing = false;
    
    const GRAVITY = 0.06;
    const DIVE_FORCE = 0.18;
    const LIFT_FORCE = 0.11;
    const MAX_VY = 3.8;
    const MAX_VX_GROWTH = 8;
    const WIND_BOOST = 0.009; // ускорение от ветра
    
    let mountainSegments = [];
    const segmentWidth = 210;
    
    let thermals = [];
    let downdrafts = [];

    const THERMAL_GEN_RATE = 85;
    const THERMAL_MAX = 7;
    const DOWNDRAFT_GEN_RATE = 110;
    const DOWNDRAFT_MAX = 4;
    
    let windParticles = [];
    let sparkParticles = [];
    let frame = 0;
    
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
        let lastHeight = canvas.height - 85;
        for (let i = 0; i < 20; i++) {
            let variation = (Math.random() - 0.5) * 42;
            let newHeight = lastHeight + variation;
            newHeight = Math.min(canvas.height - 35, Math.max(canvas.height - 180, newHeight));
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
        newY = Math.min(canvas.height - 35, Math.max(canvas.height - 190, newY));
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
                x: cameraX + canvas.width + 40 + Math.random() * 180,
                y: 70 + Math.random() * (canvas.height - 150),
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
                x: cameraX + canvas.width + 30 + Math.random() * 200,
                y: 50 + Math.random() * (canvas.height - 100),
                radius: 35 + Math.random() * 20,
                strength: -0.22 - Math.random() * 0.15
            });
        }
    }

    //облака - предпятсивя
    function addCloudIfNeeded() {
        if (clouds.length >= 4) return;
        if (Math.random() * 300 < 5) return;
        
        clouds.push({
            x: cameraX + canvas.width + 50 + Math.random() * 200,
            y: 60 + Math.random() * (canvas.height - 120), 
            width: 35 + Math.random() * 25,   
            height: 20 + Math.random() * 15, 
            speedY: (Math.random() - 0.5) * 0.3,
            opacity: 0.7 + Math.random() * 0.3
        });
    }

        // облака (движение и столкновение)
        for (let i = 0; i < clouds.length; i++) {
            let c = clouds[i];
            c.x -= player.vx * 0.6;   // движутся медленнее, чем горы (параллакс)
            c.y += c.speedY;
            
            // проверка столкновения с игроком
            let dx = player.x - c.x;
            let dy = player.y - c.y;
            let collisionDist = (c.width / 2) + 10;
            if (Math.abs(dx) < collisionDist && Math.abs(dy) < (c.height / 2) + 8) {
                // замедление
                player.vx *= 0.85;
                score = Math.max(0, score - 15);
                // визуальный эффект — облако "взрывается"
                addCloudPoof(c.x, c.y, c.width);
                clouds.splice(i, 1);
                i--;
                continue;
            }
            
            // удаляем, если ушло за левый край
            if (c.x + c.width < cameraX - 100) {
                clouds.splice(i, 1);
                i--;
            }
        }
        
        // генерация новых облаков
        addCloudIfNeeded();

        function addCloudPoof(x, y, size) {
        for (let i = 0; i < 12; i++) {
            sparkParticles.push({
                x: x - cameraX + (Math.random() - 0.5) * size,
                y: y - cameraY() + (Math.random() - 0.5) * size * 0.6,
                vx: (Math.random() - 0.5) * 2.5,
                vy: (Math.random() - 0.5) * 2 - 1,
                life: 0.8,
                size: 3 + Math.random() * 6,
                isCloud: true
            });
        }
    }
    
    
    // обычные частицы ветра (слабая турбулентность)
    function addWindParticleNormal() {
        let intensity = Math.min(0.8, player.vx / 12);
        if (Math.random() > 0.2 + intensity * 0.15) return;
        
        windParticles.push({
            x: canvas.width + 10 + Math.random() * 80,
            y: Math.random() * canvas.height,
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
            x: canvas.width + 40 + Math.random() * 120,
            y: Math.random() * canvas.height,
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
                y: y - cameraY() + (Math.random() - 0.5) * 18,
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
            if (s.life <= 0 || s.y > canvas.height + 50) {
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
    function cameraY() {
        // плавное следование камеры за игроком по вертикали
        let targetCamY = player.y - canvas.height / 2;
        cameraYOffset += (targetCamY - cameraYOffset) * 0.05;
        return cameraYOffset;
    }
    
    //обновление
    function updateGame() {
        if (!gameRunning) return;
        
        //управление по вертикали
        if (isPressing) {
            //пикирование
            player.vy += 0.32;
            player.angle = Math.min(0.65, player.angle + 0.04); 
        } else {
            player.vy -= 0.13;
            player.angle = Math.max(-0.45, player.angle - 0.03); 
        }
        
        player.vy += GRAVITY;
        if (player.vy > MAX_VY) player.vy = MAX_VY;
        if (player.vy < -4.6) player.vy = -4.6;
        player.y += player.vy;
        
        //горизонтальное движение
        player.vx += WIND_BOOST;
        if (player.vx > MAX_VX_GROWTH) player.vx = MAX_VX_GROWTH;
        player.x += player.vx;
        
        //камера за игроком
        cameraX = player.x - canvas.width * 0.35;
        if (cameraX < 0) cameraX = 0;
        
        //границы по вертикали
        if (player.y < 32) {
            gameRunning = false;
            return;
        }

        // добавление точки следа (абсолютные координаты в мире)
        let dist = Math.hypot(player.x - lastTrailX, player.y - lastTrailY);
        if (dist > 12) {  // интервал ~12 пикселей
            trailPoints.push({
                x: player.x,        
                y: player.y,        
                life: 1.0
            });
            lastTrailX = player.x;
            lastTrailY = player.y;
        }
        
        // ограничиваем количество точек (не больше 35)
        while (trailPoints.length > 35) trailPoints.shift();
        
        //столкновение с горами
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
        if (player.y + 12 >= canvas.height - 18) groundCollision = true;
        if (groundCollision) {
            gameRunning = false;
            return;
        }
        
        //термики
        for (let i = 0; i < thermals.length; i++) {
            let t = thermals[i];
            let dx = player.x - t.x;
            let dy = player.y - t.y;
            if (Math.hypot(dx, dy) < t.radius + 9) {
                player.vy -= t.strength * 1.2;
                score += 12;
                addLightnessSpark(t.x, t.y);
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
                y: y - cameraY() + (Math.random() - 0.5) * 18,
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
            if (lastBlock.x < cameraX + canvas.width + 200) {
                extendWorld();
            }
        } else {
            initMountains();
        }

        // облака (движение и столкновение)
        for (let i = 0; i < clouds.length; i++) {
            let c = clouds[i];
            c.x -= player.vx * 0.55;   // параллакс
            c.y += c.speedY;
            
            // столкновение с игроком
            let dx = player.x - c.x;
            let dy = player.y - c.y;
            let collisionDist = (c.width / 2) + 12;
            if (Math.abs(dx) < collisionDist && Math.abs(dy) < (c.height / 2) + 10) {
                player.vx *= 0.85;
                score = Math.max(0, score - 15);
                addCloudPoof(c.x, c.y, c.width);
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
        
        //счет ( с 1.0.7 с бонусом за скорость )
        let isMaxSpeed = (player.vx > MAX_VX_GROWTH - 0.8);
        
        if (isMaxSpeed) {
            // базовые очки за полёт
            score += 0.5;
            
            // бонус за скорость
            let speedBonus = Math.floor(player.vx * 0.3);
            score += Math.min(2, speedBonus);
        }
        
        //плавный возврат угла
        player.angle *= 0.98;
        
        //частицы
        addWindParticle();
        updateParticles();
        
        //рекорд
         if (Math.floor(score) > highScore) {
            highScore = Math.floor(score);
            highScorePosition = player.x;  // уже есть
            highScorePositionY = player.y; // ← ДОБАВИТЬ ЭТУ СТРОКУ
            showFlag = true;
            try { localStorage.setItem('sunrise_lightness', highScore); } catch(e) {}
        }
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
        ctx.font = 'bold 56px "Segoe UI", "Courier New", monospace';
        ctx.fillStyle = '#FFF9E8';
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText('SUNRISE', canvas.width / 2 - 130, canvas.height / 2 - 80);
        ctx.shadowBlur = 0;
        
        // подзаголовок (пустая строка, можно убрать или оставить)
        ctx.font = '18px monospace';
        ctx.fillStyle = '#FFD6A5';
        ctx.fillText('', canvas.width / 2 - 85, canvas.height / 2 - 30);
        
        // описание управления
        ctx.font = '14px monospace';
        ctx.fillStyle = '#ffd9b5';
        ctx.fillText('ЗАЖМИ — ПИКИРУЙ', canvas.width / 2 - 100, canvas.height / 2 + 40);
        ctx.fillText('ОТПУСТИ — ПАРИ', canvas.width / 2 - 90, canvas.height / 2 + 68);
        
        // подсказка для мобильных (всегда показываем на приветственном экране)
        ctx.fillText('ПОВЕРНИТЕ ТЕЛЕФОН', canvas.width / 2 - 100, canvas.height / 2 + 105);
        ctx.fillText('ДЛЯ КОМФОРТНОЙ ИГРЫ', canvas.width / 2 - 100, canvas.height / 2 + 125);
    
        // визуальная подсказка
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#FFCF9A';
        ctx.fillText('--> ЛЮБОЕ НАЖАТИЕ <--', canvas.width / 2 - 110, canvas.height / 2 + 165);
        
        // рекорд
        if (highScore > 0) {
            ctx.font = '13px monospace';
            ctx.fillStyle = '#c9b28b';
            ctx.fillText(`лучший полёт: ${highScore} ✦`, canvas.width / 2 - 80, canvas.height - 60);
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
        
        const camY = cameraY();
        
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

    //атмосферное свечение
    let atmosphere = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 180);
    atmosphere.addColorStop(0, 'rgba(255,220,150,0.14)');
    atmosphere.addColorStop(0.5, 'rgba(255,170,90,0.07)');
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
        ctx.fillStyle = `rgba(255,220,150,${0.18 + Math.sin(frame * 0.02 + i) * 0.08})`;
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
        ctx.fillStyle = `rgba(255,245,200,${0.22 + Math.sin(frame * 0.03 + i) * 0.05})`;
        ctx.fill();
        ctx.restore();
    }
        ctx.restore();

    //внешний ореол
    let outer = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 85);
    outer.addColorStop(0, 'rgba(255,235,180,0.55)');
    outer.addColorStop(0.6, 'rgba(255,180,110,0.18)');
    outer.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 85 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    //ядро солнца
    let core = ctx.createRadialGradient(sunX - 5, sunY - 5, 0, sunX, sunY, 38);
    core.addColorStop(0, '#fffef4');
    core.addColorStop(0.25, '#ffe9b5');
    core.addColorStop(0.7, '#ffc56d');
    core.addColorStop(1, '#ff9738');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34 * pulse, 0, Math.PI * 2);
        ctx.fill();

    //центральная яркая точка
    ctx.beginPath();
    ctx.arc(sunX, sunY, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,245,0.95)';
    ctx.fill();

    //крест-блик
    ctx.beginPath();
    ctx.moveTo(sunX - 18, sunY);
    ctx.lineTo(sunX + 18, sunY);
    ctx.moveTo(sunX, sunY - 18);
    ctx.lineTo(sunX, sunY + 18);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,220,0.45)';
    ctx.stroke();

    //парящие частицы
    for (let i = 0; i < 8; i++) {
        let angle = (i / 8) * Math.PI * 2 + frame * 0.01;
        let radius = 48 + Math.sin(frame * 0.03 + i) * 8;
        let px = sunX + Math.cos(angle) * radius;
        let py = sunY + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(px, py, 1.8 + Math.sin(frame * 0.04 + i) * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,230,160,${0.35 + Math.sin(frame * 0.05 + i) * 0.15})`;
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
        
        //турбулентность
        for (let d of downdrafts) {
            let screenX = d.x - cameraX;
            let screenY = d.y - camY;
            ctx.beginPath();
            ctx.arc(screenX, screenY, d.radius - 5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(90, 110, 150, 0.24)`;
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
        ctx.beginPath();
        ctx.moveTo(12, -6);
        ctx.lineTo(-4, -12);
        ctx.lineTo(-10, -2);
        ctx.lineTo(-4, 6);
        ctx.fillStyle = '#FEF6E6';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, -4);
        ctx.lineTo(-2, -9);
        ctx.lineTo(-7, -1);
        ctx.fillStyle = '#FFD966';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-3, 2, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#F2C94C';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-4.5, 1, 1, 0, Math.PI * 2);
        ctx.fill();
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
        ctx.font = 'bold 28px "Segoe UI", "Courier New", monospace';
        ctx.fillStyle = '#FFF9E8';
        ctx.fillText(`✦ ${Math.floor(score)}`, 28, 58);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#FFD6A5';
        ctx.fillText(`РЕКОРД ${highScore}`, 28, 96);
        
        let windPercent = Math.min(100, Math.floor((player.vx - 3) / 6 * 100));
        ctx.fillStyle = '#FFF2BF';
        ctx.fillRect(28, 115, Math.max(10, windPercent * 1.2), 8);
        ctx.fillStyle = '#D9C291';
        ctx.fillRect(28 + Math.max(10, windPercent * 1.2), 115, 100 - Math.max(10, windPercent * 1.2), 8);
        ctx.fillStyle = '#FFEFC0';
        ctx.font = '10px monospace';
        ctx.fillText(`ВЕТЕР ↑`, 32, 133);
        
        ctx.font = 'italic 12px monospace';
        ctx.fillStyle = "#f7e5c2";
        
        
        if (!gameRunning) {
            ctx.font = 'bold 34px monospace';
            ctx.fillStyle = '#FFF3DF';
            ctx.fillText('ПОКИНУЛ НЕБО', canvas.width / 2 - 150, canvas.height / 2 - 40);
            ctx.font = '18px monospace';
            ctx.fillStyle = '#FFCF9A';
            ctx.fillText('НАЖМИ ПРОБЕЛ / КЛИК / ТАП → НОВЫЙ ПОЛЁТ', canvas.width / 2 - 210, canvas.height / 2 + 40);
            
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
        player = {
            x: canvas.width * 0.35,
            y: canvas.height * 0.55,
            vx: 3.8,
            vy: 0,
            angle: 0,
            radius: 9
        };
        cameraX = 0;
        cameraYOffset = 0;
        thermals = [];
        downdrafts = [];
        windParticles = [];
        sparkParticles = [];
        isPressing = false;
        initMountains();
        for (let i = 0; i < 2; i++) addThermalIfNeeded();
    }
    
    //управление с поддержкой приветственного экрана
    function handlePressStart(e) {
        // если показываем приветственный экран — запускаем игру
        if (showWelcome) {
            startGameFromWelcome();
            e.preventDefault();
            return;
        }
        
        if (!gameRunning) {
            restartGame();
            return;
        }
        isPressing = true;
        e.preventDefault();
    }
    
    function handlePressEnd(e) {
        if (showWelcome) return;
        if (!gameRunning) return;
        isPressing = false;
        e.preventDefault();
    }
    
    function bindControls() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                handlePressStart(e);
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                handlePressEnd(e);
            }
        });
        canvas.addEventListener('mousedown', handlePressStart);
        window.addEventListener('mouseup', handlePressEnd);
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handlePressStart(e);
        });
        window.addEventListener('touchend', (e) => {
            e.preventDefault();
            handlePressEnd(e);
        });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    //запуск
    initMountains();
    bindControls();
    
    function animate() {
        if (gameRunning && !showWelcome) updateGame();
        draw();
        requestAnimationFrame(animate);
    }
    animate();
})();