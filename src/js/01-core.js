// ── 01-core.js ────────────────────────────────────────────────
// Canvas, DPR, логическое разрешение (LOGICAL_W/H), resizeCanvas().
// Путь к mp3 ветра тоже тут (вычисляется от расположения ЭТОГО файла).
// Зависимостей нет — грузится первым.

    // Вычисляем путь к mp3 ОТНОСИТЕЛЬНО самого game.js, а не от HTML-страницы —
    // так путь будет верным независимо от того, в какой папке лежит index.html
    // и подключает ли он game.js напрямую или через другую вложенность.
    const SCRIPT_SRC  = document.currentScript ? document.currentScript.src : '';
    const SCRIPT_DIR  = SCRIPT_SRC.substring(0, SCRIPT_SRC.lastIndexOf('/') + 1);
    const WIND_MP3_URL = SCRIPT_DIR + '../sound/sound_wind.mp3';

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Динамическое логическое разрешение — подстраивается под экран
    const BASE_W = 1600;
    const BASE_H = 800;

    let LOGICAL_W = BASE_W;
    let LOGICAL_H = BASE_H;
    let UI_SCALE  = 1;

    function resizeCanvas() {
        const DPR = window.devicePixelRatio || 1;

        const viewW = window.innerWidth;
        const viewH = window.innerHeight;

        // Канвас на весь экран, без чёрных полос
        canvas.style.width  = viewW + 'px';
        canvas.style.height = viewH + 'px';

        // Логическое разрешение = реальные CSS-пиксели
        LOGICAL_W = viewW;
        LOGICAL_H = viewH;

        // Буфер под retina
        canvas.width  = Math.round(LOGICAL_W * DPR);
        canvas.height = Math.round(LOGICAL_H * DPR);

        // Рисуем в логических координатах
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.imageSmoothingEnabled = true;

        // UI_SCALE: 1.0 при BASE_W×BASE_H, меньше на маленьких экранах
        UI_SCALE = Math.max(0.38, Math.min(LOGICAL_W / BASE_W, LOGICAL_H / BASE_H));
    }

    let gameRunning = true;
    let score = 0;
    let highScore = 0;

    let highScorePosition = 0; 
    let showFlag = false;        
    let highScorePositionY = 0;
    
