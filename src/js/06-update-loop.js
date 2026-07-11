// Главный игровой тик: triggerDeath/updateDeathTumble, updateGame().
// Тут вся физика и коллизии одного кадра.
// Зависит от: всё, что выше (02–05) + 04-audio.js (playThermalSound и т.д.).

    // запускает анимацию смерти вместо мгновенного стопа
    function triggerDeath() {
        if (isDying || !gameRunning) return;
        isDying     = true;
        deathTimer  = 0;
        // кувыркаемся в ту сторону, куда уже наклонён/летит персонаж —
        // выглядит естественнее, чем случайное направление
        deathSpinDir = player.vx >= 0 ? 1 : -1;
        playDeathSound();
    }

    // персонаж полностью теряет управление: кувыркается и падает
    function updateDeathTumble(dt, delta) {
        player.vy += GRAVITY * dt * 1.5;         // падает быстрее обычного
        if (player.vy > MAX_VY * 2) player.vy = MAX_VY * 2;
        player.y  += player.vy * dt;

        player.vx *= Math.pow(0.97, dt);          // теряет горизонтальную скорость
        player.x  += player.vx * dt;

        player.angle += deathSpinDir * 0.24 * dt; // собственно кувырок

        cameraX = player.x - LOGICAL_W * 0.35;
        if (cameraX < 0) cameraX = 0;

        deathTimer += delta;
        if (deathTimer >= DEATH_ANIM_DURATION) {
            isDying     = false;
            gameRunning = false; // теперь показываем экран "ПОКИНУЛ НЕБО"
        }
    }

    // обновление
    function updateGame(delta) {
        if (!gameRunning) return;

        // нормализуем delta (чтобы при 60 FPS всё работало как раньше)
        let dt = Math.min(1.5, delta * 60);

        if (isDying) {
            updateDeathTumble(dt, delta);
            return;
        }

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
        
        // горизонтальное движение
        player.vx += WIND_BOOST * dt;
        if (player.vx > MAX_VX_GROWTH) player.vx = MAX_VX_GROWTH;
        player.x += player.vx * dt;
        
        // камера за игроком
        cameraX = player.x - LOGICAL_W * 0.35;
        if (cameraX < 0) cameraX = 0;
        
        // границы по вертикали — привязаны к LOGICAL_H как в рендере
        if (player.y < Math.round(LOGICAL_H * 0.08)) {
            triggerDeath();
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
            triggerDeath();
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
        
        // потоки
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
        
        // генерация
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
            c.x -= player.vx * 0.55 * c.speedScale * dt; // параллакс: ближе — быстрее, дальше — медленнее
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
        updateBiom();

        // счёт
        let isMaxSpeed = (player.vx > MAX_VX_GROWTH - 0.8);
        if (isMaxSpeed) {
            score += 0.5 * dt;
            let speedBonus = Math.floor(player.vx * 0.3 * dt);
            score += Math.min(2, speedBonus);
        }
        
        // плавный возврат угла
       player.angle *= Math.pow(0.98, dt);
        
        //частицы
        addWindParticle();
        updateParticles();
        
        // рекорд
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