// Система случайных событий.
// Событие срабатывает когда score достигает nextEventAt,
// который генерируется случайно после каждого события.
// Зависит от: 01-core.js, 02-player-state.js, 05-world-entities.js.

    // состояние системы 
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

    // запуск события 
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
                activeEvent.strength = 0.07 + Math.random() * 0.07;
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

    // тик события — вызывается каждый кадр из updateGame 
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
                    if      (activeEvent.dir === 'up')      player.vy -= f * 0.6;
                    else if (activeEvent.dir === 'down')    player.vy += f * 0.5;
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

    // уведомление на экране 
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
        eventNoticeEventId = eventId;
        eventNoticeDur     = EVENT_NOTICE_DUR[eventId] || 2.2;
        eventNoticeTimer   = eventNoticeDur;
        // для дефолта
        const def = EVENT_LABELS[eventId] || EVENT_LABELS[eventId + '_forward'];
        if (def) { eventNoticeText = def.text; eventNoticeColor = def.color; }
    }

    // полное время жизни уведомления по типу события
    const EVENT_NOTICE_DUR = {
        golden_thermal: 2.8,
        tailwind:       2.2,
        lightness:      2.5,
        wind_gust:      1.8,
        turbulence:     2.0,
        headwind:       2.0,
    };
    let eventNoticeDur     = 2.2;  // длительность текущего
    let eventNoticeEventId = '';   // id текущего события для switch в draw

    function drawEventNotice() {
        if (eventNoticeTimer <= 0) return;
        eventNoticeTimer -= 1 / 60;
        if (eventNoticeTimer <= 0) return;

        const s    = UI_SCALE;
        const t    = 1 - eventNoticeTimer / eventNoticeDur; // 0=начало 1=конец
        const fadeIn  = Math.min(1, (1 - t) / 0.15);       // быстро появляется
        const fadeOut = Math.min(1, eventNoticeTimer / 0.3); // плавно исчезает
        const alpha   = Math.min(fadeIn, fadeOut);
        if (alpha <= 0) return;

        const cx = LOGICAL_W / 2;
        const cy = Math.round(LOGICAL_H * 0.13);

        ctx.save();

        switch (eventNoticeEventId) {

            // ✦ ЗОЛОТОЙ ТЕРМИК — вспышка + сияние 
            case 'golden_thermal': {
                // вспышка в начале
                const flash = Math.max(0, 1 - t / 0.12) * 0.5;
                if (flash > 0) {
                    ctx.fillStyle = `rgba(255,220,80,${flash})`;
                    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
                }

                ctx.globalAlpha = alpha;

                // пульсирующий ореол
                const haloR = Math.round(60 * s) + Math.sin(frame * 0.15) * 4;
                const halo  = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
                halo.addColorStop(0,   'rgba(255,210,60,0.35)');
                halo.addColorStop(0.5, 'rgba(255,180,30,0.12)');
                halo.addColorStop(1,   'rgba(255,150,0,0)');
                ctx.fillStyle = halo;
                ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI*2); ctx.fill();

                // звёзды вокруг
                for (let i = 0; i < 6; i++) {
                    const a  = (i/6)*Math.PI*2 + frame * 0.04;
                    const r  = Math.round(32*s) + Math.sin(frame*0.08+i)*4;
                    const sx = cx + Math.cos(a)*r;
                    const sy = cy + Math.sin(a)*r;
                    const sa = 0.5 + Math.sin(frame*0.1+i*1.1)*0.4;
                    ctx.fillStyle = `rgba(255,220,80,${sa * alpha})`;
                    ctx.font = `${Math.round(10*s)}px monospace`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('✦', sx, sy);
                }

                // основной текст — крупный, золотой, с свечением
                ctx.shadowBlur  = 18; ctx.shadowColor = '#FFD700';
                ctx.fillStyle   = '#FFE566';
                ctx.font        = `bold ${Math.round(18*s)}px monospace`;
                ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('✦  ЗОЛОТОЙ ТЕРМИК  ✦', cx, cy);
                ctx.shadowBlur  = 0;
                break;
            }

            // ▶▶ ПОПУТНЫЙ ВЕТЕР — поток стрелок слева направо 
            case 'tailwind': {
                ctx.globalAlpha = alpha;

                // стрелки летят справа налево (ветер сзади)
                const arrows = 5;
                for (let i = 0; i < arrows; i++) {
                    // каждая стрелка со своим смещением и фазой
                    const phase  = (i / arrows) + t * 1.5;
                    const xOff   = ((phase % 1) - 0.5) * Math.round(220*s);
                    const yOff   = (i - arrows/2) * Math.round(10*s);
                    const aAlpha = Math.sin((phase % 1) * Math.PI) * alpha;
                    if (aAlpha <= 0) continue;

                    ctx.globalAlpha = aAlpha;
                    ctx.strokeStyle = 'rgba(120,220,255,0.9)';
                    ctx.lineWidth   = Math.round(2*s);
                    ctx.lineCap     = 'round';
                    ctx.lineJoin    = 'round';

                    const ax = cx + xOff;
                    const ay = cy + yOff;
                    const aw = Math.round(24*s);

                    // стрелка →
                    ctx.beginPath();
                    ctx.moveTo(ax - aw, ay);
                    ctx.lineTo(ax, ay);
                    ctx.lineTo(ax - aw*0.4, ay - aw*0.35);
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(ax - aw*0.4, ay + aw*0.35);
                    ctx.stroke();
                }

                ctx.globalAlpha = alpha;
                // текст
                ctx.fillStyle    = 'rgba(120,220,255,0.95)';
                ctx.font         = `bold ${Math.round(14*s)}px monospace`;
                ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowBlur   = 8; ctx.shadowColor = 'rgba(80,180,255,0.8)';
                ctx.fillText('ПОПУТНЫЙ ВЕТЕР', cx, cy + Math.round(22*s));
                ctx.shadowBlur   = 0;
                break;
            }

            // ◈ ЛЁГКОСТЬ — перья/пузыри всплывают вверх 
            case 'lightness': {
                ctx.globalAlpha = alpha;

                // пузырьки поднимаются
                for (let i = 0; i < 8; i++) {
                    const phase = ((i/8 + t * 0.6) % 1);
                    const bx    = cx + (i - 3.5) * Math.round(18*s);
                    const by    = cy + Math.round(30*s) - phase * Math.round(60*s);
                    const br    = Math.round((2 + (i%3)) * s);
                    const ba    = Math.sin(phase * Math.PI) * alpha;
                    ctx.globalAlpha = ba;
                    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI*2);
                    ctx.fillStyle = 'rgba(200,160,255,0.8)'; ctx.fill();
                }

                ctx.globalAlpha = alpha;
                ctx.shadowBlur  = 12; ctx.shadowColor = 'rgba(180,120,255,0.7)';
                ctx.fillStyle   = '#D4A8FF';
                ctx.font        = `bold ${Math.round(16*s)}px monospace`;
                ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('◈  ЛЁГКОСТЬ', cx, cy);
                ctx.shadowBlur  = 0;
                break;
            }

            // ↑↓→ ПОРЫВ ВЕТРА — быстрые линии в нужном направлении 
            case 'wind_gust': {
                ctx.globalAlpha = alpha;
                const dir = activeEvent ? activeEvent.dir : 'forward';

                // линии порыва
                for (let i = 0; i < 6; i++) {
                    const phase = ((i/6 + t * 2) % 1);
                    const len   = Math.round((30 + i*8) * s);
                    let lx = cx + (i-2.5)*Math.round(20*s);
                    let ly = cy;
                    let dx2 = 0, dy2 = 0;
                    if (dir === 'up')      { dy2 = -len; lx = cx + (i-2.5)*Math.round(16*s); }
                    if (dir === 'down')    { dy2 =  len; lx = cx + (i-2.5)*Math.round(16*s); }
                    if (dir === 'forward') { dx2 =  len; ly = cy + (i-2.5)*Math.round(10*s); }

                    const la = Math.sin(phase * Math.PI) * alpha;
                    ctx.globalAlpha = la;
                    ctx.strokeStyle = 'rgba(255,230,120,0.9)';
                    ctx.lineWidth   = Math.round(1.5*s);
                    ctx.lineCap     = 'round';
                    ctx.beginPath();
                    ctx.moveTo(lx, ly); ctx.lineTo(lx + dx2, ly + dy2);
                    ctx.stroke();
                }

                ctx.globalAlpha = alpha;
                const label = dir === 'up' ? '↑ ПОРЫВ ВВЕРХ' : dir === 'down' ? '↓ ПОРЫВ ВНИЗ' : '→ ПОРЫВ ВПЕРЁД';
                ctx.fillStyle    = 'rgba(255,220,100,0.95)';
                ctx.font         = `bold ${Math.round(13*s)}px monospace`;
                ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(label, cx, cy + Math.round(28*s));
                break;
            }

            // ⚡ ТУРБУЛЕНТНОСТЬ — экран трясётся, красные вспышки 
            case 'turbulence': {
                // красноватый оверлей в начале
                const shake = Math.max(0, 1 - t / 0.4) * 0.18;
                if (shake > 0) {
                    ctx.fillStyle = `rgba(255,60,60,${shake * alpha})`;
                    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
                }

                ctx.globalAlpha = alpha;
                // молнии
                for (let i = 0; i < 3; i++) {
                    const lx  = cx + (i-1)*Math.round(40*s) + Math.sin(frame*0.3+i)*3;
                    const top = cy - Math.round(20*s);
                    ctx.strokeStyle = `rgba(255,80,80,${0.6 + Math.sin(frame*0.5+i)*0.4})`;
                    ctx.lineWidth   = Math.round(1.5*s);
                    ctx.beginPath();
                    ctx.moveTo(lx,   top);
                    ctx.lineTo(lx-4, top + Math.round(12*s));
                    ctx.lineTo(lx+3, top + Math.round(12*s));
                    ctx.lineTo(lx-2, top + Math.round(22*s));
                    ctx.stroke();
                }

                ctx.shadowBlur  = 10; ctx.shadowColor = 'rgba(255,80,80,0.8)';
                ctx.fillStyle   = '#FF8888';
                ctx.font        = `bold ${Math.round(14*s)}px monospace`;
                ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('⚡ ТУРБУЛЕНТНОСТЬ', cx, cy + Math.round(28*s));
                ctx.shadowBlur  = 0;
                break;
            }

            // ◀◀ ВСТРЕЧНЫЙ ВЕТЕР — стрелки летят навстречу 
            case 'headwind': {
                ctx.globalAlpha = alpha;

                for (let i = 0; i < 5; i++) {
                    const phase  = ((i/5 + t * 1.5) % 1);
                    const xOff   = ((1 - phase % 1) - 0.5) * Math.round(220*s);
                    const yOff   = (i - 2) * Math.round(10*s);
                    const aAlpha = Math.sin((phase % 1) * Math.PI) * alpha;
                    if (aAlpha <= 0) continue;

                    ctx.globalAlpha = aAlpha;
                    ctx.strokeStyle = 'rgba(255,120,120,0.9)';
                    ctx.lineWidth   = Math.round(2*s);
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

                    const ax = cx + xOff;
                    const ay = cy + yOff;
                    const aw = Math.round(24*s);
                    // стрелка ←
                    ctx.beginPath();
                    ctx.moveTo(ax + aw, ay);
                    ctx.lineTo(ax, ay);
                    ctx.lineTo(ax + aw*0.4, ay - aw*0.35);
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(ax + aw*0.4, ay + aw*0.35);
                    ctx.stroke();
                }

                ctx.globalAlpha = alpha;
                ctx.fillStyle    = 'rgba(255,120,120,0.95)';
                ctx.font         = `bold ${Math.round(14*s)}px monospace`;
                ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowBlur   = 8; ctx.shadowColor = 'rgba(255,80,80,0.7)';
                ctx.fillText('◀◀ ВСТРЕЧНЫЙ ВЕТЕР', cx, cy + Math.round(22*s));
                ctx.shadowBlur   = 0;
                break;
            }

            // дефолт — простая таблетка
            default: {
                ctx.globalAlpha = alpha;
                ctx.fillStyle   = 'rgba(5,3,15,0.8)';
                ctx.font        = `bold ${Math.round(13*s)}px monospace`;
                const tw = ctx.measureText(eventNoticeText).width;
                const bw = tw + Math.round(24*s);
                const bh = Math.round(28*s);
                ctx.beginPath();
                ctx.roundRect(cx-bw/2, cy-bh/2, bw, bh, bh/2);
                ctx.fill();
                ctx.strokeStyle = eventNoticeColor;
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.fillStyle    = eventNoticeColor;
                ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(eventNoticeText, cx, cy);
            }
        }

        ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha  = 1;
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

    // сброс при рестарте 
    function resetEvents() {
        activeEvent      = null;
        activeEventTimer = 0;
        eventNoticeTimer = 0;
        lastEventWasNeg  = false;
        scheduleNextEvent();
    }

    // первый порог при загрузке
    scheduleNextEvent();