// ── 10-events.js ─────────────────────────────────────────────
// Система случайных событий.
// Событие срабатывает когда score достигает nextEventAt,
// который генерируется случайно после каждого события.
// Зависит от: 01-core.js, 02-player-state.js, 05-world-entities.js.

    // ── состояние системы ──
    let nextEventAt     = 0;      // порог очков для следующего события
    let activeEvent     = null;   // текущее активное событие или null
    let activeEventTimer = 0;     // сколько секунд уже идёт
    let lastEventWasNeg = false;  // для антиспама негативных событий подряд
    let eventsEnabled   = true;   // можно выключить для отладки

    // генерируем следующий порог — случайный интервал от текущего score
    function scheduleNextEvent() {
        // интервал уменьшается с ростом сложности
        const minGap = Math.max(400, 900  - diffLevel * 40);
        const maxGap = Math.max(900, 2000 - diffLevel * 60);
        nextEventAt = score + minGap + Math.random() * (maxGap - minGap);
    }

    // таблица событий с весами
    // weight: чем больше — тем чаще выпадает
    const EVENT_TABLE = [
        { id: 'golden_thermal',  weight: 30, positive: true  },
        { id: 'tailwind',        weight: 25, positive: true  },
        { id: 'lightness',       weight: 12, positive: true  },
        { id: 'wind_gust',       weight: 20, positive: null  }, // нейтральное
        { id: 'turbulence',      weight: 8,  positive: false },
        { id: 'headwind',        weight: 5,  positive: false },
    ];

    function pickRandomEvent() {
        let table = EVENT_TABLE;

        // антиспам: если последнее было негативным — убираем негативные из пула
        if (lastEventWasNeg) {
            table = table.filter(e => e.positive !== false);
        }

        const totalWeight = table.reduce((s, e) => s + e.weight, 0);
        let r = Math.random() * totalWeight;
        for (let e of table) {
            r -= e.weight;
            if (r <= 0) return e;
        }
        return table[0];
    }

    // ── запуск события ──
    function triggerEvent(eventDef) {
        activeEvent      = { ...eventDef };
        activeEventTimer = 0;
        lastEventWasNeg  = eventDef.positive === false;

        switch (eventDef.id) {

            case 'golden_thermal':
                // золотой термик — появляется близко, можно не пропустить
                activeEvent.x = player.x + LOGICAL_W * 0.3 + Math.random() * LOGICAL_W * 0.3;
                activeEvent.y = LOGICAL_H * 0.25 + Math.random() * LOGICAL_H * 0.45;
                activeEvent.duration = 8;  // исчезает через 8 сек если не поймал
                activeEvent.caught   = false;
                break;

            case 'tailwind':
                // попутный ветер — увеличивает скорость
                activeEvent.duration = 4 + Math.random() * 5;   // 4–9 сек
                activeEvent.boost    = 0.004 + Math.random() * 0.004; // доп ускорение
                break;

            case 'lightness':
                // лёгкость — гравитация почти исчезает
                activeEvent.duration    = 5 + Math.random() * 4;
                activeEvent.gravityMult = 0.08 + Math.random() * 0.18; // 8–26% от обычной
                break;

            case 'wind_gust':
                // порыв ветра — толкает в случайном направлении
                activeEvent.duration = 2 + Math.random() * 2;
                const dirs = ['up', 'down', 'forward'];
                activeEvent.dir      = dirs[Math.floor(Math.random() * dirs.length)];
                activeEvent.strength = 0.15 + Math.random() * 0.15;
                break;

            case 'turbulence':
                // турбулентность — трясёт игрока
                activeEvent.duration  = 3 + Math.random() * 3;
                activeEvent.intensity = 0.12 + Math.random() * 0.12;
                break;

            case 'headwind':
                // встречный ветер — тормозит
                activeEvent.duration  = 3 + Math.random() * 2;
                activeEvent.drag      = 0.012 + Math.random() * 0.008;
                break;
        }

        // показываем уведомление игроку
        showEventNotice(eventDef.id);
    }

    // ── тик события — вызывается каждый кадр из updateGame ──
    function updateEvents(delta, dt) {
        if (!eventsEnabled || !gameRunning || isDying) return;

        // проверяем порог
        if (!activeEvent && score >= nextEventAt) {
            triggerEvent(pickRandomEvent());
        }

        if (!activeEvent) return;

        activeEventTimer += delta;

        switch (activeEvent.id) {

            case 'golden_thermal':
                // если поймал — заканчиваем
                if (activeEvent.caught) { activeEvent = null; return; }
                // если вышло время — убираем
                if (activeEventTimer >= activeEvent.duration) {
                    activeEvent = null;
                    scheduleNextEvent();
                    return;
                }
                // проверяем поимку
                {
                    let dx = player.x - activeEvent.x;
                    let dy = player.y - activeEvent.y;
                    if (Math.hypot(dx, dy) < 40) {
                        activeEvent.caught = true;
                        player.vy -= 3.5;
                        score += 80;
                        // золотые искры
                        for (let i = 0; i < 18; i++) {
                            sparkParticles.push({
                                x: activeEvent.x - cameraX + (Math.random()-0.5)*30,
                                y: activeEvent.y - getCameraY() + (Math.random()-0.5)*30,
                                vx: (Math.random()-0.5)*3,
                                vy: (Math.random()-0.5)*3 - 1.5,
                                life: 1.0, size: 3 + Math.random()*5,
                                isGolden: true
                            });
                        }
                        playThermalSound();
                        scheduleNextEvent();
                    }
                }
                break;

            case 'tailwind':
                if (activeEventTimer >= activeEvent.duration) {
                    activeEvent = null; scheduleNextEvent(); return;
                }
                // плавное начало и конец через envelope
                {
                    let t = activeEventTimer / activeEvent.duration;
                    let env = Math.sin(t * Math.PI); // 0→1→0
                    player.vx += activeEvent.boost * env * dt;
                    if (player.vx > MAX_VX_GROWTH * 1.15) player.vx = MAX_VX_GROWTH * 1.15;
                }
                break;

            case 'lightness':
                if (activeEventTimer >= activeEvent.duration) {
                    activeEvent = null; scheduleNextEvent(); return;
                }
                // гравитация уменьшена — применяем разницу (основная уже применена в updateGame)
                // вычитаем лишнюю гравитацию чтобы получить нужный multiplier
                {
                    let t = activeEventTimer / activeEvent.duration;
                    let env = Math.sin(t * Math.PI);
                    let gravReduction = GRAVITY * (1 - activeEvent.gravityMult) * env;
                    player.vy -= gravReduction * dt;
                }
                break;

            case 'wind_gust':
                if (activeEventTimer >= activeEvent.duration) {
                    activeEvent = null; scheduleNextEvent(); return;
                }
                {
                    let t = activeEventTimer / activeEvent.duration;
                    let env = Math.sin(t * Math.PI);
                    let f   = activeEvent.strength * env * dt;
                    if      (activeEvent.dir === 'up')      player.vy -= f * 1.5;
                    else if (activeEvent.dir === 'down')    player.vy += f;
                    else if (activeEvent.dir === 'forward') player.vx += f * 0.5;
                }
                break;

            case 'turbulence':
                if (activeEventTimer >= activeEvent.duration) {
                    activeEvent = null; scheduleNextEvent(); return;
                }
                // случайные толчки каждый кадр
                player.vy += (Math.random() - 0.5) * activeEvent.intensity * dt;
                player.vx += (Math.random() - 0.5) * activeEvent.intensity * 0.3 * dt;
                break;

            case 'headwind':
                if (activeEventTimer >= activeEvent.duration) {
                    activeEvent = null; scheduleNextEvent(); return;
                }
                {
                    let t = activeEventTimer / activeEvent.duration;
                    let env = Math.sin(t * Math.PI);
                    player.vx -= activeEvent.drag * env * dt;
                    if (player.vx < 2) player.vx = 2; // не останавливаем полностью
                }
                break;
        }
    }

    // ── уведомление на экране ──
    let eventNoticeTimer = 0;
    let eventNoticeText  = '';
    let eventNoticeColor = '#FFD9B5';

    const EVENT_LABELS = {
        golden_thermal: { text: '✦ ЗОЛОТОЙ ТЕРМИК',    color: '#FFD700' },
        tailwind:       { text: '▶▶ ПОПУТНЫЙ ВЕТЕР',   color: '#A0E8FF' },
        lightness:      { text: '◈ ЛЁГКОСТЬ',           color: '#E0C8FF' },
        wind_gust_up:   { text: '↑ ПОРЫВ ВВЕРХ',        color: '#FFE8A0' },
        wind_gust_down: { text: '↓ ПОРЫВ ВНИЗ',         color: '#FFE8A0' },
        wind_gust_forward: { text: '→ ПОРЫВ ВПЕРЁД',    color: '#FFE8A0' },
        turbulence:     { text: '⚡ ТУРБУЛЕНТНОСТЬ',     color: '#FF9898' },
        headwind:       { text: '◀◀ ВСТРЕЧНЫЙ ВЕТЕР',   color: '#FF9898' },
    };

    function showEventNotice(eventId) {
        let key = eventId;
        if (eventId === 'wind_gust' && activeEvent) key = 'wind_gust_' + activeEvent.dir;
        const def = EVENT_LABELS[key] || EVENT_LABELS[eventId];
        if (!def) return;
        eventNoticeText  = def.text;
        eventNoticeColor = def.color;
        eventNoticeTimer = 2.2;  // секунд
    }

    function drawEventNotice() {
        if (eventNoticeTimer <= 0) return;
        eventNoticeTimer -= 1 / 60; // убывает каждый кадр (approx)
        const alpha = Math.min(1, eventNoticeTimer / 0.4) * Math.min(1, eventNoticeTimer);
        const s = UI_SCALE;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(15*s)}px monospace`;
        ctx.fillStyle = eventNoticeColor.replace(')', `, ${alpha})`).replace('#', 'rgba(').replace(/rgba\(([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2}),/, (_, r, g, b) =>
            `rgba(${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)},`);
        // проще — используем globalAlpha
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = eventNoticeColor;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = eventNoticeColor;
        ctx.fillText(eventNoticeText, LOGICAL_W / 2, LOGICAL_H * 0.18);
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawActiveEvent() {
        if (!activeEvent) return;
        const camY = getCameraY();

        if (activeEvent.id === 'golden_thermal' && !activeEvent.caught) {
            // рисуем золотой термик
            const x = activeEvent.x - cameraX;
            const y = activeEvent.y - camY;
            const t = activeEventTimer / activeEvent.duration;
            const pulse = 0.8 + Math.sin(frame * 0.08) * 0.2;
            // время исчезает — мигает в конце
            const blink = t > 0.7 ? 0.5 + Math.sin(frame * 0.3) * 0.5 : 1;

            ctx.save();
            ctx.globalAlpha = 0.9 * blink;

            // внешнее кольцо
            ctx.beginPath();
            ctx.arc(x, y, 42 * pulse, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,215,80,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // тело
            ctx.beginPath();
            ctx.arc(x, y, 26 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,200,50,0.25)';
            ctx.fill();

            // звезда в центре
            ctx.font = `${Math.round(20 * UI_SCALE)}px monospace`;
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'center';
            ctx.fillText('✦', x, y + 7);

            // частицы летят вверх
            for (let i = 0; i < 5; i++) {
                let angle = (i / 5) * Math.PI * 2 + frame * 0.04;
                let r = 18 + Math.sin(frame * 0.1 + i) * 6;
                let px2 = x + Math.cos(angle) * r;
                let py2 = y + Math.sin(angle) * r - (frame % 60) * 0.3;
                ctx.beginPath();
                ctx.arc(px2, py2, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,220,100,0.7)';
                ctx.fill();
            }

            ctx.restore();
        }

        // индикатор активного эффекта (tailwind, lightness, headwind)
        if (['tailwind', 'lightness', 'headwind'].includes(activeEvent.id)) {
            const progress = 1 - activeEventTimer / activeEvent.duration;
            const s = UI_SCALE;
            const barW = Math.round(80 * s);
            const barX = LOGICAL_W - Math.round(24*s) - barW;
            const barY = Math.round(58*s);
            const col  = activeEvent.id === 'headwind'
                ? 'rgba(255,120,120,0.7)'
                : activeEvent.id === 'lightness'
                ? 'rgba(200,160,255,0.7)'
                : 'rgba(120,220,255,0.7)';

            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, Math.round(5*s), 3);
            ctx.fill();
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW * progress, Math.round(5*s), 3);
            ctx.fill();
            ctx.restore();
        }
    }

    // ── сброс при рестарте ──
    function resetEvents() {
        activeEvent      = null;
        activeEventTimer = 0;
        eventNoticeTimer = 0;
        lastEventWasNeg  = false;
        scheduleNextEvent();
    }

    // первый порог при загрузке
    scheduleNextEvent();
