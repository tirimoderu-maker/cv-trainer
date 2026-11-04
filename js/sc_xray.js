// sc_xray.js — 胸部X線（ポータブル・AP）。CVカテーテルの先端位置と気胸を見る。
// 透視と違い、写真の向き（骨・カテーテルが白、肺が黒）。
(function () {
  const W = 420, H = 480;
  // 右内頸から入ったカテーテルの経路（画面左＝患者の右）
  const PATH = [[118, -30], [128, 30], [140, 80], [152, 118], [166, 146], [176, 172], [181, 200], [183, 236], [184, 272], [186, 306], [190, 340]];
  const CARINA = { x: 210, y: 196 }, VBU = 31, CAJ_Y = CARINA.y + 2 * VBU;   // CAJ＝気管分岐部から椎体2つ下（Baskin 2008）
  const cum = [0]; for (let i = 1; i < PATH.length; i++) cum.push(cum[i - 1] + Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]));
  const at = d => { d = PS.clamp(d, 0, cum[cum.length - 1]); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1]); return [PATH[i - 1][0] + (PATH[i][0] - PATH[i - 1][0]) * t, PATH[i - 1][1] + (PATH[i][1] - PATH[i - 1][1]) * t]; };
  // 14 cm で気管分岐部の高さ（y≈200）になるよう換算
  const PXCM = (() => { let i = 1; while (PATH[i][1] < 200) i++; return (cum[i - 1] + (200 - PATH[i - 1][1]) / (PATH[i][1] - PATH[i - 1][1]) * (cum[i] - cum[i - 1])) / 14; })();

  let root, cv, g, ro, raf, S0, bgs = {};
  PS.scene('xray', {
    mount(host, S) {
      S0 = S;
      host.innerHTML = `<div class="field"><div class="fd-main" style="background:#000"><canvas id="xrc" width="${W}" height="${H}"></canvas></div>
        <div class="fd-side"><div class="mon note"><div class="mon-h">ポータブル胸部X線（臥位・AP）</div><p class="mon-p" id="xrNote"></p></div></div></div>`;
      root = host; cv = host.querySelector('#xrc'); g = cv.getContext('2d'); ro = PS.fit(cv, cv.parentElement);
      const loop = () => { draw(); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
    },
    update(S, st) { S0 = S; root.querySelector('#xrNote').innerHTML = (typeof st.note === 'function' ? st.note(S) : st.note) || ''; },
    unmount() { cancelAnimationFrame(raf); ro && ro.disconnect(); },
  });

  // 写真の向き（空気＝黒、骨・軟部＝白）で、ぼかした層を足し引きして作る
  const LUNG_R = { x: 128, y: 222, rx: 80, ry: 150 }, PTX = { x: 104, y: 150, rx: 58, ry: 92 };
  function makeBg(ptx) {
    const R = PS.R, c = R.mk(W, H), x = c.getContext('2d'), gy = R.grey;
    x.fillStyle = '#060606'; x.fillRect(0, 0, W, H);
    const add = (k, fn, a = 1) => { const l = R.soft(W, H, k, q => { q.fillStyle = '#000'; q.fillRect(0, 0, W, H); fn(q); }); x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = a; x.drawImage(l, 0, 0); x.restore(); };
    const mul = (k, fn) => { const l = R.soft(W, H, k, q => { q.fillStyle = '#fff'; q.fillRect(0, 0, W, H); fn(q); }); x.save(); x.globalCompositeOperation = 'multiply'; x.drawImage(l, 0, 0); x.restore(); };
    const curve = (q, P, w, v) => { q.lineCap = 'round'; q.lineJoin = 'round'; q.strokeStyle = gy(v); q.lineWidth = w; q.beginPath(); R.spline2(P, 8).forEach((p, i) => i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1])); q.stroke(); };
    // 胸壁・腕の付け根の軟部
    add(10, q => { q.fillStyle = gy(120); q.beginPath(); q.ellipse(210, 250, 196, 300, 0, 0, 7); q.fill(); q.fillStyle = gy(40); q.fillRect(0, 0, 40, H); q.fillRect(W - 40, 0, 40, H); });
    // 肺（黒く抜ける）。気胸の側は肺の縁より外がさらに黒い
    mul(7, q => {
      q.fillStyle = gy(80); q.beginPath(); q.ellipse(LUNG_R.x, LUNG_R.y, LUNG_R.rx, LUNG_R.ry, .05, 0, 7); q.fill();
      q.beginPath(); q.ellipse(294, 228, 76, 146, -.05, 0, 7); q.fill();
    });
    if (ptx) mul(2, q => { q.fillStyle = gy(150); q.beginPath(); q.ellipse(LUNG_R.x - 6, LUNG_R.y - 20, LUNG_R.rx + 4, LUNG_R.ry - 4, .05, 0, 7); q.fill(); q.globalCompositeOperation = 'destination-out'; q.beginPath(); q.ellipse(PTX.x + 12, PTX.y + 30, PTX.rx, PTX.ry + 30, .1, 0, 7); q.fill(); });
    // 縦隔・心臓・大動脈弓・横隔膜より下
    add(5, q => {
      q.fillStyle = gy(62); q.beginPath(); q.moveTo(180, 0); q.lineTo(242, 0); q.lineTo(250, 220); q.lineTo(172, 220); q.fill();
      q.fillStyle = gy(60); q.beginPath(); q.ellipse(250, 166, 22, 16, 0, 0, 7); q.fill();
      q.fillStyle = gy(78); q.beginPath(); q.moveTo(184, 222); q.bezierCurveTo(150, 250, 150, 330, 182, 372); q.bezierCurveTo(240, 394, 322, 386, 338, 350); q.bezierCurveTo(352, 310, 318, 252, 262, 230); q.bezierCurveTo(240, 216, 205, 212, 184, 222); q.fill();
      q.fillStyle = gy(64); q.beginPath(); q.moveTo(0, 396); q.quadraticCurveTo(105, 338, 205, 384); q.quadraticCurveTo(310, 352, W, 406); q.lineTo(W, H); q.lineTo(0, H); q.fill();
    });
    // 肺紋理（肺門から広がる血管影、外へ細く淡く）
    add(1.3, q => {
      const r = R.rng(4);
      [[176, 214, -1], [244, 218, 1]].forEach(([hx, hy, sd]) => {
        for (let i = 0; i < 16; i++) {
          let a = sd < 0 ? Math.PI + (r() - .5) * 2.2 : (r() - .5) * 2.2, px = hx, py = hy, w = 3.2;
          for (let j = 0; j < 5; j++) {
            const len = 14 + r() * 16, nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len;
            if (ptx && sd < 0 && ((nx - PTX.x) / PTX.rx) ** 2 + ((ny - PTX.y - 30) / (PTX.ry + 30)) ** 2 < 1) break;
            q.strokeStyle = gy(Math.round(38 - j * 6)); q.lineWidth = w; q.beginPath(); q.moveTo(px, py); q.lineTo(nx, ny); q.stroke();
            px = nx; py = ny; w *= .72; a += (r() - .5) * .5;
          }
        }
      });
    });
    // 気管・主気管支（黒い透亮像）
    mul(2.5, q => { q.strokeStyle = gy(150); q.lineCap = 'round'; q.lineWidth = 15; q.beginPath(); q.moveTo(210, 10); q.lineTo(210, CARINA.y); q.stroke(); q.lineWidth = 10; q.beginPath(); q.moveTo(208, CARINA.y); q.lineTo(176, 232); q.moveTo(212, CARINA.y); q.lineTo(246, 236); q.stroke(); });
    // 骨：椎体（淡い）・肋骨（後方は濃く、前方は淡い）・鎖骨・肩甲骨の縁
    add(1.6, q => {
      for (let i = 0; i < 13; i++) { const y = 18 + i * 31; q.fillStyle = gy(16); q.beginPath(); q.roundRect(197, y, 28, 24, 6); q.fill(); q.strokeStyle = gy(30); q.lineWidth = 2; [-1, 1].forEach(sd => { q.beginPath(); q.ellipse(211 + sd * 11, y + 9, 4, 6, 0, 0, 7); q.stroke(); }); }
      for (let i = 0; i < 10; i++) {
        const y = 40 + i * 30, d = 44 - i * 1.5;
        curve(q, [[196, y], [168, y - 10], [118, y - 6], [70, y + 14], [44, y + 46], [40, y + 70]], 7, d);
        curve(q, [[224, y], [252, y - 10], [302, y - 6], [350, y + 14], [376, y + 46], [380, y + 70]], 7, d);
        if (i < 7) { curve(q, [[46, y + 64], [80, y + 90], [130, y + 110], [168, y + 118]], 8, 22); curve(q, [[374, y + 64], [340, y + 90], [290, y + 110], [252, y + 118]], 8, 22); }
      }
      curve(q, [[196, 40], [160, 30], [110, 24], [70, 34], [36, 30]], 11, 70); curve(q, [[224, 40], [260, 30], [310, 24], [350, 34], [384, 30]], 11, 70);
      curve(q, [[58, 40], [70, 120], [92, 190]], 3, 28); curve(q, [[362, 40], [350, 120], [328, 190]], 3, 28);
    });
    if (ptx) { x.strokeStyle = 'rgba(235,235,235,.55)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(PTX.x + 12, PTX.y + 30, PTX.rx, PTX.ry + 30, .1, Math.PI * .62, Math.PI * 1.7); x.stroke(); }
    R.xgrain(c, .12);
    return c;
  }
  function draw() {
    const S = S0; if (!S) return;
    const R = PS.R, x = S.x || {}, key = x.ptx ? 'p' : 'n';
    if (!bgs[key]) bgs[key] = makeBg(x.ptx);
    g.drawImage(bgs[key], 0, 0);
    // 心電図の電極・リード
    [[60, 30], [360, 30], [370, 420]].forEach(([ex, ey]) => { g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(ex, ey, 6, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(ex, ey); g.quadraticCurveTo(ex + 20, ey + 60, ex + (ex < 200 ? -30 : 30), ey + 120); g.stroke(); });
    // カテーテル（白い線）と先端
    if (x.cv != null) {
      const n = Math.max(2, Math.ceil(x.cv * PXCM / 4)), pts = []; for (let i = 0; i <= n; i++) pts.push(at(i / n * x.cv * PXCM));
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
    }
    R.xfinish(g, W, H, { noise: .25, vign: .35, text: { tl: ['PORTABLE', 'AP SUPINE'], tr: ['R'], br: [R.clock()] } });
    const st = PS.cur && PS.cur.steps[PS.cur.i];
    if (!S.exam && st && st.showCarina) {
      const hl = (y, col, s) => { g.strokeStyle = col; g.setLineDash([5, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(60, y); g.lineTo(360, y); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.font = '12px "Hiragino Sans", sans-serif'; g.textAlign = 'left'; g.fillText(s, 262, y - 6); };
      hl(CARINA.y, 'rgba(255,207,51,.95)', '気管分岐部');
      hl(CAJ_Y, 'rgba(110,220,255,.95)', 'CAJ（椎体2つ下）');
      // 椎体を数える（分岐部 → 1 → 2）
      g.fillStyle = 'rgba(110,220,255,.95)'; g.font = 'bold 11px "Hiragino Sans", sans-serif'; g.textAlign = 'left';
      [1, 2].forEach(k => g.fillText(String(k), 232, CARINA.y + k * VBU - 8));
      // 区域（Stonelake 2006 / Imai 2026）：カテーテルの経路の左に括弧
      const br = (y0, y1, col, s1, s2) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(156, y0); g.lineTo(150, y0); g.lineTo(150, y1); g.lineTo(156, y1); g.stroke(); g.fillStyle = col; g.textAlign = 'right'; g.font = 'bold 12px "Hiragino Sans", sans-serif'; g.fillText(s1, 144, (y0 + y1) / 2 - 2); g.font = '10px "Hiragino Sans", sans-serif'; g.fillText(s2, 144, (y0 + y1) / 2 + 12); };
      br(150, CARINA.y + 4, 'rgba(255,207,51,.95)', 'Zone B', '上部上大静脈');
      br(CARINA.y + 16, CAJ_Y + 20, 'rgba(110,220,255,.95)', 'Zone A', '下部SVC〜CAJ（目標）');
    }
  }
  PS.Xray = { PXCM, CARINA, CAJ_Y };
})();
