// Система биомов: BIOME_DAY/BIOME_NIGHT, смешивание цветов, день/ночь,
// частицы биома.
// Зависит от: 01-core.js, 02-player-state.js (использует score).

    // 
    //  СИСТЕМА БИОМОВ
    //  Каждый биом — полное визуальное состояние мира.
    //  Переход между биомами плавный через biomTransition (0→1).
    // 

    const BIOMES = [
        {
            id: 'dawn',
            name: 'РАССВЕТ',
            scoreStart: 0,
            sky: [
                [0,    '#FF7A45'],
                [0.35, '#C2547A'],
                [0.65, '#784BA0'],
                [1,    '#2B1F3D'],
            ],
            sun: { color0: '#fffef0', color1: '#ffe6b0', color2: '#ffbc60', color3: '#ff9028', glow: 'rgba(255,220,150,0.08)', rays: 'rgba(255,220,150,0.12)' },
            farMtn:  '#3E2C49',
            nearMtn: '#1D142B',
            nearMtnTop: '#2E1E3F',
            snowCap: 'rgba(255,245,235,0.55)',
            cloudTop: 'rgba(255,255,255,0.92)',
            cloudBot: 'rgba(230,235,245,0.72)',
            cloudHL:  'rgba(255,220,170,0.28)',
            thermalColor: 'rgba(255,215,150,1)',
            trailColor:   'rgba(255,255,240,1)',
            windColor:    'rgba(255,255,210,1)',
            fogColor:     'rgba(255,160,100,0.10)',
            particles: 'sparks',
        },
        {
            id: 'day',
            name: 'ДЕНЬ',
            scoreStart: 6000,
            sky: [
                [0,    '#5BA8FF'],
                [0.4,  '#3A7BD5'],
                [0.75, '#1A4FA0'],
                [1,    '#0D2B6B'],
            ],
            sun: { color0: '#ffffff', color1: '#fff4c2', color2: '#ffe680', color3: '#ffd230', glow: 'rgba(255,255,200,0.10)', rays: 'rgba(255,255,180,0.14)' },
            farMtn:  '#2A4A7A',
            nearMtn: '#172B50',
            nearMtnTop: '#1E3A6A',
            snowCap: 'rgba(255,255,255,0.75)',
            cloudTop: 'rgba(255,255,255,0.95)',
            cloudBot: 'rgba(220,235,255,0.80)',
            cloudHL:  'rgba(255,255,255,0.40)',
            thermalColor: 'rgba(180,220,255,1)',
            trailColor:   'rgba(255,255,255,1)',
            windColor:    'rgba(200,230,255,1)',
            fogColor:     'rgba(100,160,255,0.07)',
            particles: 'birds',
        },
        {
            id: 'sunset',
            name: 'ЗАКАТ',
            scoreStart: 12000,
            sky: [
                [0,    '#FF4500'],
                [0.3,  '#FF7C2A'],
                [0.6,  '#C0392B'],
                [1,    '#1a0a1e'],
            ],
            sun: { color0: '#fff0c0', color1: '#ffcc60', color2: '#ff8c00', color3: '#cc3300', glow: 'rgba(255,140,0,0.12)', rays: 'rgba(255,160,50,0.15)' },
            farMtn:  '#5C1A2A',
            nearMtn: '#2A0A15',
            nearMtnTop: '#3E1220',
            snowCap: 'rgba(255,200,150,0.50)',
            cloudTop: 'rgba(255,220,180,0.90)',
            cloudBot: 'rgba(200,120,80,0.70)',
            cloudHL:  'rgba(255,160,60,0.45)',
            thermalColor: 'rgba(255,140,50,1)',
            trailColor:   'rgba(255,200,150,1)',
            windColor:    'rgba(255,180,100,1)',
            fogColor:     'rgba(200,80,30,0.13)',
            particles: 'embers',
        },
        {
            id: 'dusk',
            name: 'СУМЕРКИ',
            scoreStart: 18000,
            sky: [
                [0,    '#1A0533'],
                [0.35, '#2D0F4A'],
                [0.65, '#0F0820'],
                [1,    '#050210'],
            ],
            sun: { color0: '#ffaacc', color1: '#cc88ff', color2: '#8844cc', color3: '#440088', glow: 'rgba(180,100,255,0.10)', rays: 'rgba(200,120,255,0.12)' },
            farMtn:  '#1A0A2E',
            nearMtn: '#0A0518',
            nearMtnTop: '#180A28',
            snowCap: 'rgba(200,180,255,0.45)',
            cloudTop: 'rgba(180,160,220,0.80)',
            cloudBot: 'rgba(100,80,150,0.65)',
            cloudHL:  'rgba(200,150,255,0.35)',
            thermalColor: 'rgba(180,100,255,1)',
            trailColor:   'rgba(200,180,255,1)',
            windColor:    'rgba(180,150,255,1)',
            fogColor:     'rgba(100,50,200,0.11)',
            particles: 'stars',
        },
        {
            id: 'storm',
            name: 'БУРЯ',
            scoreStart: 24000,
            sky: [
                [0,    '#1A1A2E'],
                [0.3,  '#16213E'],
                [0.6,  '#0F0F23'],
                [1,    '#050508'],
            ],
            sun: { color0: '#c0d8ff', color1: '#8ab0e0', color2: '#4060a0', color3: '#1a3060', glow: 'rgba(100,150,255,0.06)', rays: 'rgba(120,160,255,0.08)' },
            farMtn:  '#12182A',
            nearMtn: '#080C18',
            nearMtnTop: '#101828',
            snowCap: 'rgba(180,200,255,0.35)',
            cloudTop: 'rgba(100,120,160,0.85)',
            cloudBot: 'rgba(40,50,80,0.75)',
            cloudHL:  'rgba(150,180,255,0.20)',
            thermalColor: 'rgba(100,160,255,1)',
            trailColor:   'rgba(150,200,255,1)',
            windColor:    'rgba(100,150,255,1)',
            fogColor:     'rgba(30,50,120,0.17)',
            particles: 'lightning',
        },
    ];

    let biomIndex      = 0;
    let biomTransition = 1; // 1 = полностью в текущем биоме
    let biomNoticeTimer = 0;
    let biomNoticeName  = '';
    let biomParticles   = [];

    function lerp(a, b, t) { return a + (b - a) * t; }

    function parseColor(c) {
        c = c.trim();
        if (c[0] === '#') {
            return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16), 1];
        }
        let m = c.match(/[\d.]+/g).map(Number);
        return [m[0], m[1], m[2], m[3] !== undefined ? m[3] : 1];
    }

    function lerpColor(c1, c2, t) {
        let a = parseColor(c1), b = parseColor(c2);
        let r  = Math.round(lerp(a[0],b[0],t));
        let g  = Math.round(lerp(a[1],b[1],t));
        let bl = Math.round(lerp(a[2],b[2],t));
        let al = lerp(a[3],b[3],t);
        return `rgba(${r},${g},${bl},${al.toFixed(3)})`;
    }

    const BIOME_DAY = {
        id: 'day', name: 'ДЕНЬ',
        sky: [[0,'#FF7A45'],[0.3,'#C2547A'],[0.65,'#784BA0'],[1,'#2B1F3D']],
        sun: { color0:'#fffef0', color1:'#ffe6b0', color2:'#ffbc60', color3:'#ff9028',
               glow:'rgba(255,220,150,0.08)', rays:'rgba(255,220,150,0.12)' },
        farMtn:'#3E2C49', nearMtn:'#1D142B', nearMtnTop:'#2E1E3F',
        snowCap:'rgba(255,245,235,0.55)',
        cloudTop:'rgba(255,255,255,0.92)', cloudBot:'rgba(230,235,245,0.72)', cloudHL:'rgba(255,220,170,0.28)',
        thermalColor:'rgba(255,215,150,1)', trailColor:'rgba(255,255,240,1)', windColor:'rgba(255,255,210,1)',
        fogColor:'rgba(255,140,80,0.10)', particles:'sparks',
    };

    const BIOME_NIGHT = {
        id: 'night', name: 'НОЧЬ',
        sky: [[0,'#0A0818'],[0.3,'#0D0D2B'],[0.65,'#060612'],[1,'#020208']],
        sun: { color0:'#e8f0ff', color1:'#b0c8f0', color2:'#6080c0', color3:'#203060',
               glow:'rgba(120,160,255,0.06)', rays:'rgba(140,180,255,0.08)' },
        farMtn:'#0E0A1E', nearMtn:'#060410', nearMtnTop:'#100818',
        snowCap:'rgba(200,210,255,0.40)',
        cloudTop:'rgba(80,90,130,0.75)', cloudBot:'rgba(30,35,60,0.65)', cloudHL:'rgba(120,140,220,0.20)',
        thermalColor:'rgba(120,160,255,1)', trailColor:'rgba(180,200,255,1)', windColor:'rgba(100,140,220,1)',
        fogColor:'rgba(20,30,80,0.14)', particles:'stars',
    };

    const CYCLE = 5000;
    const FADE  = 500;

    function getDayNightT() {
        let phase = score % CYCLE;
        if (phase < CYCLE - FADE) return 0;
        return (phase - (CYCLE - FADE)) / FADE;
    }
    function getCycleDir() { return Math.floor(score / CYCLE) % 2; }
    function getCurBiom()  { return getCycleDir() === 0 ? BIOME_DAY : BIOME_NIGHT; }
    function getNextBiom() { return getCycleDir() === 0 ? BIOME_NIGHT : BIOME_DAY; }
    function biomT()       { return Math.max(0, Math.min(1, getDayNightT())); }

    // Конвертирует любой цвет (hex или rgba) в rgba-строку
    function toRgba(c, overrideAlpha) {
        let p = parseColor(c);
        let a = overrideAlpha !== undefined ? overrideAlpha : p[3];
        return `rgba(${p[0]},${p[1]},${p[2]},${a.toFixed(3)})`;
    }
    // Возвращает rgba-строку биом-цвета с заменённой прозрачностью
    function biomColorA(key, alpha) {
        return toRgba(biomColor(key), alpha);
    }
    function biomSunPropA(key, alpha) {
        return toRgba(biomSunProp(key), alpha);
    }

    function biomColor(key) {
        let t = biomT();
        let cur = getCurBiom()[key], nxt = getNextBiom()[key];
        if (t <= 0 || cur === nxt) return cur;
        return lerpColor(cur, nxt, t);
    }

    function biomSkyStops() {
        let t = biomT();
        let cur = getCurBiom().sky, nxt = getNextBiom().sky;
        if (t <= 0) return cur;
        return cur.map((s, i) => [s[0], lerpColor(s[1], (nxt[i]||s)[1], t)]);
    }

    function biomSunProp(key) {
        let t = biomT();
        let cur = getCurBiom().sun[key], nxt = getNextBiom().sun[key];
        if (t <= 0) return cur;
        return lerpColor(cur, nxt, t);
    }

    function updateBiom() {
        let phase = score % CYCLE;
        let dir   = getCycleDir();
        if (phase >= CYCLE - FADE && phase < CYCLE - FADE + 80) {
            let newName = (dir === 0) ? BIOME_NIGHT.name : BIOME_DAY.name;
            if (biomNoticeName !== newName) {
                biomNoticeName  = newName;
                biomNoticeTimer = 220;
            }
        }
        updateBiomParticles();
    }

    function spawnBiomParticle() {
        const type = getCurBiom().particles;
        if (type === 'sparks') {
            biomParticles.push({ type:'spark', x: LOGICAL_W+Math.random()*200, y: Math.random()*LOGICAL_H*0.7,
                vx:-(1.5+Math.random()*3), vy:(Math.random()-0.5)*0.8,
                life:1, decay:0.005+Math.random()*0.006,
                size:1+Math.random()*2.5, hue:30+Math.random()*30 });
        } else if (type === 'birds') {
            biomParticles.push({ type:'bird', x: LOGICAL_W+Math.random()*300, y: 60+Math.random()*LOGICAL_H*0.45,
                vx:-(1.2+Math.random()*2), vy:(Math.random()-0.5)*0.4,
                life:1, decay:0.003+Math.random()*0.003,
                size:3+Math.random()*3, flap:Math.random()*Math.PI*2 });
        } else if (type === 'embers') {
            biomParticles.push({ type:'ember', x: LOGICAL_W+Math.random()*150, y: LOGICAL_H*0.3+Math.random()*LOGICAL_H*0.5,
                vx:-(0.8+Math.random()*2), vy:-(0.5+Math.random()*1.5),
                life:1, decay:0.007+Math.random()*0.008,
                size:1.5+Math.random()*3, wobble:Math.random()*Math.PI*2 });
        } else if (type === 'stars' && biomParticles.length < 60) {
            biomParticles.push({ type:'star', x: Math.random()*LOGICAL_W, y: Math.random()*LOGICAL_H*0.6,
                vx:0, vy:0, life:Math.random(), decay:0,
                size:0.8+Math.random()*2, twinkle:Math.random()*Math.PI*2 });
        } else if (type === 'lightning' && Math.random() < 0.003) {
            biomParticles.push({ type:'lightning', x: Math.random()*LOGICAL_W, y:0,
                vx:0, vy:0, life:1, decay:0.14, size:2,
                segs: Array.from({length:8}, (_,i) => ({ dx:(Math.random()-0.5)*45, dy:LOGICAL_H*0.12 })) });
        }
    }

    function updateBiomParticles() {
        const type = getCurBiom().particles;
        if (type==='sparks'  && Math.random()<0.22) spawnBiomParticle();
        if (type==='birds'   && Math.random()<0.04) spawnBiomParticle();
        if (type==='embers'  && Math.random()<0.18) spawnBiomParticle();
        if (type==='stars')  spawnBiomParticle();
        if (type==='lightning') spawnBiomParticle();

        for (let i = biomParticles.length-1; i >= 0; i--) {
            let p = biomParticles[i];
            if (p.type === 'star') {
                p.twinkle += 0.04;
                p.life = 0.3 + Math.sin(p.twinkle)*0.3;
                if (type !== 'stars') { biomParticles.splice(i,1); continue; }
            } else {
                p.x += p.vx; p.y += p.vy;
                if (p.type==='ember')  { p.vy -= 0.018; p.wobble += 0.08; p.x += Math.sin(p.wobble)*0.5; }
                if (p.type==='bird')   { p.flap += 0.18; }
                p.life -= p.decay;
            }
            if (p.life <= 0 || p.x < -100) biomParticles.splice(i,1);
        }
    }

    function drawBiomParticles(camY) {
        for (let p of biomParticles) {
            const al = Math.max(0, p.life);
            ctx.save();
            ctx.globalAlpha = al;
            if (p.type === 'spark') {
                let col = `hsl(${p.hue},100%,${70+p.life*20}%)`;
                ctx.fillStyle = col; ctx.shadowBlur = 7; ctx.shadowColor = col;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'bird') {
                ctx.strokeStyle = `rgba(120,170,230,${al*0.75})`; ctx.lineWidth = 1.3;
                let flap = Math.sin(p.flap)*p.size*0.9;
                ctx.beginPath();
                ctx.moveTo(p.x - p.size, p.y - flap);
                ctx.quadraticCurveTo(p.x, p.y - p.size*0.4, p.x + p.size, p.y - flap);
                ctx.stroke();
            } else if (p.type === 'ember') {
                ctx.fillStyle = `hsl(${15+Math.random()*20},100%,${50+al*30}%)`;
                ctx.shadowBlur = 9; ctx.shadowColor = '#ff6600';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size*al, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'star') {
                ctx.fillStyle = '#fff'; ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(200,200,255,0.8)';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'lightning') {
                ctx.strokeStyle = `rgba(180,210,255,${al})`; ctx.lineWidth = 1.5;
                ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(150,200,255,0.9)';
                ctx.beginPath();
                let lx = p.x, ly = 0; ctx.moveTo(lx, ly);
                for (let seg of p.segs) { lx += seg.dx; ly += seg.dy; ctx.lineTo(lx, ly); }
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    function drawBiomNotice() {
        if (biomNoticeTimer <= 0) return;
        biomNoticeTimer--;
        const fadeIn  = Math.min(1, (260 - biomNoticeTimer) / 30);
        const fadeOut = Math.min(1, biomNoticeTimer / 50);
        const alpha   = Math.min(fadeIn, fadeOut);
        const s = UI_SCALE;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.round(22*s)}px monospace`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(255,200,100,0.7)';
        ctx.fillText(`— ${biomNoticeName} —`, LOGICAL_W/2, LOGICAL_H/2 - Math.round(110*s));
        ctx.textAlign = 'left';
        ctx.restore();
    }

    
    let mountainSegments = [];
    const segmentWidth = 210;
    
    let thermals = [];
    let downdrafts = [];

    const THERMAL_GEN_BASE   = 85;
    const THERMAL_MAX_BASE   = 7;
    const DOWNDRAFT_GEN_BASE = 110;
    const DOWNDRAFT_MAX_BASE = 4;

    let THERMAL_GEN_RATE   = THERMAL_GEN_BASE;
    let THERMAL_MAX        = THERMAL_MAX_BASE;
    let DOWNDRAFT_GEN_RATE = DOWNDRAFT_GEN_BASE;
    let DOWNDRAFT_MAX      = DOWNDRAFT_MAX_BASE;
    let diffLevel          = 0;
    let diffNoticeTimer    = 0;
    let diffNoticeLevel    = 0;
    
    let windParticles = [];
    let sparkParticles = [];
    let frame = 0;
    const FRAME_TIME = 1000 / 60;
    let lastUpdate = 0;


