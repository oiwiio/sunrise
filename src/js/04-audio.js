// ── 04-audio.js ──────────────────────────────────────────────
// Всё про звук: Web Audio API, ветер (mp3), амбиент-слои по биомам,
// звуки термика/облака/смерти.
// Зависит от: 01-core.js (WIND_MP3_URL), 03-biomes.js (BIOM_AMBIENT, biomColorA).

    //звук
    let audioCtx  = null;
    let audioReady = false;

    //Ветер
    let windGain        = null;  // итоговая громкость ветра
    let windFilter1     = null;  // lowpass — "мягкость" (основной)
    let windFilter2     = null;  // bandpass — "свист" (тихий слой)
    let windNode        = null;

    // Амбиент-слои (по биомам)
    // Каждый слой: осциллятор + gain.  Активен только один набор за раз.
    let ambLayers       = [];    // [{osc, gain, lfo, lfoGain}, ...]
    let ambMasterGain   = null;
    let ambCurrentBiom  = -1;   // id биома для которого запущен амбиент

    //Звук ветра из mp3-файла (вместо синтезированного розового шума)
    let windAudioEl    = null;  // <audio> элемент, играет sound_wind.mp3 в цикле
    let windSourceNode = null;  // MediaElementSource, чтобы пропустить mp3 через фильтры/gain ниже

    function initAudio() {
        if (audioReady) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // Ветер: mp3-файл → lowpass (мягко) → bandpass (тихий свист) → gain ──
            windAudioEl = new Audio(WIND_MP3_URL);
            windAudioEl.loop = true;
            windAudioEl.addEventListener('error', () => {
                console.error('Не удалось загрузить звук ветра по пути:', WIND_MP3_URL);
            });
            windSourceNode = audioCtx.createMediaElementSource(windAudioEl);

            // Мягкий lowpass — срезает всё резкое выше 900 Гц
            windFilter1 = audioCtx.createBiquadFilter();
            windFilter1.type      = 'lowpass';
            windFilter1.frequency.value = 420;   // начинаем очень мягко
            windFilter1.Q.value   = 0.5;

            // Тихий bandpass — лёгкий намёк на "свист" воздуха
            windFilter2 = audioCtx.createBiquadFilter();
            windFilter2.type      = 'bandpass';
            windFilter2.frequency.value = 520;
            windFilter2.Q.value   = 1.2;

            // Второй gain для bandpass-слоя (очень тихо)
            const windBpGain = audioCtx.createGain();
            windBpGain.gain.value = 0.18;

            windGain = audioCtx.createGain();
            windGain.gain.value = 0;

            // mp3 → lowpass → windGain  (основной тракт)
            windSourceNode.connect(windFilter1);
            windFilter1.connect(windGain);

            // mp3 → bandpass → windBpGain → windGain  (свист поверх)
            windSourceNode.connect(windFilter2);
            windFilter2.connect(windBpGain);
            windBpGain.connect(windGain);

            windGain.connect(audioCtx.destination);
            windAudioEl.play().catch(e => console.warn('Wind mp3 play failed:', e));

            // Амбиент: мастер-гейн ──
            ambMasterGain = audioCtx.createGain();
            ambMasterGain.gain.value = 0;
            ambMasterGain.connect(audioCtx.destination);

            audioReady = true;
        } catch(e) { console.warn('Audio init failed:', e); }
    }

    // Параметры амбиент-слоёв для каждого биома
    // layers: [{type, freq, detune, gainVal, lfoRate, lfoDepth}]
    const BIOM_AMBIENT = {
        dawn: {
            masterGain: 0.09,
            layers: [
                { type:'sine',     freq: 110,  gainVal: 0.5,  lfoRate: 0.12, lfoDepth: 4   }, // низкий фон
                { type:'sine',     freq: 220,  gainVal: 0.20, lfoRate: 0.07, lfoDepth: 6   }, // тёплая гармоника
                { type:'triangle', freq: 330,  gainVal: 0.10, lfoRate: 0.19, lfoDepth: 3   }, // мягкий обертон
            ]
        },
        day: {
            masterGain: 0.07,
            layers: [
                { type:'sine',     freq: 130,  gainVal: 0.4,  lfoRate: 0.09, lfoDepth: 5   },
                { type:'sine',     freq: 260,  gainVal: 0.18, lfoRate: 0.14, lfoDepth: 8   },
                { type:'triangle', freq: 390,  gainVal: 0.08, lfoRate: 0.22, lfoDepth: 4   },
                { type:'sine',     freq: 520,  gainVal: 0.05, lfoRate: 0.31, lfoDepth: 10  }, // яркий воздушный слой
            ]
        },
        sunset: {
            masterGain: 0.11,
            layers: [
                { type:'sine',     freq: 98,   gainVal: 0.55, lfoRate: 0.08, lfoDepth: 3   },
                { type:'sine',     freq: 196,  gainVal: 0.22, lfoRate: 0.05, lfoDepth: 5   },
                { type:'sawtooth', freq: 147,  gainVal: 0.06, lfoRate: 0.17, lfoDepth: 6   }, // тёплый "тягучий" тон
                { type:'sine',     freq: 294,  gainVal: 0.08, lfoRate: 0.11, lfoDepth: 4   },
            ]
        },
        dusk: {
            masterGain: 0.13,
            layers: [
                { type:'sine',     freq: 82,   gainVal: 0.6,  lfoRate: 0.06, lfoDepth: 2   }, // глубокий бас
                { type:'sine',     freq: 164,  gainVal: 0.25, lfoRate: 0.04, lfoDepth: 4   },
                { type:'triangle', freq: 246,  gainVal: 0.12, lfoRate: 0.09, lfoDepth: 5   },
                { type:'sine',     freq: 328,  gainVal: 0.07, lfoRate: 0.15, lfoDepth: 8   }, // мерцающий верх
            ]
        },
        storm: {
            masterGain: 0.16,
            layers: [
                { type:'sawtooth', freq: 55,   gainVal: 0.55, lfoRate: 0.18, lfoDepth: 8   }, // тяжёлый гул
                { type:'sawtooth', freq: 110,  gainVal: 0.30, lfoRate: 0.23, lfoDepth: 12  },
                { type:'square',   freq: 82,   gainVal: 0.12, lfoRate: 0.35, lfoDepth: 6   }, // резкое напряжение
                { type:'sine',     freq: 165,  gainVal: 0.10, lfoRate: 0.27, lfoDepth: 10  },
                { type:'sawtooth', freq: 220,  gainVal: 0.06, lfoRate: 0.40, lfoDepth: 15  }, // хаотичный верх
            ]
        },
    };

    function stopAmbLayers() {
        const t = audioCtx.currentTime;
        for (let L of ambLayers) {
            try {
                L.gain.gain.setTargetAtTime(0, t, 0.8);
                L.osc.stop(t + 4);
            } catch(e) {}
        }
        ambLayers = [];
    }

    function startAmbLayers(biomId) {
        if (!audioReady) return;
        stopAmbLayers();
        const def = BIOM_AMBIENT[biomId];
        if (!def) return;

        const t = audioCtx.currentTime;
        ambMasterGain.gain.setTargetAtTime(def.masterGain * settingsVolume, t, 2.5);

        for (let L of def.layers) {
            const osc     = audioCtx.createOscillator();
            const gain    = audioCtx.createGain();
            const lfo     = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();

            osc.type             = L.type;
            osc.frequency.value  = L.freq;
            gain.gain.value      = 0;

            // LFO — медленное вибрато частоты для "живости"
            lfo.type             = 'sine';
            lfo.frequency.value  = L.lfoRate;
            lfoGain.gain.value   = L.lfoDepth;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // Мягкий lowpass на каждом слое — убирает синтетический привкус
            const lp = audioCtx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 800;
            lp.Q.value = 0.4;

            osc.connect(lp);
            lp.connect(gain);
            gain.connect(ambMasterGain);

            osc.start(t);
            lfo.start(t);
            // плавный фейд-ин
            gain.gain.setTargetAtTime(L.gainVal, t, 1.8);

            ambLayers.push({ osc, gain, lfo, lfoGain });
        }
        ambCurrentBiom = biomId;
    }

    // обновляем шум ветра каждый кадр
    function updateWindSound() {
        if (!audioReady || !gameRunning) return;
        if (!isFinite(player.vx)) return;
        const t     = audioCtx.currentTime;
        const speed = Math.max(0, Math.min(1, player.vx / MAX_VX_GROWTH));

        // Громкость: тихо в начале, нарастает со скоростью
        const targetGain = (0.025 + speed * 0.09) * settingsVolume;
        windGain.gain.setTargetAtTime(targetGain, t, 0.6);

        // Фильтр: на малой скорости — очень мягко (300 Гц), на макс — чуть открывается (900 Гц)
        // Диапазон специально сужен чтобы ветер никогда не был резким
        windFilter1.frequency.setTargetAtTime(300 + speed * 600, t, 0.8);
        windFilter2.frequency.setTargetAtTime(400 + speed * 400, t, 0.8);

        // ЗАКОММЕНТИРОВАНО: фоновый гул-эмбиент по биомам (BIOM_AMBIENT/startAmbLayers).
        // Мешал слышать настоящий звук ветра из mp3. Код оставлен ниже —
        // если захотим вернуть атмосферу, раскомментировать этот блок.
        //
        // const curBiomId = getCurBiom().id;
        // if (curBiomId !== ambCurrentBiom) {
        //     startAmbLayers(curBiomId);
        // }
        // if (ambMasterGain) {
        //     const def = BIOM_AMBIENT[curBiomId];
        //     if (def) {
        //         const diffBoost = curBiomId === 'storm' ? 1 + diffLevel * 0.04 : 1;
        //         ambMasterGain.gain.setTargetAtTime(
        //             def.masterGain * settingsVolume * diffBoost, t, 1.5
        //         );
        //     }
        // }
    }

    // короткий звук термика — нарастающий свист вверх
    function playThermalSound() {
        if (!audioReady) return;
        let t = audioCtx.currentTime;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(620, t + 0.35);
        gain.gain.setValueAtTime(0, t);
        // громкость увеличена (было 0.18) и привязана к настройке звука,
        // чтобы свист термика пробивался через звук ветра из mp3
        gain.gain.linearRampToValueAtTime(0.4 * Math.max(0.5, settingsVolume), t + 0.05);
        gain.gain.linearRampToValueAtTime(0, t + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
    }

    // удар об облако — глухой шлепок (белый шум + фильтр)
    // столкновение с облаком — мягкий приглушённый "пуфф" (воздушный слой + низкий "тук" для телесности)
    function playCloudHitSound() {
        if (!audioReady) return;
        let t = audioCtx.currentTime;

        // воздушный слой — приглушённый шум с мягкой (не щелчковой) атакой
        let bufSize = audioCtx.sampleRate * 0.26;
        let buffer  = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        let data    = buffer.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

        let noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        let noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';               // lowpass вместо bandpass — убирает "пластиковый" треск
        noiseFilter.frequency.setValueAtTime(1100, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(220, t + 0.26);
        noiseFilter.Q.value = 0.5;

        let noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, t);
        noiseGain.gain.linearRampToValueAtTime(0.20, t + 0.025); // мягкая атака — не щелчок, а "уф"
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        // низкий "тук" снизу — даёт звуку телесность, а не только шипение
        let thump = audioCtx.createOscillator();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(170, t);
        thump.frequency.exponentialRampToValueAtTime(70, t + 0.14);

        let thumpGain = audioCtx.createGain();
        thumpGain.gain.setValueAtTime(0.0001, t);
        thumpGain.gain.linearRampToValueAtTime(0.28, t + 0.012);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        thump.connect(thumpGain);
        thumpGain.connect(audioCtx.destination);

        noise.start(t);
        noise.stop(t + 0.27);
        thump.start(t);
        thump.stop(t + 0.17);
    }

    // турбулентность — низкий нисходящий гул (в отличие от "пуха" облака и "свиста" термика)
    function playTurbulenceSound() {
        if (!audioReady) return;
        let t = audioCtx.currentTime;
        let bufSize = audioCtx.sampleRate * 0.28;
        let buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        let data = buffer.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
        let noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        let filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(420, t);
        filter.frequency.exponentialRampToValueAtTime(90, t + 0.28);
        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(t);
        noise.stop(t + 0.29);
    }

    // смерть — низкий нисходящий тон
    function playDeathSound() {
        if (!audioReady) return;
        let t = audioCtx.currentTime;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.6);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.6);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.61);
    }
    

    
    //рекорд
    try {
        let saved = localStorage.getItem('sunrise_lightness');
        if (saved && !isNaN(parseInt(saved))) highScore = parseInt(saved);
    } catch(e) {}
    
    // запуск игры с экрана привествия
    function startGameFromWelcome() {
        showWelcome = false;
        gameRunning = true;
        restartGame();
    }