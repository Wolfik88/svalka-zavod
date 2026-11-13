/* Процедурная отрисовка: предметы, мусоровоз, енот, автоматы. Всё рисуется кодом. */
(function () {
  'use strict';

  const PI2 = Math.PI * 2;

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  function outline(ctx, s, color, k) {
    ctx.lineWidth = Math.max(1.5, s * (k || 0.035));
    ctx.strokeStyle = color || 'rgba(0,0,0,.35)';
    ctx.stroke();
  }

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); }

  /** Блики стекла: две белые полосы и точка — главный признак «это стекло». */
  function glassGlare(ctx, x, y, h, s) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    rr(ctx, x, y, s * 0.045, h, s * 0.02); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    rr(ctx, x + s * 0.07, y + h * 0.1, s * 0.025, h * 0.55, s * 0.012); ctx.fill();
  }

  const K = {
    // ================= МЕТАЛЛ =================
    can: function (ctx, s) {
      const w = s * 0.46, h = s * 0.7;
      rr(ctx, -w / 2, -h / 2, w, h, s * 0.08);
      ctx.fillStyle = '#aab4be'; ctx.fill(); outline(ctx, s, '#5d6873');
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = s * 0.025;
      for (let i = 1; i < 4; i++) {
        const y = -h / 2 + h * i / 4;
        ctx.beginPath(); ctx.moveTo(-w / 2 + 2, y); ctx.lineTo(w / 2 - 2, y); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(-w / 2 + w * 0.15, -h / 2 + h * 0.1, w * 0.12, h * 0.8);
    },
    gear: function (ctx, s) {
      const R = s * 0.42, r = s * 0.31, n = 8;
      ctx.beginPath();
      for (let k = 0; k < n * 4; k++) {
        const a = k * PI2 / (n * 4);
        const rad = (k % 4 < 2) ? R : r;
        if (k === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fillStyle = '#86929e'; ctx.fill(); outline(ctx, s, '#4f5964');
      circle(ctx, 0, 0, s * 0.12); ctx.fillStyle = '#3d454d'; ctx.fill();
    },
    pipe: function (ctx, s) {
      const w = s * 0.84, h = s * 0.26;
      rr(ctx, -w / 2, -h / 2, w, h, s * 0.04);
      ctx.fillStyle = '#9aa5b0'; ctx.fill(); outline(ctx, s, '#56616c');
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(-w / 2 + 4, -h / 2 + h * 0.18, w - 8, h * 0.18);
      [-w / 2, w / 2].forEach(function (x) {
        ctx.beginPath(); ctx.ellipse(x, 0, s * 0.05, h * 0.62, 0, 0, PI2);
        ctx.fillStyle = '#6f7a85'; ctx.fill();
      });
    },

    // ================= ПЛАСТИК: яркий, непрозрачный, мятый =================
    pbottle: function (ctx, s, c) {
      c = c || '#2f8fe0';
      const w = s * 0.44;
      ctx.beginPath();
      ctx.moveTo(-s * 0.075, -s * 0.34);
      ctx.lineTo(s * 0.075, -s * 0.34);
      ctx.quadraticCurveTo(w / 2, -s * 0.3, w / 2, -s * 0.14);
      ctx.lineTo(w * 0.32, s * 0.0);           // вмятина справа
      ctx.lineTo(w / 2, s * 0.12);
      ctx.lineTo(w / 2, s * 0.3);
      ctx.quadraticCurveTo(w / 2, s * 0.37, w / 2 - s * 0.06, s * 0.37);
      ctx.lineTo(-w / 2 + s * 0.06, s * 0.37);
      ctx.quadraticCurveTo(-w / 2, s * 0.37, -w / 2, s * 0.3);
      ctx.lineTo(-w / 2, s * 0.04);
      ctx.lineTo(-w * 0.36, -s * 0.06);         // вмятина слева
      ctx.lineTo(-w / 2, -s * 0.14);
      ctx.quadraticCurveTo(-w / 2, -s * 0.3, -s * 0.075, -s * 0.34);
      ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); outline(ctx, s, shade(c, -0.5), 0.045);
      // рёбра
      ctx.strokeStyle = shade(c, -0.25); ctx.lineWidth = s * 0.03;
      [0.2, 0.28].forEach(function (y) {
        ctx.beginPath(); ctx.moveTo(-w / 2 + s * 0.04, s * y); ctx.lineTo(w / 2 - s * 0.04, s * y); ctx.stroke();
      });
      // складки от сминания
      ctx.strokeStyle = shade(c, -0.35); ctx.lineWidth = s * 0.022;
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, -s * 0.12); ctx.lineTo(-w * 0.05, -s * 0.03); ctx.lineTo(w * 0.15, -s * 0.1); ctx.lineTo(w * 0.28, 0);
      ctx.stroke();
      // крышка
      rr(ctx, -s * 0.1, -s * 0.46, s * 0.2, s * 0.13, s * 0.03);
      ctx.fillStyle = shade(c, -0.4); ctx.fill(); outline(ctx, s, shade(c, -0.6));
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = s * 0.015;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * s * 0.05, -s * 0.44); ctx.lineTo(i * s * 0.05, -s * 0.35); ctx.stroke();
      }
    },
    bucket: function (ctx, s, c) {
      c = c || '#e2453c';
      ctx.beginPath();
      ctx.arc(0, -s * 0.18, s * 0.27, Math.PI, 0);
      ctx.lineWidth = s * 0.05; ctx.strokeStyle = shade(c, -0.35); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 0.18); ctx.lineTo(s * 0.32, -s * 0.18);
      ctx.lineTo(s * 0.23, s * 0.32); ctx.lineTo(-s * 0.23, s * 0.32);
      ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); outline(ctx, s, shade(c, -0.5), 0.045);
      ctx.fillStyle = shade(c, -0.2);
      ctx.fillRect(-s * 0.32, -s * 0.2, s * 0.64, s * 0.07);
      ctx.fillRect(-s * 0.27, s * 0.12, s * 0.54, s * 0.04);
    },
    jug: function (ctx, s, c) {
      c = c || '#f4f4f4';
      // ручка-проём
      rr(ctx, s * 0.02, -s * 0.36, s * 0.26, s * 0.2, s * 0.07);
      ctx.lineWidth = s * 0.07; ctx.strokeStyle = c; ctx.stroke();
      ctx.lineWidth = s * 0.02; ctx.strokeStyle = shade(c, -0.5); ctx.stroke();
      rr(ctx, -s * 0.3, -s * 0.24, s * 0.6, s * 0.62, s * 0.1);
      ctx.fillStyle = c; ctx.fill(); outline(ctx, s, shade(c, -0.5), 0.045);
      // горлышко
      rr(ctx, -s * 0.24, -s * 0.38, s * 0.16, s * 0.16, s * 0.03);
      ctx.fillStyle = shade(c, -0.15); ctx.fill(); outline(ctx, s, shade(c, -0.5));
      rr(ctx, -s * 0.26, -s * 0.44, s * 0.2, s * 0.08, s * 0.02);
      ctx.fillStyle = '#e2453c'; ctx.fill();
      // этикетка
      rr(ctx, -s * 0.2, s * 0.0, s * 0.4, s * 0.2, s * 0.03);
      ctx.fillStyle = '#ffcf3d'; ctx.fill();
    },

    // ================= СТЕКЛО: прозрачное, с бликами =================
    wine: function (ctx, s, c) {
      c = c || 'rgba(30,110,60,.85)';
      ctx.beginPath();
      ctx.moveTo(-s * 0.055, -s * 0.4); ctx.lineTo(s * 0.055, -s * 0.4);
      ctx.lineTo(s * 0.055, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.15, -s * 0.16, s * 0.15, -s * 0.05);
      ctx.lineTo(s * 0.15, s * 0.38);
      ctx.quadraticCurveTo(s * 0.15, s * 0.43, s * 0.1, s * 0.43);
      ctx.lineTo(-s * 0.1, s * 0.43);
      ctx.quadraticCurveTo(-s * 0.15, s * 0.43, -s * 0.15, s * 0.38);
      ctx.lineTo(-s * 0.15, -s * 0.05);
      ctx.quadraticCurveTo(-s * 0.15, -s * 0.16, -s * 0.055, -s * 0.2);
      ctx.closePath();
      ctx.fillStyle = c; ctx.fill();
      outline(ctx, s, 'rgba(225,255,235,.9)', 0.03);
      // пробка
      rr(ctx, -s * 0.05, -s * 0.48, s * 0.1, s * 0.1, s * 0.02);
      ctx.fillStyle = '#c9a06a'; ctx.fill(); outline(ctx, s, '#7d5a32', 0.02);
      // этикетка
      rr(ctx, -s * 0.15, s * 0.08, s * 0.3, s * 0.17, s * 0.02);
      ctx.fillStyle = '#f1e6c8'; ctx.fill();
      ctx.fillStyle = '#9b3b3b'; ctx.fillRect(-s * 0.09, s * 0.13, s * 0.18, s * 0.03);
      glassGlare(ctx, -s * 0.11, -s * 0.06, s * 0.12, s);
      glassGlare(ctx, -s * 0.03, -s * 0.37, 0, s);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(-s * 0.035, -s * 0.37, s * 0.02, s * 0.13);
    },
    jar: function (ctx, s) {
      const w = s * 0.5, h = s * 0.58;
      rr(ctx, -w / 2, -h / 2 + s * 0.05, w, h, s * 0.1);
      ctx.fillStyle = 'rgba(160,225,235,.45)'; ctx.fill(); outline(ctx, s, 'rgba(230,255,255,.95)', 0.03);
      // содержимое на дне
      rr(ctx, -w / 2 + s * 0.03, s * 0.14, w - s * 0.06, s * 0.17, s * 0.07);
      ctx.fillStyle = 'rgba(200,120,60,.55)'; ctx.fill();
      rr(ctx, -w * 0.45, -h / 2 - s * 0.06, w * 0.9, s * 0.12, s * 0.03);
      ctx.fillStyle = '#c9b56a'; ctx.fill(); outline(ctx, s, '#7d6a32', 0.025);
      glassGlare(ctx, -w / 2 + w * 0.12, -h / 2 + s * 0.13, h * 0.5, s);
    },
    cup: function (ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.26, -s * 0.34); ctx.lineTo(s * 0.26, -s * 0.34);
      ctx.lineTo(s * 0.19, s * 0.36); ctx.lineTo(-s * 0.19, s * 0.36);
      ctx.closePath();
      ctx.fillStyle = 'rgba(200,235,255,.35)'; ctx.fill(); outline(ctx, s, 'rgba(235,252,255,.95)', 0.03);
      // толстое дно
      ctx.fillStyle = 'rgba(220,245,255,.6)';
      ctx.fillRect(-s * 0.19, s * 0.28, s * 0.38, s * 0.08);
      ctx.beginPath(); ctx.ellipse(0, -s * 0.34, s * 0.26, s * 0.05, 0, 0, PI2);
      ctx.strokeStyle = 'rgba(235,252,255,.95)'; ctx.lineWidth = s * 0.025; ctx.stroke();
      glassGlare(ctx, -s * 0.17, -s * 0.24, s * 0.42, s);
    },

    // ================= БУМАГА =================
    box: function (ctx, s) {
      const w = s * 0.62, h = s * 0.56;
      rr(ctx, -w / 2, -h / 2, w, h, s * 0.03);
      ctx.fillStyle = '#c99559'; ctx.fill(); outline(ctx, s, '#7d5a32');
      ctx.fillStyle = '#e9cf98';
      ctx.fillRect(-s * 0.06, -h / 2, s * 0.12, h);
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = s * 0.025;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + h * 0.28); ctx.lineTo(w / 2, -h / 2 + h * 0.28); ctx.stroke();
    },
    news: function (ctx, s) {
      const w = s * 0.66, h = s * 0.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2 - s * 0.12, -h / 2);
      ctx.lineTo(w / 2, -h / 2 + s * 0.12); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.fillStyle = '#ece6d6'; ctx.fill(); outline(ctx, s, '#9a9486');
      ctx.fillStyle = '#5a564c';
      ctx.fillRect(-w / 2 + s * 0.06, -h / 2 + s * 0.06, w * 0.55, s * 0.08);
      ctx.fillStyle = '#a49e8f';
      for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2 + s * 0.06, -h / 2 + s * 0.2 + i * s * 0.08, w - s * 0.12, s * 0.035);
    },

    // ================= ЭЛЕКТРОНИКА =================
    board: function (ctx, s) {
      const w = s * 0.7, h = s * 0.5;
      rr(ctx, -w / 2, -h / 2, w, h, s * 0.04);
      ctx.fillStyle = '#2f8f57'; ctx.fill(); outline(ctx, s, '#1b5534');
      ctx.strokeStyle = '#d4b04a'; ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 4, -h * 0.2); ctx.lineTo(-w * 0.1, -h * 0.2); ctx.lineTo(0, 0); ctx.lineTo(w / 2 - 4, 0);
      ctx.moveTo(-w / 2 + 4, h * 0.25); ctx.lineTo(w * 0.2, h * 0.25);
      ctx.stroke();
      ctx.fillStyle = '#1d1d1d';
      ctx.fillRect(-w * 0.32, -h * 0.05, w * 0.22, h * 0.32);
      ctx.fillRect(w * 0.12, -h * 0.38, w * 0.26, h * 0.28);
    },
    phone: function (ctx, s) {
      const w = s * 0.38, h = s * 0.66;
      rr(ctx, -w / 2, -h / 2, w, h, s * 0.07);
      ctx.fillStyle = '#26292e'; ctx.fill(); outline(ctx, s, '#0e0f11');
      rr(ctx, -w / 2 + s * 0.035, -h / 2 + s * 0.07, w - s * 0.07, h - s * 0.14, s * 0.02);
      ctx.fillStyle = '#5b86c5'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, -h * 0.25); ctx.lineTo(0, -h * 0.05); ctx.lineTo(-w * 0.1, h * 0.12); ctx.lineTo(w * 0.15, h * 0.28);
      ctx.moveTo(0, -h * 0.05); ctx.lineTo(w * 0.25, -h * 0.12);
      ctx.stroke();
    },

    // ================= КРУПНЫЙ ХЛАМ (разбирается) =================
    tv: function (ctx, s) {
      ctx.strokeStyle = '#555'; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(-s * 0.2, -s * 0.52); ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.18, -s * 0.54); ctx.stroke();
      rr(ctx, -s * 0.44, -s * 0.32, s * 0.88, s * 0.64, s * 0.08);
      ctx.fillStyle = '#8a6440'; ctx.fill(); outline(ctx, s, '#4f3620');
      rr(ctx, -s * 0.36, -s * 0.24, s * 0.54, s * 0.48, s * 0.1);
      ctx.fillStyle = '#5d7180'; ctx.fill(); outline(ctx, s, '#2f3a42');
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      rr(ctx, -s * 0.3, -s * 0.19, s * 0.08, s * 0.24, s * 0.03); ctx.fill();
      ctx.fillStyle = '#d8c7a8';
      circle(ctx, s * 0.31, -s * 0.12, s * 0.06); ctx.fill();
      circle(ctx, s * 0.31, s * 0.06, s * 0.06); ctx.fill();
    },
    bike: function (ctx, s) {
      ctx.lineCap = 'round';
      [-0.27, 0.27].forEach(function (x) {
        circle(ctx, x * s, s * 0.14, s * 0.2);
        ctx.lineWidth = s * 0.06; ctx.strokeStyle = '#2b2b2b'; ctx.stroke();
        ctx.lineWidth = s * 0.012; ctx.strokeStyle = '#999';
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(x * s + Math.cos(a) * s * 0.17, s * 0.14 + Math.sin(a) * s * 0.17);
          ctx.lineTo(x * s - Math.cos(a) * s * 0.17, s * 0.14 - Math.sin(a) * s * 0.17);
          ctx.stroke();
        }
      });
      ctx.strokeStyle = '#d64541'; ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(-s * 0.27, s * 0.14); ctx.lineTo(-s * 0.02, s * 0.14); ctx.lineTo(s * 0.13, -s * 0.12);
      ctx.lineTo(-s * 0.14, -s * 0.12); ctx.lineTo(-s * 0.27, s * 0.14);
      ctx.moveTo(-s * 0.14, -s * 0.12); ctx.lineTo(-s * 0.02, s * 0.14);
      ctx.moveTo(s * 0.13, -s * 0.12); ctx.lineTo(s * 0.27, s * 0.14);
      ctx.moveTo(s * 0.13, -s * 0.12); ctx.lineTo(s * 0.17, -s * 0.26); ctx.lineTo(s * 0.26, -s * 0.26);
      ctx.stroke();
      rr(ctx, -s * 0.22, -s * 0.22, s * 0.16, s * 0.06, s * 0.03);
      ctx.fillStyle = '#222'; ctx.fill();
      ctx.lineCap = 'butt';
    },
    radio: function (ctx, s) {
      ctx.strokeStyle = '#777'; ctx.lineWidth = s * 0.025;
      ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.24); ctx.lineTo(s * 0.44, -s * 0.54); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -s * 0.24, s * 0.2, Math.PI, 0);
      ctx.lineWidth = s * 0.045; ctx.strokeStyle = '#3a3a3a'; ctx.stroke();
      rr(ctx, -s * 0.42, -s * 0.24, s * 0.84, s * 0.52, s * 0.1);
      ctx.fillStyle = '#3fa7a0'; ctx.fill(); outline(ctx, s, '#22605c');
      circle(ctx, -s * 0.16, s * 0.03, s * 0.16); ctx.fillStyle = '#2a6f6a'; ctx.fill();
      ctx.fillStyle = '#1c4a47';
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { circle(ctx, -s * 0.16 + i * s * 0.06, s * 0.03 + j * s * 0.06, s * 0.02); ctx.fill(); }
      rr(ctx, s * 0.06, -s * 0.14, s * 0.28, s * 0.13, s * 0.02);
      ctx.fillStyle = '#f3e7c9'; ctx.fill();
      ctx.fillStyle = '#d64541'; ctx.fillRect(s * 0.16, -s * 0.14, s * 0.02, s * 0.13);
      circle(ctx, s * 0.2, s * 0.13, s * 0.07); ctx.fillStyle = '#e9e1cf'; ctx.fill(); outline(ctx, s, '#22605c', 0.02);
    },
    lamp: function (ctx, s) {
      circle(ctx, 0, -s * 0.1, s * 0.08); ctx.fillStyle = 'rgba(255,240,170,.9)'; ctx.fill();
      ctx.fillStyle = '#9aa5b0'; ctx.fillRect(-s * 0.03, -s * 0.12, s * 0.06, s * 0.42);
      ctx.beginPath(); ctx.ellipse(0, s * 0.32, s * 0.26, s * 0.08, 0, 0, PI2);
      ctx.fillStyle = '#6f7a85'; ctx.fill(); outline(ctx, s, '#3d454d');
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 0.1); ctx.lineTo(s * 0.32, -s * 0.1);
      ctx.lineTo(s * 0.19, -s * 0.44); ctx.lineTo(-s * 0.19, -s * 0.44);
      ctx.closePath();
      ctx.fillStyle = '#efd9a7'; ctx.fill(); outline(ctx, s, '#a8895a');
      ctx.strokeStyle = 'rgba(168,137,90,.5)'; ctx.lineWidth = s * 0.02;
      ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.44); ctx.lineTo(-s * 0.12, -s * 0.1); ctx.moveTo(s * 0.08, -s * 0.44); ctx.lineTo(s * 0.12, -s * 0.1); ctx.stroke();
    },

    // ================= СОКРОВИЩА (коллекция) =================
    coin: function (ctx, s) {
      const g = ctx.createRadialGradient(-s * 0.1, -s * 0.1, s * 0.02, 0, 0, s * 0.34);
      g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, '#f5c518'); g.addColorStop(1, '#c48a0a');
      circle(ctx, 0, 0, s * 0.32); ctx.fillStyle = g; ctx.fill(); outline(ctx, s, '#8a5f05');
      circle(ctx, 0, 0, s * 0.22);
      ctx.strokeStyle = 'rgba(138,95,5,.6)'; ctx.lineWidth = s * 0.03; ctx.stroke();
      ctx.fillStyle = 'rgba(138,95,5,.75)';
      ctx.font = '900 ' + (s * 0.26) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('1', 0, s * 0.01);
    },
    watch: function (ctx, s) {
      ctx.strokeStyle = '#b8941a'; ctx.lineWidth = s * 0.04;
      ctx.beginPath(); ctx.arc(0, -s * 0.36, s * 0.07, 0, PI2); ctx.stroke();
      circle(ctx, 0, 0, s * 0.3); ctx.fillStyle = '#f5c518'; ctx.fill(); outline(ctx, s, '#8a5f05');
      circle(ctx, 0, 0, s * 0.22); ctx.fillStyle = '#fffaf0'; ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.15); ctx.moveTo(0, 0); ctx.lineTo(s * 0.1, s * 0.04); ctx.stroke();
    },
    ring: function (ctx, s) {
      circle(ctx, 0, s * 0.08, s * 0.25);
      ctx.lineWidth = s * 0.09; ctx.strokeStyle = '#e8b811'; ctx.stroke();
      ctx.lineWidth = s * 0.03; ctx.strokeStyle = '#fff3a0'; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.38); ctx.lineTo(s * 0.13, -s * 0.24); ctx.lineTo(0, -s * 0.1); ctx.lineTo(-s * 0.13, -s * 0.24);
      ctx.closePath();
      ctx.fillStyle = '#5fd3ff'; ctx.fill(); outline(ctx, s, '#2a7fa8');
    },
    medal: function (ctx, s) {
      ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.44); ctx.lineTo(-s * 0.04, -s * 0.44); ctx.lineTo(s * 0.06, -s * 0.06); ctx.lineTo(-s * 0.08, -s * 0.06); ctx.closePath();
      ctx.fillStyle = '#d64541'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.44); ctx.lineTo(s * 0.04, -s * 0.44); ctx.lineTo(-s * 0.06, -s * 0.06); ctx.lineTo(s * 0.08, -s * 0.06); ctx.closePath();
      ctx.fillStyle = '#3b7fd1'; ctx.fill();
      circle(ctx, 0, s * 0.12, s * 0.24); ctx.fillStyle = '#f5c518'; ctx.fill(); outline(ctx, s, '#8a5f05');
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const r = i % 2 ? s * 0.06 : s * 0.15;
        ctx.lineTo(Math.cos(a) * r, s * 0.12 + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fillStyle = '#c48a0a'; ctx.fill();
    },
    vinyl: function (ctx, s) {
      circle(ctx, 0, 0, s * 0.38); ctx.fillStyle = '#1b1b1d'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1;
      [0.32, 0.27, 0.22, 0.18].forEach(function (r) { circle(ctx, 0, 0, s * r); ctx.stroke(); });
      circle(ctx, 0, 0, s * 0.12); ctx.fillStyle = '#e2453c'; ctx.fill();
      circle(ctx, 0, 0, s * 0.025); ctx.fillStyle = '#111'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.3, -2.4, -1.8); ctx.stroke();
    },
    key: function (ctx, s) {
      ctx.strokeStyle = '#d4a017'; ctx.lineCap = 'round';
      circle(ctx, -s * 0.22, 0, s * 0.14); ctx.lineWidth = s * 0.08; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.08, 0); ctx.lineTo(s * 0.36, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.22, 0); ctx.lineTo(s * 0.22, s * 0.12); ctx.moveTo(s * 0.32, 0); ctx.lineTo(s * 0.32, s * 0.14); ctx.stroke();
      ctx.strokeStyle = '#fff0a0'; ctx.lineWidth = s * 0.025;
      ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.015); ctx.lineTo(s * 0.3, -s * 0.015); ctx.stroke();
      ctx.lineCap = 'butt';
    }
  };

  function sparkle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.25, y - r * 0.25); ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.25, y + r * 0.25); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.25, y + r * 0.25);
    ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.25, y - r * 0.25);
    ctx.closePath();
    ctx.fillStyle = '#fffbe0'; ctx.fill();
  }

  /** Трещины на крупном хламе по числу ударов. */
  function cracks(ctx, s, n) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(1.5, s * 0.025);
    const sets = [
      [[-0.1, -0.2], [0.02, -0.05], [-0.06, 0.06], [0.08, 0.2]],
      [[0.2, -0.15], [0.08, 0.0], [0.22, 0.12]],
      [[-0.3, 0.1], [-0.15, 0.02], [-0.2, -0.12]]
    ];
    for (let i = 0; i < Math.min(n, sets.length); i++) {
      ctx.beginPath();
      sets[i].forEach(function (p, k) { if (k === 0) ctx.moveTo(p[0] * s, p[1] * s); else ctx.lineTo(p[0] * s, p[1] * s); });
      ctx.stroke();
    }
  }

  /** Мусоровоз, смотрит влево; кузов справа и наклоняется (tilt) для разгрузки. */
  function truck(ctx, s, tilt, t, color) {
    color = color || '#6f8f3a';
    // кузов
    ctx.save();
    ctx.translate(s * 1.0, s * 0.12);
    ctx.rotate(-tilt);
    rr(ctx, -s * 1.55, -s * 0.62, s * 1.55, s * 0.62, s * 0.06);
    ctx.fillStyle = color; ctx.fill(); outline(ctx, s, shade(color, -0.45));
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    for (let i = 1; i < 5; i++) ctx.fillRect(-s * 1.55 + i * s * 0.31, -s * 0.58, s * 0.04, s * 0.54);
    // мусор сверху
    ctx.fillStyle = '#7a5c43';
    ctx.beginPath(); ctx.ellipse(-s * 0.78, -s * 0.62, s * 0.7, s * 0.14, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
    // кабина
    rr(ctx, -s * 1.12, -s * 0.38, s * 0.58, s * 0.56, s * 0.1);
    ctx.fillStyle = '#f2a93b'; ctx.fill(); outline(ctx, s, '#9a6216');
    rr(ctx, -s * 1.04, -s * 0.3, s * 0.3, s * 0.2, s * 0.04);
    ctx.fillStyle = '#bfe3f2'; ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(-s * 1.14, s * 0.02, s * 0.06, s * 0.08);
    // колёса
    const spin = t * 10;
    [-0.82, 0.15, 0.7].forEach(function (x) {
      circle(ctx, x * s, s * 0.22, s * 0.15); ctx.fillStyle = '#222'; ctx.fill();
      circle(ctx, x * s, s * 0.22, s * 0.06); ctx.fillStyle = '#9aa5b0'; ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = s * 0.02;
      ctx.beginPath(); ctx.moveTo(x * s, s * 0.22); ctx.lineTo(x * s + Math.cos(spin) * s * 0.12, s * 0.22 + Math.sin(spin) * s * 0.12); ctx.stroke();
    });
  }

  /** Енот, смотрит вправо при dir=1. */
  function raccoon(ctx, s, t, scared) {
    const bob = Math.sin(t * 16) * s * 0.03;
    const step = Math.sin(t * 16);
    // хвост
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(-s * 0.34 - i * s * 0.09, -s * 0.06 - i * s * 0.07 + bob, s * 0.08, s * 0.065, -0.6, 0, PI2);
      ctx.fillStyle = i % 2 ? '#3a3c40' : '#9a9ea4'; ctx.fill();
    }
    // лапы
    ctx.fillStyle = '#3a3c40';
    [-0.2, -0.08, 0.1, 0.22].forEach(function (x, i) {
      const o = (i % 2 ? step : -step) * s * 0.04;
      ctx.fillRect(x * s + o, s * 0.1, s * 0.07, s * 0.14);
    });
    // тело
    ctx.beginPath(); ctx.ellipse(0, bob, s * 0.34, s * 0.2, 0, 0, PI2);
    ctx.fillStyle = '#8b8f95'; ctx.fill(); outline(ctx, s, '#4a4d52', 0.025);
    // голова
    const hy = -s * 0.12 + bob;
    ctx.fillStyle = '#6c7076';
    ctx.beginPath(); ctx.moveTo(s * 0.24, hy - s * 0.08); ctx.lineTo(s * 0.26, hy - s * 0.24); ctx.lineTo(s * 0.34, hy - s * 0.12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.38, hy - s * 0.1); ctx.lineTo(s * 0.44, hy - s * 0.24); ctx.lineTo(s * 0.48, hy - s * 0.08); ctx.fill();
    circle(ctx, s * 0.38, hy, s * 0.16); ctx.fillStyle = '#a7abb1'; ctx.fill(); outline(ctx, s, '#4a4d52', 0.025);
    // маска
    ctx.beginPath(); ctx.ellipse(s * 0.41, hy - s * 0.01, s * 0.13, s * 0.055, 0, 0, PI2);
    ctx.fillStyle = '#2b2d31'; ctx.fill();
    ctx.fillStyle = '#fff';
    circle(ctx, s * 0.37, hy - s * 0.015, s * (scared ? 0.035 : 0.025)); ctx.fill();
    circle(ctx, s * 0.46, hy - s * 0.015, s * (scared ? 0.035 : 0.025)); ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, s * 0.53, hy + s * 0.05, s * 0.03); ctx.fill();
  }

  /** Сторожевой пёс, смотрит вправо. running — бежит за енотом (уши назад, язык наружу). */
  function dog(ctx, s, t, running) {
    const step = Math.sin(t * (running ? 22 : 12));
    const bob = Math.abs(step) * s * 0.03;
    // хвост
    ctx.strokeStyle = '#a0622d'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.08 - bob);
    ctx.quadraticCurveTo(-s * 0.46, -s * 0.2 + Math.sin(t * 18) * s * 0.06, -s * 0.42, -s * 0.34);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // лапы
    ctx.fillStyle = '#8a5326';
    [-0.2, -0.08, 0.12, 0.24].forEach(function (x, i) {
      const o = (i % 2 ? step : -step) * s * 0.05;
      ctx.fillRect(x * s + o, s * 0.04, s * 0.07, s * 0.18);
    });
    // тело
    ctx.beginPath(); ctx.ellipse(0, -bob, s * 0.34, s * 0.17, 0, 0, PI2);
    ctx.fillStyle = '#c47a3a'; ctx.fill(); outline(ctx, s, '#7a4519', 0.025);
    // пятно и ошейник
    ctx.beginPath(); ctx.ellipse(-s * 0.08, -s * 0.06 - bob, s * 0.12, s * 0.08, 0, 0, PI2);
    ctx.fillStyle = '#e6b07a'; ctx.fill();
    ctx.fillStyle = '#d64541'; ctx.fillRect(s * 0.22, -s * 0.2 - bob, s * 0.06, s * 0.16);
    // голова
    const hy = -s * 0.2 - bob;
    circle(ctx, s * 0.38, hy, s * 0.15); ctx.fillStyle = '#c47a3a'; ctx.fill(); outline(ctx, s, '#7a4519', 0.025);
    ctx.beginPath(); ctx.ellipse(s * 0.52, hy + s * 0.04, s * 0.09, s * 0.065, 0, 0, PI2);
    ctx.fillStyle = '#e6b07a'; ctx.fill();
    circle(ctx, s * 0.6, hy + s * 0.02, s * 0.03); ctx.fillStyle = '#222'; ctx.fill();
    circle(ctx, s * 0.42, hy - s * 0.04, s * 0.025); ctx.fill();
    // ухо
    ctx.beginPath();
    ctx.ellipse(s * 0.3, hy - s * 0.02, s * 0.06, s * 0.12, running ? 1.1 : 0.3, 0, PI2);
    ctx.fillStyle = '#7a4519'; ctx.fill();
    if (running) {
      ctx.beginPath(); ctx.ellipse(s * 0.55, hy + s * 0.12, s * 0.035, s * 0.06, 0.3, 0, PI2);
      ctx.fillStyle = '#ff7a8a'; ctx.fill();
    }
  }

  /** Автосортер над контейнером. ready — 0..1 перезарядка. */
  function machine(ctx, s, color, ready, level) {
    rr(ctx, -s * 0.34, -s * 0.2, s * 0.68, s * 0.34, s * 0.07);
    ctx.fillStyle = '#3d434a'; ctx.fill(); outline(ctx, s, '#1f2327', 0.025);
    ctx.fillStyle = color; ctx.fillRect(-s * 0.34 + 3, -s * 0.2 + 3, s * 0.68 - 6, s * 0.06);
    // кольцо перезарядки
    circle(ctx, 0, -s * 0.02, s * 0.1);
    ctx.fillStyle = ready >= 1 ? color : '#20242a'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -s * 0.02, s * 0.13, -Math.PI / 2, -Math.PI / 2 + PI2 * Math.min(1, ready));
    ctx.strokeStyle = color; ctx.lineWidth = s * 0.04; ctx.stroke();
    // уровень
    ctx.fillStyle = '#fff';
    ctx.font = '800 ' + Math.max(9, s * 0.16) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(level, s * 0.24, -s * 0.02);
    // антенна
    ctx.strokeStyle = '#1f2327'; ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(-s * 0.22, -s * 0.2); ctx.lineTo(-s * 0.26, -s * 0.34); ctx.stroke();
    circle(ctx, -s * 0.26, -s * 0.36, s * 0.035); ctx.fillStyle = ready >= 1 ? '#7dff9a' : '#ff6b5e'; ctx.fill();
  }

  // ================= ДЕКОР ДВОРА (рисуется от точки «на земле», s — размер) =================
  const DECOR = {
    fence: function (ctx, s) {
      // короткий отрезок забора; на поле рисуется повтором
      ctx.fillStyle = '#a7835a';
      ctx.fillRect(-s * 0.5, -s * 0.42, s, s * 0.08);
      ctx.fillRect(-s * 0.5, -s * 0.2, s, s * 0.08);
      for (let i = 0; i < 3; i++) {
        const x = -s * 0.42 + i * s * 0.36;
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, -s * 0.52); ctx.lineTo(x + s * 0.06, -s * 0.6); ctx.lineTo(x + s * 0.12, -s * 0.52); ctx.lineTo(x + s * 0.12, 0);
        ctx.closePath();
        ctx.fillStyle = '#c49a6a'; ctx.fill(); outline(ctx, s, '#6b4f2e', 0.025);
      }
    },
    flowers: function (ctx, s, t) {
      ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.48, s * 0.14, 0, 0, PI2);
      ctx.fillStyle = '#5a3d27'; ctx.fill();
      const cols = ['#ff6b8a', '#ffd84d', '#ff9f1c', '#c58cff', '#ffffff'];
      for (let i = 0; i < 6; i++) {
        const x = -s * 0.38 + i * s * 0.15, sway = Math.sin(t * 2 + i) * s * 0.02;
        ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = s * 0.03;
        ctx.beginPath(); ctx.moveTo(x, -s * 0.08); ctx.lineTo(x + sway, -s * 0.32 - (i % 2) * s * 0.06); ctx.stroke();
        circle(ctx, x + sway, -s * 0.34 - (i % 2) * s * 0.06, s * 0.065);
        ctx.fillStyle = cols[i % cols.length]; ctx.fill();
        circle(ctx, x + sway, -s * 0.34 - (i % 2) * s * 0.06, s * 0.025);
        ctx.fillStyle = '#7a4b12'; ctx.fill();
      }
    },
    lamp: function (ctx, s, t, night) {
      const g = ctx.createRadialGradient(0, -s * 0.95, 0, 0, -s * 0.95, s * 0.6);
      g.addColorStop(0, 'rgba(255,230,140,.45)'); g.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = g; circle(ctx, 0, -s * 0.95, s * 0.6); ctx.fill();
      ctx.fillStyle = '#2f3438';
      ctx.fillRect(-s * 0.035, -s * 0.95, s * 0.07, s * 0.95);
      ctx.fillRect(-s * 0.12, -s * 0.06, s * 0.24, s * 0.06);
      rr(ctx, -s * 0.11, -s * 1.08, s * 0.22, s * 0.16, s * 0.04);
      ctx.fillStyle = '#ffe9a0'; ctx.fill(); outline(ctx, s, '#2f3438', 0.03);
    },
    flag: function (ctx, s, t) {
      ctx.fillStyle = '#8a8f96'; ctx.fillRect(-s * 0.025, -s * 1.1, s * 0.05, s * 1.1);
      ctx.beginPath();
      ctx.moveTo(s * 0.025, -s * 1.08);
      for (let i = 0; i <= 8; i++) {
        const x = s * 0.025 + i * s * 0.06;
        ctx.lineTo(x, -s * 1.08 + Math.sin(t * 5 + i * 0.8) * s * 0.03);
      }
      for (let i = 8; i >= 0; i--) {
        const x = s * 0.025 + i * s * 0.06;
        ctx.lineTo(x, -s * 0.78 + Math.sin(t * 5 + i * 0.8) * s * 0.03);
      }
      ctx.closePath();
      ctx.fillStyle = '#e8833a'; ctx.fill(); outline(ctx, s, '#9a4f16', 0.02);
      ctx.fillStyle = '#fff';
      circle(ctx, s * 0.27, -s * 0.93 + Math.sin(t * 5 + 3.2) * s * 0.03, s * 0.07); ctx.fill();
    },
    cat: function (ctx, s, t) {
      const br = 1 + Math.sin(t * 2) * 0.03;
      // хвост
      ctx.strokeStyle = '#e09040'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s * 0.25, -s * 0.08); ctx.quadraticCurveTo(s * 0.45, -s * 0.05, s * 0.3, s * 0.02); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.13, s * 0.3, s * 0.14 * br, 0, 0, PI2);
      ctx.fillStyle = '#f0a050'; ctx.fill(); outline(ctx, s, '#a8642a', 0.025);
      ctx.strokeStyle = '#c87a34'; ctx.lineWidth = s * 0.03;
      [-0.1, 0, 0.1].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x * s, -s * 0.25); ctx.lineTo(x * s + s * 0.03, -s * 0.15); ctx.stroke(); });
      circle(ctx, -s * 0.27, -s * 0.16, s * 0.12); ctx.fillStyle = '#f0a050'; ctx.fill(); outline(ctx, s, '#a8642a', 0.025);
      ctx.fillStyle = '#f0a050';
      ctx.beginPath(); ctx.moveTo(-s * 0.36, -s * 0.22); ctx.lineTo(-s * 0.35, -s * 0.33); ctx.lineTo(-s * 0.28, -s * 0.26); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * 0.22, -s * 0.26); ctx.lineTo(-s * 0.17, -s * 0.33); ctx.lineTo(-s * 0.16, -s * 0.22); ctx.fill();
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = s * 0.015;
      ctx.beginPath(); ctx.arc(-s * 0.31, -s * 0.16, s * 0.025, 0, Math.PI); ctx.arc(-s * 0.22, -s * 0.16, s * 0.025, 0, Math.PI); ctx.stroke();
      // «Zzz»
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(t * 1.5)) + ')';
      ctx.font = '800 ' + (s * 0.16) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('z', -s * 0.2, -s * 0.42 - (t % 2) * s * 0.05);
    },
    gnome: function (ctx, s) {
      ctx.beginPath(); ctx.ellipse(0, -s * 0.03, s * 0.2, s * 0.06, 0, 0, PI2);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fill();
      rr(ctx, -s * 0.15, -s * 0.36, s * 0.3, s * 0.34, s * 0.08);
      ctx.fillStyle = '#3b7fd1'; ctx.fill(); outline(ctx, s, '#1f4a80', 0.025);
      ctx.beginPath(); ctx.moveTo(-s * 0.14, -s * 0.36); ctx.lineTo(s * 0.14, -s * 0.36); ctx.lineTo(0, -s * 0.12); ctx.closePath();
      ctx.fillStyle = '#f4f4f4'; ctx.fill();
      circle(ctx, 0, -s * 0.44, s * 0.1); ctx.fillStyle = '#f2c9a0'; ctx.fill();
      circle(ctx, 0, -s * 0.42, s * 0.03); ctx.fillStyle = '#e07a6a'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * 0.13, -s * 0.48); ctx.lineTo(s * 0.13, -s * 0.48); ctx.lineTo(s * 0.02, -s * 0.8); ctx.closePath();
      ctx.fillStyle = '#d64541'; ctx.fill(); outline(ctx, s, '#8a2421', 0.025);
    }
  };

  window.Draw = {
    rr: rr, shade: shade, sparkle: sparkle, cracks: cracks,
    truck: truck, raccoon: raccoon, machine: machine, dog: dog,
    decor: function (ctx, id, s, t) { const f = DECOR[id]; if (f) f(ctx, s, t || 0); },
    item: function (ctx, kind, s, color) { const f = K[kind]; if (f) f(ctx, s, color); }
  };
})();
