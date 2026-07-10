// ── 07-ui-screens.js ─────────────────────────────────────────
// Экран приветствия, слайдеры настроек, флажок рекорда.
// Зависит от: 01–05 (использует биомы/облака/горы для фона).

    // привественный экран
    function drawWelcomeScreen() {
        const s = UI_SCALE;
        const cx = LOGICAL_W / 2;

        // фон
        let bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
        bg.addColorStop(0,   '#1a0f2e');
        bg.addColorStop(0.4, '#2B1F3D');
        bg.addColorStop(1,   '#0a0c14');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

        // горы (используем реальные сегменты) ──
        ctx.fillStyle = '#3E2C49';
        for (let seg of mountainSegments) {
            let sx = (seg.x - frame * 0.4) % (segmentWidth * mountainSegments.length);
            if (sx + segmentWidth < -100 || sx > LOGICAL_W + 100) continue;
            ctx.beginPath();
            ctx.moveTo(sx, LOGICAL_H);
            ctx.lineTo(sx, seg.y - 20);
            ctx.quadraticCurveTo(sx+segmentWidth*.18,seg.y-44,sx+segmentWidth*.3,seg.y-38);
            ctx.quadraticCurveTo(sx+segmentWidth*.45,seg.y-18,sx+segmentWidth*.55,seg.y-28);
            ctx.quadraticCurveTo(sx+segmentWidth*.72,seg.y-36,sx+segmentWidth*.8,seg.y-18);
            ctx.quadraticCurveTo(sx+segmentWidth*.92,seg.y-10,sx+segmentWidth,seg.y-14);
            ctx.lineTo(sx + segmentWidth, LOGICAL_H);
            ctx.fill();
        }
        ctx.fillStyle = '#1D142B';
        for (let seg of mountainSegments) {
            let sx = (seg.x - frame * 0.9) % (segmentWidth * mountainSegments.length);
            if (sx + segmentWidth < -100 || sx > LOGICAL_W + 100) continue;
            ctx.beginPath();
            ctx.moveTo(sx, LOGICAL_H);
            ctx.lineTo(sx, seg.y);
            ctx.quadraticCurveTo(sx+segmentWidth*.15,seg.y-20,sx+segmentWidth*.25,seg.y-14);
            ctx.quadraticCurveTo(sx+segmentWidth*.38,seg.y-34,sx+segmentWidth*.45,seg.y-24);
            ctx.quadraticCurveTo(sx+segmentWidth*.58,seg.y-10,sx+segmentWidth*.65,seg.y-18);
            ctx.quadraticCurveTo(sx+segmentWidth*.82,seg.y-20,sx+segmentWidth,seg.y-6);
            ctx.lineTo(sx + segmentWidth, LOGICAL_H);
            ctx.fill();
        }

        // солнце (полноценное, как в игре) ──
        let sunX = LOGICAL_W - 120, sunY = 110;
        let pulse = 0.95 + Math.sin(frame * 0.03) * 0.05;
        let atm = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 180);
        atm.addColorStop(0, 'rgba(255,220,150,0.1)');
        atm.addColorStop(1, 'rgba(255,120,50,0)');
        ctx.fillStyle = atm;
        ctx.beginPath(); ctx.arc(sunX, sunY, 180, 0, Math.PI*2); ctx.fill();

        for (let [count, rSpeed, minR, len, spread, color] of [
            [10,  0.008, 30, 95, 5,   'rgba(255,220,150,0.1)'],
            [6,  -0.005, 22, 65, 3,   'rgba(255,245,200,0.12)'],
            [14,  0.022, 28, 42, 1.5, 'rgba(255,255,220,0.18)'],
        ]) {
            ctx.save(); ctx.translate(sunX, sunY); ctx.rotate(frame * rSpeed);
            for (let i = 0; i < count; i++) {
                ctx.save(); ctx.rotate((i/count)*Math.PI*2);
                let l = len + Math.sin(frame*0.05+i)*8;
                ctx.beginPath(); ctx.moveTo(minR,0); ctx.lineTo(l,-spread); ctx.lineTo(l,spread);
                ctx.fillStyle = color; ctx.fill(); ctx.restore();
            }
            ctx.restore();
        }
        let outer = ctx.createRadialGradient(sunX,sunY,10,sunX,sunY,85);
        outer.addColorStop(0,'rgba(255,235,180,0.35)'); outer.addColorStop(1,'rgba(255,140,80,0)');
        ctx.fillStyle = outer; ctx.beginPath(); ctx.arc(sunX,sunY,85*pulse,0,Math.PI*2); ctx.fill();
        let core = ctx.createRadialGradient(sunX-5,sunY-5,0,sunX,sunY,38);
        core.addColorStop(0,'#fffef0'); core.addColorStop(0.25,'#ffe6b0');
        core.addColorStop(0.7,'#ffbc60'); core.addColorStop(1,'#ff9028');
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(sunX,sunY,34*pulse,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(sunX,sunY,7,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,240,0.85)'; ctx.fill();

        // частицы 
        for (let i = 0; i < 16; i++) {
            let px2 = (frame*0.15 + i*71) % (LOGICAL_W+100) - 50;
            let py2 = 40 + Math.sin(frame*0.018 + i*0.7)*35;
            ctx.fillStyle = `rgba(255,215,150,${0.12+Math.sin(frame*0.04+i)*0.07})`;
            ctx.beginPath(); ctx.arc(px2, py2, 1.5+Math.sin(frame*0.06+i)*0.8, 0, Math.PI*2); ctx.fill();
        }

        // ЛЕВАЯ ЧАСТЬ
        ctx.save();
        ctx.textAlign = 'left';
        let tx = Math.round(60*s);
        let ty = Math.round(LOGICAL_H/2 - 90*s);

        // название
        ctx.font = `bold ${Math.round(64*s)}px "Segoe UI", monospace`;
        ctx.fillStyle = 'rgba(255,249,232,0.06)';
        ctx.fillText('SUNRISE', tx+2, ty+3);
        ctx.shadowBlur = 16; ctx.shadowColor = 'rgba(255,180,80,0.3)';
        ctx.fillStyle = '#FFF9E8';
        ctx.fillText('SUNRISE', tx, ty);
        ctx.shadowBlur = 0;

        // подзаголовок
        ctx.font = `${Math.round(13*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,185,100,0.65)';
        ctx.fillText('✦  ИГРА О ЛЁГКОСТИ  ✦', tx, ty + Math.round(32*s));

        // разделитель
        ctx.beginPath();
        ctx.moveTo(tx, ty + Math.round(46*s));
        ctx.lineTo(tx + Math.round(230*s), ty + Math.round(46*s));
        ctx.strokeStyle = 'rgba(255,217,181,0.12)'; ctx.lineWidth = 1; ctx.stroke();

        // управление
        let gy = ty + Math.round(76*s);
        ctx.font = `${Math.round(12*s)}px monospace`;
        [
            ['▼', 'ЗАЖМИ — ПИКИРУЙ'],
            ['▲', 'ОТПУСТИ — ПАРИ'],
            ['✦', 'ТЕРМИКИ ДАЮТ ЛЁГКОСТЬ'],
            ['☁', 'ОБЛАКА ЗАМЕДЛЯЮТ'],
        ].forEach(([icon, text], i) => {
            let ly = gy + i * Math.round(26*s);
            ctx.fillStyle = 'rgba(255,185,100,0.55)';
            ctx.fillText(icon, tx, ly);
            ctx.fillStyle = 'rgba(255,217,181,0.72)';
            ctx.fillText(text, tx + Math.round(22*s), ly);
        });

        // ONE BUTTON бейдж
        let by = gy + Math.round(118*s);
        ctx.fillStyle = 'rgba(255,185,100,0.08)';
        ctx.beginPath();
        ctx.roundRect(tx - Math.round(6*s), by - Math.round(14*s), Math.round(162*s), Math.round(22*s), Math.round(4*s));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,185,100,0.25)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = `bold ${Math.round(10*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,200,120,0.75)';
        ctx.fillText('⬡  ONE BUTTON GAME', tx, by);

        // рекорд
        if (highScore > 0) {
            ctx.font = `${Math.round(11*s)}px monospace`;
            ctx.fillStyle = 'rgba(201,178,139,0.55)';
            ctx.fillText('РЕКОРД  ' + highScore + '  ✦', tx, by + Math.round(28*s));
        }

        ctx.restore();

        // ── КНОПКА СТАРТА ──
        let btnX = cx, btnY = LOGICAL_H - Math.round(68*s);
        let bp = 0.85 + Math.sin(frame*0.06)*0.15;
        let btnR = Math.round(28*s) * bp;

        ctx.beginPath(); ctx.arc(btnX, btnY, btnR + Math.round(14*s), 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,185,100,${0.05*bp})`; ctx.fill();

        ctx.beginPath(); ctx.arc(btnX, btnY, btnR, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(255,200,130,${0.45+Math.sin(frame*0.06)*0.2})`;
        ctx.lineWidth = Math.round(1.5*s); ctx.stroke();

        ctx.beginPath(); ctx.arc(btnX, btnY, btnR - Math.round(3*s), 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,185,80,${0.1*bp})`; ctx.fill();

        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(9*s)}px monospace`;
        ctx.fillStyle = `rgba(255,230,180,${0.65+Math.sin(frame*0.06)*0.3})`;
        ctx.fillText('НАЖМИ', btnX, btnY + Math.round(3*s));
        ctx.font = `${Math.round(10*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.28)';
        ctx.fillText('ПРОБЕЛ  /  КЛИК  /  ТАП', btnX, btnY + Math.round(46*s));
        ctx.restore();

        // настройки
        drawSettingsPanel();
    }

    function drawSlider(x, y, w, t, s) {
        s = s || 1;
        const h = Math.round(6*s);
        const r = Math.round(3*s);
        const knob = Math.round(9*s);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fillStyle = 'rgba(255,217,181,0.14)';
        ctx.fill();
        if (t > 0) {
            ctx.beginPath();
            ctx.roundRect(x, y, w * t, h, r);
            ctx.fillStyle = 'rgba(255,185,100,0.75)';
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x + w * t, y + h/2, knob, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD6A5';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function drawSettingsPanel() {
        const s = UI_SCALE;
        let pw = Math.round(210 * s);
        let px = LOGICAL_W - Math.round(248 * s);
        let py = LOGICAL_H / 2 - Math.round(60 * s);

        // подложка
        ctx.fillStyle = 'rgba(10, 12, 20, 0.6)';
        ctx.beginPath();
        ctx.roundRect(px - Math.round(16*s), py - Math.round(32*s), pw + Math.round(32*s), Math.round(190*s), Math.round(14*s));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 217, 181, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold ${Math.round(11*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.45)';
        ctx.fillText('⚙  НАСТРОЙКИ', px, py - Math.round(12*s));

        ctx.font = `${Math.round(12*s)}px monospace`;
        ctx.fillStyle = '#ffd9b5';
        ctx.fillText('ЗВУК', px, py + Math.round(14*s));
        ctx.font = `${Math.round(11*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.5)';
        ctx.fillText(Math.round(settingsVolume * 100) + '%', px + pw - Math.round(28*s), py + Math.round(14*s));
        drawSlider(px, py + Math.round(22*s), pw, settingsVolume, s);

        ctx.font = `${Math.round(12*s)}px monospace`;
        ctx.fillStyle = '#ffd9b5';
        ctx.fillText('МАКС. СКОРОСТЬ', px, py + Math.round(80*s));
        ctx.font = `${Math.round(11*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.5)';
        ctx.fillText('' + settingsMaxSpeed, px + pw - Math.round(18*s), py + Math.round(80*s));
        let speedT = (settingsMaxSpeed - 8) / 12;
        drawSlider(px, py + Math.round(88*s), pw, speedT, s);

        ctx.font = `${Math.round(10*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.3)';
        ctx.fillText('8', px, py + Math.round(118*s));
        ctx.fillText('20', px + pw - Math.round(14*s), py + Math.round(118*s));
    }

    // флажек рекорда
    function drawRecordFlag(currentX, camY) {
        if (!showFlag) return;
        
        // флаг появляется только если игрок ещё не прошел это место
        if (player.x < highScorePosition - 50) return;
        
        const screenX = highScorePosition - cameraX;
        
        // Не рисуем, если флаг далеко за пределами экрана
        if (screenX < -50 || screenX > LOGICAL_W + 50) return;
        
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
    
