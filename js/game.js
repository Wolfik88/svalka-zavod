(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const canvas = $('game');
  const ctx = canvas.getContext('2d');

  // ================= Конфигурация =================
  const MATERIALS = {
    metal:       { color: '#8f9ba8', kinds: ['can', 'gear', 'pipe'],       icon: 'can',     base: 3 },
    plastic:     { color: '#e9a92b', kinds: ['pbottle', 'bucket', 'jug'],  icon: 'pbottle', base: 1 },
    glass:       { color: '#2f9e64', kinds: ['wine', 'jar', 'cup'],        icon: 'wine',    base: 2 },
    paper:       { color: '#3b7fd1', kinds: ['box', 'news'],               icon: 'box',     base: 1 },
    electronics: { color: '#a855c9', kinds: ['board', 'phone'],            icon: 'board',   base: 6 }
  };
  const ICON_COLOR = { plastic: '#f4f4f4', glass: 'rgba(225,250,255,.75)' };
  const BASE_BINS = ['metal', 'plastic', 'glass', 'paper'];
  const ALL_BINS = BASE_BINS.concat('electronics');
  const STAGES = [
    { cost: 0,     mult: 1,   bins: BASE_BINS, ground: ['#7a5c43', '#57412f'] },
    { cost: 400,   mult: 1.5, bins: ALL_BINS,  ground: ['#726b5f', '#4f4a42'] },
    { cost: 4000,  mult: 2.5, bins: ALL_BINS,  ground: ['#5e6873', '#3e4650'] },
    { cost: 40000, mult: 4,   bins: ALL_BINS,  ground: ['#40605f', '#2a3f40'] }
  ];
  const COMPOSITES = {
    tv:    { parts: ['glass', 'electronics', 'plastic'], taps: 3 },
    bike:  { parts: ['metal', 'metal', 'plastic'],       taps: 3 },
    radio: { parts: ['plastic', 'metal', 'electronics'], taps: 2 },
    lamp:  { parts: ['glass', 'metal', 'paper'],         taps: 2 }
  };
  const COLLECTIBLES = ['coin', 'watch', 'ring', 'medal', 'vinyl', 'key'];
  const UPGRADES = [
    // tab — вкладка магазина: yard (двор), skills (навыки), auto (автоматика)
    { id: 'pile',  tab: 'yard',   icon: 'box',   base: 40,  growth: 1.45, max: 20, perStage: 5 },
    { id: 'truck', tab: 'yard',   icon: 'truck', base: 250, growth: 1.8, max: 7 },
    { id: 'dog',   tab: 'yard',   icon: 'dog',   costs: [5000, 12000, 30000], max: 3, minPile: 1 },
    { id: 'grab',  tab: 'skills', icon: 'grab',  base: 500, growth: 2.5, max: 4,  minDay: 2 },
    { id: 'hands', tab: 'skills', icon: 'gear',  costs: [2500, 10000], max: 2 },
    { id: 'value', tab: 'skills', icon: 'coin',  base: 100, growth: 1.75, max: 30 },
    { id: 'luck',  tab: 'skills', icon: 'ring',  base: 800, growth: 2.2, max: 10, minDay: 2 },
    { id: 'disasm', tab: 'auto',  icon: 'tv',    base: 10000, growth: 1.8, max: 8, minDay: 3 }
  ];
  const SHOP_TABS = ['yard', 'skills', 'auto'];
  // Автосортеры: покупка и прокачка за монеты + материал, собранный вручную. Уровни без предела.
  const AUTO_BUY = { coins: 300, mats: 30 };
  const AUTO_BUY_ELECTRONICS = { coins: 1000, mats: 30 };
  function autoSpeedCost(s) { return { coins: Math.ceil(150 * Math.pow(1.4, s)), mats: 20 + 10 * s }; }
  function autoGrabCost(g) { return { coins: Math.ceil(400 * Math.pow(1.25, g)), mats: Math.ceil(40 * Math.pow(1.25, g)) }; }
  // 10 с на старте, каждое улучшение скорости −0,5 с, но не быстрее 1 с.
  const AUTO_SPEED_MAX = 18;
  function autoInterval(speed) { return Math.max(1, 10 - 0.5 * speed); }
  const COMPOSITE_UNITS = 4; // крупный хлам занимает 4 единицы места в мусоровозе
  function autoGrab(grab) { return 1 + grab; }
  const PLASTIC_COLORS = ['#2f8fe0', '#e2453c', '#ff9f1c', '#27c093', '#f4f4f4'];
  const WINE_COLORS = ['rgba(30,110,60,.85)', 'rgba(115,62,22,.85)'];
  const OVERFLOW_MAX = 3;
  const OFFLINE_CAP = 3 * 3600;
  const COMBO_WINDOW = 3;
  const COMPOSITE_SCALE = 1.4;

  // ================= Состояние =================
  const state = {
    money: 0, total: 0, stage: 0, day: 1, stars: 0,
    upg: {}, collection: [], muted: false,
    tips: { drag: false, treasure: false, composite: false, raccoon: false },
    city: 1, starsSpent: 0,
    decor: { owned: [], paints: ['green'], paint: 'green' },
    daily: { streak: 0, last: '' },
    quests: { date: '', list: [], bonusClaimed: false },
    mats: {},   // материалы, сданные вручную (валюта для автоматики)
    auto: {}    // автосортеры: { owned, speed, grab } по материалам
  };
  UPGRADES.forEach(function (u) { state.upg[u.id] = 0; });
  function resetAutomation() {
    ALL_BINS.forEach(function (m) { state.mats[m] = 0; state.auto[m] = { owned: false, speed: 0, grab: 0 }; });
  }
  resetAutomation();

  let W = 0, H = 0, DPR = 1;
  const L = { pile: { x: 0, y: 0, w: 0, h: 0 }, bins: [], size: 56, specks: [] };
  let items = [], floaters = [], particles = [];
  let run = null, truck = null, racs = [], dog = null;
  let gameTime = 0, saveTimer = 0, hudTimer = 0;
  let combo = 0, comboTimer = 0;
  let drag = null, hoverBin = null;
  let currentModal = null;
  const pauseReasons = new Set(['loading']);

  // ================= Утилиты =================
  const rand = function (a, b) { return a + Math.random() * (b - a); };
  const pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const lerp = function (a, b, k) { return a + (b - a) * k; };

  function fmt(n) {
    n = Math.floor(n);
    if (n < 10000) return String(n);
    const units = ['K', 'M', 'B', 'T'];
    let i = -1;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    let s = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s + units[i];
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ================= Формулы =================
  function activeMaterials() { return STAGES[state.stage].bins; }
  function collectionMult() {
    const n = state.collection.length;
    return 1 + 0.05 * n + (n >= COLLECTIBLES.length ? 0.25 : 0);
  }
  /** Постоянный множитель за переезды в новые города. */
  function cityMult() { return 1 + 0.5 * (state.city - 1); }
  /** Оценщик: каждый уровень умножает цену сырья на 1.25. */
  function valueUpgMult() { return Math.pow(1.25, state.upg.value); }
  function valueMult() {
    return valueUpgMult() * STAGES[state.stage].mult * collectionMult() * cityMult();
  }
  function pileCap() { return 10 + 2 * state.upg.pile; }
  // Вместимость мусоровоза в единицах груза: ур. 0 → 1–3, ур. 7 → 8–10.
  function truckMax() { return 3 + state.upg.truck; }
  function truckMin() { return Math.max(1, truckMax() - 2); }
  function treasureChance() { return 0.03 + 0.01 * state.upg.luck; }
  function compositeTaps(kind) { return Math.max(1, COMPOSITES[kind].taps - state.upg.hands); }
  function disasmInterval(lvl) { return 8 * Math.pow(0.85, lvl - 1); }
  function upgCost(u) {
    const lvl = state.upg[u.id];
    if (u.costs) return u.costs[Math.min(lvl, u.costs.length - 1)];
    return Math.ceil(u.base * Math.pow(u.growth, lvl));
  }
  function upgLockReason(u) {
    if (u.minDay && state.day < u.minDay) return t('locked_day', { d: u.minDay });
    if (u.minPile && state.upg.pile < u.minPile) return t('locked_pile');
    if (u.minStage && state.stage < u.minStage) return t('locked_stage', { n: u.minStage + 1 });
    // Часть уровней открывается только на следующих этапах двора.
    if (u.perStage && state.upg[u.id] < u.max && state.upg[u.id] >= u.perStage * (state.stage + 1)) {
      return t('locked_next_stage', { n: state.stage + 2 });
    }
    return null;
  }
  function grabCount() { return 1 + state.upg.grab; }
  function canPay(cost, mat) { return state.money >= cost.coins && (state.mats[mat] || 0) >= cost.mats; }
  function autoLocked(m) { return m === 'electronics' && state.stage < 1; }
  function autoBuyCost(m) { return m === 'electronics' ? AUTO_BUY_ELECTRONICS : AUTO_BUY; }
  function upgAffordable(u) { return !upgLockReason(u) && state.upg[u.id] < u.max && state.money >= upgCost(u); }
  function autoAffordable(m) {
    if (autoLocked(m)) return false;
    const a = state.auto[m];
    if (!a.owned) return canPay(autoBuyCost(m), m);
    return (a.speed < AUTO_SPEED_MAX && canPay(autoSpeedCost(a.speed), m)) || canPay(autoGrabCost(a.grab), m);
  }
  /** Есть ли во вкладке магазина что купить (для красной точки). */
  function tabAffordable(tab) {
    if (UPGRADES.some(function (u) { return u.tab === tab && upgAffordable(u); })) return true;
    return tab === 'auto' && ALL_BINS.some(autoAffordable);
  }
  function anyAffordable() { return SHOP_TABS.some(tabAffordable); }

  /** Сложность дня: чем дальше, тем чаще и больше мусоровозы, выше норма. */
  function dayParams(d) {
    const duration = 60;
    const truckInterval = Math.max(3.8, 6.8 - d * 0.25);
    const compositeChance = d >= 3 ? Math.min(0.25, 0.08 + 0.015 * (d - 3)) : 0;
    // Загрузка машины зависит только от улучшения «Мусоровоз».
    const truckLoad = (truckMin() + truckMax()) / 2;
    const expected = (duration - 3) / truckInterval * truckLoad;
    const quota = Math.max(8, Math.round(expected * Math.min(0.75, 0.45 + d * 0.015)));
    return { duration: duration, truckInterval: truckInterval, truckLoad: truckLoad, compositeChance: compositeChance, quota: quota };
  }

  // ================= Пауза =================
  function pauseAdd(reason) {
    const was = pauseReasons.size > 0;
    pauseReasons.add(reason);
    if (!was) onPauseChange(true);
  }
  function pauseRemove(reason) {
    if (!pauseReasons.has(reason)) return;
    pauseReasons.delete(reason);
    if (pauseReasons.size === 0) onPauseChange(false);
  }
  function isPaused() { return pauseReasons.size > 0; }
  function onPauseChange(paused) {
    if (paused) {
      cancelDrag();
      Platform.gameplayStop();
      GameAudio.setPaused(true);
    } else {
      // Геймплей идёт только во время рабочего дня; в перерыве — GameplayAPI остаётся остановленным.
      if (run) Platform.gameplayStart();
      GameAudio.setPaused(false);
    }
  }

  // ================= Раскладка =================
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    const barBottom = $('bar').getBoundingClientRect().bottom;
    const pad = 12;
    const mats = activeMaterials();
    const n = mats.length;
    const gap = clamp(W * 0.02, 6, 16);
    const binW = Math.min((W - pad * 2 - gap * (n - 1)) / n, 150);
    const binH = clamp(H * 0.15, 70, 130);
    const totalW = binW * n + gap * (n - 1);
    const binY = H - binH - Math.max(10, H * 0.02);

    const old = L.bins;
    L.bins = mats.map(function (type, i) {
      const o = old.find(function (b) { return b.type === type; });
      return {
        type: type, x: (W - totalW) / 2 + i * (binW + gap), y: binY, w: binW, h: binH,
        bounce: o ? o.bounce : 0, shake: o ? o.shake : 0, cd: o ? o.cd : 0
      };
    });

    const top = barBottom + 8;
    const pileH = Math.max(90, binY - top - 18);
    // Чем больше вмещает куча, тем мельче предметы, чтобы всё помещалось.
    const crowd = clamp(Math.sqrt(16 / pileCap()), 0.7, 1);
    L.size = clamp(Math.min(W / 7.5, pileH / 4.2) * crowd, 30, 80);
    // Сверху место под мусоровоз, снизу — под автоматы над контейнерами.
    const truckH = L.size * 1.05;
    L.pile = { x: pad, y: top + truckH, w: W - pad * 2, h: Math.max(60, pileH - truckH - L.size * 0.45) };
    L.truckY = top + truckH * 0.55;

    items.forEach(function (it) {
      const p = clampToPile(it.hx, it.hy);
      it.hx = p.x; it.hy = p.y;
      if (it.state === 'idle') { it.x = p.x; it.y = p.y; }
    });

    let seed = 7;
    const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    L.specks = [];
    const count = Math.round(W * H / 6000);
    for (let i = 0; i < count; i++) L.specks.push({ x: rnd() * W, y: rnd() * H, r: 1 + rnd() * 3, a: 0.05 + rnd() * 0.12 });

    $('hint').style.top = Math.max(top, L.pile.y - truckH * 0.85) + 'px';
  }

  function clampToPile(x, y) {
    const m = L.size * 0.5;
    return {
      x: clamp(x, L.pile.x + m, L.pile.x + L.pile.w - m),
      y: clamp(y, L.pile.y + m * 0.6, L.pile.y + L.pile.h - m * 0.6)
    };
  }

  // ================= Предметы =================
  function pileCount() { return items.filter(function (i) { return i.state !== 'fly'; }).length; }
  function itemSize(it) { return L.size * (it.type === 'composite' ? COMPOSITE_SCALE : 1); }
  function findIdle(pred) {
    const c = items.filter(function (i) { return i.state === 'idle' && pred(i); });
    return c.length ? pick(c) : null;
  }

  function findSpot(cx, cy, r) {
    let best = null, bestD = -1;
    for (let k = 0; k < 14; k++) {
      let x, y;
      if (cx != null) { const a = rand(0, Math.PI * 2), d = rand(0.3, 1) * r; x = cx + Math.cos(a) * d; y = cy + Math.sin(a) * d; }
      else { x = rand(L.pile.x, L.pile.x + L.pile.w); y = rand(L.pile.y, L.pile.y + L.pile.h); }
      const p = clampToPile(x, y);
      let dmin = Infinity;
      items.forEach(function (o) { if (o.state !== 'fly') dmin = Math.min(dmin, Math.hypot(o.hx - p.x, o.hy - p.y)); });
      if (dmin > bestD) { bestD = dmin; best = p; }
    }
    return best;
  }

  function colorFor(kind) {
    if (kind === 'pbottle' || kind === 'bucket' || kind === 'jug') return pick(PLASTIC_COLORS);
    if (kind === 'wine') return pick(WINE_COLORS);
    return null;
  }
  function partType(m) { return activeMaterials().indexOf(m) >= 0 ? m : 'metal'; }

  /** room — сколько единиц места осталось в машине: крупный хлам занимает 4, остальное 1. */
  function rollJunk(p, room) {
    if (p.compositeChance && (room == null || room >= COMPOSITE_UNITS) && Math.random() < p.compositeChance) {
      return { type: 'composite', kind: pick(Object.keys(COMPOSITES)), hits: 0 };
    }
    if (state.day >= 2 && Math.random() < treasureChance()) {
      return { type: 'treasure', kind: pick(COLLECTIBLES) };
    }
    const type = pick(activeMaterials());
    const kind = pick(MATERIALS[type].kinds);
    return { type: type, kind: kind, color: colorFor(kind) };
  }

  function addItem(spec, fromX, fromY, spot, dur) {
    const p = spot || findSpot();
    const it = Object.assign({
      x: fromX, y: fromY, hx: p.x, hy: p.y, rot: rand(-0.5, 0.5),
      born: gameTime, scale: 1, shake: 0,
      state: 'drop', fx: fromX, fy: fromY, ft: 0, dur: dur || 0.5
    }, spec);
    items.push(it);
    return it;
  }

  function binFor(type) { return L.bins.find(function (b) { return b.type === type; }); }
  function binAt(x, y) {
    for (let i = 0; i < L.bins.length; i++) {
      const b = L.bins[i];
      const ex = Math.min(10, b.w * 0.08);
      if (x >= b.x - ex && x <= b.x + b.w + ex && y >= b.y - L.size * 0.7 && y <= b.y + b.h + 10) return b;
    }
    return null;
  }

  function earn(v, x, y, color) {
    state.money += v;
    state.total += v;
    if (run) run.earned += v;
    floaters.push({ x: x, y: y, text: '+' + fmt(Math.max(1, v)), t: 0, color: color || '#ffd84d' });
  }
  function say(x, y, text, color) { floaters.push({ x: x, y: y, text: text, t: 0, color: color || '#fff', small: true }); }

  function burst(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(80, 260);
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, t: 0, life: rand(0.5, 0.9), c: pick(colors), r: rand(2, 5) });
    }
  }

  function startFly(it, bin, auto) {
    it.state = 'fly';
    it.auto = auto;
    it.fx = it.x; it.fy = it.y; it.ft = 0;
    it.dur = auto ? 0.55 : 0.18;
    it.tx = bin.x + bin.w / 2;
    it.ty = bin.y + bin.h * 0.2;
    it.bin = bin;
    if (auto) (bin.beams || (bin.beams = [])).push(it);
  }

  /** Верная сортировка. quiet — не показывать сумму (для охапки сумма выводится одной строкой). */
  function sortCorrect(it, bin, quiet) {
    combo = comboTimer > 0 ? Math.min(combo + 1, 50) : 1;
    comboTimer = COMBO_WINDOW;
    const comboMult = 1 + Math.min(combo - 1, 10) * 0.1;
    const v = MATERIALS[it.type].base * valueMult() * comboMult;
    if (quiet) { state.money += v; state.total += v; if (run) run.earned += v; }
    else earn(v, bin.x + bin.w / 2, bin.y - 10);
    burst(bin.x + bin.w / 2, bin.y + 6, 6, ['#ffd84d', '#fff3a8', MATERIALS[bin.type].color]);
    startFly(it, bin, false);
    bin.bounce = 1;
    if (run) run.sorted++;
    if (run && run.sorted >= 3) state.tips.drag = true;
    state.mats[it.type] = (state.mats[it.type] || 0) + 1; // ручная сдача пополняет материалы для автоматики
    questProgress('sort_any', 1);
    questProgress('sort_mat', 1, it.type);
    if (combo >= 6) questProgress('combo', 1); // комбо ×1.5
    GameAudio.play('ok', combo);
    return v;
  }

  // ---------- Охапка: несколько предметов одного материала за раз ----------
  function gatherExtras(it) {
    const n = grabCount() - 1;
    if (n <= 0 || it.type === 'treasure' || it.type === 'composite') return [];
    const extras = items
      .filter(function (o) { return o !== it && o.state === 'idle' && o.type === it.type; })
      .sort(function (a, b) { return Math.hypot(a.x - it.x, a.y - it.y) - Math.hypot(b.x - it.x, b.y - it.y); })
      .slice(0, n);
    extras.forEach(function (o) { o.state = 'carried'; });
    return extras;
  }

  function carrySlot(i) {
    // Предметы охапки лежат «стопкой» за основным предметом.
    const s = L.size;
    return { x: (i % 2 ? 1 : -1) * s * 0.28 * (1 + Math.floor(i / 2) * 0.6), y: -s * 0.22 * (i + 1) };
  }

  function releaseExtras(extras) {
    extras.forEach(function (o) { if (o.state === 'carried') o.state = 'return'; });
  }

  function sortWrong(it, bin) {
    bin.shake = 1;
    combo = 0; comboTimer = 0;
    it.state = 'return';
    say(bin.x + bin.w / 2, bin.y - 10, it.type === 'composite' ? t('compose_first') : t('wrong'), '#ff8a7a');
    GameAudio.play('bad');
  }

  function collectTreasure(it) {
    items.splice(items.indexOf(it), 1);
    burst(it.x, it.y, 18, ['#ffd84d', '#fff3a8', '#ffffff', '#f5c518']);
    state.tips.treasure = true;
    questProgress('treasure', 1);
    if (state.collection.indexOf(it.kind) < 0) {
      state.collection.push(it.kind);
      say(it.x, it.y - L.size * 0.9, t('new_find'), '#fff27a');
      say(it.x, it.y - L.size * 0.4, t('col_' + it.kind), '#ffffff');
      GameAudio.play('star');
      save(true);
    } else {
      earn(20 * valueMult() * rand(1, 2.5), it.x, it.y - L.size * 0.5, '#fff27a');
      GameAudio.play('coin');
    }
  }

  function tapComposite(it) {
    it.hits = (it.hits || 0) + 1;
    it.shake = 1;
    burst(it.x, it.y, 5, ['#d9d9d9', '#a0a0a0']);
    GameAudio.play('crack');
    if (it.hits >= compositeTaps(it.kind)) dismantle(it, false);
  }

  function dismantle(it, auto) {
    const idx = items.indexOf(it);
    if (idx < 0) return;
    items.splice(idx, 1);
    COMPOSITES[it.kind].parts.forEach(function (m) {
      const type = partType(m);
      const kind = pick(MATERIALS[type].kinds);
      const spot = findSpot(it.x, it.y, L.size * 1.4);
      const n = addItem({ type: type, kind: kind, color: colorFor(kind) }, it.x, it.y, spot, 0.35);
      n.born = gameTime - 1;
    });
    burst(it.x, it.y, 14, ['#d9d9d9', '#a0a0a0', '#ffd84d']);
    if (auto) say(it.x, it.y - L.size * 0.6, t('auto_disasm'), '#cfe8ff');
    else questProgress('composite', 1);
    state.tips.composite = true;
    GameAudio.play('break');
  }

  // ================= Мусоровоз =================
  function spawnTruck() {
    const s = L.size;
    // Груз собирается заранее: обычный мусор — 1 единица, крупный хлам — 4.
    let room = truckMin() + Math.floor(Math.random() * (truckMax() - truckMin() + 1));
    const cargo = [];
    while (room > 0) {
      const spec = rollJunk(run.p, room);
      cargo.push(spec);
      room -= spec.type === 'composite' ? COMPOSITE_UNITS : 1;
    }
    truck = {
      x: W + s * 2.5, y: L.truckY, tx: L.pile.x + L.pile.w * 0.5 - s * 0.4,
      phase: 'in', t: 0, tilt: 0, cargo: cargo, load: cargo.length,
      released: 0, rel: 0
    };
    GameAudio.play('truck');
  }

  function releaseOne() {
    const s = L.size;
    const ox = truck.x + s * 0.95, oy = truck.y - s * 0.1;
    if (pileCount() >= pileCap()) {
      // Невлезший мусор теряется; штраф — один на машину, а не за каждый предмет.
      if (truck.overflowed) return;
      truck.overflowed = true;
      run.overflow++;
      say(clamp(ox, 70, W - 70), oy + s * 0.5, t('overflow_hit'), '#ff7a6a');
      GameAudio.play('bad');
      flashOverflow();
      if (run.overflow >= OVERFLOW_MAX) onOverflow();
      return;
    }
    addItem(truck.cargo[truck.released - 1] || rollJunk(run.p, 1), ox, oy);
  }

  function updateTruck(dt) {
    const s = L.size;
    truck.t += dt;
    if (truck.phase === 'in') {
      const f = Math.min(1, truck.t / 0.8);
      truck.x = lerp(W + s * 2.5, truck.tx, 1 - Math.pow(1 - f, 3));
      if (f >= 1) { truck.phase = 'dump'; truck.t = 0; }
    } else if (truck.phase === 'dump') {
      truck.tilt = Math.min(0.5, truck.t * 2);
      if (truck.t > 0.25) {
        truck.rel += dt;
        while (truck.rel >= 0.12 && truck.released < truck.load) {
          truck.rel -= 0.12;
          truck.released++;
          releaseOne();
          if (!truck || !run || isPaused()) return;
        }
        if (truck.released >= truck.load) { truck.phase = 'out'; truck.t = 0; }
      }
    } else {
      truck.tilt = Math.max(0, truck.tilt - dt * 2);
      const f = Math.min(1, truck.t / 0.8);
      truck.x = lerp(truck.tx, W + s * 2.5, f * f);
      if (f >= 1) truck = null;
    }
  }

  // ================= Еноты (число и частота зависят от уровня кучи) =================
  function raccoonsActive() { return state.upg.pile >= 1; }
  function maxRaccoons() { return 1 + Math.floor(state.upg.pile / 5); }
  function raccoonInterval() { return Math.max(6, 20 - 0.7 * state.upg.pile); }
  function activeRaccoons() { return racs.filter(function (r) { return !r.scared; }); }

  function spawnRaccoon() {
    // Еноты не охотятся за одним и тем же предметом.
    const taken = racs.map(function (r) { return r.target; });
    const cands = items.filter(function (i) { return i.state === 'idle' && i.type !== 'composite' && taken.indexOf(i) < 0; });
    if (!cands.length) return;
    const target = cands.find(function (i) { return i.type === 'treasure'; }) || pick(cands);
    const fromLeft = target.x < W / 2;
    racs.push({
      x: fromLeft ? -L.size : W + L.size, y: target.y, dir: fromLeft ? 1 : -1,
      state: 'enter', target: target, carry: null, t: rand(0, 3), scared: false,
      speed: L.size * 2.3
    });
    GameAudio.play('rac');
  }

  function updateRaccoon(rac, dt) {
    const s = L.size;
    rac.t += dt;
    if (rac.state === 'enter') {
      let tg = rac.target;
      if (!tg || tg.state !== 'idle' || items.indexOf(tg) < 0) {
        tg = rac.target = findIdle(function (i) { return i.type !== 'composite'; });
        if (!tg) { rac.state = 'flee'; rac.dir = rac.x < W / 2 ? -1 : 1; return; }
      }
      const dx = tg.x - rac.x, dy = tg.y - rac.y, d = Math.hypot(dx, dy);
      rac.dir = dx >= 0 ? 1 : -1;
      if (d < s * 0.35) {
        tg.state = 'grabbed';
        rac.carry = tg;
        rac.state = 'flee';
        rac.dir = rac.x < W / 2 ? -1 : 1;
      } else {
        const st = Math.min(d, rac.speed * dt);
        rac.x += dx / d * st; rac.y += dy / d * st;
      }
    } else {
      rac.x += rac.dir * rac.speed * (rac.scared ? 2.4 : 1.25) * dt;
      if (rac.carry) { rac.carry.x = rac.x + rac.dir * s * 0.5; rac.carry.y = rac.y - s * 0.15; }
      if (rac.x < -s * 1.5 || rac.x > W + s * 1.5) {
        if (rac.carry) {
          const i = items.indexOf(rac.carry);
          if (i >= 0) items.splice(i, 1);
          say(clamp(rac.x, 70, W - 70), rac.y, t('stolen'), '#ff8a7a');
        }
        rac.gone = true;
      }
    }
  }

  function scareRaccoon(rac, byDog) {
    if (!rac || rac.scared) return;
    if (rac.carry) {
      const it = rac.carry;
      const c = clampToPile(it.x, it.y);
      it.hx = c.x; it.hy = c.y; it.state = 'return';
      rac.carry = null;
    }
    rac.scared = true;
    rac.state = 'flee';
    rac.dir = rac.x < W / 2 ? -1 : 1;
    say(rac.x, rac.y - L.size * 0.7, byDog ? t('woof') : t('shoo'), '#ffffff');
    if (!byDog) { earn(4 * valueMult(), rac.x, rac.y - L.size * 1.1); state.tips.raccoon = true; questProgress('raccoon', 1); }
    GameAudio.play(byDog ? 'woof' : 'coin');
  }

  // ================= Сторожевой пёс (виден на поле) =================
  // Скорость погони (в размерах предмета в секунду). Енот убегает со скоростью ≈2.9, так что пёс всегда быстрее.
  function dogSpeed() { return L.size * [0, 3.2, 4.0, 5.0][Math.min(3, state.upg.dog)]; }

  function ensureDog() {
    if (state.upg.dog <= 0) { dog = null; return; }
    if (!dog) {
      const p = clampToPile(L.pile.x + L.pile.w / 2, L.pile.y + L.pile.h / 2);
      dog = { x: p.x, y: p.y, tx: p.x, ty: p.y, dir: 1, t: 0, rest: 0, moving: false, chasing: false };
    }
  }

  function updateDog(dt) {
    ensureDog();
    if (!dog) return;
    dog.t += dt;
    // Ближайший неиспуганный енот — цель погони.
    let target = null, best = Infinity;
    activeRaccoons().forEach(function (r) {
      const d = Math.hypot(r.x - dog.x, r.y - dog.y);
      if (d < best) { best = d; target = r; }
    });
    dog.chasing = !!target;
    let speed = dogSpeed();
    if (target) {
      dog.tx = target.x; dog.ty = target.y;
      if (best < L.size * 0.9) { scareRaccoon(target, true); dog.rest = 0.6; dog.moving = false; return; }
    } else if (dog.rest > 0) {
      dog.rest -= dt; dog.moving = false; return;
    } else if (Math.hypot(dog.tx - dog.x, dog.ty - dog.y) < 4) {
      // Новая точка прогулки внутри кучи.
      const p = clampToPile(rand(L.pile.x, L.pile.x + L.pile.w), rand(L.pile.y, L.pile.y + L.pile.h));
      dog.tx = p.x; dog.ty = p.y; dog.rest = rand(0.3, 1.5);
      return;
    } else {
      speed *= 0.25; // неспешная прогулка
    }
    const dx = dog.tx - dog.x, dy = dog.ty - dog.y, d = Math.hypot(dx, dy);
    if (d > 0.5) {
      const st = Math.min(d, speed * dt);
      dog.x += dx / d * st; dog.y += dy / d * st;
      if (Math.abs(dx) > 1) dog.dir = dx >= 0 ? 1 : -1;
      dog.moving = true;
    } else dog.moving = false;
  }

  // ================= Рабочий день =================
  function startDay() {
    const p = dayParams(state.day);
    run = {
      d: state.day, p: p, time: 0, sorted: 0, earned: 0, overflow: 0, revived: false,
      truckTimer: 0.5, racTimer: raccoonInterval() * 0.5, disasmTimer: 0
    };
    items = []; truck = null; racs = []; combo = 0; comboTimer = 0;
    L.bins.forEach(function (b) { b.cd = 0; b.beams = []; });
    buildPips();
    updateHUD();
    if (!isPaused()) Platform.gameplayStart();
  }

  function updateDay(dt) {
    run.time += dt;
    if (run.time >= run.p.duration) { endDay(false); return; }

    run.truckTimer -= dt;
    if (truck) updateTruck(dt);
    else if (run.truckTimer <= 0 && run.time < run.p.duration - 3) {
      spawnTruck();
      run.truckTimer = run.p.truckInterval;
    }
    if (!run || isPaused()) return;

    // Автосортеры: при срабатывании забирают до «захват» ближайших предметов своего материала.
    L.bins.forEach(function (b) {
      const a = state.auto[b.type];
      if (!a || !a.owned) return;
      if (b.cd < 1) b.cd = Math.min(1, b.cd + dt / autoInterval(a.speed));
      if (b.cd >= 1) {
        const cx = b.x + b.w / 2, cy = b.y;
        const cands = items
          .filter(function (i) { return i.state === 'idle' && i.type === b.type; })
          .sort(function (p, q) { return Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy); })
          .slice(0, autoGrab(a.grab));
        if (cands.length) {
          cands.forEach(function (it) { startFly(it, b, true); });
          b.cd = 0;
        }
      }
    });

    // Разборщик
    if (state.upg.disasm > 0) {
      const iv = disasmInterval(state.upg.disasm);
      run.disasmTimer = Math.min(iv, run.disasmTimer + dt);
      if (run.disasmTimer >= iv) {
        const c = findIdle(function (i) { return i.type === 'composite'; });
        if (c) { dismantle(c, true); run.disasmTimer = 0; }
      }
    }

    // Еноты
    if (raccoonsActive()) {
      run.racTimer -= dt;
      if (run.racTimer <= 0 && racs.length < maxRaccoons()) {
        // Набег: сразу столько енотов, сколько позволяет уровень кучи.
        const n = maxRaccoons() - racs.length;
        for (let i = 0; i < n; i++) spawnRaccoon();
        run.racTimer = raccoonInterval() * rand(0.8, 1.2);
      }
    }
    racs.forEach(function (r) { updateRaccoon(r, dt); });
    racs = racs.filter(function (r) { return !r.gone; });
    updateDog(dt);
  }

  function onOverflow() {
    if (run.revived) { endDay(true); return; }
    openModal({
      title: t('overflow_title'),
      text: t('overflow_text'),
      buttons: [
        { label: t('give_up'), cls: 'btn-ghost', onClick: function () { endDay(true); } },
        {
          label: t('revive'), cls: 'btn-ad', ad: true,
          onClick: function () {
            Platform.showRewarded(revive, function (rewarded) { if (!rewarded) endDay(true); });
            closeModal();
          }
        }
      ]
    });
  }

  function revive() {
    if (!run) return;
    run.revived = true;
    run.overflow = 0;
    if (truck) truck.released = truck.load;
    const pile = items.filter(function (i) { return i.state === 'idle' || i.state === 'drop' || i.state === 'return'; });
    pile.slice(0, Math.ceil(pile.length / 2)).forEach(function (it) {
      burst(it.x, it.y, 6, ['#d9d9d9', '#a0a0a0']);
      items.splice(items.indexOf(it), 1);
    });
    updateHUD();
  }

  function endDay(failed) {
    if (!run) return;
    const r = run;
    run = null; truck = null; racs = []; drag = null; hoverBin = null;
    items.forEach(function (it) { if (Math.random() < 0.4) burst(it.x, it.y, 3, ['#a0a0a0']); });
    items = [];
    Platform.gameplayStop();

    const q = r.p.quota;
    let stars = 0;
    if (!failed && r.sorted >= q) {
      stars = 1;
      if (r.overflow === 0 && !r.revived) stars++;
      if (r.sorted >= Math.ceil(q * 1.5)) stars++;
    }
    const bonus = stars ? Math.round((15 + 8 * r.d) * stars * STAGES[state.stage].mult) : 0;
    if (stars) { state.day = r.d + 1; state.stars += stars; }
    if (stars === 3) questProgress('stars3', 1);
    save(true);
    GameAudio.play(stars ? 'stage' : 'bad');
    showSummary(r, stars, bonus, failed);
  }

  function showSummary(r, stars, bonus, failed) {
    const box = el('div', 'summary');
    const starsEl = el('div', 'stars');
    for (let i = 0; i < 3; i++) starsEl.appendChild(el('span', 'star' + (i < stars ? ' on' : ''), '★'));
    box.appendChild(starsEl);
    box.appendChild(el('div', 'sum-line', t('sum_sorted', { n: r.sorted, q: r.p.quota })));
    box.appendChild(el('div', 'sum-line', t('sum_earned', { n: fmt(r.earned) })));
    if (stars) box.appendChild(el('div', 'sum-line gold', t('sum_bonus', { n: fmt(bonus) })));
    else box.appendChild(el('div', 'sum-line warn', failed ? t('sum_fail_overflow') : t('sum_fail_quota')));
    box.appendChild(el('div', 'sum-hint', t('stars_hint')));

    const buttons = [];
    if (stars) {
      buttons.push({ label: t('take'), cls: 'btn-ghost', onClick: function () { addMoney(bonus); openHub(); } });
      buttons.push({
        label: t('bonus_x2'), cls: 'btn-ad', ad: true,
        onClick: function () {
          Platform.showRewarded(
            function () { addMoney(bonus * 2); },
            function (rewarded) { if (!rewarded) addMoney(bonus); save(true); openHub(); }
          );
        }
      });
    } else {
      buttons.push({ label: t('continue'), onClick: function () { openHub(); } });
    }
    openModal({ title: stars ? t('day_done', { d: r.d }) : t('day_failed', { d: r.d }), content: box, buttons: buttons });
  }

  function addMoney(v) { state.money += v; state.total += v; save(true); }

  // ================= Ввод =================
  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e) {
    GameAudio.unlock();
    if (!run || isPaused() || drag) return;
    const p = pointerPos(e);
    const hitRac = activeRaccoons().find(function (r) { return Math.hypot(p.x - r.x, p.y - r.y) < L.size * 0.75; });
    if (hitRac) { scareRaccoon(hitRac, false); return; }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.state !== 'idle' && it.state !== 'return') continue;
      if (Math.hypot(p.x - it.x, p.y - it.y) > itemSize(it) * 0.6) continue;
      if (it.type === 'composite') { tapComposite(it); return; }
      if (it.type === 'treasure') { collectTreasure(it); return; }
      const lift = e.pointerType === 'touch' ? L.size * 0.45 : 0;
      drag = { it: it, dx: it.x - p.x, dy: it.y - p.y - lift, id: e.pointerId, extras: gatherExtras(it) };
      it.state = 'drag';
      it.x = p.x + drag.dx; it.y = p.y + drag.dy;
      items.splice(i, 1);
      items.push(it);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      GameAudio.play('pick');
      return;
    }
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = pointerPos(e);
    drag.it.x = p.x + drag.dx;
    drag.it.y = p.y + drag.dy;
    hoverBin = binAt(drag.it.x, drag.it.y) || binAt(p.x, p.y);
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const it = drag.it;
    const p = pointerPos(e);
    const bin = binAt(it.x, it.y) || binAt(p.x, p.y);
    const extras = drag.extras;
    drag = null; hoverBin = null;
    if (bin) {
      if (bin.type === it.type) {
        if (!extras.length) sortCorrect(it, bin);
        else {
          let sum = sortCorrect(it, bin, true);
          extras.forEach(function (o) { if (o.state === 'carried') sum += sortCorrect(o, bin, true); });
          questProgress('grab', extras.length + 1);
          floaters.push({ x: bin.x + bin.w / 2, y: bin.y - 10, text: '+' + fmt(Math.max(1, sum)) + '  ×' + (extras.length + 1), t: 0, color: '#ffd84d' });
        }
      } else {
        sortWrong(it, bin);
        releaseExtras(extras);
      }
    } else {
      releaseExtras(extras);
      if (it.y > L.pile.y - L.size && it.y < L.pile.y + L.pile.h + L.size * 0.3) {
        const c = clampToPile(it.x, it.y);
        it.hx = c.x; it.hy = c.y;
      }
      it.state = 'return';
    }
  }

  function cancelDrag() {
    if (!drag) return;
    drag.it.state = 'return';
    releaseExtras(drag.extras || []);
    drag = null; hoverBin = null;
  }

  // ================= Обновление =================
  function update(dt) {
    gameTime += dt;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
    if (run) updateDay(dt);

    const k = 1 - Math.exp(-14 * dt);
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.shake > 0) it.shake = Math.max(0, it.shake - dt * 4);
      if (it.state === 'carried' && drag) {
        const idx = drag.extras.indexOf(it);
        const slot = carrySlot(idx < 0 ? 0 : idx);
        const kc = 1 - Math.exp(-20 * dt);
        it.x = lerp(it.x, drag.it.x + slot.x, kc);
        it.y = lerp(it.y, drag.it.y + slot.y, kc);
      } else if (it.state === 'return') {
        it.x = lerp(it.x, it.hx, k); it.y = lerp(it.y, it.hy, k);
        if (Math.hypot(it.x - it.hx, it.y - it.hy) < 1) { it.x = it.hx; it.y = it.hy; it.state = 'idle'; }
      } else if (it.state === 'drop') {
        it.ft += dt / it.dur;
        const f = Math.min(1, it.ft);
        it.x = lerp(it.fx, it.hx, f);
        it.y = lerp(it.fy, it.hy, f) - Math.sin(f * Math.PI) * L.size * 0.7;
        it.scale = 0.6 + 0.4 * f;
        if (f >= 1) { it.state = 'idle'; it.scale = 1; }
      } else if (it.state === 'fly') {
        it.ft += dt / it.dur;
        const f = Math.min(1, it.ft);
        it.x = lerp(it.fx, it.tx, f);
        it.y = lerp(it.fy, it.ty, f) - (it.auto ? Math.sin(f * Math.PI) * L.size * 0.8 : 0);
        it.scale = 1 - f * 0.6;
        if (it.ft >= 1) {
          if (it.auto) {
            earn(MATERIALS[it.type].base * valueMult(), it.tx, it.bin.y - 10, '#cfe8ff');
            if (run) run.sorted++;
            questProgress('sort_any', 1);
            questProgress('sort_mat', 1, it.type);
            it.bin.bounce = 1;
            GameAudio.play('auto');
          }
          if (it.bin.beams) it.bin.beams = it.bin.beams.filter(function (b) { return b !== it; });
          items.splice(i, 1);
        }
      }
    }

    L.bins.forEach(function (b) {
      if (b.bounce > 0) b.bounce = Math.max(0, b.bounce - dt * 4);
      if (b.shake > 0) b.shake = Math.max(0, b.shake - dt * 2.5);
    });

    saveTimer += dt;
    if (saveTimer >= 10) { saveTimer = 0; save(false); }
  }

  function updateEffects(dt) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      floaters[i].t += dt;
      if (floaters[i].t >= 1.2) floaters.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt; p.vy += 600 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) particles.splice(i, 1);
    }
  }

  // ================= Отрисовка =================
  function drawBackground() {
    const st = STAGES[state.stage];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, st.ground[0]);
    g.addColorStop(1, st.ground[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    L.specks.forEach(function (s) {
      ctx.fillStyle = 'rgba(0,0,0,' + s.a + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });

    // Дорога для мусоровоза
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, L.truckY + L.size * 0.2, W, L.size * 0.22);
    drawDecor();

    // Куча
    const p = L.pile;
    const full = run ? Math.min(1, pileCount() / pileCap()) : 0;
    ctx.fillStyle = full >= 1 ? 'rgba(160,30,20,.22)' : 'rgba(0,0,0,.14)';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h * 0.5, p.w * 0.52, p.h * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (L.bins.length) {
      const b0 = L.bins[0];
      const y = b0.y + b0.h * 0.55;
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.fillRect(0, y, W, H - y);
      if (state.stage >= 2) {
        const sw = 18;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, y - 6, W, 6); ctx.clip();
        ctx.fillStyle = '#f2c230';
        for (let x = -sw; x < W + sw; x += sw * 2) {
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x + sw, y - 6); ctx.lineTo(x + sw * 2, y - 6); ctx.lineTo(x + sw, y);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  function drawBin(b) {
    const m = MATERIALS[b.type];
    let x = b.x, y = b.y;
    if (b.shake > 0) x += Math.sin(b.shake * 40) * 7 * b.shake;
    if (b.bounce > 0) y -= Math.sin(b.bounce * Math.PI) * 6;
    const hover = hoverBin === b;
    const w = b.w, h = b.h;
    const color = hover ? Draw.shade(m.color, 0.18) : m.color;

    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 2, w * 0.48, 6, 0, 0, Math.PI * 2); ctx.fill();

    const top = y + h * 0.16;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.02, top); ctx.lineTo(x + w * 0.98, top);
    ctx.lineTo(x + w * 0.92, y + h); ctx.lineTo(x + w * 0.08, y + h);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = Draw.shade(m.color, -0.4); ctx.stroke();

    Draw.rr(ctx, x - 3, y + (hover ? -6 : 0), w + 6, h * 0.18, 6);
    ctx.fillStyle = Draw.shade(m.color, -0.28); ctx.fill();

    const iconS = Math.min(w * 0.55, h * 0.45);
    ctx.save();
    ctx.translate(x + w / 2, top + (h - h * 0.16) * 0.4);
    Draw.item(ctx, m.icon, iconS, ICON_COLOR[b.type]);
    ctx.restore();

    const fs = clamp(w * 0.15, 10, 15);
    ctx.font = '700 ' + fs + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillText(t('mat_' + b.type), x + w / 2 + 1, y + h - fs * 0.55 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(t('mat_' + b.type), x + w / 2, y + h - fs * 0.55);

    const a = state.auto[b.type];
    if (a && a.owned) {
      const s = Math.min(L.size, w * 0.8);
      ctx.save();
      ctx.translate(x + w / 2, y - s * 0.22);
      // Подпись: уровень скорости, а после «×» — сколько деталей берёт за раз.
      Draw.machine(ctx, s, m.color, b.cd, a.grab ? a.speed + '×' + autoGrab(a.grab) : a.speed);
      ctx.restore();
    }
  }

  function drawBeams() {
    L.bins.forEach(function (b) {
      (b.beams || []).forEach(function (it) {
        if (it.state !== 'fly') return;
        const s = Math.min(L.size, b.w * 0.8);
        ctx.save();
        ctx.strokeStyle = MATERIALS[b.type].color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -gameTime * 60;
        ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, b.y - s * 0.3); ctx.lineTo(it.x, it.y); ctx.stroke();
        ctx.restore();
      });
    });
  }

  function drawItem(it) {
    const s = itemSize(it);
    let scale = it.scale;
    if (it.state === 'drag') scale *= 1.12;
    let ox = 0;
    if (it.shake > 0) ox = Math.sin(it.shake * 50) * 5 * it.shake;

    if (it.state !== 'fly' && it.state !== 'drop') {
      ctx.fillStyle = it.state === 'drag' ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.28)';
      ctx.beginPath();
      ctx.ellipse(it.x, it.y + s * 0.34 + (it.state === 'drag' ? s * 0.15 : 0), s * 0.3 * scale, s * 0.08 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(it.x + ox, it.y);
    if (it.type === 'treasure') {
      const pulse = 0.5 + 0.5 * Math.sin(gameTime * 5 + it.hx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.75);
      g.addColorStop(0, 'rgba(255,240,150,' + (0.45 + pulse * 0.3) + ')');
      g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, Math.PI * 2); ctx.fill();
    }
    ctx.rotate(it.type === 'composite' ? it.rot * 0.3 : it.rot);
    ctx.scale(scale, scale);
    Draw.item(ctx, it.kind, s, it.color);
    if (it.type === 'composite' && it.hits) Draw.cracks(ctx, s, it.hits);
    ctx.restore();

    if (it.type === 'treasure') {
      const a = gameTime * 3 + it.hy;
      Draw.sparkle(ctx, it.x + Math.cos(a) * s * 0.42, it.y + Math.sin(a) * s * 0.42, s * 0.1 * (0.6 + 0.4 * Math.sin(gameTime * 8)));
    }
    if (it.type === 'composite' && it.state === 'idle') {
      // точки-индикатор: сколько нажатий осталось
      const left = compositeTaps(it.kind) - (it.hits || 0);
      for (let i = 0; i < left; i++) {
        ctx.beginPath();
        ctx.arc(it.x + (i - (left - 1) / 2) * 10, it.y - s * 0.55, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground();
    L.bins.forEach(drawBin);
    items.forEach(function (it) { if (it.state !== 'drag' && it.state !== 'carried') drawItem(it); });
    drawBeams();

    racs.forEach(function (rac) {
      ctx.save();
      ctx.translate(rac.x, rac.y);
      ctx.scale(rac.dir, 1);
      Draw.raccoon(ctx, L.size * 1.1, rac.t, rac.scared);
      ctx.restore();
      if (rac.carry) drawItem(rac.carry);
    });
    if (dog && run) {
      ctx.save();
      ctx.translate(dog.x, dog.y);
      ctx.scale(dog.dir, 1);
      Draw.dog(ctx, L.size * 1.15, dog.moving ? dog.t : 0, dog.chasing);
      ctx.restore();
    }
    if (truck) {
      ctx.save();
      ctx.translate(truck.x, truck.y);
      Draw.truck(ctx, L.size * 0.8, truck.tilt, truck.phase === 'dump' ? 0 : gameTime, paintColor());
      ctx.restore();
    }
    items.forEach(function (it) { if (it.state === 'carried') drawItem(it); });
    items.forEach(function (it) { if (it.state === 'drag') drawItem(it); });
    if (drag && drag.extras.length) {
      // Счётчик предметов в охапке.
      const bx = drag.it.x + L.size * 0.45, by = drag.it.y + L.size * 0.35;
      ctx.beginPath(); ctx.arc(bx, by, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#e8833a'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('×' + (drag.extras.length + 1), bx, by + 1);
    }

    particles.forEach(function (p) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    floaters.forEach(function (f) {
      const a = f.t < 0.85 ? 1 : 1 - (f.t - 0.85) / 0.35;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '800 ' + (f.small ? 15 : 22) + 'px system-ui, sans-serif';
      const y = f.y - f.t * 50;
      const half = ctx.measureText(f.text).width / 2 + 6;
      const x = clamp(f.x, half, W - half);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    });
    ctx.globalAlpha = 1;

    if (run && combo >= 2) {
      const pulse = 1 + 0.08 * Math.sin(gameTime * 12);
      ctx.save();
      ctx.translate(L.pile.x + L.pile.w / 2, L.pile.y + L.pile.h - 4);
      ctx.scale(pulse, pulse);
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.5)';
      const txt = t('combo', { n: (1 + Math.min(combo - 1, 10) * 0.1).toFixed(1) });
      ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = '#ffcf3d';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
  }

  // ================= HUD =================
  const SVG_SOUND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="white"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const SVG_SOUND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="white"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
  const SVG_PAUSE = '<svg viewBox="0 0 24 24" fill="white"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

  const hudCache = {};
  function setText(id, text) {
    if (hudCache[id] === text) return;
    hudCache[id] = text;
    $(id).textContent = text;
  }

  function buildPips() {
    const box = $('overflow-pips');
    box.innerHTML = '';
    for (let i = 0; i < OVERFLOW_MAX; i++) box.appendChild(el('span', 'pip'));
  }
  function flashOverflow() {
    const box = $('goals');
    box.classList.remove('flash');
    void box.offsetWidth;
    box.classList.add('flash');
  }

  function updateHUD() {
    setText('money', fmt(state.money));
    setText('stars', String(starsFree()));
    const goals = $('goals');
    if (run) {
      setText('day-label', t('day', { d: run.d }));
      const left = run.p.duration - run.time;
      setText('day-timer', fmtTime(left));
      $('day-timer').classList.toggle('warn', left <= 10);
      $('day-timer').classList.remove('hidden');
      goals.classList.remove('invisible');
      $('btn-pause').classList.remove('invisible');
      setText('quota-label', t('quota', { n: run.sorted, q: run.p.quota }));
      const pr = Math.min(1, run.sorted / run.p.quota);
      $('quota-progress').style.width = (pr * 100).toFixed(1) + '%';
      $('quota-progress').classList.toggle('done', pr >= 1);
      setText('pile-label', t('pile', { n: pileCount(), m: pileCap() }));
      $('pile-label').classList.toggle('warn', pileCount() >= pileCap());
      const pips = $('overflow-pips').children;
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < run.overflow);
    } else {
      setText('day-label', t('day', { d: state.day }));
      $('day-timer').classList.add('hidden');
      goals.classList.add('invisible');
      $('btn-pause').classList.add('invisible');
    }

    const hint = $('hint');
    let text = '';
    if (run && !currentModal) {
      if (!state.tips.drag && run.d === 1) text = t('hint_drag');
      else if (!state.tips.raccoon && activeRaccoons().length) text = t('hint_raccoon');
      else if (!state.tips.composite && items.some(function (i) { return i.type === 'composite' && i.state === 'idle'; })) text = t('hint_composite');
      else if (!state.tips.treasure && items.some(function (i) { return i.type === 'treasure' && i.state === 'idle'; })) text = t('hint_treasure');
    }
    if (text) { setText('hint', text); hint.classList.remove('hidden'); }
    else hint.classList.add('hidden');
  }

  function updateSoundIcon() { $('btn-sound').innerHTML = state.muted ? SVG_SOUND_OFF : SVG_SOUND_ON; }

  // ================= Модальные окна =================
  function openModal(opts) {
    if (currentModal) closeModal(true);
    pauseAdd('modal');
    const ov = el('div', 'overlay');
    const m = el('div', 'modal' + (opts.wide ? ' wide' : ''));
    if (opts.title) m.appendChild(el('h2', null, opts.title));
    if (opts.text) m.appendChild(el('p', null, opts.text));
    if (opts.content) m.appendChild(opts.content);
    if (opts.buttons && opts.buttons.length) {
      const actions = el('div', 'modal-actions');
      opts.buttons.forEach(function (b) {
        // Кнопки за рекламу скрываются, если реклама недоступна (блокировщик, площадка без рекламы).
        if (b.ad && !Platform.rewardedAvailable()) return;
        const btn = el('button', 'btn ' + (b.cls || 'btn-primary'));
        if (b.ad) btn.appendChild(el('span', 'ad-badge', 'AD'));
        btn.appendChild(document.createTextNode(b.label));
        btn.addEventListener('click', b.onClick);
        actions.appendChild(btn);
      });
      m.appendChild(actions);
    }
    ov.appendChild(m);
    $('modal-root').appendChild(ov);
    currentModal = { ov: ov };
    $('hint').classList.add('hidden');
  }

  function closeModal(keepPause) {
    if (!currentModal) return;
    currentModal.ov.remove();
    currentModal = null;
    if (!keepPause) pauseRemove('modal');
  }

  function openHub() {
    const box = el('div', 'hub');
    const next = STAGES[state.stage + 1];
    ensureQuests();
    box.appendChild(el('div', 'hub-stage', t('stage_label', { n: state.stage + 1, name: t('stage_' + state.stage) })));
    if (state.city > 1) box.appendChild(el('div', 'hub-city', t('city_label', { n: state.city, m: fmtMult(cityMult()) })));
    box.appendChild(el('div', 'hub-info', t('hub_text', { n: starsFree(), c: state.collection.length, m: COLLECTIBLES.length })));

    const p = dayParams(state.day);
    const preview = [t('preview_quota', { q: p.quota })];
    if (p.compositeChance) preview.push(t('preview_composite'));
    if (raccoonsActive()) preview.push(maxRaccoons() > 1 ? t('preview_raccoons_n', { n: maxRaccoons() }) : t('preview_raccoon'));
    box.appendChild(el('div', 'hub-preview', preview.join(' · ')));

    const start = el('button', 'btn btn-stage big', t('start_day', { d: state.day }));
    start.addEventListener('click', function () {
      if (state.day >= 3) Platform.showFullscreen(); // логическая пауза между днями
      closeModal();
      startDay();
    });
    box.appendChild(start);

    const row = el('div', 'hub-row');
    const shop = el('button', 'btn btn-primary', t('shop'));
    if (anyAffordable()) shop.appendChild(el('span', 'dot'));
    shop.addEventListener('click', openShop);
    row.appendChild(shop);
    const col = el('button', 'btn btn-ghost', t('collection_btn', { n: state.collection.length, m: COLLECTIBLES.length }));
    col.addEventListener('click', openCollection);
    row.appendChild(col);
    box.appendChild(row);

    const row2 = el('div', 'hub-row');
    if (questsActive()) {
      const q = el('button', 'btn btn-ghost', t('quests_btn', {
        n: state.quests.list.filter(function (x) { return x.progress >= x.target; }).length, m: state.quests.list.length
      }));
      if (questsReady()) q.appendChild(el('span', 'dot'));
      q.addEventListener('click', openQuests);
      row2.appendChild(q);
    }
    const dec = el('button', 'btn btn-ghost', t('decor') + ' ★' + starsFree());
    dec.addEventListener('click', openDecor);
    row2.appendChild(dec);
    box.appendChild(row2);

    if (next) {
      const ex = el('button', 'btn btn-gold', t('expand', { name: t('stage_' + (state.stage + 1)), cost: fmt(next.cost) }));
      ex.disabled = state.money < next.cost;
      ex.addEventListener('click', buyStage);
      box.appendChild(ex);
    } else {
      const mv = el('button', 'btn btn-gold', t('move_btn') + ' · ×' + fmtMult(1 + 0.5 * state.city));
      mv.addEventListener('click', openMove);
      box.appendChild(mv);
    }
    openModal({ title: t('hub_title'), content: box });
  }

  // ================= Магазин улучшений (вкладки + карточки) =================
  let shopTab = 'yard';

  /** Иконка карточки: маленький canvas с готовыми рисунками из draw.js. */
  function shopIcon(icon, mat) {
    return miniCanvas(46, function (c, px) {
      c.translate(px / 2, px / 2);
      if (icon === 'truck') { c.translate(px * 0.04, px * 0.08); Draw.truck(c, px * 0.26, 0, 0, paintColor()); }
      else if (icon === 'dog') { c.translate(-px * 0.06, px * 0.14); Draw.dog(c, px * 0.72, 0, false); }
      else if (icon === 'grab') {
        c.save(); c.translate(-px * 0.14, 0); c.rotate(-0.2); Draw.item(c, 'pbottle', px * 0.62, '#2f8fe0'); c.restore();
        c.save(); c.translate(px * 0.16, px * 0.04); c.rotate(0.2); Draw.item(c, 'pbottle', px * 0.62, '#e2453c'); c.restore();
      }
      else if (icon === 'mat') Draw.item(c, MATERIALS[mat].icon, px * 0.82, ICON_COLOR[mat]);
      else Draw.item(c, icon, px * (icon === 'tv' ? 0.7 : 0.82));
    });
  }

  /** Строка «сейчас → после покупки» для улучшения. */
  function upgEffect(u) {
    const l = state.upg[u.id];
    const r1 = function (x) { return String(Math.round(x * 100) / 100); };
    switch (u.id) {
      case 'pile': return t('eff_cap', { a: pileCap(), b: pileCap() + 2 });
      case 'truck': return t('eff_truck', { a: truckMin() + '–' + truckMax(), b: Math.max(1, truckMax() - 1) + '–' + (truckMax() + 1) });
      case 'dog': return l ? t('eff_dog', { a: l, b: l + 1 }) : t('eff_dog_new');
      case 'grab': return t('eff_grab', { a: grabCount(), b: grabCount() + 1 });
      case 'hands': return t('eff_hands', { a: 3 - l, b: Math.max(1, 3 - l - 1) });
      case 'value': return t('eff_mult', { a: r1(valueUpgMult()), b: r1(valueUpgMult() * 1.25) });
      case 'luck': return t('eff_luck', { a: Math.round(treasureChance() * 100), b: Math.round(treasureChance() * 100) + 1 });
      case 'disasm': return l ? t('eff_every', { a: disasmInterval(l).toFixed(1), b: disasmInterval(l + 1).toFixed(1) }) : '';
      default: return '';
    }
  }

  /** Полоска уровней; для кучи — уровни следующих этапов отмечены как закрытые. */
  function levelBar(u) {
    if (u.max > 20) return null;
    const bar = el('div', 'lvl-bar');
    const lvl = state.upg[u.id];
    const open = u.perStage ? u.perStage * (state.stage + 1) : u.max;
    for (let i = 0; i < u.max; i++) bar.appendChild(el('span', i < lvl ? 'on' : (i >= open ? 'lock' : '')));
    return bar;
  }

  function priceButton(cost, onBuy) {
    const btn = el('button', 'btn btn-stage price-btn');
    btn.appendChild(el('span', 'coin-s'));
    btn.appendChild(document.createTextNode(fmt(cost)));
    btn.disabled = state.money < cost;
    btn.addEventListener('click', function () {
      if (state.money < cost) return;
      state.money -= cost;
      onBuy();
      GameAudio.play('buy');
      save(false);
    });
    return btn;
  }

  /** Кнопка с ценой «монеты + материал»; label — подпись над ценой. */
  function costButton(cost, mat, onBuy, label) {
    const btn = el('button', 'btn btn-stage cost-btn');
    if (label) btn.appendChild(el('span', 'cost-label', label));
    const line = el('span', 'cost-line');
    line.appendChild(el('span', 'coin-s'));
    line.appendChild(document.createTextNode(fmt(cost.coins)));
    const chip = el('span', 'mat-chip', String(cost.mats));
    chip.style.background = MATERIALS[mat].color;
    line.appendChild(chip);
    btn.appendChild(line);
    btn.disabled = !canPay(cost, mat);
    btn.addEventListener('click', function () {
      if (!canPay(cost, mat)) return;
      state.money -= cost.coins;
      state.mats[mat] -= cost.mats;
      onBuy();
      GameAudio.play('buy');
      save(false);
    });
    return btn;
  }

  function lockedButton(text) {
    const b = el('button', 'btn btn-stage price-btn', text || '🔒');
    b.disabled = true;
    return b;
  }

  function upgradeCard(u, refresh) {
    const lvl = state.upg[u.id];
    const locked = upgLockReason(u);
    const maxed = lvl >= u.max;
    const card = el('div', 'card' + (locked ? ' locked' : ''));
    card.appendChild(shopIcon(u.icon));
    const body = el('div', 'card-body');
    const name = el('div', 'card-name', t('upg_' + u.id));
    name.appendChild(el('span', 'lvl-badge', u.max > 20 || !u.max ? t('level', { n: lvl }) : lvl + '/' + u.max));
    body.appendChild(name);
    body.appendChild(el('div', 'card-desc', locked || t('upg_' + u.id + '_d')));
    const eff = !locked && !maxed ? upgEffect(u) : '';
    if (eff) body.appendChild(el('div', 'card-eff', eff));
    const bar = levelBar(u);
    if (bar) body.appendChild(bar);
    card.appendChild(body);
    if (locked) card.appendChild(lockedButton());
    else if (maxed) card.appendChild(lockedButton(t('max')));
    else card.appendChild(priceButton(upgCost(u), function () {
      state.upg[u.id]++;
      if (u.id === 'pile') layout();
      refresh();
    }));
    return card;
  }

  function autoCard(m, refresh) {
    const a = state.auto[m];
    const card = el('div', 'card acard' + (autoLocked(m) ? ' locked' : ''));
    card.style.borderLeftColor = MATERIALS[m].color;
    const top = el('div', 'acard-top');
    top.appendChild(shopIcon('mat', m));
    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-name', t('mat_' + m)));
    let status;
    if (autoLocked(m)) status = t('locked_stage', { n: 2 });
    else if (!a.owned) status = t('auto_buy_d', { m: t('mat_acc_' + m) });
    else status = t('auto_status', { s: autoInterval(a.speed).toFixed(1), n: autoGrab(a.grab) });
    body.appendChild(el('div', 'card-desc', status));
    top.appendChild(body);
    if (autoLocked(m)) top.appendChild(lockedButton());
    else if (!a.owned) top.appendChild(costButton(autoBuyCost(m), m, function () { a.owned = true; refresh(); }, t('buy')));
    card.appendChild(top);

    if (a.owned && !autoLocked(m)) {
      const acts = el('div', 'acard-actions');
      if (a.speed >= AUTO_SPEED_MAX) {
        const b = lockedButton(t('auto_speed_cap') + ' · ' + t('max'));
        b.classList.add('cost-btn');
        acts.appendChild(b);
      } else {
        acts.appendChild(costButton(autoSpeedCost(a.speed), m, function () { a.speed++; refresh(); },
          t('auto_speed_btn', { a: autoInterval(a.speed).toFixed(1), b: autoInterval(a.speed + 1).toFixed(1) })));
      }
      acts.appendChild(costButton(autoGrabCost(a.grab), m, function () { a.grab++; refresh(); },
        t('auto_grab_btn', { a: autoGrab(a.grab), b: autoGrab(a.grab + 1) })));
      card.appendChild(acts);
    }
    return card;
  }

  function openShop() {
    const root = el('div', 'shop');
    const tabs = el('div', 'shop-tabs');
    const list = el('div', 'shop-list');
    root.appendChild(tabs);
    root.appendChild(list);

    function render(keepScroll) {
      const modal = root.closest('.modal');
      const scroll = modal ? modal.scrollTop : 0;
      tabs.innerHTML = '';
      SHOP_TABS.forEach(function (tab) {
        const b = el('button', 'shop-tab' + (tab === shopTab ? ' active' : ''), t('tab_' + tab));
        if (tabAffordable(tab)) b.appendChild(el('span', 'dot'));
        b.addEventListener('click', function () { shopTab = tab; render(false); });
        tabs.appendChild(b);
      });
      list.innerHTML = '';
      const refresh = function () { render(true); setText('money', fmt(state.money)); };
      if (shopTab === 'auto') {
        const bal = el('div', 'mats-balance');
        bal.appendChild(el('span', 'mats-hint', t('mats_collected_hint')));
        activeMaterials().forEach(function (m) {
          const c = el('span', 'mat-chip', t('mat_' + m) + ' ' + fmt(state.mats[m] || 0));
          c.style.background = MATERIALS[m].color;
          bal.appendChild(c);
        });
        list.appendChild(bal);
        ALL_BINS.forEach(function (m) { list.appendChild(autoCard(m, refresh)); });
      }
      UPGRADES.forEach(function (u) { if (u.tab === shopTab) list.appendChild(upgradeCard(u, refresh)); });
      if (modal) modal.scrollTop = keepScroll ? scroll : 0;
    }
    render(false);
    openModal({ title: t('shop'), content: root, wide: true, buttons: [{ label: t('back'), cls: 'btn-ghost', onClick: openHub }] });
  }

  function openCollection() {
    const box = el('div');
    box.appendChild(el('p', 'col-text', t('collection_text')));
    const grid = el('div', 'col-grid');
    COLLECTIBLES.forEach(function (kind) {
      const found = state.collection.indexOf(kind) >= 0;
      const cell = el('div', 'col-cell' + (found ? ' found' : ''));
      const cv = document.createElement('canvas');
      const px = 64, dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = px * dpr; cv.height = px * dpr;
      cv.style.width = px + 'px'; cv.style.height = px + 'px';
      const c = cv.getContext('2d');
      c.scale(dpr, dpr);
      c.translate(px / 2, px / 2);
      Draw.item(c, kind, px * 0.85);
      if (!found) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = 'rgba(20,14,10,.92)';
        c.fillRect(0, 0, cv.width, cv.height);
      }
      cell.appendChild(cv);
      cell.appendChild(el('div', 'col-name', found ? t('col_' + kind) : '???'));
      grid.appendChild(cell);
    });
    box.appendChild(grid);
    box.appendChild(el('div', 'hub-info', t('collection_bonus', { p: Math.round((collectionMult() - 1) * 100) })));
    openModal({ title: t('collection'), content: box, buttons: [{ label: t('back'), cls: 'btn-ghost', onClick: openHub }] });
  }

  function openPause() {
    if (!run || isPaused()) return;
    openModal({ title: t('pause'), buttons: [{ label: t('resume'), onClick: function () { closeModal(); } }] });
  }

  function buyStage() {
    const next = STAGES[state.stage + 1];
    if (!next || state.money < next.cost) return;
    state.money -= next.cost;
    state.stage++;
    layout();
    GameAudio.play('stage');
    save(true);
    const isFinal = state.stage === STAGES.length - 1;
    openModal({
      title: isFinal ? t('final_title') : t('stage_up_title', { name: t('stage_' + state.stage) }),
      text: t('stage_desc_' + state.stage),
      buttons: [{ label: t('continue'), onClick: openHub }]
    });
  }

  // ================= Офлайн-доход =================
  function offlineSum(savedAt) {
    if (!savedAt) return 0;
    const away = (Date.now() - savedAt) / 1000;
    if (away < 60) return 0;
    let rate = 0;
    activeMaterials().forEach(function (m) {
      const a = state.auto[m];
      if (a && a.owned) rate += MATERIALS[m].base * autoGrab(a.grab) / autoInterval(a.speed);
    });
    return Math.floor(Math.min(away, OFFLINE_CAP) * rate * valueMult() * 0.3);
  }

  function showOffline(sum) {
    openModal({
      title: t('offline_title'),
      text: t('offline_text', { sum: fmt(sum) }),
      buttons: [
        { label: t('take'), cls: 'btn-ghost', onClick: function () { addMoney(sum); continueStartup(); } },
        {
          label: t('take_x2'), cls: 'btn-ad', ad: true,
          onClick: function () {
            Platform.showRewarded(
              function () { addMoney(sum * 2); },
              function (rewarded) { if (!rewarded) addMoney(sum); continueStartup(); }
            );
          }
        }
      ]
    });
  }

  // ================= Общие помощники для мета-систем =================
  function todayKey(offsetDays) {
    // ?today=2026-11-20 подменяет дату для тестов
    const forced = Platform.isDev ? new URLSearchParams(location.search).get('today') : null;
    const d = forced ? new Date(forced + 'T12:00:00') : new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtMult(x) { return String(Math.round(x * 10) / 10); }
  function starsFree() { return Math.max(0, state.stars - state.starsSpent); }
  function rewardScale() { return STAGES[state.stage].mult * cityMult() * (1 + state.day * 0.08); }

  function miniCanvas(px, drawFn) {
    const cv = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = px * dpr; cv.height = px * dpr;
    cv.style.width = px + 'px'; cv.style.height = px + 'px';
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    drawFn(c, px);
    return cv;
  }

  // Очередь окон при запуске: офлайн-доход → награда за вход → перерыв.
  const startupQueue = [];
  function continueStartup() {
    const f = startupQueue.shift();
    if (f) f(); else openHub();
  }

  function giveFind() {
    const missing = COLLECTIBLES.filter(function (k) { return state.collection.indexOf(k) < 0; });
    if (missing.length) { state.collection.push(pick(missing)); GameAudio.play('star'); return true; }
    addMoney(Math.round(300 * rewardScale()));
    return false;
  }

  // ================= Награда за вход (7 дней) =================
  const DAILY_REWARDS = [{ coins: 1 }, { coins: 2 }, { stars: 2 }, { coins: 3 }, { coins: 4 }, { stars: 3 }, { find: true }];
  function dailyCoins(k) { return Math.round(50 * k * rewardScale()); }
  function dailyDue() { return state.daily.last !== todayKey(); }
  function dailyLabel(r) {
    if (r.coins) return fmt(dailyCoins(r.coins));
    if (r.stars) return '★' + r.stars;
    return t('reward_find');
  }

  function showDaily() {
    const today = todayKey();
    const streak = state.daily.last === todayKey(-1) ? (state.daily.streak + 1) % 7 : 0;
    const r = DAILY_REWARDS[streak];
    const box = el('div');
    box.appendChild(el('p', 'col-text', t('login_text')));
    const grid = el('div', 'cal-grid');
    DAILY_REWARDS.forEach(function (rw, i) {
      const cell = el('div', 'cal-cell' + (i < streak ? ' past' : '') + (i === streak ? ' today' : '') + (i === 6 ? ' big' : ''));
      cell.appendChild(el('div', null, t('login_day', { n: i + 1 })));
      cell.appendChild(el('div', 'cal-reward', dailyLabel(rw)));
      grid.appendChild(cell);
    });
    box.appendChild(grid);

    function grant(mult) {
      if (state.daily.last === today) return;
      state.daily = { streak: streak, last: today };
      if (r.coins) addMoney(dailyCoins(r.coins) * mult);
      if (r.stars) state.stars += r.stars * mult;
      if (r.find) giveFind();
      GameAudio.play('coin');
      save(true);
    }
    const buttons = [{ label: t('take'), cls: r.find ? 'btn-primary' : 'btn-ghost', onClick: function () { grant(1); continueStartup(); } }];
    if (!r.find) {
      buttons.push({
        label: t('take_x2'), cls: 'btn-ad', ad: true,
        onClick: function () {
          Platform.showRewarded(function () { grant(2); }, function () { grant(1); continueStartup(); });
        }
      });
    }
    openModal({ title: t('login_title'), content: box, buttons: buttons });
  }

  // ================= Ежедневные задания =================
  const QUEST_KINDS = ['sort_mat', 'sort_any', 'grab', 'raccoon', 'composite', 'treasure', 'combo', 'stars3'];
  function questAvailable(k) {
    if (k === 'grab') return state.upg.grab > 0;
    if (k === 'raccoon') return raccoonsActive();
    if (k === 'composite') return state.day >= 3;
    return true;
  }
  function questTarget(k) {
    const d = state.day;
    switch (k) {
      case 'sort_mat': return Math.min(80, 15 + d * 2);
      case 'sort_any': return Math.min(250, 40 + d * 5);
      case 'grab': return Math.min(100, 20 + d * 2);
      case 'raccoon': return Math.min(10, 3 + Math.floor(d / 4));
      case 'composite': return Math.min(20, 4 + Math.floor(d / 2));
      case 'treasure': return 2;
      default: return 1;
    }
  }
  function questsActive() { return state.day >= 2; }
  function ensureQuests() {
    if (!questsActive()) return;
    const today = todayKey();
    if (state.quests.date === today && state.quests.list.length) return;
    const pool = QUEST_KINDS.filter(questAvailable);
    const list = [];
    while (list.length < 3 && pool.length) {
      const k = pool.splice((Math.random() * pool.length) | 0, 1)[0];
      const q = { kind: k, target: questTarget(k), progress: 0, claimed: false, reward: Math.round(40 * rewardScale()) };
      if (k === 'sort_mat') q.mat = pick(activeMaterials());
      list.push(q);
    }
    state.quests = { date: today, list: list, bonusClaimed: false };
  }
  function questProgress(kind, n, mat) {
    if (state.quests.date !== todayKey()) return;
    state.quests.list.forEach(function (q) {
      if (q.kind !== kind || q.progress >= q.target) return;
      if (kind === 'sort_mat' && q.mat !== mat) return;
      q.progress = Math.min(q.target, q.progress + n);
      if (q.progress >= q.target) {
        say(W / 2, L.pile.y + L.size * 0.4, t('quest_done'), '#7dff9a');
        GameAudio.play('star');
      }
    });
  }
  function questName(q) {
    if (q.kind === 'sort_mat') return t('q_sort_mat', { m: t('mat_' + q.mat), n: q.target });
    return t('q_' + q.kind, { n: q.target });
  }
  function questsAllClaimed() { return state.quests.list.length && state.quests.list.every(function (q) { return q.claimed; }); }
  function questsReady() {
    let n = state.quests.list.filter(function (q) { return q.progress >= q.target && !q.claimed; }).length;
    if (questsAllClaimed() && !state.quests.bonusClaimed) n++;
    return n;
  }
  function questsBonusCoins() { return Math.round(120 * rewardScale()); }

  function openQuests() {
    ensureQuests();
    const box = el('div');
    box.appendChild(el('p', 'col-text', t('quests_text')));
    state.quests.list.forEach(function (q) {
      const done = q.progress >= q.target;
      const row = el('div', 'quest' + (done ? ' done' : ''));
      const info = el('div', 'quest-info');
      info.appendChild(el('div', 'quest-name', questName(q)));
      info.appendChild(el('div', 'quest-reward', '+' + fmt(q.reward)));
      const bar = el('div', 'progress');
      const fill = el('div');
      fill.style.width = (q.progress / q.target * 100).toFixed(1) + '%';
      bar.appendChild(fill);
      info.appendChild(bar);
      row.appendChild(info);
      const btn = el('button', 'btn btn-stage');
      if (q.claimed) { btn.textContent = t('quest_claimed'); btn.disabled = true; }
      else if (done) {
        btn.textContent = t('take');
        btn.addEventListener('click', function () { q.claimed = true; addMoney(q.reward); GameAudio.play('coin'); openQuests(); });
      } else { btn.textContent = q.progress + '/' + q.target; btn.disabled = true; }
      row.appendChild(btn);
      box.appendChild(row);
    });
    const bonus = questsBonusCoins();
    box.appendChild(el('div', 'quest-bonus', t('quests_bonus', { s: 2, c: fmt(bonus) })));

    const buttons = [{ label: t('back'), cls: 'btn-ghost', onClick: openHub }];
    if (questsAllClaimed() && !state.quests.bonusClaimed) {
      const grantBonus = function (mult) {
        if (state.quests.bonusClaimed) return;
        state.quests.bonusClaimed = true;
        state.stars += 2;
        addMoney(bonus * mult);
        GameAudio.play('stage');
      };
      buttons.push({ label: t('take'), cls: 'btn-primary', onClick: function () { grantBonus(1); openQuests(); } });
      buttons.push({
        label: t('bonus_x2'), cls: 'btn-ad', ad: true,
        onClick: function () { Platform.showRewarded(function () { grantBonus(2); }, function () { grantBonus(1); openQuests(); }); }
      });
    }
    openModal({ title: t('quests'), content: box, buttons: buttons });
  }

  // ================= Престиж «Новый город» =================
  function openMove() {
    const next = 1 + 0.5 * state.city;
    const box = el('div');
    box.appendChild(el('p', null, t('move_text', { m: fmtMult(next) })));
    box.appendChild(el('div', 'sum-line warn', t('move_lose')));
    box.appendChild(el('div', 'sum-line gold', t('move_keep')));
    openModal({
      title: t('move_title'), content: box,
      buttons: [
        { label: t('cancel'), cls: 'btn-ghost', onClick: openHub },
        { label: t('move_confirm'), cls: 'btn-gold', onClick: doMove }
      ]
    });
  }

  function doMove() {
    if (state.stage < STAGES.length - 1) return;
    state.city++;
    state.money = 0;
    state.stage = 0;
    state.day = 1;
    UPGRADES.forEach(function (u) { state.upg[u.id] = 0; });
    resetAutomation();
    dog = null;
    layout();
    save(true);
    GameAudio.play('stage');
    openModal({
      title: t('moved_title', { n: state.city }),
      text: t('moved_text', { m: fmtMult(cityMult()) }),
      buttons: [{ label: t('continue'), onClick: openHub }]
    });
  }

  // ================= Декор за звёзды =================
  const PAINTS = [
    { id: 'green', color: '#6f8f3a', cost: 0 },
    { id: 'blue', color: '#3b7fd1', cost: 10 },
    { id: 'red', color: '#d64541', cost: 15 },
    { id: 'gold', color: '#d4a017', cost: 30 }
  ];
  const DECOR_ITEMS = [
    { id: 'fence', cost: 5 }, { id: 'flowers', cost: 8 }, { id: 'lamp', cost: 12 },
    { id: 'flag', cost: 15 }, { id: 'cat', cost: 20 }, { id: 'gnome', cost: 25 }
  ];
  function paintColor() {
    const p = PAINTS.find(function (x) { return x.id === state.decor.paint; });
    return p ? p.color : PAINTS[0].color;
  }
  function hasDecor(id) { return state.decor.owned.indexOf(id) >= 0; }

  function decorButton(owned, active, cost, onBuy, onSelect) {
    const btn = el('button', 'btn ' + (owned ? 'btn-ghost' : 'btn-gold'));
    if (owned) {
      btn.textContent = active ? t('selected') : (onSelect ? t('select') : t('owned'));
      btn.disabled = active || !onSelect;
      if (onSelect && !active) btn.addEventListener('click', onSelect);
    } else {
      btn.textContent = '★ ' + cost;
      btn.disabled = starsFree() < cost;
      btn.addEventListener('click', function () {
        if (starsFree() < cost) return;
        state.starsSpent += cost;
        onBuy();
        GameAudio.play('buy');
        save(true);
        openDecor();
      });
    }
    return btn;
  }

  function openDecor() {
    const box = el('div');
    box.appendChild(el('p', 'col-text', t('decor_text', { n: starsFree() })));

    box.appendChild(el('div', 'group-title', t('decor_paint')));
    const g1 = el('div', 'decor-grid paints');
    PAINTS.forEach(function (p) {
      const owned = state.decor.paints.indexOf(p.id) >= 0;
      const cell = el('div', 'decor-cell' + (owned ? ' owned' : ''));
      cell.appendChild(miniCanvas(64, function (c, px) {
        c.translate(px * 0.53, px * 0.6);
        Draw.truck(c, px * 0.4, 0, 0, p.color);
      }));
      cell.appendChild(el('div', 'decor-name', t('paint_' + p.id)));
      cell.appendChild(decorButton(owned, state.decor.paint === p.id, p.cost,
        function () { state.decor.paints.push(p.id); state.decor.paint = p.id; },
        function () { state.decor.paint = p.id; save(false); openDecor(); }));
      g1.appendChild(cell);
    });
    box.appendChild(g1);

    box.appendChild(el('div', 'group-title', t('decor_items')));
    const g2 = el('div', 'decor-grid');
    DECOR_ITEMS.forEach(function (d) {
      const owned = hasDecor(d.id);
      const cell = el('div', 'decor-cell' + (owned ? ' owned' : ''));
      cell.appendChild(miniCanvas(72, function (c, px) {
        c.translate(px * 0.5, px * 0.88);
        Draw.decor(c, d.id, px * 0.6, 0);
      }));
      cell.appendChild(el('div', 'decor-name', t('deco_' + d.id)));
      cell.appendChild(decorButton(owned, false, d.cost, function () { state.decor.owned.push(d.id); }, null));
      g2.appendChild(cell);
    });
    box.appendChild(g2);
    openModal({ title: t('decor'), content: box, wide: true, buttons: [{ label: t('back'), cls: 'btn-ghost', onClick: openHub }] });
  }

  /** Украшения на поле: по углам кучи и вдоль дороги, под мусором. */
  function drawDecor() {
    const s = L.size * 0.8, p = L.pile, tt = gameTime;
    const at = function (id, x, y, size) {
      if (!hasDecor(id)) return;
      ctx.save(); ctx.translate(x, y); Draw.decor(ctx, id, size || s, tt); ctx.restore();
    };
    if (hasDecor('fence')) {
      const fs = L.size * 0.55, y = L.truckY + L.size * 0.62;
      for (let x = fs / 2; x < W; x += fs) { ctx.save(); ctx.translate(x, y); Draw.decor(ctx, 'fence', fs, tt); ctx.restore(); }
    }
    at('cat', p.x + s * 0.5, p.y + s * 0.35);
    at('flag', p.x + p.w - s * 0.45, p.y + s * 0.95);
    at('gnome', p.x + s * 0.25, p.y + p.h * 0.6);
    at('lamp', p.x + s * 0.2, p.y + p.h);
    at('flowers', p.x + p.w - s * 0.55, p.y + p.h);
  }

  // ================= Сохранение =================
  function serialize() {
    return {
      v: 2,
      money: state.money, total: state.total, stage: state.stage, day: state.day, stars: state.stars,
      upg: Object.assign({}, state.upg), collection: state.collection.slice(),
      muted: state.muted, tips: Object.assign({}, state.tips),
      city: state.city, starsSpent: state.starsSpent,
      decor: JSON.parse(JSON.stringify(state.decor)),
      daily: Object.assign({}, state.daily),
      quests: JSON.parse(JSON.stringify(state.quests)),
      mats: Object.assign({}, state.mats),
      auto: JSON.parse(JSON.stringify(state.auto)),
      savedAt: Date.now()
    };
  }

  function applySave(d) {
    if (!d || typeof d !== 'object') return;
    const num = function (v, def) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : def; };
    state.money = num(d.money, 0);
    state.total = num(d.total, 0);
    state.stage = clamp(Math.floor(num(d.stage, 0)), 0, STAGES.length - 1);
    state.day = Math.max(1, Math.floor(num(d.day, 1)));
    state.stars = Math.floor(num(d.stars, 0));
    if (d.upg && typeof d.upg === 'object') {
      UPGRADES.forEach(function (u) { state.upg[u.id] = clamp(Math.floor(num(d.upg[u.id], 0)), 0, u.max); });
    }
    ALL_BINS.forEach(function (m) {
      if (d.mats && typeof d.mats === 'object') state.mats[m] = Math.floor(num(d.mats[m], 0));
      const a = d.auto && d.auto[m];
      if (a && typeof a === 'object') {
        state.auto[m] = { owned: !!a.owned, speed: Math.floor(num(a.speed, 0)), grab: Math.floor(num(a.grab, 0)) };
      } else if (d.upg && num(d.upg['auto_' + m], 0) > 0) {
        // Перенос со старой системы: купленный автосортер, уровни → скорость.
        state.auto[m] = { owned: true, speed: Math.floor(d.upg['auto_' + m]) - 1, grab: 0 };
      }
    });
    if (Array.isArray(d.collection)) state.collection = d.collection.filter(function (k) { return COLLECTIBLES.indexOf(k) >= 0; });
    state.muted = !!d.muted;
    if (d.tips && typeof d.tips === 'object') Object.keys(state.tips).forEach(function (k) { state.tips[k] = !!d.tips[k]; });
    state.city = Math.max(1, Math.floor(num(d.city, 1)));
    state.starsSpent = Math.min(state.stars, Math.floor(num(d.starsSpent, 0)));
    if (d.decor && typeof d.decor === 'object') {
      const ids = DECOR_ITEMS.map(function (x) { return x.id; }), pids = PAINTS.map(function (x) { return x.id; });
      if (Array.isArray(d.decor.owned)) state.decor.owned = d.decor.owned.filter(function (k) { return ids.indexOf(k) >= 0; });
      if (Array.isArray(d.decor.paints)) state.decor.paints = ['green'].concat(d.decor.paints.filter(function (k) { return k !== 'green' && pids.indexOf(k) >= 0; }));
      if (state.decor.paints.indexOf(d.decor.paint) >= 0) state.decor.paint = d.decor.paint;
    }
    if (d.daily && typeof d.daily === 'object') {
      state.daily = { streak: clamp(Math.floor(num(d.daily.streak, 0)), 0, 6), last: typeof d.daily.last === 'string' ? d.daily.last : '' };
    }
    if (d.quests && typeof d.quests === 'object' && Array.isArray(d.quests.list)) {
      state.quests = {
        date: typeof d.quests.date === 'string' ? d.quests.date : '',
        bonusClaimed: !!d.quests.bonusClaimed,
        list: d.quests.list.filter(function (q) { return q && QUEST_KINDS.indexOf(q.kind) >= 0; }).map(function (q) {
          return { kind: q.kind, mat: q.mat, target: Math.max(1, num(q.target, 1)), progress: num(q.progress, 0), claimed: !!q.claimed, reward: num(q.reward, 0) };
        })
      };
    }
  }

  function save(important) { Platform.saveData(serialize(), { force: important, flush: important }); }

  // ================= Цикл =================
  let last = 0;
  function loop(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!isPaused()) update(dt);
    updateEffects(dt);
    render();
    hudTimer += dt;
    if (hudTimer >= 0.1) { hudTimer = 0; updateHUD(); }
    requestAnimationFrame(loop);
  }

  // ================= Запуск =================
  function bindEvents() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('selectstart', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    document.addEventListener('pointerdown', function () { GameAudio.unlock(); }, true);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { pauseAdd('hidden'); save(true); }
      else pauseRemove('hidden');
    });
    window.addEventListener('blur', function () { GameAudio.setBlurred(true); });
    window.addEventListener('focus', function () { GameAudio.setBlurred(false); });
    window.addEventListener('pagehide', function () { save(true); });

    Platform.on('game_api_pause', function () { pauseAdd('platform'); });
    Platform.on('game_api_resume', function () { pauseRemove('platform'); });
    Platform.hooks.adStart = function () { pauseAdd('ad'); };
    Platform.hooks.adEnd = function () { pauseRemove('ad'); };

    $('btn-pause').addEventListener('click', openPause);
    $('btn-sound').addEventListener('click', function () {
      state.muted = !state.muted;
      GameAudio.setMuted(state.muted);
      updateSoundIcon();
      save(false);
    });
  }

  async function boot() {
    await Platform.init();
    I18N.setLang(Platform.lang);
    $('overflow-label').textContent = t('overflow');
    $('btn-pause').innerHTML = SVG_PAUSE;

    const data = await Platform.loadData();
    applySave(data);
    GameAudio.setMuted(state.muted);
    updateSoundIcon();
    buildPips();
    updateHUD();
    layout();
    bindEvents();

    $('loading').classList.add('hidden');
    requestAnimationFrame(loop);
    Platform.ready();

    const off = offlineSum(data && data.savedAt);
    const returning = state.day > 1 || state.total > 0;
    if (off > 0) startupQueue.push(function () { showOffline(off); });
    // Новичку календарь не показываем до первого возвращения в игру.
    if (returning && dailyDue()) startupQueue.push(showDaily);
    if (startupQueue.length) continueStartup();
    else if (returning) openHub();
    pauseRemove('loading');
    if (!currentModal) startDay();

    if (Platform.isDev && new URLSearchParams(location.search).get('debug') === '1') {
      window.__junk = {
        state: state, pauseReasons: pauseReasons,
        items: function () { return items; }, run: function () { return run; },
        racs: function () { return racs; }, dog: function () { return dog; },
        endDay: endDay, openHub: openHub,
        // Прокрутить игровое время вперёд (для тестов, даже если вкладка скрыта).
        step: function (sec) {
          pauseReasons.delete('hidden');
          for (let tt = 0; tt < sec; tt += 0.05) { if (!isPaused()) update(0.05); updateEffects(0.05); }
          render(); updateHUD();
        },
        sortAll: function () {
          items.slice().forEach(function (it) {
            if (it.state !== 'idle') return;
            if (it.type === 'composite') { dismantle(it, false); return; }
            if (it.type === 'treasure') { collectTreasure(it); return; }
            const b = binFor(it.type); if (b) sortCorrect(it, b);
          });
        }
      };
    }
  }

  boot();
})();
