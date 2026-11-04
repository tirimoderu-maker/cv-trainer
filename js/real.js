// real.js — 見た目をリアルにする共通部品
//   X線：濃度を掛け合わせた解剖のベース・量子ノイズ・ビネット・装置の文字表示
//   エコー：スペックル（横に伸びた粒）・層構造・後方エコー増強/音響陰影・多重反射・カラードプラ・装置の文字表示
//   器具：円筒の陰影（チューブ・カテーテル・ワイヤー）・金属・影
(function () {
  const R = PS.R = {};
  // 再現できる乱数
  R.rng = seed => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; };
  const gauss = r => { let u = 0; for (let i = 0; i < 4; i++) u += r(); return (u - 2) * 1.73; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  R.mk = mk;

  // ---------- ノイズ（オーバーレイ合成で使う。128 が「変化なし」） ----------
  const noiseCache = {};
  function noiseTile(key, n, amp, grain) {
    if (noiseCache[key]) return noiseCache[key];
    const c = mk(n, n), g = c.getContext('2d'), im = g.createImageData(n, n), d = im.data, r = R.rng(key.length * 977 + n);
    for (let i = 0; i < n * n; i++) { const v = PS.clamp(128 + gauss(r) * amp, 0, 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    let out = c;
    if (grain > 1) { out = mk(n * grain, n * grain); const o = out.getContext('2d'); o.imageSmoothingEnabled = true; o.drawImage(c, 0, 0, n * grain, n * grain); }
    noiseCache[key] = out; return out;
  }
  // 画面全体に量子ノイズを乗せる（毎フレーム位置を変える＝透視のざらつき）
  R.mottle = (g, w, h, amt = .5, grain = 1) => {
    const tile = noiseTile('q' + grain, 160, 34, grain), pat = g.createPattern(tile, 'repeat');
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = amt;
    const ox = Math.floor(Math.random() * tile.width), oy = Math.floor(Math.random() * tile.height);
    g.translate(-ox, -oy); g.fillStyle = pat; g.fillRect(0, 0, w + ox, h + oy);
    g.restore();
  };

  // ぼかした図形を作る（縮小して描き、拡大して戻す＝どのブラウザでも効くぼかし）
  R.soft = (w, h, k, fn) => {
    const sw = Math.max(1, Math.round(w / k)), sh = Math.max(1, Math.round(h / k));
    const s = mk(sw, sh), sg = s.getContext('2d');
    sg.scale(1 / k, 1 / k); fn(sg);
    const c = mk(w, h), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(s, 0, 0, w, h);
    return c;
  };

  // ---------- X線 ----------
  // 濃い（X線を通しにくい）ほど暗い。base は肺野の明るさ
  R.xbase = (w, h, base = 205) => { const c = mk(w, h), g = c.getContext('2d'); g.fillStyle = `rgb(${base},${base},${base - 3})`; g.fillRect(0, 0, w, h); return c; };
  // ぼかした濃度レイヤーを乗算で重ねる
  R.xlayer = (dst, k, fn) => {
    const w = dst.width, h = dst.height;
    const lay = R.soft(w, h, k, sg => { sg.fillStyle = '#fff'; sg.fillRect(0, 0, w, h); fn(sg); });
    const g = dst.getContext('2d'); g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(lay, 0, 0); g.restore();
  };
  // 明るくする（肺・空気）
  R.xlight = (dst, k, fn) => {
    const w = dst.width, h = dst.height;
    const lay = R.soft(w, h, k, sg => { sg.fillStyle = '#000'; sg.fillRect(0, 0, w, h); fn(sg); });
    const g = dst.getContext('2d'); g.save(); g.globalCompositeOperation = 'screen'; g.drawImage(lay, 0, 0); g.restore();
  };
  // 骨の質感（細かい梁）
  R.xgrain = (dst, amt = .18) => {
    const g = dst.getContext('2d'), tile = noiseTile('b', 128, 40, 2);
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = amt; g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, dst.width, dst.height); g.restore();
  };
  const grey = v => `rgb(${v},${v},${v})`;
  R.grey = grey;
  // 肋骨1本（皮質が濃く、髄が少し抜ける）
  R.rib = (g, pts, w, v = 150) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = grey(v); g.lineWidth = w; line(g, pts); g.stroke();
    g.strokeStyle = grey(Math.min(255, v + 45)); g.lineWidth = w * .45; line(g, pts); g.stroke();
  };
  function line(g, pts) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); }
  R.line = line;
  // 椎体（終板と椎弓根）
  R.vert = (g, x, y, w, h, v = 140) => {
    g.fillStyle = grey(v); g.beginPath(); g.roundRect(x - w / 2, y, w, h, 3); g.fill();
    g.strokeStyle = grey(v - 30); g.lineWidth = 2; g.beginPath(); g.moveTo(x - w / 2, y + 1); g.lineTo(x + w / 2, y + 1); g.moveTo(x - w / 2, y + h - 1); g.lineTo(x + w / 2, y + h - 1); g.stroke();
    g.fillStyle = grey(v - 40);
    [-1, 1].forEach(s => { g.beginPath(); g.ellipse(x + s * (w / 2 - w * .17), y + h * .4, w * .1, h * .22, 0, 0, 7); g.fill(); });
    g.fillStyle = grey(v + 18); [-1, 1].forEach(s => { g.beginPath(); g.ellipse(x + s * (w / 2 - w * .17), y + h * .4, w * .05, h * .12, 0, 0, 7); g.fill(); });
  };
  // 心電図電極とリード線（体表のもの。透視で必ず写る）
  R.electrode = (g, x, y, s = 1, lead) => {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = 'rgba(30,30,30,.55)'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
    g.fillStyle = 'rgba(20,20,20,.9)'; g.beginPath(); g.arc(0, 0, 2.6, 0, 7); g.fill();
    g.restore();
    if (lead) { g.strokeStyle = 'rgba(25,25,25,.55)'; g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(lead[0], lead[1], lead[2], lead[3], lead[4], lead[5]); g.stroke(); }
  };

  // 透視の仕上げ：ノイズ・ビネット・コリメーター・文字
  R.xfinish = (g, w, h, o = {}) => {
    R.mottle(g, w, h, o.noise == null ? .55 : o.noise, o.grain || 1);
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${o.vign == null ? .5 : o.vign})`);
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    if (o.shutter) {   // 上下のコリメーター（少し暗い帯）
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, w, o.shutter); g.fillRect(0, h - o.shutter, w, o.shutter);
    }
    g.font = '10px Menlo, "SF Mono", monospace'; g.fillStyle = 'rgba(235,238,240,.85)';
    g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 2;
    const L = o.text || {};
    g.textAlign = 'left'; (L.tl || []).forEach((s, i) => g.fillText(s, 6, 13 + i * 12));
    g.textAlign = 'right'; (L.tr || []).forEach((s, i) => g.fillText(s, w - 6, 13 + i * 12));
    g.textAlign = 'left'; (L.bl || []).slice().reverse().forEach((s, i) => g.fillText(s, 6, h - 6 - i * 12));
    g.textAlign = 'right'; (L.br || []).slice().reverse().forEach((s, i) => g.fillText(s, w - 6, h - 6 - i * 12));
    g.shadowBlur = 0;
    if (o.rec) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(w - 10, 30, 4, 0, 7); g.fill(); }
  };
  R.clock = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

  // ---------- 器具 ----------
  // 円筒（チューブ・カテーテル・ダイレーター）。pts に沿って陰影つきで描く
  R.tube = (g, pts, w, col, o = {}) => {
    if (pts.length < 2) return;
    g.save(); g.lineCap = o.cap || 'round'; g.lineJoin = 'round';
    if (o.shadow !== false) { g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = o.sb || 5; g.shadowOffsetX = o.sx || 2.5; g.shadowOffsetY = o.sy || 3.5; }
    g.strokeStyle = o.edge || shade(col, -.45); g.lineWidth = w; line(g, pts); g.stroke();
    g.shadowColor = 'transparent';
    g.strokeStyle = col; g.lineWidth = w * .78; line(g, pts); g.stroke();
    if (o.core) { g.strokeStyle = o.core; g.lineWidth = w * (o.coreW || .5); line(g, pts); g.stroke(); }
    // ハイライト（左上から光）
    g.translate(-w * .16, -w * .16);
    g.strokeStyle = o.hi || 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(.8, w * .2); line(g, pts); g.stroke();
    g.restore();
  };
  // 色を明るく/暗く（#rrggbb）
  function shade(hex, k) {
    if (!/^#/.test(hex)) return 'rgba(0,0,0,.5)';
    const n = parseInt(hex.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
    return `rgb(${f(r)},${f(gg)},${f(b)})`;
  }
  R.shade = shade;
  // 金属の棒（針・鉗子）
  R.metal = (g, x1, y1, x2, y2, w) => {
    g.save(); g.lineCap = 'round';
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
    g.strokeStyle = '#7d858d'; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#c9cfd5'; g.lineWidth = w * .6; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(.6, w * .22); g.beginPath(); g.moveTo(x1 - w * .15, y1 - w * .15); g.lineTo(x2 - w * .15, y2 - w * .15); g.stroke();
    g.restore();
  };
  // 立体の箱（ハブ・コネクタ）。中心 x,y・幅 w・高さ h・回転 a
  R.part = (g, x, y, w, h, col, a = 0, r = 3) => {
    g.save(); g.translate(x, y); g.rotate(a);
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
    const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    gr.addColorStop(0, shade(col, -.35)); gr.addColorStop(.35, shade(col, .35)); gr.addColorStop(.6, col); gr.addColorStop(1, shade(col, -.45));
    g.fillStyle = gr; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, r); g.fill();
    g.restore();
  };
  // 手袋の指先（ワイヤーをつまむ・押さえる）
  R.fingers = (g, x, y, a = 0, s = 1) => {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 4;
    const glove = (cx, cy, rx, ry, rot) => {
      const gr = g.createRadialGradient(cx - rx * .3, cy - ry * .3, 1, cx, cy, Math.max(rx, ry));
      gr.addColorStop(0, '#f3ece0'); gr.addColorStop(.7, '#ddd2bf'); gr.addColorStop(1, '#bfb19a');
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 7); g.fill();
    };
    glove(-9, 10, 8, 16, .35);   // 親指
    glove(9, 8, 8, 18, -.3);     // 示指
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(120,100,70,.35)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(-9, 2, 5, 4, .35, 0, 7); g.stroke(); g.beginPath(); g.ellipse(9, -2, 5, 4, -.3, 0, 7); g.stroke();
    g.restore();
  };

  // 手元のノブを正面から見た図（溝が回る）＋先端の向きの黄色い矢印
  R.knob = (g, x, y, r, ang, on, label) => {
    g.save();
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 10; g.shadowOffsetX = 3; g.shadowOffsetY = 5;
    g.fillStyle = '#1e2227'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(x + (r - 2) * Math.cos(a), y + (r - 2) * Math.sin(a)); g.lineTo(x + (r - 7) * Math.cos(a), y + (r - 7) * Math.sin(a)); g.stroke(); }
    const kr = r - 12, kg = g.createRadialGradient(x - 14, y - 16, 4, x, y, kr);
    kg.addColorStop(0, on ? '#f4f6f8' : '#7a8188'); kg.addColorStop(.7, on ? '#b9c0c7' : '#5c636a'); kg.addColorStop(1, on ? '#7f8890' : '#41474d');
    g.fillStyle = kg; g.beginPath(); g.arc(x, y, kr, 0, 7); g.fill();
    g.strokeStyle = 'rgba(40,46,52,.55)'; g.lineWidth = 2;
    for (let i = 0; i < 28; i++) { const a = -ang + i * Math.PI * 2 / 28; g.beginPath(); g.moveTo(x + (kr - 1) * Math.cos(a), y + (kr - 1) * Math.sin(a)); g.lineTo(x + (kr - 7) * Math.cos(a), y + (kr - 7) * Math.sin(a)); g.stroke(); }
    g.fillStyle = on ? '#2a2f35' : '#33383e'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
    if (on) {
      const x2 = x + (kr - 12) * Math.cos(ang), y2 = y - (kr - 12) * Math.sin(ang);
      g.strokeStyle = '#ffcf33'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 10 * Math.cos(ang), y - 10 * Math.sin(ang)); g.lineTo(x2, y2); g.stroke();
      g.fillStyle = '#ffcf33'; g.beginPath(); g.moveTo(x2 + 9 * Math.cos(ang), y2 - 9 * Math.sin(ang)); g.lineTo(x2 + 6 * Math.cos(ang + 2.2), y2 - 6 * Math.sin(ang + 2.2)); g.lineTo(x2 + 6 * Math.cos(ang - 2.2), y2 - 6 * Math.sin(ang - 2.2)); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '10px "Hiragino Sans", sans-serif'; g.textAlign = 'center';
    if (label) g.fillText(label, x, y + r + 16);
    if (!on) g.fillText('（回さない）', x, y + 4);
    g.restore();
  };
  // 2D の Catmull-Rom（[x,y] の列）
  R.spline2 = (P, n = 6) => {
    if (P.length < 3) return P.slice();
    const o = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let j = 0; j < n; j++) { const t = j / n, t2 = t * t, t3 = t2 * t; o.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
    }
    o.push(P[P.length - 1]); return o;
  };

  // ---------- 布・皮膚のテクスチャ ----------
  const texCache = {};
  R.drape = (col = '#2f6f9e') => {
    if (texCache[col]) return texCache[col];
    const n = 128, c = mk(n, n), g = c.getContext('2d'), r = R.rng(7);
    g.fillStyle = col; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) { const x = r() * n, y = r() * n, l = r() < .5; g.fillStyle = l ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.fillRect(x, y, 1 + r() * 2, 1); }
    for (let y = 0; y < n; y += 2) { g.fillStyle = 'rgba(0,0,0,.035)'; g.fillRect(0, y, n, 1); }
    texCache[col] = c; return c;
  };
  // ポビドンヨードを塗った皮膚（茶色のむら＋濡れたつや）
  R.iodineSkin = (w, h, seed = 3) => {
    const key = 'skin' + w + 'x' + h + seed; if (texCache[key]) return texCache[key];
    const c = R.soft(w, h, 3, g => {
      const r = R.rng(seed);
      g.fillStyle = '#9c5524'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.fillStyle = r() < .5 ? `rgba(70,28,8,${.08 + r() * .14})` : `rgba(200,120,60,${.06 + r() * .12})`; g.beginPath(); g.ellipse(r() * w, r() * h, 12 + r() * 50, 6 + r() * 22, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 22; i++) { g.strokeStyle = `rgba(60,22,6,${.10 + r() * .12})`; g.lineWidth = 6 + r() * 10; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.bezierCurveTo(x + 40, y + r() * 60, x + 80, y - 20, x + 140, y + r() * 40); g.stroke(); }
    });
    const g = c.getContext('2d'), tile = noiseTile('s', 96, 18, 1);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = .35; g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, w, h);
    texCache[key] = c; return c;
  };

  // ---------- エコー（Bモード） ----------
  // 組織像：皮膚→皮下脂肪（暗く隔壁が光る）→筋膜→筋（線維状）。px＝1 cm のピクセル数
  R.usTissue = (W, H, px, o = {}) => {
    const key = ['us', W, H, px, JSON.stringify(o)].join('|'); if (texCache[key]) return texCache[key];
    const r = R.rng(o.seed || 11);
    // スペックル：横に長い粒（レイリー分布の雑音を横方向にぼかす）
    const sp = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { const a = gauss(r), b = gauss(r); sp[i] = Math.sqrt(a * a + b * b) * .55; }
    const sp2 = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let k = -3; k <= 3; k++) { const xx = x + k; if (xx < 0 || xx >= W) continue; const wt = 1 - Math.abs(k) / 4; s += sp[y * W + xx] * wt; n += wt; }
      if (y > 0) { s += sp[(y - 1) * W + x] * .5; n += .5; }
      sp2[y * W + x] = s / n;
    }
    const fat = o.fat || .9, fascia = o.fascia || 1.0, skin = o.skin || .12;
    // 皮下脂肪の隔壁・筋の線維の線
    const septa = [], fib = [];
    for (let i = 0; i < 26; i++) septa.push({ y: skin + r() * (fat - skin), a: (r() - .5) * .25, ph: r() * 6, amp: .03 + r() * .06 });
    for (let i = 0; i < 40; i++) fib.push({ y: fascia + .1 + r() * 6, a: (o.fibAng || .12) + (r() - .5) * .05, ph: r() * 6 });
    const c = mk(W, H), g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
    for (let y = 0; y < H; y++) {
      const dep = y / px;
      for (let x = 0; x < W; x++) {
        const xc = (x - W / 2) / px;
        let base;
        if (dep < skin) base = 170 + 40 * (1 - dep / skin);
        else if (dep < fat) {
          base = 46;
          for (const s of septa) { const yy = s.y + s.a * xc + s.amp * Math.sin(xc * 3 + s.ph); const dd = Math.abs(dep - yy) * px; if (dd < 1.6) base += 70 * (1 - dd / 1.6); }
        } else if (Math.abs(dep - fascia) < .06) base = 175;
        else if (dep < fascia) base = 60;
        else {
          base = 78;
          for (const f of fib) { const yy = f.y + f.a * xc + .04 * Math.sin(xc * 2 + f.ph); const dd = Math.abs(dep - yy) * px; if (dd < 1.4) base += 50 * (1 - dd / 1.4); }
        }
        if (o.deepFascia && Math.abs(dep - o.deepFascia) < .05) base = 160;
        base *= Math.exp(-dep * (o.att || .12));        // 深さで減衰（TGCで補正しきれない分）
        if (dep < .35) base *= 1.1;                      // 近距離の明るさ
        const v = PS.clamp(base * sp2[y * W + x], 0, 255);
        const k = (y * W + x) * 4; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    texCache[key] = c; return c;
  };
  // 低輝度の粒（血管の内腔の中のわずかなエコー）
  R.usLumen = (g, x, y, rx, ry, o = {}) => {
    g.save();
    g.beginPath(); g.ellipse(x, y, rx, ry, o.rot || 0, 0, 7); g.clip();
    g.fillStyle = '#040404'; g.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 + 4);
    const tile = noiseTile('l', 64, 22, 1);
    g.globalAlpha = .1; g.globalCompositeOperation = 'lighter'; g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    g.restore();
  };
  // 血管1本（短軸）：内腔・壁・後方エコー増強・側方陰影
  R.usVessel = (g, x, y, rx, ry, art, H, o = {}) => {
    // 後方エコー増強
    const gr = g.createLinearGradient(0, y + ry, 0, Math.min(H, y + ry + 90));
    gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - rx * .85, y + ry * .6, rx * 1.7, 90); g.restore();
    // 側方陰影（辺縁で屈折）
    [-1, 1].forEach(s => { const sg = g.createLinearGradient(0, y, 0, Math.min(H, y + 110)); sg.addColorStop(0, 'rgba(0,0,0,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(x + s * rx - 1.5, y, 3, 110); });
    R.usLumen(g, x, y, rx, ry);
    g.save();
    if (art) {   // 動脈：厚く明るい壁（内膜中膜の二重線）
      g.strokeStyle = 'rgba(225,225,220,.85)'; g.lineWidth = 2.6; g.beginPath(); g.ellipse(x, y, rx + 1.6, ry + 1.6, 0, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(150,150,145,.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, rx + .2, ry + .2, 0, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(255,255,250,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, rx + 1.6, ry + 1.6, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    } else {     // 静脈：薄い壁
      g.strokeStyle = 'rgba(190,190,185,.55)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, rx + .6, ry + .6, 0, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(230,230,225,.5)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y, rx + .6, ry + .6, 0, Math.PI * .1, Math.PI * .9); g.stroke();
    }
    g.restore();
  };
  // 骨：明るい皮質の線＋その下の音響陰影
  R.usBone = (g, x, y, rx, ry, H, a0 = Math.PI * 1.05, a1 = Math.PI * 1.95) => {
    g.save();
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, a0, a1); g.lineTo(x + rx * Math.cos(a1), H); g.lineTo(x + rx * Math.cos(a0), H); g.closePath();
    g.fillStyle = 'rgba(0,0,0,.88)'; g.fill();
    g.strokeStyle = 'rgba(255,255,248,.95)'; g.lineWidth = 3.4; g.beginPath(); g.ellipse(x, y, rx, ry, 0, a0, a1); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 7; g.stroke();
    g.restore();
  };
  // 腱（線維状の明るい楕円）
  R.usTendon = (g, x, y, rx, ry) => {
    g.save(); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.clip();
    g.fillStyle = 'rgba(180,180,175,.55)'; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = -6; i < 7; i++) { g.fillRect(x - rx, y + i * ry / 6, rx * 2, 1); }
    g.restore();
  };
  // 針先（短軸＝点）と多重反射
  R.usNeedleDot = (g, x, y, ring) => {
    g.save();
    g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 4; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); g.shadowBlur = 0;
    for (let k = 1; k < 6; k++) { g.fillStyle = `rgba(255,255,255,${.55 - k * .09})`; g.fillRect(x - 3.5 + k * .2, y + k * 4.2, 7 - k * .4, 1.4); }
    if (ring) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke(); }
    g.restore();
  };
  // カラードプラ：ボックス内の血管だけ色を塗る。art は収縮期で赤→黄（折り返しのモザイク）
  R.usColor = (g, x, y, rx, ry, art, b) => {
    g.save(); g.beginPath(); g.ellipse(x, y, rx * .94, ry * .94, 0, 0, 7); g.clip();
    if (art) {
      if (b > .04) {
        const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        gr.addColorStop(0, `rgba(255,${200 + 55 * b},${60 + 80 * b},${.6 + .35 * b})`); gr.addColorStop(.6, `rgba(235,${70 + 120 * b},30,${.55 + .4 * b})`); gr.addColorStop(1, 'rgba(160,20,10,.7)');
        g.fillStyle = gr; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
        if (b > .6) { const r = Math.random; for (let i = 0; i < 26; i++) { g.fillStyle = r() < .5 ? 'rgba(80,200,255,.75)' : 'rgba(255,255,120,.8)'; g.fillRect(x + (r() - .5) * rx * 1.2, y + (r() - .5) * ry * 1.2, 2, 2); } }
      } else { g.fillStyle = 'rgba(120,10,10,.35)'; g.fillRect(x - rx, y - ry, rx * 2, ry * 2); }
    } else {
      const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      gr.addColorStop(0, 'rgba(70,170,255,.85)'); gr.addColorStop(.7, 'rgba(30,70,220,.8)'); gr.addColorStop(1, 'rgba(10,20,120,.7)');
      g.fillStyle = gr; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    }
    g.restore();
  };
  // 装置の文字・深さ目盛・フォーカス・プローブマーカー・カラーバー
  R.usUI = (g, X, Y, W, H, px, o = {}) => {
    g.save();
    g.font = '9.5px Menlo, "SF Mono", monospace'; g.fillStyle = 'rgba(220,226,232,.9)'; g.textAlign = 'left';
    (o.info || ['L12-3', '12.0MHz', 'Gn 54', 'DR 60', 'FR 31']).forEach((s, i) => g.fillText(s, X + 4, Y + 12 + i * 11));
    // プローブの向きマーカー（画面左上）
    g.fillStyle = '#7fd0ff'; g.beginPath(); g.moveTo(X + W * .12, Y + 3); g.lineTo(X + W * .12 + 7, Y + 3); g.lineTo(X + W * .12 + 3.5, Y + 9); g.fill();
    // 深さ目盛
    const maxD = H / px;
    g.fillStyle = 'rgba(220,226,232,.85)'; g.textAlign = 'right';
    for (let d = .5; d < maxD; d += .5) {
      const yy = Y + d * px, big = Math.abs(d - Math.round(d)) < .01;
      g.fillRect(X + W - (big ? 7 : 4), yy, big ? 7 : 4, 1);
      if (big) g.fillText(String(Math.round(d)), X + W - 9, yy + 3.5);
    }
    // フォーカス
    const fd = o.focus || maxD * .45;
    g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(X + W - 1, Y + fd * px); g.lineTo(X + W - 7, Y + fd * px - 4); g.lineTo(X + W - 7, Y + fd * px + 4); g.fill();
    g.textAlign = 'right'; g.fillStyle = 'rgba(220,226,232,.9)'; g.fillText(`D ${maxD.toFixed(1)}cm`, X + W - 4, Y + H - 4);
    if (o.color) {
      const cx = X + 6, cy = Y + H - 70, gr = g.createLinearGradient(0, cy, 0, cy + 50);
      gr.addColorStop(0, '#ffe066'); gr.addColorStop(.3, '#e02a1a'); gr.addColorStop(.5, '#000'); gr.addColorStop(.7, '#1a3ce0'); gr.addColorStop(1, '#66e0ff');
      g.fillStyle = gr; g.fillRect(cx, cy, 6, 50);
      g.textAlign = 'left'; g.fillStyle = 'rgba(220,226,232,.9)'; g.fillText('+31', cx + 9, cy + 6); g.fillText('-31', cx + 9, cy + 50); g.fillText('cm/s', cx + 9, cy + 28);
    }
    g.restore();
  };
  // カラーボックスの枠（リニアはステア付きの平行四辺形）
  R.usColorBox = (g, x, y, w, h) => {
    g.save(); g.strokeStyle = 'rgba(235,235,235,.75)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w + h * .18, y + h); g.lineTo(x + h * .18, y + h); g.closePath(); g.stroke(); g.restore();
  };
})();
