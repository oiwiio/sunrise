// ── 05-world-entities.js ─────────────────────────────────────
// Процедурный мир: горы (mountainSegments), термики, нисходящие потоки,
// облака (спавн), частицы ветра/искры, камера по Y, сложность.
// Зависит от: 01-core.js, 02-player-state.js, 04-audio.js (звуки при спавне).

    // горы
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
        // удаление сегментов позади
        while (mountainSegments.length > 0 && mountainSegments[0].x + segmentWidth < cameraX - 300) {
            mountainSegments.shift();
        }
    }

    // термики
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

    // облака - препятствия
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

        // depth: 0 = далёкое облако (мелкое, тусклое, медленное, размытое)
        //        1 = близкое облако (крупное, чёткое, быстрое)
        const depth      = Math.random();
        const sizeScale  = 0.6 + depth * 0.7;  // 0.6x .. 1.3x размера
        const speedScale = 0.5 + depth * 0.9;  // 0.5x .. 1.4x скорости параллакса

        clouds.push({
            x: cameraX + LOGICAL_W + 50 + Math.random() * 200,
            y: 60 + Math.random() * (LOGICAL_H - 120),
            width: (35 + Math.random() * 25) * sizeScale,
            height: (20 + Math.random() * 15) * sizeScale,
            speedY: (Math.random() - 0.5) * 0.3,
            opacity: (0.55 + Math.random() * 0.3) * (0.6 + depth * 0.5),
            depth: depth,
            speedScale: speedScale
        });
    }
    
    
    // обычные частицы ветра (слабая турбулентность)
    function addWindParticleNormal() {
        let intensity = Math.min(0.8, player.vx / 12);
        if (Math.random() > 0.2 + intensity * 0.15) return;
        
        windParticles.push({
            x: LOGICAL_W + 10 + Math.random() * 80,
            y: Math.random() * LOGICAL_H,
            length: 14 + Math.random() * 24,
            width: 0.8 + Math.random() * 1.2,
            life: 0.6 + Math.random() * 0.5,
            vx: -(2 + Math.random() * 6 + player.vx * 0.4),
            vy: (Math.random() - 0.5) * 0.6,
            opacity: 0.18 + Math.random() * 0.28,
            curl: (Math.random() - 0.5) * 18,   // изгиб: + вверх, - вниз
            phase: Math.random() * Math.PI * 2,  // фаза для волнистости
            type: 'normal'
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
            length: 40 + Math.random() * 60,
            width: 1.8 + Math.random() * 2.5,
            life: 0.9 + Math.random() * 0.6,
            vx: -(5 + Math.random() * 12 + player.vx * 0.9),
            vy: (Math.random() - 0.5) * 0.9,
            opacity: 0.4 + Math.random() * 0.4,
            curl: (Math.random() - 0.5) * 32,   // сильнее изгиб на макс. скорости
            phase: Math.random() * Math.PI * 2,
            type: 'fast'
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