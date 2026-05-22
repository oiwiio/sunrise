(function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1000;
    canvas.height = 600;
    
    let gameRunning = true;
    let score = 0;
    let highScore = 0;
    
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
    const MAX_VX_GROWTH = 9.2;
    const WIND_BOOST = 0.008; // ускорение от ветра
    
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
    
    //частицы
    function addWindParticle() {
        let intensity = Math.min(1.2, player.vx / 9);
        if (Math.random() > 0.45 + intensity * 0.2) return;
        windParticles.push({
            x: canvas.width - 10,
            y: (player.y - cameraY()) - 5 + (Math.random() - 0.5) * 32,
            size: 2 + Math.random() * 5,
            life: 1,
            vx: -(2 + Math.random() * 7 + player.vx * 0.9),
            vy: (Math.random() - 0.5) * 1.2
        });
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
            p.life -= 0.022;
            if (p.x < -50 || p.x > canvas.width + 100 || p.life <= 0) {
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
            // пикирование
            player.vy += 0.32;
            player.angle = Math.min(0.42, player.angle + 0.025);
        } else {
            // плавный подъем
            player.vy -= 0.13;
            player.angle = Math.max(-0.28, player.angle - 0.018);
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
        
        //потоки
        for (let i = 0; i < downdrafts.length; i++) {
            let d = downdrafts[i];
            let dx = player.x - d.x;
            let dy = player.y - d.y;
            if (Math.hypot(dx, dy) < d.radius + 9) {
                player.vy += Math.abs(d.strength) * 0.55;
                score = Math.max(0, score - 5);
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
        
        // 9. Генерация гор
        if (mountainSegments.length > 0) {
            let lastBlock = mountainSegments[mountainSegments.length - 1];
            if (lastBlock.x < cameraX + canvas.width + 200) {
                extendWorld();
            }
        } else {
            initMountains();
        }
        
        //счет
        let speedBonus = Math.floor(player.vx * 1.2);
        score += 1 + Math.min(7, speedBonus);
        
        //плавный возврат угла
        player.angle *= 0.97;
        
        //частицы
        addWindParticle();
        updateParticles();
        
        //рекорд
        if (Math.floor(score) > highScore) {
            highScore = Math.floor(score);
            try { localStorage.setItem('sunrise_lightness', highScore); } catch(e) {}
        }
    }
    
    //отрисовка
    function draw() {
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
        ctx.fillText('ПРЕДЕЛ ВЫСОТЫ', canvas.width - 160, 24 - camY);
        
        //солнце
        ctx.beginPath();
        ctx.arc(canvas.width - 70, 65, 42, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD89C';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width - 70, 65, 34, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF1C1';
        ctx.fill();
        
        //дальние горы
        ctx.fillStyle = '#3E2C49';
        for (let seg of mountainSegments) {
            let screenX = seg.x - cameraX;
            let screenYBase = seg.y - camY;
            if (screenX + segmentWidth > -50 && screenX < canvas.width + 100) {
                ctx.beginPath();
                ctx.moveTo(screenX, canvas.height);
                ctx.lineTo(screenX, screenYBase - 20);
                ctx.lineTo(screenX + segmentWidth * 0.3, screenYBase - 40);
                ctx.lineTo(screenX + segmentWidth * 0.6, screenYBase - 18);
                ctx.lineTo(screenX + segmentWidth, screenYBase - 28);
                ctx.lineTo(screenX + segmentWidth, canvas.height);
                ctx.fill();
            }
        }
        
        //ближние горы
        ctx.fillStyle = '#1D142B';
        for (let seg of mountainSegments) {
            let screenX = seg.x - cameraX;
            let screenYBase = seg.y - camY;
            if (screenX + segmentWidth > -50 && screenX < canvas.width + 100) {
                ctx.beginPath();
                ctx.moveTo(screenX, canvas.height);
                ctx.lineTo(screenX, screenYBase);
                ctx.lineTo(screenX + segmentWidth * 0.45, screenYBase - 28);
                ctx.lineTo(screenX + segmentWidth, screenYBase - 10);
                ctx.lineTo(screenX + segmentWidth, canvas.height);
                ctx.fill();
            }
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
        
        //частицы
        for (let p of windParticles) {
            ctx.fillStyle = `rgba(255, 255, 200, ${p.life * 0.6})`;
            ctx.fillRect(p.x, p.y, p.size * 0.8, p.size * 0.6);
        }
        for (let s of sparkParticles) {
            ctx.fillStyle = `rgba(255, 220, 140, ${s.life * 0.9})`;
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
        ctx.fillText(`SUNRISE · невесомость · скорость · ветер`, canvas.width - 210, 35);
        
        if (!gameRunning) {
            ctx.font = 'bold 34px monospace';
            ctx.fillStyle = '#FFF3DF';
            ctx.fillText('ПОКИНУЛ НЕБО', canvas.width / 2 - 150, canvas.height / 2 - 40);
            ctx.font = '18px monospace';
            ctx.fillStyle = '#FFCF9A';
            ctx.fillText('НАЖМИ ПРОБЕЛ / КЛИК / ТАП → НОВЫЙ ПОЛЁТ', canvas.width / 2 - 210, canvas.height / 2 + 40);
        }
        
        frame++;
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
    
    //управление
    function handlePressStart(e) {
        if (!gameRunning) {
            restartGame();
            return;
        }
        isPressing = true;
        e.preventDefault();
    }
    
    function handlePressEnd(e) {
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
        if (gameRunning) updateGame();
        draw();
        requestAnimationFrame(animate);
    }
    animate();
})();