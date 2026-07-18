// draw() и всё, что рисует кадр: небо, горы, солнце, игрок, HUD.
// Самый большой файл — чисто отрисовка, почти без игровой логики.
// Зависит от: всё выше (01–07).

    // отрисовка
    function draw() {
        // Сбрасываем трансформ в начале каждого кадра — гарантирует правильный DPR-масштаб
        // даже если предыдущий save/restore где-то нарушил стек
        const _DPR = window.devicePixelRatio || 1;
        ctx.setTransform(_DPR, 0, 0, _DPR, 0, 0);
        // Сбрасываем состояние контекста между кадрами
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalCompositeOperation = 'source-over';
        frame++;

        // во время меню — рисуем игровой мир как фон, потом накладываем UI
        // (early return убран — меню теперь оверлей поверх живого мира)
        
        const camY = getCameraY();
        
        // небо — биом (кеш, не пересоздаём каждый кадр)
        let _curBiomT = biomT(), _curBiomDir = getCycleDir();
        if (!draw._skyC || draw._skyT !== _curBiomT || draw._skyD !== _curBiomDir) {
            draw._skyT = _curBiomT; draw._skyD = _curBiomDir;
            draw._skyC = document.createElement('canvas');
            draw._skyC.width = 2; draw._skyC.height = LOGICAL_H;
            let _sc = draw._skyC.getContext('2d');
            let _sg = _sc.createLinearGradient(0, 0, 0, LOGICAL_H);
            for (let _s of biomSkyStops()) _sg.addColorStop(_s[0], _s[1]);
            _sc.fillStyle = _sg; _sc.fillRect(0, 0, 2, LOGICAL_H);
        }
        ctx.drawImage(draw._skyC, 0, 0, LOGICAL_W, LOGICAL_H);

        // туман у горизонта (биомный)
        let _fogGrad = ctx.createLinearGradient(0, LOGICAL_H*0.55, 0, LOGICAL_H);
        _fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
        _fogGrad.addColorStop(1, biomColor('fogColor'));
        ctx.fillStyle = _fogGrad;
        ctx.fillRect(0, LOGICAL_H*0.55, LOGICAL_W, LOGICAL_H*0.45);

        // граница
        const HEIGHT_LIMIT = Math.round(LOGICAL_H * 0.08);

        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(0, HEIGHT_LIMIT - camY);
        ctx.lineTo(LOGICAL_W, HEIGHT_LIMIT - camY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `${Math.round(11 * UI_SCALE)}px monospace`;
        if (HEIGHT_LIMIT - 10 - camY > 10 && HEIGHT_LIMIT - 10 - camY < LOGICAL_H - 10) {
            ctx.fillText('▲  ПРЕДЕЛ ВЫСОТЫ', Math.round(LOGICAL_W * 0.5 - 70), HEIGHT_LIMIT - 10 - camY);
        }
        
    // солнце / луна — зависит от биома
    let sunX = LOGICAL_W - 90;
    let sunY = 78;
    let pulse = 0.95 + Math.sin(frame * 0.03) * 0.05;

    // nightT: 0 = день, 1 = ночь
    const nightT = (getCurBiom().id === 'night')
        ? Math.min(1, 1 - biomT())       // переходим В ночь
        : Math.min(1, biomT());           // переходим ИЗ ночи — обратно день
    const isNight = getCurBiom().id === 'night' || (getNextBiom && getNextBiom().id === 'night' && biomT() > 0.5);

    // СОЛНЦЕ (дневная сторона)
    if (nightT < 1) {
        const sunAlpha = 1 - nightT;
        ctx.save();
        ctx.globalAlpha = sunAlpha;

        let rayRotation  = frame * 0.01;
        let rayRotation2 = -frame * 0.006;

        let atmosphere = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 180);
        atmosphere.addColorStop(0, biomSunProp('glow'));
        atmosphere.addColorStop(0.5, 'rgba(0,0,0,0)');
        atmosphere.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = atmosphere;
        ctx.beginPath(); ctx.arc(sunX, sunY, 180, 0, Math.PI*2); ctx.fill();

        const _raysBase = biomSunProp('rays');
        function _rayColor(alpha) { return toRgba(_raysBase, alpha); }

        ctx.save(); ctx.translate(sunX, sunY); ctx.rotate(rayRotation);
        for (let i = 0; i < 10; i++) {
            ctx.save(); ctx.rotate((i/10)*Math.PI*2);
            let len = 95 + Math.sin(frame*0.04+i)*12;
            ctx.beginPath(); ctx.moveTo(30,0); ctx.lineTo(len,-5); ctx.lineTo(len,5);
            ctx.fillStyle = _rayColor(0.1+Math.sin(frame*0.02+i)*0.05); ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        ctx.save(); ctx.translate(sunX, sunY); ctx.rotate(rayRotation2);
        for (let i = 0; i < 6; i++) {
            ctx.save(); ctx.rotate((i/6)*Math.PI*2);
            let len = 65 + Math.sin(frame*0.05+i)*8;
            ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(len,-3); ctx.lineTo(len,3);
            ctx.fillStyle = _rayColor(0.12+Math.sin(frame*0.03+i)*0.04); ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        let outer = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 85);
        outer.addColorStop(0,   biomSunPropA('color1', 0.35));
        outer.addColorStop(0.6, biomSunPropA('color2', 0.10));
        outer.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = outer;
        ctx.beginPath(); ctx.arc(sunX, sunY, 85*pulse, 0, Math.PI*2); ctx.fill();

        let core = ctx.createRadialGradient(sunX-5, sunY-5, 0, sunX, sunY, 38);
        core.addColorStop(0,    biomSunProp('color0'));
        core.addColorStop(0.25, biomSunProp('color1'));
        core.addColorStop(0.7,  biomSunProp('color2'));
        core.addColorStop(1,    biomSunProp('color3'));
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(sunX, sunY, 34*pulse, 0, Math.PI*2); ctx.fill();

        ctx.beginPath(); ctx.arc(sunX, sunY, 7, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,240,0.85)'; ctx.fill();

        ctx.beginPath();
        ctx.moveTo(sunX-18, sunY); ctx.lineTo(sunX+18, sunY);
        ctx.moveTo(sunX, sunY-18); ctx.lineTo(sunX, sunY+18);
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,210,0.35)'; ctx.stroke();

        for (let i = 0; i < 8; i++) {
            let angle = (i/8)*Math.PI*2 + frame*0.01;
            let radius = 48 + Math.sin(frame*0.03+i)*8;
            let px = sunX + Math.cos(angle)*radius;
            let py = sunY + Math.sin(angle)*radius;
            ctx.beginPath(); ctx.arc(px, py, 1.8+Math.sin(frame*0.04+i)*0.4, 0, Math.PI*2);
            ctx.fillStyle = `rgba(255,230,160,${0.2+Math.sin(frame*0.05+i)*0.1})`; ctx.fill();
        }
        ctx.restore();
    }

    // ЛУНА (ночная сторона) 
    if (nightT > 0) {
        const moonAlpha = nightT;
        const moonR = 28 * pulse;
        const moonX = sunX;
        const moonY = sunY;

        ctx.save();
        ctx.globalAlpha = moonAlpha;

        // мягкое свечение вокруг луны
        let moonGlow = ctx.createRadialGradient(moonX, moonY, moonR*0.5, moonX, moonY, moonR*4);
        moonGlow.addColorStop(0,   'rgba(180,200,255,0.12)');
        moonGlow.addColorStop(0.5, 'rgba(120,150,255,0.05)');
        moonGlow.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath(); ctx.arc(moonX, moonY, moonR*4, 0, Math.PI*2); ctx.fill();

        // тело луны
        let moonBody = ctx.createRadialGradient(moonX-4, moonY-4, 0, moonX, moonY, moonR);
        moonBody.addColorStop(0,   '#f0f4ff');
        moonBody.addColorStop(0.5, '#d8e4f8');
        moonBody.addColorStop(1,   '#b0c0e8');
        ctx.fillStyle = moonBody;
        ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI*2); ctx.fill();

        // серп — тёмный круг смещён, создаёт форму месяца
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(moonX + moonR*0.55, moonY - moonR*0.05, moonR*0.85, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.fill();
        ctx.restore();

        // ободок серпа — тонкое свечение по краю
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR + 1.5, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(200,220,255,0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // звёзды рядом с луной
        for (let i = 0; i < 5; i++) {
            let angle = (i / 5) * Math.PI * 2 + frame * 0.004;
            let dist  = moonR * (2.2 + (i % 2) * 0.8);
            let sx2 = moonX + Math.cos(angle) * dist;
            let sy2 = moonY + Math.sin(angle) * dist;
            let sa  = 0.4 + Math.sin(frame*0.05 + i*1.3) * 0.3;
            let sr  = 0.8 + (i % 3) * 0.5;
            ctx.beginPath(); ctx.arc(sx2, sy2, sr, 0, Math.PI*2);
            ctx.fillStyle = `rgba(220,230,255,${sa})`; ctx.fill();
        }

        ctx.restore();
    }

    // фон: несколько слоёв глубины

    // СЛОЙ 0: звёзды/частицы по всему небу
    {
        let btype = getCurBiom().particles;
        let t = biomT(); // для плавного перехода

        if (btype === 'stars') {
            // крупные звёзды
            for (let i = 0; i < 80; i++) {
                let sx2 = (i * 137.508) % LOGICAL_W;
                let sy2 = (i * 97.314)  % (LOGICAL_H * 0.78);
                let twinkle = 0.25 + Math.sin(frame * 0.035 + i * 1.7) * 0.22;
                let sz = 0.6 + (i % 4) * 0.45;
                ctx.beginPath();
                ctx.arc(sx2, sy2, sz, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(220,215,255,${twinkle})`;
                ctx.fill();
            }
            // крестики для ярких звёзд
            for (let i = 0; i < 8; i++) {
                let sx2 = (i * 317.4) % LOGICAL_W;
                let sy2 = (i * 181.9) % (LOGICAL_H * 0.6);
                let a = 0.3 + Math.sin(frame * 0.04 + i * 2.3) * 0.2;
                let r = 3 + (i % 3);
                ctx.save();
                ctx.strokeStyle = `rgba(230,225,255,${a})`;
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(sx2 - r, sy2); ctx.lineTo(sx2 + r, sy2);
                ctx.moveTo(sx2, sy2 - r); ctx.lineTo(sx2, sy2 + r);
                ctx.stroke();
                ctx.restore();
            }
        } else if (btype === 'sparks') {
            for (let i = 0; i < 35; i++) {
                let sx2 = ((i * 173.1 + frame * 0.06) % (LOGICAL_W + 60)) - 30;
                let sy2 = 20 + (i * 83.7) % (LOGICAL_H * 0.72);
                let a = 0.06 + Math.sin(frame * 0.03 + i * 2.1) * 0.05;
                ctx.beginPath();
                ctx.arc(sx2, sy2, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,215,160,${a})`;
                ctx.fill();
            }
        } else if (btype === 'embers') {
            for (let i = 0; i < 40; i++) {
                let sx2 = ((i * 159.3 + frame * 0.12) % (LOGICAL_W + 60)) - 30;
                let sy2 = 15 + (i * 71.9) % (LOGICAL_H * 0.75);
                let a = 0.07 + Math.sin(frame * 0.05 + i * 1.9) * 0.06;
                ctx.beginPath();
                ctx.arc(sx2, sy2, 0.7 + (i % 3) * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,140,50,${a})`;
                ctx.fill();
            }
        } else if (btype === 'birds') {
            for (let i = 0; i < 12; i++) {
                let bx = ((i * 180 + frame * (0.35 + i * 0.04)) % (LOGICAL_W + 120)) - 60;
                let by2 = 30 + (i * 71) % (LOGICAL_H * 0.55);
                let a = 0.12 + (i % 3) * 0.05;
                let scale = 0.7 + (i % 3) * 0.2;
                ctx.save();
                ctx.translate(bx, by2);
                ctx.beginPath();
                ctx.moveTo(-6 * scale, 0);
                ctx.lineTo(0, -2.5 * scale);
                ctx.lineTo(6 * scale, 0);
                ctx.strokeStyle = `rgba(20,50,110,${a})`;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }
        }

        // плавный переход — звёзды появляются при переходе к ночи
        if (t > 0 && btype !== 'stars') {
            for (let i = 0; i < 50; i++) {
                let sx2 = (i * 137.508) % LOGICAL_W;
                let sy2 = (i * 97.314)  % (LOGICAL_H * 0.75);
                let twinkle = (0.2 + Math.sin(frame * 0.035 + i * 1.7) * 0.18) * t;
                ctx.beginPath();
                ctx.arc(sx2, sy2, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200,210,255,${twinkle})`;
                ctx.fill();
            }
        }
    }

    // СЛОЙ 1: очень дальние горы (4й план, parallax 0.08) — высокие, занимают среднюю часть неба
    {
        let p4 = cameraX * 0.08;
        let c4 = biomColor('farMtn');
        ctx.beginPath();
        let step = 14;
        for (let x = 0; x <= LOGICAL_W + step; x += step) {
            let wx = x + p4;
            let h = LOGICAL_H * 0.38       // базовая высота — середина экрана
                + Math.sin(wx * 0.0041) * 80
                + Math.sin(wx * 0.0019) * 55
                + Math.sin(wx * 0.0097) * 25
                + Math.sin(wx * 0.0007) * 40;
            let y = LOGICAL_H - h - camY * 0.06;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(LOGICAL_W, LOGICAL_H);
        ctx.lineTo(0, LOGICAL_H);
        ctx.closePath();
        let g4 = ctx.createLinearGradient(0, LOGICAL_H * 0.2, 0, LOGICAL_H);
        g4.addColorStop(0,   toRgba(c4, 0.18));
        g4.addColorStop(0.5, toRgba(c4, 0.32));
        g4.addColorStop(1,   toRgba(c4, 0.45));
        ctx.fillStyle = g4;
        ctx.fill();
    }

    // СЛОЙ 2: дальние горы (3й план, parallax 0.18) — пониже
    {
        let p3 = cameraX * 0.18;
        let c3 = biomColor('farMtn');
        ctx.beginPath();
        let step = 16;
        for (let x = 0; x <= LOGICAL_W + step; x += step) {
            let wx = x + p3;
            let h = LOGICAL_H * 0.25
                + Math.sin(wx * 0.0062) * 55
                + Math.sin(wx * 0.0028) * 35
                + Math.sin(wx * 0.014)  * 18;
            let y = LOGICAL_H - h - camY * 0.10;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(LOGICAL_W, LOGICAL_H);
        ctx.lineTo(0, LOGICAL_H);
        ctx.closePath();
        let g3 = ctx.createLinearGradient(0, LOGICAL_H * 0.35, 0, LOGICAL_H);
        g3.addColorStop(0,   toRgba(c3, 0.28));
        g3.addColorStop(0.6, toRgba(c3, 0.48));
        g3.addColorStop(1,   toRgba(c3, 0.55));
        ctx.fillStyle = g3;
        ctx.fill();
    }

    // дымка убрана (была видна как полосы на ярких биомах)

    // горы: одна вершина на сегмент, сплайн без волн ──
    function buildMtnPoints(offsetY) {
        let pts = [];
        for (let seg of mountainSegments) {
            // центр сегмента = вершина горы
            let sx = seg.x - cameraX + segmentWidth * 0.5;
            let sy = seg.y - camY - offsetY;
            pts.push({ x: sx, y: sy, baseY: seg.y - offsetY });
        }
        return pts;
    }

    function drawMtnLayer(pts, fillStyle, snowColor) {
        if (pts.length < 2) return;
        let visible = [];
        for (let i = 0; i < pts.length; i++) {
            if (pts[i].x > -segmentWidth * 2 && pts[i].x < LOGICAL_W + segmentWidth * 2)
                visible.push({ idx: i, p: pts[i] });
        }
        if (visible.length < 2) return;

        let first = visible[0].p;
        let last  = visible[visible.length - 1].p;

        ctx.beginPath();
        ctx.moveTo(first.x - segmentWidth * 0.5, LOGICAL_H);
        ctx.lineTo(first.x - segmentWidth * 0.5, first.y);

        // через каждую вершину — Catmull-Rom, низкое натяжение = острее пики
        for (let j = 0; j < visible.length - 1; j++) {
            let i0 = Math.max(0, visible[j].idx - 1);
            let i1 = visible[j].idx;
            let i2 = visible[j + 1].idx;
            let i3 = Math.min(pts.length - 1, visible[j + 1].idx + 1);
            let p0 = pts[i0], p1 = pts[i1], p2 = pts[i2], p3 = pts[i3];
            let t = 0.18;  // низкое натяжение = острые пики, не волны
            let cp1x = p1.x + (p2.x - p0.x) * t;
            let cp1y = p1.y + (p2.y - p0.y) * t;
            let cp2x = p2.x - (p3.x - p1.x) * t;
            let cp2y = p2.y - (p3.y - p1.y) * t;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }

        ctx.lineTo(last.x + segmentWidth * 0.5, LOGICAL_H);
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();

        // снежные шапки — только на реальных пиках (локальный минимум Y)
        if (snowColor) {
            for (let j = 1; j < visible.length - 1; j++) {
                let prev = visible[j - 1].p;
                let cur  = visible[j].p;
                let next = visible[j + 1].p;
                // локальный пик = выше соседей
                if (cur.y < prev.y && cur.y < next.y) {
                    let capH = (Math.min(prev.y, next.y) - cur.y) * 0.55;
                    capH = Math.max(8, Math.min(capH, 40));
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(cur.x - capH * 0.9, cur.y + capH * 0.6);
                    ctx.quadraticCurveTo(cur.x - capH * 0.3, cur.y + capH * 0.15, cur.x, cur.y - 4);
                    ctx.quadraticCurveTo(cur.x + capH * 0.3, cur.y + capH * 0.15, cur.x + capH * 0.9, cur.y + capH * 0.6);
                    ctx.closePath();
                    ctx.fillStyle = snowColor;
                    ctx.fill();
                    ctx.restore();
                }
            }
        }
    }

    let farPts  = buildMtnPoints(20);
    let nearPts = buildMtnPoints(0);

    // дальние горы
    drawMtnLayer(farPts, biomColor('farMtn'), null);

    // атмосферная дымка
    {
        let vis = farPts.filter(p => p.x > 0 && p.x < LOGICAL_W);
        if (vis.length) {
            let hazeY = Math.min(...vis.map(p => p.y));
            let haze = ctx.createLinearGradient(0, hazeY - 20, 0, hazeY + 90);
            haze.addColorStop(0,   'rgba(60,30,100,0)');
            haze.addColorStop(0.5, 'rgba(40,20,70,0.14)');
            haze.addColorStop(1,   'rgba(10,5,20,0)');
            ctx.fillStyle = haze;
            ctx.fillRect(0, hazeY - 20, LOGICAL_W, 110);
        }
    }

    // ближние горы с градиентом и снегом
    let nearVisible = nearPts.filter(p => p.x > 0 && p.x < LOGICAL_W);
    let nearTop = nearVisible.length ? Math.min(...nearVisible.map(p => p.y)) : 0;
    let nearGrad = ctx.createLinearGradient(0, nearTop - 20, 0, LOGICAL_H);
    nearGrad.addColorStop(0,    biomColor('nearMtnTop') || biomColor('nearMtn'));
    nearGrad.addColorStop(0.4,  biomColor('nearMtn'));
    nearGrad.addColorStop(1,    biomColor('nearMtn'));
    drawMtnLayer(nearPts, nearGrad, biomColor('snowCap'));

        // облака — без blur и без градиентов (быстро)
        const _cTop = biomColor('cloudTop');
        const _cBot = biomColor('cloudBot');
        const cloudsToDraw = [...clouds].sort((a, b) => a.depth - b.depth);
        for (let c of cloudsToDraw) {
            let x = c.x - cameraX;
            let y = c.y - camY;
            let w = c.width;
            let h = c.height;
            if (!isFinite(x) || !isFinite(y) || !w || !h) continue;
            if (x + w < -20 || x - w > LOGICAL_W + 20) continue;

            ctx.save();
            ctx.globalAlpha = c.opacity;

            // тень снизу
            ctx.fillStyle = 'rgba(160, 170, 200, 0.14)';
            ctx.beginPath();
            ctx.arc(x, y + h * 0.25, h * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // тело — верхний цвет
            ctx.fillStyle = _cTop;
            ctx.beginPath();
            ctx.arc(x - w * 0.42, y,           h * 0.46, 0, Math.PI * 2);
            ctx.arc(x - w * 0.1,  y - h * 0.18, h * 0.56, 0, Math.PI * 2);
            ctx.arc(x + w * 0.22, y - h * 0.08, h * 0.5,  0, Math.PI * 2);
            ctx.arc(x + w * 0.45, y + h * 0.04, h * 0.38, 0, Math.PI * 2);
            ctx.fill();

            // нижняя часть темнее
            ctx.fillStyle = _cBot;
            ctx.globalAlpha = c.opacity * 0.3;
            ctx.beginPath();
            ctx.arc(x - w * 0.42, y + h * 0.08, h * 0.38, 0, Math.PI * 2);
            ctx.arc(x + w * 0.22, y + h * 0.04, h * 0.35, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        }
        ctx.filter = 'none';

        //термики
        for (let t of thermals) {
            let screenX = t.x - cameraX;
            let screenY = t.y - camY;
            const pulseScale = 0.85 + Math.sin(frame * 0.025 + t.pulse) * 0.1;

            ctx.save();

            // поймали: короткая вспышка вместо обычного термика 
            if (t.caught) {
                const ft = t.catchTimer / 0.3; // 0..1
                const flashR = t.pullRadius * (0.4 + ft * 0.8);
                let flashGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, flashR);
                flashGrad.addColorStop(0, biomColorA('thermalColor', Math.max(0, 1 - ft) * 0.9));
                flashGrad.addColorStop(1, biomColorA('thermalColor', 0));
                ctx.fillStyle = flashGrad;
                ctx.beginPath();
                ctx.arc(screenX, screenY, flashR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                continue;
            }

            // шлейф тёплого воздуха, "исходящий от земли" к термику 
            let shaftGrad = ctx.createLinearGradient(screenX, screenY + t.pullRadius * 1.6, screenX, screenY - t.coreRadius);
            shaftGrad.addColorStop(0, biomColorA('thermalColor', 0));
            shaftGrad.addColorStop(1, biomColorA('thermalColor', 0.16));
            ctx.fillStyle = shaftGrad;
            ctx.beginPath();
            ctx.moveTo(screenX - t.coreRadius * 0.5, screenY + t.pullRadius * 1.6);
            ctx.lineTo(screenX + t.coreRadius * 0.5, screenY + t.pullRadius * 1.6);
            ctx.lineTo(screenX + t.coreRadius * 1.1, screenY);
            ctx.lineTo(screenX - t.coreRadius * 1.1, screenY);
            ctx.closePath();
            ctx.fill();

            // тонкое кольцо — видимая зона притяжения 
            ctx.beginPath();
            ctx.arc(screenX, screenY, t.pullRadius, 0, Math.PI * 2);
            ctx.strokeStyle = biomColorA('thermalColor', 0.14 + Math.sin(frame * 0.03 + t.pulse) * 0.05);
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // концентрические волны, расширяющиеся от центра наружу 
            for (let r = 0; r < 3; r++) {
                const ringPhase  = ((frame * 0.006) + t.pulse * 0.1 + r / 3) % 1;
                const ringRadius = t.coreRadius + ringPhase * (t.pullRadius - t.coreRadius);
                const ringAlpha  = (1 - ringPhase) * 0.35;
                ctx.beginPath();
                ctx.arc(screenX, screenY, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = biomColorA('thermalColor', ringAlpha);
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // яркое свечение к центру 
            const glowR = t.coreRadius * pulseScale * 1.4;
            let glowGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowR);
            glowGrad.addColorStop(0, biomColorA('thermalColor', 0.55 + Math.sin(Date.now() * 0.005) * 0.08));
            glowGrad.addColorStop(1, biomColorA('thermalColor', 0));
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, glowR, 0, Math.PI * 2);
            ctx.fill();

            // частицы, летящие вверх внутри термика 
            for (let p of t.particles) {
                const px = screenX + p.offsetX * t.coreRadius * 0.8;
                const py = screenY + t.pullRadius * 0.9 - p.phase * (t.pullRadius * 0.9 + t.coreRadius);
                const pAlpha = Math.sin(p.phase * Math.PI); // мягко появляется и исчезает
                ctx.beginPath();
                ctx.arc(px, py, p.size, 0, Math.PI * 2);
                ctx.fillStyle = biomColorA('thermalColor', pAlpha * 0.7);
                ctx.fill();
            }

            // подсказка: дуга-стрелка сверху намекает, что термик тянет вверх 
            const hintY = screenY - t.pullRadius - 14 + Math.sin(frame * 0.04 + t.pulse) * 3;
            ctx.beginPath();
            ctx.moveTo(screenX - 8, hintY + 6);
            ctx.lineTo(screenX, hintY - 6);
            ctx.lineTo(screenX + 8, hintY + 6);
            ctx.strokeStyle = biomColorA('thermalColor', 0.5);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            ctx.restore();
        }
        
        // турбулентность — закручивающийся вихрь, тянущий вниз
        for (let d of downdrafts) {
            let screenX = d.x - cameraX;
            let screenY = d.y - camY;

            ctx.save();

            // попадание: короткая встряска-вспышка вместо обычного вихря 
            if (d.hit) {
                const ft = d.hitTimer / 0.3; // 0..1
                const shockR = d.pullRadius * (0.35 + ft * 0.9);
                let shockGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, shockR);
                shockGrad.addColorStop(0, `rgba(90, 100, 150, ${Math.max(0, 1 - ft) * 0.65})`);
                shockGrad.addColorStop(1, 'rgba(90, 100, 150, 0)');
                ctx.fillStyle = shockGrad;
                ctx.beginPath();
                ctx.arc(screenX, screenY, shockR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                continue;
            }

            // тёмное пульсирующее ядро 
            const corePulse = 0.9 + Math.sin(frame * 0.05 + d.pulse) * 0.12;
            let coreGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, d.coreRadius * corePulse);
            coreGrad.addColorStop(0, 'rgba(55, 65, 105, 0.55)');
            coreGrad.addColorStop(1, 'rgba(55, 65, 105, 0)');
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, d.coreRadius * corePulse, 0, Math.PI * 2);
            ctx.fill();

            // неровный дрожащий контур зоны турбулентности 
            ctx.beginPath();
            const jSegs = 22;
            for (let s = 0; s <= jSegs; s++) {
                const ang = (s / jSegs) * Math.PI * 2;
                const jitter = Math.sin(frame * 0.16 + ang * 5 + d.pulse) * 3;
                const r = d.pullRadius + jitter;
                const px = screenX + Math.cos(ang) * r;
                const py = screenY + Math.sin(ang) * r;
                if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = 'rgba(115, 135, 185, 0.16)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // спиральные завитки, закручивающиеся в разные стороны 
            for (let r = 0; r < 2; r++) {
                ctx.beginPath();
                const spiralTurns  = 1.3;
                const spiralPoints = 18;
                const rot = frame * 0.02 * (r % 2 === 0 ? 1 : -1) + d.pulse + r * Math.PI;
                for (let s = 0; s <= spiralPoints; s++) {
                    const p    = s / spiralPoints;
                    const ang  = rot + p * Math.PI * 2 * spiralTurns;
                    const rad  = d.coreRadius + p * (d.pullRadius - d.coreRadius);
                    const px   = screenX + Math.cos(ang) * rad;
                    const py   = screenY + Math.sin(ang) * rad;
                    if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = `rgba(120, 140, 200, ${0.26 - r * 0.08})`;
                ctx.lineWidth = 1.6;
                ctx.stroke();
            }

            // частицы, хаотично кружащиеся внутри вихря 
            for (let p of d.particles) {
                const rad = d.coreRadius + (Math.sin(p.angle * 0.7) * 0.5 + 0.5) * (d.pullRadius - d.coreRadius);
                const px  = screenX + Math.cos(p.angle) * rad;
                const py  = screenY + Math.sin(p.angle) * rad + Math.sin(frame * 0.1 + p.angle) * 3;
                ctx.beginPath();
                ctx.arc(px, py, p.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(140, 160, 210, 0.5)';
                ctx.fill();
            }

            // подсказка: шеврон ВНИЗ — предупреждает, что тянет вниз 
            const hintY = screenY + d.pullRadius + 14 + Math.sin(frame * 0.04 + d.pulse) * 3;
            ctx.beginPath();
            ctx.moveTo(screenX - 8, hintY - 6);
            ctx.lineTo(screenX, hintY + 6);
            ctx.lineTo(screenX + 8, hintY - 6);
            ctx.strokeStyle = 'rgba(140, 160, 210, 0.55)';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            ctx.restore();
        }
        
        //отрисовка флага рекорда
        // drawRecordFlag(player.x, camY);


        // индикатор максимальной скорости
        let isMaxSpeed = (player.vx > MAX_VX_GROWTH - 0.8);
        if (isMaxSpeed) {
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = '#FFD966';
            ctx.fillText(' MAX SPEED ', LOGICAL_W - 130, 58);
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
                ctx.strokeStyle = biomColorA('trailColor', opacity);
                ctx.stroke();
            }
        }

        // частицы биома (птицы, угли, звёзды, молнии)
        drawBiomParticles(camY);

        // линии ветра — изогнутые, без градиента
        ctx.lineCap = 'round';
        for (let p of windParticles) {
            const curl  = p.curl  || 0;
            const phase = p.phase || 0;
            const wave  = Math.sin(frame * 0.08 + phase) * (p.type === 'fast' ? 4 : 2);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.quadraticCurveTo(
                p.x - p.length * 0.5, p.y + curl * 0.5 + wave,
                p.x - p.length,       p.y - p.vy * 2 + curl
            );
            ctx.lineWidth   = p.width * (0.8 + p.life * 0.4);
            ctx.strokeStyle = biomColorA('windColor', p.life * p.opacity * 0.55);
            ctx.stroke();
        }

    // игрок — самолётик в стиле Telegram
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.translate(player.x - cameraX, player.y - camY);
    ctx.rotate(player.angle);

    const drift = Math.sin(frame * 0.12) * 0.6;
    ctx.rotate(drift * 0.025);

    // верхняя половина корпуса (светлее)
    ctx.beginPath();
    ctx.moveTo(22,  0);   // острый нос
    ctx.lineTo( 2, -8);   // верхний передний угол
    ctx.lineTo(-16, -4);  // верхний хвост
    ctx.lineTo(-12,  0);  // центр хвоста
    ctx.closePath();
    ctx.fillStyle = '#FFF8F0';
    ctx.fill();

    // нижняя половина (темнее) 
    ctx.beginPath();
    ctx.moveTo(22,  0);
    ctx.lineTo( 2,  8);
    ctx.lineTo(-16,  4);
    ctx.lineTo(-12,  0);
    ctx.closePath();
    ctx.fillStyle = '#E0C8A8';
    ctx.fill();

    // верхнее крыло (загнуто назад)
    ctx.beginPath();
    ctx.moveTo( 5,  0);
    ctx.lineTo(-3, -17 + drift);
    ctx.lineTo(-14, -4);
    ctx.lineTo(-12,  0);
    ctx.closePath();
    ctx.fillStyle = '#FFF4E8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,150,110,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // нижнее крыло 
    ctx.beginPath();
    ctx.moveTo( 5,  0);
    ctx.lineTo(-3,  17 - drift);
    ctx.lineTo(-14,  4);
    ctx.lineTo(-12,  0);
    ctx.closePath();
    ctx.fillStyle = '#D8BEA0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,130,90,0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // центральная линия-складка 
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-12, 0);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(160,130,95,0.55)';
    ctx.lineCap = 'round';
    ctx.stroke();

    // блик на носу 
    ctx.beginPath();
    ctx.moveTo(22,  0);
    ctx.lineTo( 9, -5);
    ctx.lineTo( 5, -1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();

    ctx.restore();

        // искры (жёлтые, синие, облачные)
        for (let sp of sparkParticles) {
            let color;
            if (sp.isCloud) {
                color = `rgba(240, 248, 255, ${sp.life * 0.8})`;
            } else if (sp.isNegative) {
                color = `rgba(100, 150, 200, ${sp.life * 0.9})`;
            } else {
                color = `rgba(255, 220, 140, ${sp.life * 0.9})`;
            }
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.size * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        //ui — сбрасываем ctx-состояние перед HUD чтобы тени и alpha не текли
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = 1;
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
            ctx.fillText(msgs[diffNoticeLevel] || '', LOGICAL_W / 2, LOGICAL_H / 2 - 80);
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
            ctx.fillText(`ВЕТЕР КРЕПЧАЕТ — МАКС. ${windNoticeSpeed}`, LOGICAL_W / 2, LOGICAL_H / 2 - Math.round(55*UI_SCALE));
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
        
        
        if (!gameRunning && !isDying) {
            const cx = LOGICAL_W / 2;
            const cy = LOGICAL_H / 2;
            const isRecord = Math.floor(score) >= highScore && highScore > 0;

            // затемнение фона
            ctx.fillStyle = 'rgba(5, 3, 15, 0.62)';
            ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

            // карточка по центру
            const cw = Math.round(340 * s);
            const ch = Math.round(220 * s);
            const cx0 = cx - cw / 2;
            const cy0 = cy - ch / 2;

            // фон карточки
            ctx.fillStyle = 'rgba(10, 8, 22, 0.82)';
            ctx.beginPath();
            ctx.roundRect(cx0, cy0, cw, ch, Math.round(16*s));
            ctx.fill();
            ctx.strokeStyle = isRecord
                ? 'rgba(255,210,80,0.45)'
                : 'rgba(255,217,181,0.12)';
            ctx.lineWidth = isRecord ? 1.5 : 1;
            ctx.stroke();

            // заголовок
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = `bold ${Math.round(22*s)}px monospace`;
            ctx.fillStyle = isRecord ? '#FFD966' : '#FFF3DF';
            ctx.shadowBlur = isRecord ? 12 : 0;
            ctx.shadowColor = 'rgba(255,210,80,0.5)';
            ctx.fillText(isRecord ? '✦  НОВЫЙ РЕКОРД  ✦' : 'ПОКИНУЛ НЕБО', cx, cy0 + Math.round(42*s));
            ctx.shadowBlur = 0;

            // счёт
            ctx.font = `bold ${Math.round(44*s)}px monospace`;
            ctx.fillStyle = '#FFF9E8';
            ctx.fillText(Math.floor(score), cx, cy0 + Math.round(102*s));

            // подпись под счётом
            ctx.font = `${Math.round(10*s)}px monospace`;
            ctx.fillStyle = 'rgba(255,217,181,0.4)';
            ctx.fillText('ОЧКОВ НАБРАНО', cx, cy0 + Math.round(118*s));

            // рекорд (если не новый)
            if (!isRecord && highScore > 0) {
                ctx.font = `${Math.round(11*s)}px monospace`;
                ctx.fillStyle = 'rgba(255,210,140,0.55)';
                ctx.fillText('РЕКОРД  ' + highScore + '  ✦', cx, cy0 + Math.round(142*s));
            }

            // разделитель
            ctx.beginPath();
            ctx.moveTo(cx0 + Math.round(24*s), cy0 + Math.round(158*s));
            ctx.lineTo(cx0 + cw - Math.round(24*s), cy0 + Math.round(158*s));
            ctx.strokeStyle = 'rgba(255,217,181,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // кнопка рестарта — пульсирует
            let bp = 0.88 + Math.sin(frame * 0.07) * 0.12;
            ctx.font = `${Math.round(11*s)}px monospace`;
            ctx.fillStyle = `rgba(255,200,120,${0.5 + Math.sin(frame*0.07)*0.2})`;
            ctx.fillText('ПРОБЕЛ  /  КЛИК  /  ТАП  →  НОВЫЙ ПОЛЁТ', cx, cy0 + Math.round(185*s));

            ctx.restore();

            // звезда на месте рекорда в мире
            if (highScorePosition > 0) {
                const starX = highScorePosition - cameraX;
                const starY = highScorePositionY - camY;
                if (starX > -50 && starX < LOGICAL_W + 50) {
                    ctx.save();
                    ctx.font = `${Math.round(20*s)}px monospace`;
                    ctx.fillStyle = '#FFD966';
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = 'rgba(255,210,80,0.6)';
                    ctx.textAlign = 'center';
                    ctx.fillText('✦', starX, starY - 18);
                    ctx.font = `${Math.round(9*s)}px monospace`;
                    ctx.fillStyle = 'rgba(201,178,139,0.6)';
                    ctx.shadowBlur = 0;
                    ctx.fillText('рекорд', starX, starY - 4);
                    ctx.restore();
                }
            }
        }

        ctx.restore(); // конец HUD

        // эффект рассвета (линзовые блики + дымка)
        // теплая дымка поверх неба (мягкий градиент)
        let hazeGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
        hazeGrad.addColorStop(0, 'rgba(255, 220, 150, 0.12)');
        hazeGrad.addColorStop(0.5, 'rgba(255, 180, 100, 0.05)');
        hazeGrad.addColorStop(1, 'rgba(255, 140, 80, 0)');
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
        
        // линзовый блик
        let flareX = LOGICAL_W - 80;
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

        // виньетирование на опасной скорости — тёмно-красные края экрана,
        // усиливаются по мере разгона к текущему максимуму скорости
        const DANGER_SPEED_THRESHOLD = 0.72; // с какой доли макс. скорости начинает проявляться
        const speedRatio = Math.max(0, Math.min(1, player.vx / MAX_VX_GROWTH));
        const dangerT = Math.max(0, (speedRatio - DANGER_SPEED_THRESHOLD) / (1 - DANGER_SPEED_THRESHOLD));
        if (dangerT > 0) {
            const vignetteStrength = dangerT * 0.5; // максимальная непрозрачность краёв
            const vgX = LOGICAL_W / 2, vgY = LOGICAL_H / 2;
            const innerR = Math.min(LOGICAL_W, LOGICAL_H) * 0.32;
            const outerR = Math.max(LOGICAL_W, LOGICAL_H) * 0.75;
            let vignette = ctx.createRadialGradient(vgX, vgY, innerR, vgX, vgY, outerR);
            vignette.addColorStop(0, 'rgba(110, 10, 10, 0)');
            vignette.addColorStop(1, `rgba(110, 10, 10, ${vignetteStrength.toFixed(3)})`);
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
        }

        // события — поверх игры, под меню
        if (!showWelcome) {
            drawActiveEvent();
            drawEventNotice();
        }

        // приветственный экран — поверх всего
        if (showWelcome) {
            drawWelcomeScreen();
        }

        // конец кадра — сбрасываем трансформ для безопасности
        ctx.setTransform(_DPR, 0, 0, _DPR, 0, 0);
    }