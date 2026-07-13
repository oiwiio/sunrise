// Экран приветствия, слайдеры настроек, флажок рекорда.
// Зависит от: 01–05 (использует биомы/облака/горы для фона).

    // приветственный экран — поверх живой игры
    function drawWelcomeScreen() {
        const s   = UI_SCALE;
        const sw  = Math.round(LOGICAL_W * 0.32); // ширина левой панели

        // eased slide offset — панель уезжает влево
        let slideX = 0;
        if (menuSlideOut) {
            let e = menuSlideT * menuSlideT * menuSlideT; // easeInCubic
            slideX = -(sw + 40) * e;
        }

        // затемнение правой части (чтоб самолётик был виден)
        ctx.fillStyle = 'rgba(5, 3, 15, 0.28)';
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

        // левая тёмная панель
        ctx.save();
        ctx.translate(slideX, 0);

        // фон панели — градиент с прозрачностью на правом крае
        let panelGrad = ctx.createLinearGradient(0, 0, sw, 0);
        panelGrad.addColorStop(0,    'rgba(5, 3, 15, 0.94)');
        panelGrad.addColorStop(0.75, 'rgba(8, 5, 20, 0.88)');
        panelGrad.addColorStop(1,    'rgba(5, 3, 15, 0)');
        ctx.fillStyle = panelGrad;
        ctx.fillRect(0, 0, sw, LOGICAL_H);

        // тонкая вертикальная линия — граница панели
        ctx.beginPath();
        ctx.moveTo(sw - 1, 0);
        ctx.lineTo(sw - 1, LOGICAL_H);
        ctx.strokeStyle = 'rgba(255,217,181,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // контент панели
        const tx = Math.round(40 * s);
        const ty = Math.round(LOGICAL_H * 0.22);
        ctx.textAlign = 'left';

        // название
        ctx.font = `bold ${Math.round(52*s)}px "Segoe UI", monospace`;
        ctx.fillStyle = 'rgba(255,249,232,0.07)';
        ctx.fillText('SUNRISE', tx+2, ty+2);
        ctx.shadowBlur = 14;
        ctx.shadowColor = 'rgba(255,180,80,0.28)';
        ctx.fillStyle = '#FFF9E8';
        ctx.fillText('SUNRISE', tx, ty);
        ctx.shadowBlur = 0;

        // подзаголовок
        ctx.font = `${Math.round(12*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,185,100,0.6)';
        ctx.fillText('✦  ИГРА О ЛЁГКОСТИ  ✦', tx, ty + Math.round(28*s));

        // разделитель
        ctx.beginPath();
        ctx.moveTo(tx, ty + Math.round(42*s));
        ctx.lineTo(tx + Math.round(180*s), ty + Math.round(42*s));
        ctx.strokeStyle = 'rgba(255,217,181,0.1)';
        ctx.lineWidth = 1; ctx.stroke();

        // управление
        const gy = ty + Math.round(68*s);
        ctx.font = `${Math.round(11*s)}px monospace`;
        [
            ['▼', 'ЗАЖМИ — ПИКИРУЙ'],
            ['▲', 'ОТПУСТИ — ПАРИ'],
            ['✦', 'ТЕРМИКИ ДАЮТ ЛЁГКОСТЬ'],
            ['☁', 'ОБЛАКА ЗАМЕДЛЯЮТ'],
        ].forEach(([icon, text], i) => {
            let ly = gy + i * Math.round(24*s);
            ctx.fillStyle = 'rgba(255,185,100,0.5)';
            ctx.fillText(icon, tx, ly);
            ctx.fillStyle = 'rgba(255,217,181,0.68)';
            ctx.fillText(text, tx + Math.round(20*s), ly);
        });

        // ONE BUTTON бейдж
        const by = gy + Math.round(110*s);
        ctx.fillStyle = 'rgba(255,185,100,0.07)';
        ctx.beginPath();
        ctx.roundRect(tx - Math.round(5*s), by - Math.round(13*s), Math.round(150*s), Math.round(20*s), Math.round(4*s));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,185,100,0.22)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = `bold ${Math.round(9*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,200,120,0.7)';
        ctx.fillText('⬡  ONE BUTTON GAME', tx, by);

        // рекорд
        if (highScore > 0) {
            ctx.font = `${Math.round(10*s)}px monospace`;
            ctx.fillStyle = 'rgba(201,178,139,0.5)';
            ctx.fillText('РЕКОРД  ' + highScore + '  ✦', tx, by + Math.round(26*s));
        }

        // кнопка — пульсирует внизу панели
        const btnY = LOGICAL_H - Math.round(60*s);
        let bp = 0.85 + Math.sin(frame*0.06)*0.15;
        ctx.font = `${Math.round(10*s)}px monospace`;
        ctx.fillStyle = `rgba(255,200,120,${0.45 + Math.sin(frame*0.06)*0.2})`;
        ctx.fillText('▶  НАЖМИ ЧТОБЫ ЛЕТЕТЬ', tx, btnY);
        ctx.font = `${Math.round(9*s)}px monospace`;
        ctx.fillStyle = 'rgba(255,217,181,0.25)';
        ctx.fillText('ПРОБЕЛ  /  КЛИК  /  ТАП', tx, btnY + Math.round(18*s));

        ctx.restore(); // конец slide transform

        // настройки — тоже уезжают с панелью
        ctx.save();
        ctx.translate(slideX, 0);
        drawSettingsPanel();
        ctx.restore();

        // самолётик на фоне (планирует, не зависит от slide) 
        ctx.save();
        ctx.translate(menuPlaneX, menuPlaneY);
        // угол = небольшой наклон от скорости
        let planeAngle = menuPlaneVY * 0.18;
        ctx.rotate(planeAngle);

        const drift = Math.sin(frame * 0.12) * 0.8;
        ctx.rotate(drift * 0.025);
        ctx.shadowBlur = 18;
        ctx.shadowColor = 'rgba(255,200,100,0.2)';

        // корпус
        let bodyG = ctx.createLinearGradient(-14, 0, 20, 0);
        bodyG.addColorStop(0,    '#F8F0E0');
        bodyG.addColorStop(0.55, '#FFF8F0');
        bodyG.addColorStop(1,    '#FFE8C8');
        ctx.beginPath();
        ctx.moveTo(20, 0); ctx.lineTo(-14, -7); ctx.lineTo(-8, 0); ctx.lineTo(-14, 7);
        ctx.closePath(); ctx.fillStyle = bodyG; ctx.fill();

        // нижняя тень
        let shadG = ctx.createLinearGradient(-14, 0, 20, 0);
        shadG.addColorStop(0, '#D4C4A8'); shadG.addColorStop(1, '#C8A878');
        ctx.beginPath();
        ctx.moveTo(20,0); ctx.lineTo(-8,0); ctx.lineTo(-14,7);
        ctx.closePath(); ctx.fillStyle = shadG; ctx.fill();

        // складка
        ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(-8,0);
        ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(180,155,120,0.7)'; ctx.lineCap = 'round'; ctx.stroke();

        // верхнее крыло
        let wTG = ctx.createLinearGradient(0,-18,0,0);
        wTG.addColorStop(0,'rgba(255,252,245,0.95)'); wTG.addColorStop(1,'rgba(240,225,200,0.85)');
        ctx.beginPath();
        ctx.moveTo(8,0); ctx.lineTo(-2,-18+drift); ctx.lineTo(-10,-4); ctx.lineTo(-8,0);
        ctx.closePath(); ctx.fillStyle = wTG; ctx.fill();
        ctx.strokeStyle = 'rgba(180,155,120,0.4)'; ctx.lineWidth = 0.6; ctx.stroke();

        // нижнее крыло
        let wBG = ctx.createLinearGradient(0,0,0,14);
        wBG.addColorStop(0,'rgba(230,210,185,0.9)'); wBG.addColorStop(1,'rgba(200,175,140,0.7)');
        ctx.beginPath();
        ctx.moveTo(8,0); ctx.lineTo(-2,14-drift); ctx.lineTo(-10,4); ctx.lineTo(-8,0);
        ctx.closePath(); ctx.fillStyle = wBG; ctx.fill();
        ctx.strokeStyle = 'rgba(160,135,100,0.35)'; ctx.lineWidth = 0.6; ctx.stroke();

        // блик
        ctx.beginPath();
        ctx.moveTo(20,0); ctx.lineTo(6,-5); ctx.lineTo(2,-2);
        ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
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