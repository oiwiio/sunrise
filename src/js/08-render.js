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

        // если показываем приветственный экран — рисуем его и выходим
        if (showWelcome) {
            drawWelcomeScreen();
            return;
        }
        
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
        
    // солнце
    let sunX = LOGICAL_W - 90;
    let sunY = 78;

    let pulse = 0.95 + Math.sin(frame * 0.03) * 0.05;
    let rayRotation = frame * 0.01;
    let rayRotation2 = -frame * 0.006;

    // атмосферное свечение (биом)
    let atmosphere = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 180);
    atmosphere.addColorStop(0, biomSunProp('glow'));
    atmosphere.addColorStop(0.5, 'rgba(0,0,0,0)');
    atmosphere.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 180, 0, Math.PI * 2);
    ctx.fill();

    // лучи
    // лучи солнца — цвет вычисляем один раз за пределами обоих циклов
    const _raysBase = biomSunProp('rays');
    function _rayColor(alpha) {
        return toRgba(_raysBase, alpha);
    }

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
        ctx.fillStyle = _rayColor(0.1 + Math.sin(frame * 0.02 + i) * 0.05);
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();

    // лучи (второй набор, медленнее)
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
        ctx.fillStyle = _rayColor(0.12 + Math.sin(frame * 0.03 + i) * 0.04);
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();

    // внешний ореол
    let outer = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 85);
    outer.addColorStop(0,   biomSunPropA('color1', 0.35));
    outer.addColorStop(0.6, biomSunPropA('color2', 0.10));
    outer.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 85 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    // ядро солнца
    let core = ctx.createRadialGradient(sunX - 5, sunY - 5, 0, sunX, sunY, 38);
    core.addColorStop(0,    biomSunProp('color0'));
    core.addColorStop(0.25, biomSunProp('color1'));
    core.addColorStop(0.7,  biomSunProp('color2'));
    core.addColorStop(1,    biomSunProp('color3'));      
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // центральная яркая точка
    ctx.beginPath();
    ctx.arc(sunX, sunY, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,240,0.85)';
    ctx.fill();

    // крест-блик
    ctx.beginPath();
    ctx.moveTo(sunX - 18, sunY);
    ctx.lineTo(sunX + 18, sunY);
    ctx.moveTo(sunX, sunY - 18);
    ctx.lineTo(sunX, sunY + 18);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,210,0.35)';
    ctx.stroke();

    // парящие частицы вокруг солнца
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

    // СЛОЙ 3: атмосферная дымка между планами
    {
        // верхняя дымка (у линии горизонта дальних гор)
        let hazeY1 = LOGICAL_H * 0.42;
        let h1 = ctx.createLinearGradient(0, hazeY1 - 40, 0, hazeY1 + 80);
        h1.addColorStop(0,   'rgba(0,0,0,0)');
        h1.addColorStop(0.45, toRgba(biomColor('fogColor'), 0.18));
        h1.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = h1;
        ctx.fillRect(0, hazeY1 - 40, LOGICAL_W, 120);

        // нижняя дымка (у подножья гор)
        let hazeY2 = LOGICAL_H * 0.68;
        let h2 = ctx.createLinearGradient(0, hazeY2 - 20, 0, hazeY2 + 70);
        h2.addColorStop(0,   'rgba(0,0,0,0)');
        h2.addColorStop(0.4, toRgba(biomColor('fogColor'), 0.28));
        h2.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = h2;
        ctx.fillRect(0, hazeY2 - 20, LOGICAL_W, 90);
    }

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

        // облака
        // рисуем от дальних к ближним (параллакс) — дальние облака мельче, тусклее и мягче
        const cloudsToDraw = [...clouds].sort((a, b) => a.depth - b.depth);
        for (let c of cloudsToDraw) {
            let x = c.x - cameraX;
            let y = c.y - camY;
            let w = c.width;
            let h = c.height;
            
            if (!isFinite(x) || !isFinite(y) || !w || !h) continue;

            ctx.save();
            ctx.globalAlpha = c.opacity;
            // дальние облака чуть размыты — усиливает ощущение глубины
            ctx.filter = `blur(${Math.max(0, (1 - c.depth) * 1.6).toFixed(2)}px)`;

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
            body.addColorStop(0, biomColor('cloudTop'));
            body.addColorStop(1, biomColor('cloudBot'));
            ctx.fillStyle = body;
            ctx.beginPath();
            ctx.arc(x - w * 0.42, y, h * 0.46, 0, Math.PI * 2);
            ctx.arc(x - w * 0.1, y - h * 0.18, h * 0.56, 0, Math.PI * 2); 
            ctx.arc(x + w * 0.22, y - h * 0.08, h * 0.5, 0, Math.PI * 2);
            ctx.arc(x + w * 0.45, y + h * 0.04, h * 0.38, 0, Math.PI * 2);
            ctx.fill();
            
            // рассветная подсветка сверху
            let highlight = ctx.createLinearGradient(x, y - h, x, y);
            highlight.addColorStop(0, biomColorA('cloudHL', parseColor(biomColor('cloudHL'))[3]));
            highlight.addColorStop(1, biomColorA('cloudHL', 0));
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
            ctx.restore();
        }
        ctx.filter = 'none';  // гарантированный сброс filter после облаков

        //термики
        for (let t of thermals) {
            let screenX = t.x - cameraX;
            let screenY = t.y - camY;
            ctx.beginPath();
            let pulseScale = 0.85 + Math.sin(frame * 0.025 + t.pulse) * 0.1;
            ctx.arc(screenX, screenY, t.radius * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = biomColorA('thermalColor', 0.24+Math.sin(Date.now()*0.005)*0.08);
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

        // линии ветра
        for (let p of windParticles) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.length, p.y - p.vy * 2);
            ctx.lineWidth = p.width;
            ctx.strokeStyle = biomColorA('windColor', p.life*p.opacity*0.6);
            ctx.stroke();
        }

    // игрок
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.translate(player.x - cameraX, player.y - camY);
    ctx.rotate(player.angle);

    let flap = Math.sin(frame * 0.18) * 0.8;
    let scarfSwing = Math.max(-14, Math.min(14, -player.vy * 2.2));

    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(0,0,0,0.18)';

    // крыло
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

    // нижняя тень крыла 
    ctx.beginPath();
    ctx.moveTo(12, -3);
    ctx.quadraticCurveTo(2, 1, -6, 3);
    ctx.quadraticCurveTo(2, 4, 12, -3);
    ctx.fillStyle = 'rgba(140, 90, 40, 0.14)';
    ctx.fill();

    // стропы
    ctx.beginPath();
    ctx.moveTo(-2, -8); ctx.lineTo(-6, 4);
    ctx.moveTo(4, -9);  ctx.lineTo(-1, 5);
    ctx.moveTo(10, -6); ctx.lineTo(4, 5);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#B78D62';
    ctx.stroke();

    // тело
    let bodyGrad = ctx.createLinearGradient(-5, 0, 4, 10);
    bodyGrad.addColorStop(0, '#F3C98E');
    bodyGrad.addColorStop(1, '#C9975E');

    ctx.beginPath();
    ctx.ellipse(-1, 5, 4, 5.5, 0.12, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
        
    // голова
    let headGrad = ctx.createRadialGradient(-4, 0, 1, -2, 2, 5);
    headGrad.addColorStop(0, '#FFE2B7');
    headGrad.addColorStop(1, '#D9A66C');

    ctx.beginPath();
    ctx.arc(-2.8, 1.8, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.fill();

    // шарф
    ctx.beginPath();
    ctx.moveTo(1, 4);
    ctx.quadraticCurveTo(-10, 5 + scarfSwing * 0.2, -18, 8 + scarfSwing);
    ctx.quadraticCurveTo(-12, 7 + scarfSwing * 0.45, -2, 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#FFF1D6';
    ctx.stroke();

    // глаз
    ctx.beginPath();
    ctx.arc(-4.4, 1.2, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-4.7, 1.1, 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
        ctx.fill();

    // улыбка
    ctx.beginPath();
    ctx.arc(-3.2, 2.4, 1.2, 0.2, Math.PI - 0.2);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#8B5A2B';
    ctx.stroke();

    // ноги
    ctx.beginPath();
    ctx.moveTo(-3, 9);  
    ctx.lineTo(-7, 13 + flap * 0.2);
    ctx.moveTo(1, 9);
    ctx.lineTo(4, 12);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#C79C6B';
    ctx.stroke();

    // свет сверху
    ctx.beginPath();
    ctx.moveTo(12, -5);
    ctx.quadraticCurveTo(2, -12, -5, -8);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.shadowBlur = 0;
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
        
        
        if (!gameRunning) {
            ctx.font = `bold ${Math.round(34*s)}px monospace`;
            ctx.fillStyle = '#FFF3DF';
            ctx.fillText('ПОКИНУЛ НЕБО', LOGICAL_W / 2 - Math.round(150*s), LOGICAL_H / 2 - Math.round(40*s));
            ctx.font = `${Math.round(18*s)}px monospace`;
            ctx.fillStyle = '#FFCF9A';
            ctx.fillText('НАЖМИ ПРОБЕЛ / КЛИК / ТАП → НОВЫЙ ПОЛЁТ', LOGICAL_W / 2 - Math.round(210*s), LOGICAL_H / 2 + Math.round(40*s));
            
            // звезда на месте рекорда
            if (highScorePosition > 0) {
                const starX = highScorePosition - cameraX;
                const starY = highScorePositionY - camY;  // нужна будет отдельная переменная
                
                if (starX > -50 && starX < LOGICAL_W + 50) {
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

        // конец кадра — сбрасываем трансформ для безопасности
        ctx.setTransform(_DPR, 0, 0, _DPR, 0, 0);
    }