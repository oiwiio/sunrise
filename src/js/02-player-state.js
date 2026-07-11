// Игрок, камера, гравитация/скорости, облака-препятствия (только состояние),
// след от параплана, пороги роста скорости ветра.
// Зависит от: 01-core.js (LOGICAL_W/H).

    // облака - препядствия 
    let clouds = []; 
    const CLOUD_MAX = 6;  
    
    // след от параплана
    let trailPoints = [];   // точки для линии следа
    let lastTrailX = 0;     // для проверки, когда добавлять новую точку
    let lastTrailY = 0;

    //привественный экран
    let showWelcome = true;  // показываем только при первой загрузке
    
    // игрок с полной физикой (двигается и по X, и по Y)
    let player = {
        x: 0, // будет выставлено в resetPlayerPos() после resizeCanvas
        y: 0,
        vx: 5.2,
        vy: 0,
        angle: 0,
        radius: 9
    };

    // Анимация смерти: кувырок вниз перед экраном Game Over ──
    let isDying           = false; // true — персонаж уже неуправляем и падает
    let deathTimer         = 0;     // сколько секунд длится анимация
    let deathSpinDir       = 1;     // направление кувырка (зависит от скорости на момент смерти)
    const DEATH_ANIM_DURATION = 1.1; // сек — как долго крутится/падает перед Game Over

    function resetPlayerPos() {
        player.x = LOGICAL_W * 0.35;
        player.y = LOGICAL_H * 0.55;
    }
    
    let cameraX = 0;  // камера следует за игроком
    let isPressing = false;
    
    const GRAVITY = 0.06;
    const DIVE_FORCE = 0.18;
    const LIFT_FORCE = 0.11;
    const MAX_VY = 3.8;
    let MAX_VX_GROWTH = 8;
    let settingsVolume = 0.5;
    let settingsMaxSpeed = 8;
    const WIND_BOOST = 0.009; // ускорение от ветра

    // Пороги увеличения максимальной скорости ветра
    // { score: очки, speed: новый лимит }
    const WIND_MILESTONES = [
        { score:  5000, speed: 10 },
        { score: 10000, speed: 12 },
        { score: 15000, speed: 14 },
        { score: 20000, speed: 16 },
        { score: 25000, speed: 18 },
        { score: 30000, speed: 20 },
    ];
    let windMilestoneIndex = 0; // следующий не пройденный порог

