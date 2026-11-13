/*
 * Platform — единый интерфейс игры к игровой площадке.
 *
 * Площадка задаётся в index.html: window.GAME_PLATFORM = 'pikabu' | 'yandex' | 'local'.
 * Сборка (tools/build.py) подставляет нужное значение и тег SDK.
 *
 *  - pikabu: Пикабу Игры (https://games.pikabu.ru/sdk/docs/), PkbSDK.
 *  - yandex: Яндекс Игры, YaGames.
 *  - local:  разработка без площадки — заглушки, тестовая реклама, отладочные параметры в адресе.
 *
 * Если SDK площадки не загрузился (блокировщик рекламы, сеть), игра продолжает работать
 * без рекламы и с сохранениями в localStorage.
 */
(function () {
  'use strict';

  const SAVE_KEY = 'junkyard_save_v2';
  const CLOUD_MIN_INTERVAL = 20000; // мс; лимит обеих площадок — около 100 сохранений за 5 минут
  const PLATFORM = (window.GAME_PLATFORM || 'local').toLowerCase();

  const P = {
    platform: PLATFORM,
    isDev: PLATFORM === 'local',
    ready_: false,
    lang: 'ru',
    // Игра подменяет эти хуки, чтобы ставить паузу на время рекламы.
    hooks: { adStart: function () {}, adEnd: function () {} },
    _gp: false,
    _lastCloud: 0
  };

  let adapter = null;

  function log() {
    if (!P.isDev) return;
    const args = Array.prototype.slice.call(arguments);
    args.unshift('[Platform ' + PLATFORM + ']');
    console.log.apply(console, args);
  }

  function once(fn) {
    let done = false;
    return function () {
      if (done) return;
      done = true;
      if (fn) fn.apply(null, arguments);
    };
  }

  function loadScript(src, timeout) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      const timer = setTimeout(function () { reject(new Error('timeout')); }, timeout);
      s.onload = function () { clearTimeout(timer); resolve(); };
      s.onerror = function () { clearTimeout(timer); reject(new Error('load error')); };
      document.head.appendChild(s);
    });
  }

  /** Ждём появления глобального объекта SDK (тег подключён в index.html с async). */
  function waitGlobal(name, timeout) {
    return new Promise(function (resolve, reject) {
      const t0 = Date.now();
      (function check() {
        if (typeof window[name] !== 'undefined') return resolve(window[name]);
        if (Date.now() - t0 > timeout) return reject(new Error(name + ' not loaded'));
        setTimeout(check, 50);
      })();
    });
  }

  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () { reject(new Error(message)); }, ms);
      Promise.resolve(promise).then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  function urlParam(name) {
    // Отладочные параметры адреса работают только при разработке.
    if (!P.isDev) return null;
    return new URLSearchParams(location.search).get(name);
  }

  // ================= Адаптер: Пикабу Игры =================
  const pikabu = {
    sdk: null,
    async init() {
      const PkbSDK = await waitGlobal('PkbSDK', 6000);
      // Вне площадки init() может не ответить никогда — ограничиваем ожидание.
      this.sdk = await withTimeout(PkbSDK.init(), 5000, 'PkbSDK.init timeout');
      P.lang = 'ru'; // требование площадки: русский язык по умолчанию
    },
    ready() { if (this.sdk) this.sdk.gameStarted(); },
    gameplayStart() {}, // у Пикабу нет разметки геймплея
    gameplayStop() {},
    on() {},
    rewardedAvailable() {
      try { return !!(this.sdk && this.sdk.ads && this.sdk.ads.rewarded && this.sdk.ads.rewarded.isSupported); }
      catch (e) { return false; }
    },
    async showFullscreen() {
      const ad = this.sdk && this.sdk.ads && this.sdk.ads.fullscreen;
      if (!ad || !ad.isSupported) return;
      if (!(await Promise.resolve(ad.canShow()))) return; // кулдаун 120 с и т.п. — просто пропускаем
      await ad.show();
    },
    async showRewarded() {
      const ad = this.sdk && this.sdk.ads && this.sdk.ads.rewarded;
      if (!ad || !ad.isSupported) return false;
      if (!(await Promise.resolve(ad.canShow()))) return false;
      const res = await ad.show();
      return !!(res && res.reward === true); // награда только при reward === true
    },
    async cloudLoad() {
      if (!this.sdk || !this.sdk.storage) return null;
      const raw = await Promise.resolve(this.sdk.storage.get(SAVE_KEY));
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    },
    cloudSave(data, flush) {
      if (!this.sdk || !this.sdk.storage) return;
      Promise.resolve(this.sdk.storage.set(SAVE_KEY, JSON.stringify(data)))
        .then(function () { if (flush && pikabu.sdk.storage.flush) return pikabu.sdk.storage.flush(); })
        .catch(function () {});
    }
  };

  // ================= Адаптер: Яндекс Игры =================
  const yandex = {
    ysdk: null,
    player: null,
    async init() {
      // На хостинге Яндекса SDK доступен по относительному пути /sdk.js.
      if (typeof YaGames === 'undefined') await loadScript('/sdk.js', 5000);
      this.ysdk = await withTimeout(YaGames.init(), 5000, 'YaGames.init timeout');
      try { P.lang = this.ysdk.environment.i18n.lang; } catch (e) { /* ignore */ }
      try { this.player = await this.ysdk.getPlayer(); } catch (e) { this.player = null; }
    },
    ready() {
      const f = this.ysdk && this.ysdk.features;
      if (f && f.LoadingAPI) f.LoadingAPI.ready();
    },
    gameplayStart() {
      const f = this.ysdk && this.ysdk.features;
      if (f && f.GameplayAPI) f.GameplayAPI.start();
    },
    gameplayStop() {
      const f = this.ysdk && this.ysdk.features;
      if (f && f.GameplayAPI) f.GameplayAPI.stop();
    },
    on(event, cb) { if (this.ysdk && this.ysdk.on) this.ysdk.on(event, cb); },
    rewardedAvailable() { return !!this.ysdk; },
    showFullscreen() {
      const ysdk = this.ysdk;
      return new Promise(function (resolve) {
        ysdk.adv.showFullscreenAdv({ callbacks: { onClose: resolve, onError: resolve } });
      });
    },
    showRewarded() {
      const ysdk = this.ysdk;
      return new Promise(function (resolve) {
        let rewarded = false;
        ysdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: function () { rewarded = true; },
            onClose: function () { resolve(rewarded); },
            onError: function () { resolve(rewarded); }
          }
        });
      });
    },
    async cloudLoad() {
      if (!this.player) return null;
      const d = await this.player.getData();
      return d && d.savedAt ? d : null;
    },
    cloudSave(data, flush) {
      if (!this.player) return;
      try { this.player.setData(data, !!flush).catch(function () {}); } catch (e) { /* ignore */ }
    }
  };

  // ================= Адаптер: локальная разработка =================
  const local = {
    async init() {
      P.lang = (navigator.language || 'ru').slice(0, 2);
    },
    ready() {}, gameplayStart() {}, gameplayStop() {}, on() {},
    rewardedAvailable() { return true; },
    showFullscreen() { return new Promise(function (resolve) { mockAd(false, resolve); }); },
    showRewarded() { return new Promise(function (resolve) { mockAd(true, resolve); }); },
    async cloudLoad() { return null; },
    cloudSave() {}
  };

  /** Тестовая «реклама» — только для локальной разработки. resolve(rewarded). */
  function mockAd(isRewarded, resolve) {
    const ov = document.createElement('div');
    ov.className = 'mock-ad';
    const box = document.createElement('div');
    box.className = 'mock-ad-box';
    const title = document.createElement('div');
    title.className = 'mock-ad-title';
    title.textContent = t('ad_mock');
    const timer = document.createElement('div');
    timer.className = 'mock-ad-timer';
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = t('close');
    btn.disabled = true;
    box.appendChild(title); box.appendChild(timer); box.appendChild(btn);
    ov.appendChild(box);
    document.body.appendChild(ov);

    let n = isRewarded ? 3 : 2;
    let rewarded = false;
    timer.textContent = n;
    const iv = setInterval(function () {
      n--;
      if (n > 0) { timer.textContent = n; return; }
      clearInterval(iv);
      timer.textContent = isRewarded ? '✓' : '';
      if (isRewarded) { title.textContent = t('ad_reward_ok'); rewarded = true; }
      btn.disabled = false;
    }, 1000);
    btn.addEventListener('click', function () { ov.remove(); resolve(rewarded); });
  }

  // ================= Общий интерфейс =================
  P.init = async function () {
    const chosen = PLATFORM === 'pikabu' ? pikabu : PLATFORM === 'yandex' ? yandex : local;
    try {
      await chosen.init();
      adapter = chosen;
      P.ready_ = true;
    } catch (e) {
      // SDK площадки недоступен: играем без рекламы и облака.
      console.warn('[Platform] SDK недоступен, игра работает без площадки:', e && e.message);
      adapter = null;
    }
    const forced = urlParam('lang');
    if (forced) P.lang = forced;
    log('init, lang =', P.lang, 'sdk ok =', P.ready_);
  };

  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

  P.ready = function () { if (adapter) safe(function () { adapter.ready(); }); log('ready'); };

  P.gameplayStart = function () {
    if (P._gp) return;
    P._gp = true;
    if (adapter) safe(function () { adapter.gameplayStart(); });
    log('gameplay start');
  };
  P.gameplayStop = function () {
    if (!P._gp) return;
    P._gp = false;
    if (adapter) safe(function () { adapter.gameplayStop(); });
    log('gameplay stop');
  };

  P.on = function (event, cb) { if (adapter) safe(function () { adapter.on(event, cb); }); };

  /** Можно ли сейчас предлагать рекламу за награду (иначе кнопки «AD» скрываются). */
  P.rewardedAvailable = function () {
    if (!adapter) return false;
    return !!safe(function () { return adapter.rewardedAvailable(); });
  };

  /** Полноэкранная реклама. Игра на паузе до завершения; done() вызывается ровно один раз. */
  P.showFullscreen = function (done) {
    const finish = once(function () { P.hooks.adEnd(); if (done) done(); });
    if (!adapter) { if (done) done(); return; }
    P.hooks.adStart();
    log('fullscreen ad');
    Promise.resolve().then(function () { return adapter.showFullscreen(); })
      .then(finish, finish);
  };

  /**
   * Реклама за вознаграждение.
   * onReward() — когда просмотр засчитан; done(rewarded) — после закрытия (ровно один раз).
   */
  P.showRewarded = function (onReward, done) {
    const finish = once(function (rewarded) {
      P.hooks.adEnd();
      if (rewarded && onReward) onReward();
      if (done) done(!!rewarded);
    });
    if (!adapter) { if (done) done(false); return; }
    P.hooks.adStart();
    log('rewarded ad');
    Promise.resolve().then(function () { return adapter.showRewarded(); })
      .then(function (r) { finish(r); }, function () { finish(false); });
  };

  // ---------- Сохранения ----------
  P.loadData = async function () {
    if (urlParam('reset') === '1') {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      log('save reset');
      return null;
    }
    let localData = null;
    try { localData = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { localData = null; }
    let cloud = null;
    if (adapter) {
      try { cloud = await adapter.cloudLoad(); } catch (e) { cloud = null; }
      if (cloud && !cloud.savedAt) cloud = null;
    }
    if (localData && cloud) return (cloud.savedAt > localData.savedAt) ? cloud : localData;
    return cloud || localData;
  };

  P.saveData = function (data, opts) {
    opts = opts || {};
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    if (!adapter) return;
    const now = Date.now();
    if (opts.force || now - P._lastCloud >= CLOUD_MIN_INTERVAL) {
      P._lastCloud = now;
      safe(function () { adapter.cloudSave(data, !!opts.flush); });
    }
  };

  window.Platform = P;
})();
