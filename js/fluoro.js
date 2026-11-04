// fluoro.js — 透視像（AP）の合成。骨・心陰影は背景に一度だけ描き、ワイヤー・カニューレは毎フレーム重ねる
(function () {
  const W = 400, H = 660, PX_CM = 10;   // 透視座標: 1 cm = 10 px（経路に沿った長さ）
  // 経路（透視座標）。画面左 = 患者の右
  const PATHS = {
    V: [[128, 598], [134, 570], [142, 540], [160, 490], [178, 445], [188, 410], [191, 350], [192, 290], [190, 240], [186, 212], [180, 185], [178, 160], [183, 130], [189, 112], [194, 70], [197, 30]],
    A: [[272, 598], [266, 570], [258, 540], [240, 490], [222, 450], [208, 418], [207, 380], [208, 330], [210, 280], [212, 230], [214, 180], [215, 130], [213, 95], [205, 68], [190, 58], [176, 68], [170, 95]],
  };
  const HEADS = { R: { x: 110, y: 560, r: 23 }, L: { x: 290, y: 560, r: 23 } };
  const cum = {};
  Object.keys(PATHS).forEach(k => {
    const p = PATHS[k], c = [0];
    for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    cum[k] = c;
  });
  function pointAt(k, d) {
    const p = PATHS[k], c = cum[k];
    d = Math.max(0, Math.min(d, c[c.length - 1]));
    let i = 1; while (i < c.length - 1 && c[i] < d) i++;
    const t = (d - c[i - 1]) / (c[i] - c[i - 1] || 1);
    return { x: p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, y: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t, i };
  }
  function maxLen(k) { const c = cum[k]; return c[c.length - 1] / PX_CM; }
  function zone(k, cm) {
    const pt = pointAt(k, cm * PX_CM), y = pt.y;
    if (k === 'V') {
      if (y > 560) return { id: 'fv', t: '大腿静脈' };
      if (y > 445) return { id: 'eiv', t: '外腸骨静脈' };
      if (y > 410) return { id: 'civ', t: '総腸骨静脈' };
      if (y > 212) return { id: 'ivc', t: '下大静脈' };
      if (y > 118) return { id: 'ra', t: '右房' };
      return { id: 'svc', t: '上大静脈' };
    }
    if (pt.i >= 14) return { id: 'arch', t: '大動脈弓〜上行' };
    if (y > 560) return { id: 'fa', t: '大腿動脈' };
    if (y > 450) return { id: 'eia', t: '外腸骨動脈' };
    if (y > 418) return { id: 'cia', t: '総腸骨動脈' };
    if (y > 250) return { id: 'aa', t: '腹部大動脈' };
    return { id: 'dta', t: '胸部下行大動脈' };
  }

  // ---------- 背景（濃度を重ねて作る。暗い＝X線を通しにくい） ----------
  let bg = null;
  function makeBg() {
    const R = PS.R, gy = R.grey;
    const c = R.xbase(W, H, 222);
    // 肺・腸管ガス（明るい）
    R.xlight(c, 5, g => {
      g.fillStyle = gy(60);
      g.beginPath(); g.ellipse(112, 150, 80, 128, .06, 0, 7); g.fill();
      g.beginPath(); g.ellipse(292, 154, 76, 124, -.06, 0, 7); g.fill();
      g.fillStyle = gy(45); g.beginPath(); g.ellipse(296, 296, 30, 17, .2, 0, 7); g.fill();   // 胃泡
      const r = R.rng(5); g.fillStyle = gy(26);
      for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(70 + r() * 260, 330 + r() * 110, 10 + r() * 16, 6 + r() * 9, r() * 3, 0, 7); g.fill(); }
    });
    // 軟部組織・縦隔・心臓・肝臓（ぼかして乗算）
    R.xlayer(c, 5, g => {
      g.fillStyle = gy(214); g.fillRect(0, 0, W, H);
      g.fillStyle = gy(178); g.beginPath(); g.moveTo(172, 0); g.lineTo(230, 0); g.lineTo(238, 120); g.lineTo(166, 126); g.fill();   // 縦隔
      g.fillStyle = gy(172); g.beginPath(); g.ellipse(236, 98, 20, 15, 0, 0, 7); g.fill();                                          // 大動脈弓
      g.fillStyle = gy(150);   // 心陰影
      g.beginPath(); g.moveTo(178, 112); g.bezierCurveTo(150, 140, 146, 215, 172, 250); g.bezierCurveTo(220, 268, 290, 262, 306, 236);
      g.bezierCurveTo(318, 205, 292, 150, 250, 128); g.bezierCurveTo(232, 112, 200, 104, 178, 112); g.fill();
      g.fillStyle = gy(140);   // 横隔膜より下（肝臓は右で濃い）
      g.beginPath(); g.moveTo(0, 268); g.quadraticCurveTo(105, 206, 200, 252); g.quadraticCurveTo(300, 218, W, 288); g.lineTo(W, H); g.lineTo(0, H); g.fill();
      g.fillStyle = gy(178); g.beginPath(); g.moveTo(200, 252); g.quadraticCurveTo(300, 218, W, 288); g.lineTo(W, 380); g.lineTo(200, 360); g.fill();
      g.fillStyle = gy(200); [[150, 300, 140], [250, 300, 140]].forEach(([x, y, l]) => { g.beginPath(); g.moveTo(x + (x < 200 ? 30 : -30), y); g.lineTo(x + (x < 200 ? -18 : 18), y + l); g.lineTo(x + (x < 200 ? 4 : -4), y + l); g.lineTo(x + (x < 200 ? 44 : -44), y); g.fill(); });   // 腸腰筋
      g.fillStyle = gy(200); g.beginPath(); g.ellipse(200, 600, 210, 150, 0, 0, 7); g.fill();   // 骨盤の軟部
    });
    // 骨（ぼかしは少なめ）
    R.xlayer(c, 1.6, g => {
      // 鎖骨
      R.rib(g, [[184, 22], [130, 10], [70, 18], [34, 30]], 9, 150); R.rib(g, [[216, 22], [270, 10], [330, 18], [366, 30]], 9, 150);
      // 肋骨（後方は濃く、前方は淡い）
      for (let i = 0; i < 10; i++) {
        const y = 26 + i * 25, d = 160 + i * 2;
        R.rib(g, [[186, y], [140, y - 6 + i], [80, y + 4 + i * 2], [42, y + 30 + i * 3], [36, y + 52 + i * 3]], 7, d);
        R.rib(g, [[214, y], [260, y - 6 + i], [320, y + 4 + i * 2], [358, y + 30 + i * 3], [364, y + 52 + i * 3]], 7, d);
        if (i < 6) { R.rib(g, [[40, y + 60], [90, y + 82], [150, y + 88]], 5, 205); R.rib(g, [[360, y + 60], [310, y + 82], [250, y + 88]], 5, 205); }
      }
      // 椎体
      for (let y = 0, i = 0; y < 440; i++) { const h = y < 270 ? 23 : 29, w = y < 270 ? 32 : 44; R.vert(g, 200, y + 2, w, h - 4, 150); y += h; }
      // 仙骨・腸骨・恥骨・坐骨・大腿骨
      g.fillStyle = gy(158); g.beginPath(); g.moveTo(168, 440); g.lineTo(232, 440); g.lineTo(214, 530); g.lineTo(186, 530); g.fill();
      [false, true].forEach(m => {
        g.save(); if (m) { g.translate(W, 0); g.scale(-1, 1); }
        g.fillStyle = gy(168); g.beginPath(); g.moveTo(172, 446); g.quadraticCurveTo(66, 384, 50, 462); g.quadraticCurveTo(58, 520, 94, 542); g.lineTo(140, 532); g.quadraticCurveTo(150, 484, 176, 474); g.fill();
        g.strokeStyle = gy(130); g.lineWidth = 4; g.beginPath(); g.moveTo(172, 446); g.quadraticCurveTo(66, 384, 50, 462); g.stroke();   // 腸骨稜
        g.strokeStyle = gy(140); g.lineWidth = 3; g.beginPath(); g.moveTo(176, 474); g.quadraticCurveTo(140, 500, 132, 540); g.stroke();  // 骨盤分界線
        g.fillStyle = gy(160); g.beginPath(); g.ellipse(160, 600, 40, 30, 0, 0, 7); g.fill();
        g.fillStyle = gy(232); g.beginPath(); g.ellipse(160, 603, 21, 15, .3, 0, 7); g.fill();                                        // 閉鎖孔
        g.strokeStyle = gy(140); g.lineWidth = 3; g.beginPath(); g.arc(110, 560, 29, Math.PI * 1.05, Math.PI * 1.85); g.stroke();       // 臼蓋
        g.fillStyle = gy(150); g.beginPath(); g.arc(110, 560, 23, 0, 7); g.fill();                                                     // 骨頭
        g.beginPath(); g.moveTo(96, 572); g.lineTo(74, 600); g.lineTo(64, 612); g.lineTo(78, 660); g.lineTo(112, 660); g.lineTo(106, 620); g.lineTo(126, 582); g.fill();
        g.fillStyle = gy(165); g.beginPath(); g.ellipse(70, 600, 13, 18, .3, 0, 7); g.fill();                                          // 大転子
        g.strokeStyle = gy(125); g.lineWidth = 3; g.beginPath(); g.moveTo(80, 620); g.lineTo(84, 660); g.moveTo(106, 622); g.lineTo(108, 660); g.stroke();   // 骨幹の皮質
        g.restore();
      });
    });
    R.xgrain(c, .2);
    // 体表の心電図電極とリード線
    const g = c.getContext('2d');
    R.electrode(g, 120, 40, 1, [100, 10, 90, -10, 80, -20]); R.electrode(g, 290, 42, 1, [310, 10, 320, -10, 330, -20]);
    R.electrode(g, 318, 268, 1, [350, 240, 380, 220, 410, 200]); R.electrode(g, 96, 300, 1, [60, 280, 20, 260, -10, 250]);
    return c;
  }

  function polyTo(g, k, dpx, map) {
    const p = PATHS[k], c = cum[k];
    g.beginPath();
    let s = map(p[0][0], p[0][1]); g.moveTo(s.x, s.y);
    for (let i = 1; i < p.length; i++) {
      if (c[i] >= dpx) { const q = pointAt(k, dpx), m = map(q.x, q.y); g.lineTo(m.x, m.y); break; }
      const m = map(p[i][0], p[i][1]); g.lineTo(m.x, m.y);
    }
  }

  // view: {cx, cy, scale}; objs: {guide, wire:{k,len}, dil:{k,len,fr}, can:{k,len,kind}, marker:{x,y}, needle:{x,y}}
  function draw(g, cw, ch, view, objs, t) {
    if (!bg) bg = makeBg();
    const R = PS.R, sc = view.scale;
    const map = (x, y) => ({ x: (x - view.cx) * sc + cw / 2, y: (y - view.cy) * sc + ch / 2 });
    g.save();
    g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, cw, ch);
    const o = map(0, 0);
    g.imageSmoothingQuality = 'high';
    g.drawImage(bg, o.x, o.y, W * sc, H * sc);
    // 血管のロードマップ（ガイドあり時だけ薄く）
    if (objs.guide) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      [['V', 'rgba(60,110,220,.22)', 15], ['A', 'rgba(220,60,60,.2)', 12]].forEach(([k, col, w]) => {
        g.strokeStyle = col; g.lineWidth = w * sc; polyTo(g, k, 1e9, map); g.stroke();
      });
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (objs.can) {
      // カニューレ：本体は X線を少し通す（灰色の帯）＋らせん状の補強ワイヤー＋先端の不透過マーカー
      const k = objs.can.k, len = objs.can.len * PX_CM, w = (objs.can.kind === 'V' ? 7.5 : 6.5) * sc;
      g.strokeStyle = 'rgba(40,40,38,.42)'; g.lineWidth = w; polyTo(g, k, len, map); g.stroke();
      g.strokeStyle = 'rgba(15,15,14,.5)'; g.lineWidth = 1;
      for (let d = 4; d < len - 6; d += 3) {
        const a = pointAt(k, d), b = pointAt(k, d + 1.5), m = map(a.x, a.y), n = map(b.x, b.y);
        const dx = n.x - m.x, dy = n.y - m.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2;
        g.beginPath(); g.moveTo(m.x - nx, m.y - ny); g.lineTo(n.x + nx, n.y + ny); g.stroke();
      }
      const tip = pointAt(k, len), m = map(tip.x, tip.y);
      g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(m.x, m.y, w * .55, 0, 7); g.fill();
      if (objs.can.kind === 'V') {
        g.fillStyle = 'rgba(225,225,215,.7)';
        for (let d = 8; d < 150; d += 14) { if (len - d < 0) break; const q = map(pointAt(k, len - d).x, pointAt(k, len - d).y); g.beginPath(); g.arc(q.x, q.y, 1.2 * sc, 0, 7); g.fill(); }
      }
      const s0 = map(PATHS[k][0][0], PATHS[k][0][1]);
      g.strokeStyle = 'rgba(40,40,38,.42)'; g.lineWidth = w; g.beginPath(); g.moveTo(s0.x, s0.y); g.lineTo(s0.x + (k === 'V' ? -6 : 6) * sc, s0.y + 80 * sc); g.stroke();
    }
    if (objs.dil) {
      // ダイレーター：ほぼ X線透過（淡い帯）
      const k = objs.dil.k, len = objs.dil.len * PX_CM;
      g.strokeStyle = 'rgba(30,30,28,.26)'; g.lineWidth = (2 + objs.dil.fr / 6) * sc; polyTo(g, k, len, map); g.stroke();
      const s0 = map(PATHS[k][0][0], PATHS[k][0][1]);
      g.beginPath(); g.moveTo(s0.x, s0.y); g.lineTo(s0.x + (k === 'V' ? -5 : 5) * sc, s0.y + 80 * sc); g.stroke();
    }
    if (objs.wire && objs.wire.len > 0) {
      const k = objs.wire.k, len = objs.wire.len * PX_CM;
      g.strokeStyle = 'rgba(8,8,8,.92)'; g.lineWidth = Math.max(1.4, 1.3 * sc);
      polyTo(g, k, len, map); g.stroke();
      const s0 = map(PATHS[k][0][0], PATHS[k][0][1]);
      g.beginPath(); g.moveTo(s0.x, s0.y); g.lineTo(s0.x + (k === 'V' ? -10 : 10) * sc, s0.y + 90 * sc); g.stroke();
      const tip = pointAt(k, len), m = map(tip.x, tip.y);   // Jチップ
      g.lineWidth = Math.max(1.6, 1.5 * sc); g.beginPath(); g.arc(m.x + 3 * sc, m.y, 3 * sc, Math.PI, Math.PI * 2.6); g.stroke();
    }
    if (objs.needle) {
      const m = map(objs.needle.x, objs.needle.y);
      g.strokeStyle = '#060606'; g.lineWidth = 2 * sc;
      g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(m.x + 6 * sc, m.y + 40 * sc); g.stroke();
    }
    if (objs.marker) {
      // 皮膚の上に置いたペアン先端（X線不透過）
      const m = map(objs.marker.x, objs.marker.y);
      g.strokeStyle = '#070707'; g.lineWidth = 2.6 * sc;
      g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(m.x - 7 * sc, m.y + 46 * sc); g.moveTo(m.x, m.y); g.lineTo(m.x + 7 * sc, m.y + 46 * sc); g.stroke();
      g.beginPath(); g.arc(m.x - 9 * sc, m.y + 52 * sc, 5 * sc, 0, 7); g.arc(m.x + 9 * sc, m.y + 52 * sc, 5 * sc, 0, 7); g.stroke();
    }
    R.xfinish(g, cw, ch, { noise: .6, vign: .55, text: { tl: ['FLUORO', '7.5 p/s'], tr: [view.scale > 1.5 ? 'MAG 2' : 'FOV 48'], bl: ['AP'], br: [R.clock()] } });
    g.restore();
    return map;
  }

  PS.Fluoro = { PATHS, HEADS, PX_CM, pointAt, maxLen, zone, draw, W, H };
})();
