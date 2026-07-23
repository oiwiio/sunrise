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
        // ── "мир меняется" — не бафф/дебафф игрока, а другой мир вокруг ──
        { id: 'fog',             weight: 14, positive: false },
        { id: 'meteor_shower',   weight: 10, positive: false },
        { id: 'bird_flock',      weight: 13, positive: false },
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

            case 'fog':
                // туман — видимость падает, физика игрока не меняется
                activeEvent.duration = 6 + Math.random() * 4; // 6–10 сек
                break;

            case 'meteor_shower':
                // метеоритный дождь — активная опасность, требует уворота
                activeEvent.duration    = 7 + Math.random() * 3; // 7–10 сек спавна
                activeEvent.meteors     = [];
                activeEvent.spawnTimer  = 0;
                activeEvent.nextSpawnIn = 0.3;
                break;

            case 'bird_flock': {
                // стая птиц V-образным строем, летит навстречу — надо вписаться в промежутки
                activeEvent.birds = [];
                const birdCount = 7;
                const centerY   = LOGICAL_H * 0.28 + Math.random() * LOGICAL_H * 0.35;
                for (let i = 0; i < birdCount; i++) {
                    const side = i % 2 === 0 ? 1 : -1;
                    const rank = Math.ceil(i / 2);
                    activeEvent.birds.push({
                        x: player.x + LOGICAL_W * 1.15 + rank * 34,
                        y: centerY + side * rank * 24,
                        wingPhase: Math.random() * Math.PI * 2,
                        hit: false,
                        passed: false
                    });
                }
                break;
            }
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

            case 'fog':
                // сама видимость (оверлей) считается в отрисовке — тут только таймер
                if (activeEventTimer >= activeEvent.duration) {
                    activeEvent = null; scheduleNextEvent(); return;
                }
                break;

            case 'meteor_shower': {
                // спавним новые метеоры, пока не вышло время
                if (activeEventTimer < activeEvent.duration) {
                    activeEvent.spawnTimer += delta;
                    if (activeEvent.spawnTimer >= activeEvent.nextSpawnIn) {
                        activeEvent.spawnTimer  = 0;
                        activeEvent.nextSpawnIn = 0.32 + Math.random() * 0.36;
                        activeEvent.meteors.push({
                            x: cameraX + LOGICAL_W * (0.55 + Math.random() * 0.55),
                            y: -30,
                            vx: -(1.1 + Math.random() * 1.3),
                            vy: 4.2 + Math.random() * 2.6,
                            size: 5 + Math.random() * 4,
                            seed: Math.random() * 1000
                        });
                    }
                }

                // двигаем и проверяем столкновения (метеоры доживают и после конца спавна)
                for (let i = 0; i < activeEvent.meteors.length; i++) {
                    let m = activeEvent.meteors[i];
                    m.x += m.vx * dt;
                    m.y += m.vy * dt;

                    let dx = player.x - m.x;
                    let dy = player.y - m.y;
                    if (Math.hypot(dx, dy) < m.size + 14) {
                        score = Math.max(0, score - 40);
                        player.vx *= 0.8;
                        player.vy += 0.6;
                        addCloudPoof(m.x, m.y, 26);
                        playCloudHitSound();
                        activeEvent.meteors.splice(i, 1);
                        i--;
                        continue;
                    }

                    if (m.y - getCameraY() > LOGICAL_H + 60 || m.x < cameraX - 200) {
                        activeEvent.meteors.splice(i, 1);
                        i--;
                    }
                }

                // событие кончается, когда время спавна вышло и все метеоры улетели/убраны
                if (activeEventTimer >= activeEvent.duration && activeEvent.meteors.length === 0) {
                    activeEvent = null; scheduleNextEvent(); return;
                }
                break;
            }

            case 'bird_flock': {
                let allDone = true;
                for (let b of activeEvent.birds) {
                    if (b.hit || b.passed) continue;

                    b.x -= (player.vx + 1.6) * dt;
                    b.wingPhase += dt * 0.3;

                    let dx = player.x - b.x;
                    let dy = player.y - b.y;
                    if (Math.hypot(dx, dy) < 16) {
                        b.hit = true;
                        score = Math.max(0, score - 10);
                        player.vx *= 0.9;
                        addNegativeSpark(b.x, b.y);
                        playCloudHitSound();
                    }

                    if (b.x < cameraX - 100) {
                        b.passed = true;
                    } else {
                        allDone = false;
                    }
                }

                if (allDone) {
                    activeEvent = null; scheduleNextEvent(); return;
                }
                break;
            }
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
        fog:            { text: '▒ ТУМАН',              color: '#C8D0DC' },
        meteor_shower:  { text: '☄ МЕТЕОРИТНЫЙ ДОЖДЬ',  color: '#FFB070' },
        bird_flock:     { text: '≈ СТАЯ ПТИЦ',          color: '#D8D0C0' },
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
        fog:            2.4,
        meteor_shower:  2.4,
        bird_flock:     2.2,
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

            // ТУМАН — клубы, стелющиеся по сторонам
            case 'fog': {
                ctx.globalAlpha = alpha;
                for (let i = 0; i < 5; i++) {
                    const phase = ((i/5 + t * 0.5) % 1);
                    const fx = cx + (i - 2) * Math.round(26*s);
                    const fy = cy + Math.sin(frame*0.04 + i) * Math.round(4*s);
                    const fr = Math.round((14 + (i%3)*4) * s);
                    ctx.beginPath();
                    ctx.arc(fx, fy, fr, 0, Math.PI*2);
                    ctx.fillStyle = `rgba(200,205,215,${0.25 * alpha})`;
                    ctx.fill();
                }
                ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(200,205,215,0.6)';
                ctx.fillStyle  = '#C8D0DC';
                ctx.font       = `bold ${Math.round(14*s)}px monospace`;
                ctx.textAlign  = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('▒ ТУМАН — ВИДИМОСТЬ ПАДАЕТ', cx, cy + Math.round(24*s));
                ctx.shadowBlur = 0;
                break;
            }

            // МЕТЕОРИТНЫЙ ДОЖДЬ — падающие огненные штрихи
            case 'meteor_shower': {
                ctx.globalAlpha = alpha;
                for (let i = 0; i < 5; i++) {
                    const phase = ((i/5 + t * 1.8) % 1);
                    const mx = cx + (i - 2) * Math.round(22*s) - phase * Math.round(14*s);
                    const my = cy - Math.round(24*s) + phase * Math.round(46*s);
                    const ma = Math.sin(phase * Math.PI) * alpha;
                    if (ma <= 0) continue;
                    ctx.globalAlpha = ma;
                    ctx.strokeStyle = 'rgba(255,150,90,0.9)';
                    ctx.lineWidth = Math.round(2*s);
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(mx, my);
                    ctx.lineTo(mx - Math.round(6*s), my - Math.round(12*s));
                    ctx.stroke();
                }
                ctx.globalAlpha = alpha;
                ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,140,70,0.8)';
                ctx.fillStyle  = '#FFB070';
                ctx.font       = `bold ${Math.round(14*s)}px monospace`;
                ctx.textAlign  = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('☄ МЕТЕОРИТНЫЙ ДОЖДЬ', cx, cy + Math.round(26*s));
                ctx.shadowBlur = 0;
                break;
            }

            // ≈ СТАЯ ПТИЦ — силуэты-галочки пролетают
            case 'bird_flock': {
                ctx.globalAlpha = alpha;
                for (let i = 0; i < 4; i++) {
                    const phase = ((i/4 + t * 1.2) % 1);
                    const bx = cx + ((phase % 1) - 0.5) * Math.round(160*s);
                    const by = cy - Math.round(6*s) + (i%2===0 ? -4 : 4) * s;
                    const ba = Math.sin((phase % 1) * Math.PI) * alpha;
                    if (ba <= 0) continue;
                    ctx.globalAlpha = ba;
                    ctx.strokeStyle = 'rgba(216,208,192,0.9)';
                    ctx.lineWidth = Math.round(1.6*s);
                    ctx.lineCap = 'round';
                    const bw = Math.round(9*s);
                    ctx.beginPath();
                    ctx.moveTo(bx - bw, by + bw*0.5);
                    ctx.lineTo(bx, by);
                    ctx.lineTo(bx + bw, by + bw*0.5);
                    ctx.stroke();
                }
                ctx.globalAlpha = alpha;
                ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(216,208,192,0.5)';
                ctx.fillStyle  = '#D8D0C0';
                ctx.font       = `bold ${Math.round(14*s)}px monospace`;
                ctx.textAlign  = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('≈ СТАЯ ПТИЦ', cx, cy + Math.round(22*s));
                ctx.shadowBlur = 0;
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

        // ТУМАН — оверлей на весь экран, плавно нарастает/спадает по краям события
        if (activeEvent.id === 'fog') {
            const t = activeEventTimer / activeEvent.duration;
            const env = Math.min(1, Math.min(t, 1 - t) / 0.12); // плавный вход/выход
            ctx.save();
            ctx.globalAlpha = 1;
            // плотнее к краям экрана, чище в центре — читается как "видимость сузилась"
            const fogGrad = ctx.createRadialGradient(
                LOGICAL_W * 0.5, LOGICAL_H * 0.45, LOGICAL_W * 0.15,
                LOGICAL_W * 0.5, LOGICAL_H * 0.45, LOGICAL_W * 0.62
            );
            fogGrad.addColorStop(0, `rgba(195,200,210,${0.10 * env})`);
            fogGrad.addColorStop(1, `rgba(195,200,210,${0.42 * env})`);
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
            ctx.restore();
        }

        // МЕТЕОРЫ — падающие камни с огненным хвостом
        if (activeEvent.id === 'meteor_shower' && activeEvent.meteors) {
            const camY = getCameraY();
            ctx.save();
            for (let m of activeEvent.meteors) {
                const mx = m.x - cameraX;
                const my = m.y - camY;
                const tailLen = 16 + m.size;
                const ang = Math.atan2(m.vy, m.vx);

                // огненный хвост
                const tailGrad = ctx.createLinearGradient(
                    mx, my,
                    mx - Math.cos(ang) * tailLen, my - Math.sin(ang) * tailLen
                );
                tailGrad.addColorStop(0, 'rgba(255,200,120,0.8)');
                tailGrad.addColorStop(1, 'rgba(255,120,60,0)');
                ctx.strokeStyle = tailGrad;
                ctx.lineWidth = m.size * 0.9;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(mx, my);
                ctx.lineTo(mx - Math.cos(ang) * tailLen, my - Math.sin(ang) * tailLen);
                ctx.stroke();

                // само тело метеора
                ctx.beginPath();
                ctx.arc(mx, my, m.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,180,110,0.95)';
                ctx.fill();
            }
            ctx.restore();
        }

        // ≈ СТАЯ ПТИЦ — простые силуэты-галочки, машут крыльями
        if (activeEvent.id === 'bird_flock' && activeEvent.birds) {
            const camY = getCameraY();
            ctx.save();
            for (let b of activeEvent.birds) {
                if (b.hit || b.passed) continue;
                const bx = b.x - cameraX;
                const by = b.y - camY;
                const flap = Math.sin(b.wingPhase * 4) * 6; // взмах крыльев

                ctx.beginPath();
                ctx.moveTo(bx - 10, by + 4 + flap * 0.3);
                ctx.quadraticCurveTo(bx - 4, by - flap, bx, by);
                ctx.quadraticCurveTo(bx + 4, by - flap, bx + 10, by + 4 + flap * 0.3);
                ctx.strokeStyle = 'rgba(60,55,50,0.85)';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
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