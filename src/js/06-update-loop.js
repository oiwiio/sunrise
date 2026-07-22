// Главный игровой тик: triggerDeath/updateDeathTumble, updateGame().
// Тут вся физика и коллизии одного кадра.
// Зависит от: всё, что выше (02–05) + 04-audio.js (playThermalSound и т.д.).

    // Погодный цикл: дождь / гроза 
    // Общие переменные — их же читает 08-render.js, чтобы не дублировать расчёт.
    const WCYCLE    = 10000;
    const WSTART    = 2000;
    const WFADE_IN  = 500;
    const WEND      = 7500;
    const WFADE_OUT = 500;

    let wAlpha  = 0;      // непрозрачность дождя/грозы (0..1)
    let isStorm = false;  // true — текущий цикл дождя грозовой (каждый второй)

    function updateWeatherCycle() {
        const wPhase = score % WCYCLE;

        if (wPhase >= WSTART && wPhase < WSTART + WFADE_IN) {
            wAlpha = (wPhase - WSTART) / WFADE_IN;
        } else if (wPhase >= WSTART + WFADE_IN && wPhase < WEND) {
            wAlpha = 1;
        } else if (wPhase >= WEND && wPhase < WEND + WFADE_OUT) {
            wAlpha = 1 - (wPhase - WEND) / WFADE_OUT;
        } else {
            wAlpha = 0;
        }

        // каждый второй цикл дождя — грозовой
        isStorm = (Math.floor(score / WCYCLE) % 2 === 1);
    }

    // Молнии (только во время грозы)
    // Три фазы: warning (прицел на земле + мигание сверху) → flash (весь экран) → strike (сам разряд).
    let lightnings      = [];
    let lightningTimer  = 0;
    let nextLightningIn = 4; // сек до следующего удара, пересчитывается случайно

    const LIGHTNING_WARN_DUR   = 0.8;  // предупреждение
    const LIGHTNING_FLASH_DUR  = 0.1;  // вспышка на весь экран
    const LIGHTNING_STRIKE_DUR = 0.15; // видимость самого разряда
    const LIGHTNING_HIT_RADIUS = 60;   // px — радиус поражения вокруг точки удара

    function rollNextLightning() {
        nextLightningIn = 3 + Math.random() * 3; // 3–6 сек, как в ТЗ
    }
    rollNextLightning();

    function spawnLightning() {
        // X — случайно впереди игрока, в пределах видимой области
        const x = cameraX + LOGICAL_W * 0.3 + Math.random() * LOGICAL_W * 0.5;

        // Y — высота рельефа под этой точкой (бьёт "в землю", как в ТЗ)
        let groundY = LOGICAL_H - 40;
        for (let seg of mountainSegments) {
            if (x >= seg.x && x < seg.x + segmentWidth) {
                groundY = seg.y - 4;
                break;
            }
        }

        lightnings.push({
            x: x,
            y: groundY,
            state: 'warning', // warning → flash → strike
            timer: 0,
            seed: Math.random() * 1000 // для случайной формы зигзага при отрисовке
        });
    }

    function updateLightnings(delta) {
        // спавним новые молнии только во время активной грозы
        if (isStorm && wAlpha > 0.4) {
            lightningTimer += delta;
            if (lightningTimer >= nextLightningIn) {
                lightningTimer = 0;
                rollNextLightning();
                spawnLightning();
            }
        } else {
            lightningTimer = 0;
        }

        for (let i = 0; i < lightnings.length; i++) {
            let l = lightnings[i];
            l.timer += delta;

            if (l.state === 'warning' && l.timer >= LIGHTNING_WARN_DUR) {
                l.state = 'flash';
                l.timer = 0;
            } else if (l.state === 'flash' && l.timer >= LIGHTNING_FLASH_DUR) {
                l.state = 'strike';
                l.timer = 0;

                // момент удара — проверяем, не задело ли персонажа
                let dx = player.x - l.x;
                let dy = player.y - l.y;
                if (Math.hypot(dx, dy) < LIGHTNING_HIT_RADIUS) {
                    triggerDeath();
                }
            } else if (l.state === 'strike' && l.timer >= LIGHTNING_STRIKE_DUR) {
                lightnings.splice(i, 1);
                i--;
            }
        }
    }

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
            isDying      = false;
            gameRunning  = false;
            gameOverTimer = 0;  // запускаем fade-in экрана смерти
        }
    }

    // обновление
    function updateGame(delta) {
        if (!gameRunning) {
            // тикаем таймер fade-in экрана смерти
            if (gameOverTimer < 1) gameOverTimer = Math.min(1, gameOverTimer + delta / 0.35);
            return;
        }

        // нормализуем delta (чтобы при 60 FPS всё работало как раньше)
        let dt = Math.min(1.5, delta * 60);

        updateWeatherCycle(); // дождь/гроза — считаем всегда, пока идёт игра (даже во время кувырка)

        if (isDying) {
            updateDeathTumble(dt, delta);
            return;
        }

        //управление по вертикали
        if (isPressing) {
            player.vy += 0.18 * dt;                                    // пикирование — чуть мягче
            player.angle = Math.min(0.65, player.angle + 0.06 * dt);  // быстрее отклик
        } else {
            player.vy -= 0.20 * dt;                                    // подъём — заметно сильнее
            player.angle = Math.max(-0.45, player.angle - 0.05 * dt); // быстрее отклик
        }
        
        player.vy += GRAVITY * 0.75 * dt;  // гравитация чуть слабее — ощущение парения
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
        
        // термики — нарастающая тяга по мере приближения к центру + поимка в ядре
        for (let i = 0; i < thermals.length; i++) {
            let t = thermals[i];

            // анимация частиц внутри термика (летят вверх, зацикливаются)
            for (let p of t.particles) {
                p.phase += p.speed * dt * 0.02;
                if (p.phase > 1) p.phase -= 1;
            }

            if (t.caught) {
                // короткая вспышка после поимки, потом термик убирается
                t.catchTimer += delta;
                if (t.catchTimer > 0.3) { thermals.splice(i, 1); i--; }
                continue;
            }

            let dx = player.x - t.x;
            let dy = player.y - t.y;
            let dist = Math.hypot(dx, dy);

            if (dist < t.pullRadius) {
                // чем ближе к центру — тем сильнее тянет вверх
                const proximity = 1 - Math.max(0, dist - t.coreRadius) / (t.pullRadius - t.coreRadius);
                const pull = t.strength * (0.12 + proximity * proximity * 0.9);
                player.vy -= pull * dt;
            }

            if (dist < t.coreRadius) {
                // поимка: вспышка + очки + лёгкое ускорение персонажа
                t.caught     = true;
                t.catchTimer = 0;
                player.vy   -= t.strength * 0.9;
                player.vx   += 0.35; // короткий импульс вперёд при захвате
                score += 12;
                addLightnessSpark(t.x, t.y);
                playThermalSound();
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
        
        // потоки — нарастающая просадка и болтанка по мере приближения к ядру
        for (let i = 0; i < downdrafts.length; i++) {
            let d = downdrafts[i];

            for (let p of d.particles) {
                p.angle += p.spin * dt * 0.02;
            }

            if (d.hit) {
                // короткая "встряска" после удара, потом поток убирается
                d.hitTimer += delta;
                if (d.hitTimer > 0.3) { downdrafts.splice(i, 1); i--; }
                continue;
            }

            let dx = player.x - d.x;
            let dy = player.y - d.y;
            let dist = Math.hypot(dx, dy);

            if (dist < d.pullRadius) {
                // чем ближе к ядру — тем сильнее просадка и болтанка
                const proximity = 1 - Math.max(0, dist - d.coreRadius) / (d.pullRadius - d.coreRadius);
                player.vy += Math.abs(d.strength) * (0.1 + proximity * proximity * 0.5) * dt;
                player.vx += (Math.random() - 0.5) * proximity * 0.15 * dt; // болтанка из стороны в сторону
            }

            if (dist < d.coreRadius) {
                // попадание в ядро: резкий толчок вниз + штраф очков + встряска
                d.hit      = true;
                d.hitTimer = 0;
                player.vy += Math.abs(d.strength) * 0.6;
                score = Math.max(0, score - 5);
                addNegativeSpark(d.x, d.y);
                playTurbulenceSound();
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
        
        updateLightnings(delta);
        updateEvents(delta, dt);
        updateDifficulty();
        updateBiom();

        // счёт
        let isMaxSpeed = (player.vx > MAX_VX_GROWTH - 0.8);
        if (isMaxSpeed) {
            score += 0.3 * dt;
            let speedBonus = Math.floor(player.vx * 0.18 * dt);
            score += Math.min(1.2, speedBonus);
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