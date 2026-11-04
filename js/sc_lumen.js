// sc_lumen.js — カテーテルの手元（延長チューブ・クランプ・ルアー）を大きく見た図
// シリンジをつなぐ → 押し子を引いて逆血 → 押してフラッシュ／ロック → クランプ → 外す。
// 薬の割り振り（どの内腔に何を流すか）もここでドラッグして決める。
(function () {
  const W = 760, H = 420, LX = 500, CLX = 420, BX = 510, BW = 140;
  const SYR = {
    saline: { t: '生食シリンジ', s: '10 mL（7 mL入り）', cap: 10, v0: 7, col: 'rgba(225,240,250,.55)' },
    hep: { t: 'ヘパリン', s: '1,000単位/mL・2.5 mLシリンジ', cap: 2.5, v0: 2.5, col: 'rgba(240,235,200,.6)' },
  };
  const LEGINFO = {
    d: { t: '遠位（Distal）', s: '先端に開く・いちばん太い', c: '#7a4a28' },
    m: { t: '中間（Medial）', s: '', c: '#2f6fd0' },
    p: { t: '近位（Proximal）', s: '先端から最も手前', c: '#f2f2ee' },
    x: { t: '4本目', s: '', c: '#8f979e' },
    A: { t: '脱血（A・赤）', s: '先端より手前の側孔', c: '#d0302c' },
    V: { t: '返血（V・青）', s: '先端に開く', c: '#2f6fd0' },
  };
  const DRUGS = {
    main: '維持輸液・ワンショット・採血', nad: 'ノルアドレナリン', dob: 'ドブタミン', prop: 'プロポフォール', amio: 'アミオダロン', hep: 'ヘパリン持続',
  };

  let root, cv, g, ro, raf, drag = null, S0, T0 = performance.now(), mouse = { x: -99, y: -99, in: false };
  const legY = (L, i) => { const n = L.keys.length; return n === 2 ? [150, 270][i] : n === 3 ? [115, 205, 295][i] : [95, 170, 245, 320][i]; };
  const legOf = (L, k) => L.keys.indexOf(k);

  PS.scene('lumen', {
    mount(host, S) {
      S0 = S;
      host.innerHTML = `<div class="field"><div class="fd-main"><canvas id="lmc" width="${W}" height="${H}"></canvas><div class="fd-held" id="fdHeld"></div></div></div>
        <div class="tray" id="tray"></div>`;
      root = host; cv = host.querySelector('#lmc'); g = cv.getContext('2d'); ro = PS.fit(cv, cv.parentElement);
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', () => { mouse.in = false; });
      const loop = () => { draw(); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
    },
    update(S, st) {
      S0 = S;
      const L = S.L, tray = st.tray || L.tray || [];
      const btn = st.mode === 'assign' ? `<button class="tool" data-ctl="assignDone" id="aDone" style="width:auto;padding:10px 16px"><span class="t-n">これで決定</span><span class="t-s">ルールに合うか確かめる</span></button>` : '';
      root.querySelector('#tray').innerHTML = `<div class="tray-h">器械台</div>` + tray.map(id => {
        const t = SYR[id];
        return `<button class="tool ${L.held === id ? 'held' : ''}" data-ctl="tool-${id}" data-id="${id}"><span class="t-ic">${icon(id)}</span><span class="t-n">${t.t}</span><span class="t-s">${t.s}</span></button>`;
      }).join('') + btn;
      root.querySelectorAll('.tool[data-id]').forEach(b => b.onclick = () => { const id = b.dataset.id; L.held = L.held === id ? null : id; PS.refresh(); PS.emit({ type: 'pick', id: L.held }); });
      if (root.querySelector('#aDone')) root.querySelector('#aDone').onclick = () => PS.emit({ type: 'assign', map: Object.assign({}, L.assign), res: judge(L) });
      root.querySelector('#fdHeld').textContent = L.held ? `手に持っている: ${SYR[L.held].t}` : '';
      cv.style.cursor = L.held ? 'none' : 'grab';
    },
    unmount() { anim = null; cancelAnimationFrame(raf); ro && ro.disconnect(); },
  });

  const curStep = () => PS.cur && PS.cur.steps[PS.cur.i];
  const near = (p, x, y, r) => Math.hypot(p.x - x, p.y - y) < r;
  const stopX = sy => BX + 6 + (sy.vol + sy.blood) * BW / SYR[sy.type].cap;

  // ---------- 操作 ----------
  function down(e) {
    const S = S0, L = S.L, p = PS.cpos(cv, e), st = curStep();
    if (anim) return;
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 合成イベント */ }
    drag = { x0: p.x, y0: p.y };
    if (st && st.mode === 'assign') {
      const c = chips(L).find(c => p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + 24);
      if (c) { drag.kind = 'chip'; drag.id = c.id; drag.dx = p.x - c.x; drag.dy = p.y - c.y; }
      return;
    }
    // 押し子（つまみ）
    if (L.syr) { const y = legY(L, legOf(L, L.syr.leg)), sx = stopX(L.syr); if (p.x > sx + 40 && p.x < sx + 110 && Math.abs(p.y - y) < 22) { drag.kind = 'plunger'; drag.v0 = L.syr.vol; drag.b0 = L.syr.blood; drag.pushed = 0; return; } }
    for (let i = 0; i < L.keys.length; i++) {
      const k = L.keys[i], y = legY(L, i), lg = L.legs[k];
      if (near(p, CLX, y, 22)) { lg.clamp = !lg.clamp; PS.refresh(); PS.emit({ type: 'clamp', k, on: lg.clamp }); return; }
      if (L.syr && L.syr.leg === k && p.x > BX - 8 && p.x < BX + 36 && Math.abs(p.y - y) < 18) {   // シリンジを外す（先端側の胴をつまむ）
        const sy = L.syr; L.syr = null; if (lg.clamp) lg.cap = true;
        PS.refresh(); PS.emit({ type: 'detach', k, clamp: lg.clamp, syr: sy.type }); return;
      }
      if (near(p, LX, y, 22) && !L.syr) {
        if (!L.held) return PS.emit({ type: 'noTool', tool: 'saline' });
        L.syr = { leg: k, type: L.held, vol: SYR[L.held].v0, blood: 0 }; lg.cap = false; L.held = null;
        PS.refresh(); PS.emit({ type: 'attach', k, syr: L.syr.type }); return;
      }
    }
  }
  function move(e) {
    const p = PS.cpos(cv, e); mouse = { x: p.x, y: p.y, in: true };
    if (!drag) return;
    if (Math.abs(p.x - drag.x0) + Math.abs(p.y - drag.y0) > 5) drag.moved = true;
    const S = S0, L = S.L;
    if (drag.kind === 'chip') { drag.x = p.x; drag.y = p.y; return; }
    if (drag.kind !== 'plunger') return;
    const sy = L.syr, lg = L.legs[sy.leg], cap = SYR[sy.type].cap, dml = (p.x - drag.x0) * cap / BW;
    if (lg.clamp) { if (Math.abs(dml) > .3 && !drag.warned) { drag.warned = true; PS.emit({ type: 'clamped', k: sy.leg }); } return; }
    if (dml > 0) {   // 引く：血液が上がってくる
      const room = cap - drag.v0 - drag.b0;
      sy.blood = drag.b0 + Math.min(room, dml * (lg.occl ? .05 : 1)); sy.vol = drag.v0;
      if (lg.occl && dml > .8 && !drag.warned) { drag.warned = true; PS.emit({ type: 'noBlood', k: sy.leg }); }
    } else {          // 押す：血液→生食の順に戻す
      let push = -dml, b = drag.b0, v = drag.v0;
      const fromB = Math.min(b, push); b -= fromB; push -= fromB; v = Math.max(0, v - push);
      sy.blood = b; sy.vol = v;
    }
  }
  function up() {
    if (!drag) return;
    const S = S0, L = S.L, d = drag; drag = null;
    if (d.kind === 'chip') {
      if (d.x == null) return;
      const i = L.keys.findIndex((k, i) => Math.abs(d.y - legY(L, i)) < 34 && d.x > 250 && d.x < 520);
      if (i >= 0) L.assign[d.id] = L.keys[i]; else delete L.assign[d.id];
      PS.refresh(); PS.emit({ type: 'chip', id: d.id, leg: i >= 0 ? L.keys[i] : null }); return;
    }
    if (d.kind !== 'plunger' || !L.syr) return;
    if (!d.moved && L.syr.type === 'saline') return tapPlunger(L);   // タップ＝自動（ヘパリンは量を合わせるのでドラッグ）
    const sy = L.syr, lg = L.legs[sy.leg];
    const db = sy.blood - d.b0, dv = d.v0 - sy.vol;
    if (db > .05) { lg.asp = Math.max(lg.asp, sy.blood); PS.emit({ type: 'asp', k: sy.leg, ml: sy.blood }); }
    else if (dv > .02 || d.b0 - sy.blood > .05) {
      if (sy.type === 'hep') { lg.inj = (lg.inj || 0) + dv; PS.emit({ type: 'inj', k: sy.leg, ml: lg.inj }); }
      else { lg.flush = (lg.flush || 0) + dv; PS.emit({ type: 'flush', k: sy.leg, ml: lg.flush, back: sy.blood < .05 }); }
    }
    PS.refresh();
  }

  // 生食シリンジの押し子をタップ：まだ逆血を見ていなければ引く、見ていれば押してフラッシュ
  let anim = null;
  function tapPlunger(L) {
    const sy = L.syr, lg = L.legs[sy.leg], cap = SYR[sy.type].cap;
    if (lg.clamp) { PS.emit({ type: 'clamped', k: sy.leg }); return; }
    if (lg.occl) { PS.emit({ type: 'noBlood', k: sy.leg }); return; }
    const b0 = sy.blood, v0 = sy.vol;
    if (lg.asp < 1) {
      const to = Math.min(cap - v0, 3);
      anim = { t0: performance.now(), dur: 700, step: e => { sy.blood = b0 + (to - b0) * e; }, done: () => { lg.asp = Math.max(lg.asp, sy.blood); PS.emit({ type: 'asp', k: sy.leg, ml: sy.blood }); } };
      tick();
    } else {
      anim = { t0: performance.now(), dur: 1000, step: e => { sy.blood = b0 * (1 - Math.min(1, e * 2)); sy.vol = e < .5 ? v0 : v0 * (1 - (e - .5) * 2); },
        done: () => { sy.blood = 0; sy.vol = 0; lg.flush = (lg.flush || 0) + v0; PS.emit({ type: 'flush', k: sy.leg, ml: lg.flush, back: true }); } };
      tick();
    }
  }
  function tick() { const iv = setInterval(() => { if (!anim) return clearInterval(iv); stepAnim(); }, 30); }
  function stepAnim() {
    if (!anim) return;
    const a = anim, k = Math.min(1, (performance.now() - a.t0) / a.dur);
    a.step(k); if (k >= 1) { anim = null; a.done(); PS.refresh(); }
  }

  // ---------- 薬の割り振り ----------
  function chips(L) {
    const ids = L.drugs || [], out = []; g.font = '12px "Hiragino Sans", sans-serif';
    const per = {}; let fx = 20;
    ids.forEach(id => {
      const w = g.measureText(DRUGS[id]).width + 18, leg = L.assign[id];
      if (leg) { const i = legOf(L, leg), n = per[leg] = (per[leg] || 0) + 1; out.push({ id, x: 250 + (n - 1) % 2 * 130, y: legY(L, i) - 30 - Math.floor((n - 1) / 2) * 26, w: Math.min(w, 126) }); }
      else { out.push({ id, x: fx, y: H - 34, w }); fx += w + 8; }
    });
    return out;
  }
  // ルール：プロポフォールは単独／カテコラミンは同士だけ／アミオダロンはヘパリン・ワンショットの内腔と分ける
  function judge(L) {
    const a = L.assign, ids = L.drugs || [];
    if (ids.some(id => !a[id])) return { ok: false, msg: 'まだ置いていない薬がある。全部どこかの内腔へ。' };
    const by = {}; ids.forEach(id => (by[a[id]] = by[a[id]] || []).push(id));
    for (const k in by) {
      const s = by[k], has = id => s.includes(id), cat = has('nad') || has('dob');
      if (has('prop') && s.length > 1) return { ok: false, k, msg: '<b>プロポフォール</b>（脂肪乳剤）は他の薬と同じ内腔に入れない（配合変化・細菌が増えやすい）。単独で。' };
      if (cat && s.some(id => id !== 'nad' && id !== 'dob')) return { ok: false, k, msg: '<b>カテコラミンの内腔に他の薬を入れない</b>。ワンショットやフラッシュ、同じ内腔の薬の速度変更のたびに、ライン内のカテコラミンが押し出されて血圧が急変する。' };
      if (has('amio') && has('hep')) return { ok: false, k, msg: '<b>アミオダロンとヘパリン</b>は配合変化（白濁・沈殿）。同じ内腔に入れない。' };
      if (has('amio') && has('main')) return { ok: false, k, msg: '<b>アミオダロン</b>は配合変化が多い（ヘパリン・フロセミド・炭酸水素Naなど）。いろいろな薬をワンショットする内腔とは分ける。' };
    }
    return { ok: true, n: Object.keys(by).length };
  }

  // ---------- 描画 ----------
  let bg = null;
  function makeBg() {
    const R = PS.R, c = R.mk(W, H), x = c.getContext('2d');
    x.fillStyle = x.createPattern(R.drape('#2c6b99'), 'repeat'); x.fillRect(0, 0, W, H);
    x.drawImage(R.soft(W, H, 10, q => { const r = R.rng(51); for (let i = 0; i < 6; i++) { q.save(); q.translate(r() * W, r() * H); q.rotate(r() * 3); const gr = q.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.45, 'rgba(255,255,255,.12)'); gr.addColorStop(.55, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr; q.fillRect(-260, -40, 520, 80); q.restore(); } }), 0, 0);
    return c;
  }
  function draw() {
    stepAnim();
    const S = S0; if (!S) return;
    const R = PS.R, L = S.L, t = (performance.now() - T0) / 1000, st = curStep();
    if (!bg) bg = makeBg();
    g.drawImage(bg, 0, 0);
    const hub = { x: 230, y: H / 2 - 10 };
    // 刺入部（透明ドレッシングの下）とカテーテル本体
    g.save(); g.beginPath(); g.roundRect(-20, hub.y - 70, 150, 140, 20); g.clip(); g.drawImage(R.iodineSkin(150, 140, 9), -20, hub.y - 70); g.restore();
    g.fillStyle = 'rgba(220,235,245,.2)'; g.strokeStyle = 'rgba(240,248,255,.7)'; g.lineWidth = 2; g.beginPath(); g.roundRect(-14, hub.y - 62, 136, 124, 16); g.fill(); g.stroke();
    R.tube(g, [[20, hub.y + 30], [80, hub.y + 10], [hub.x - 30, hub.y]], L.fdl ? 10 : 6, '#f3f1ea', { edge: '#8c8f88' });
    R.part(g, hub.x - 40, hub.y, 14, 44, '#e7e3d6', 0, 4);   // 固定の翼
    R.part(g, hub.x, hub.y, 50, 30, '#e7e3d6', 0, 6);
    if (!S.exam) { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '11px "Hiragino Sans", sans-serif'; g.textAlign = 'left'; g.fillText(L.fdl ? '大腿（刺入部）' : '右内頸（刺入部）', 4, hub.y - 76); }
    L.keys.forEach((k, i) => {
      const y = legY(L, i), lg = L.legs[k], info = LEGINFO[k];
      const P = R.spline2([[hub.x + 22, hub.y + (i - (L.keys.length - 1) / 2) * 8], [hub.x + 80, y], [CLX, y], [LX - 12, y]], 8);
      const fill = lg.asp > .2 || lg.inj ? (L.fdl ? '#6e0a10' : '#5a0a10') : null;
      R.tube(g, P, L.fdl ? 8 : 6, '#eef2f4', { hi: 'rgba(255,255,255,.7)', core: fill && lg.flush < 3 ? fill : (lg.flush >= 3 ? 'rgba(230,240,250,.6)' : null), coreW: .45 });
      // スライドクランプ（閉＝挟んでいる）
      g.save(); g.translate(CLX, y); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 5; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
      g.fillStyle = L.fdl ? info.c : '#f5f5f2'; g.beginPath(); g.roundRect(-16, -14, 32, 28, 5); g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = lg.clamp ? '#2a2f35' : 'rgba(0,0,0,.25)'; g.fillRect(lg.clamp ? -2 : -10, -8, lg.clamp ? 4 : 20, 16);
      if (L.fdl && lg.prime) { g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(lg.prime.toFixed(1) + ' mL', 0, 24); }
      g.restore();
      // ルアー・キャップ
      R.part(g, LX - 4, y, 18, 16, info.c, 0, 3);
      if (lg.cap) R.part(g, LX + 10, y, 12, 14, L.fdl ? info.c : '#f4f4f4', 0, 3);
      if (!lg.cap && !L.syr && lg.drip) { const k2 = (t * .7) % 1; g.fillStyle = '#4a0508'; g.beginPath(); g.ellipse(LX + 10, y + 4 + k2 * 16, 2.5, 3.5, 0, 0, 7); g.fill(); }
      // 名前と状態
      g.fillStyle = '#fff'; g.font = 'bold 12px "Hiragino Sans", sans-serif'; g.textAlign = 'left';
      g.fillText(info.t, 300, y - 16 + (st && st.mode === 'assign' ? -36 : 0));
      if (st && st.mode !== 'assign' && !S.exam) {
        g.font = '11px "Hiragino Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)';
        const done = [lg.asp > .5 ? '逆血✓' : '', lg.flush >= 3 ? 'フラッシュ✓' : '', lg.inj ? `ロック ${lg.inj.toFixed(1)} mL` : '', lg.clamp ? 'クランプ' : '開'].filter(Boolean).join('・');
        g.fillText(done, 300, y + 26);
      }
      if (L.syr && L.syr.leg === k) drawSyr(L.syr, y);
    });
    if (st && st.mode === 'assign') {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H - 44, W, 44);
      chips(L).forEach(c => {
        let x = c.x, y = c.y; if (drag && drag.kind === 'chip' && drag.id === c.id && drag.x != null) { x = drag.x - drag.dx; y = drag.y - drag.dy; }
        g.fillStyle = c.id === 'nad' || c.id === 'dob' ? '#ffe2a8' : c.id === 'prop' ? '#fff6e8' : c.id === 'main' ? '#dff1ff' : '#e9e2ff';
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.beginPath(); g.roundRect(x, y, c.w, 24, 12); g.fill(); g.stroke();
        g.fillStyle = '#1d2733'; g.font = '12px "Hiragino Sans", sans-serif'; g.textAlign = 'left'; g.save(); g.beginPath(); g.rect(x, y, c.w - 6, 24); g.clip(); g.fillText(DRUGS[c.id], x + 9, y + 16); g.restore();
      });
    }
    if (st && st.hint && !PS.cur.waiting) PS.drawHint(g, typeof st.hint === 'function' ? st.hint(S) : st.hint, t);
    if (L.held && mouse.in) drawSyr({ type: L.held, vol: SYR[L.held].v0, blood: 0 }, mouse.y, mouse.x - (BX - LX) - 8);
  }
  // シリンジ（右向き。左の先端をルアーに差す）
  function drawSyr(sy, y, x0) {
    const R = PS.R, info = SYR[sy.type], cap = info.cap, ox = x0 == null ? 0 : x0 - LX, k = BW / cap;
    g.save(); g.translate(ox, 0);
    R.part(g, BX - 2, y, 14, 8, '#e9ecef', 0, 2);
    g.save(); g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 4;
    const bgd = g.createLinearGradient(0, y - 13, 0, y + 13); bgd.addColorStop(0, 'rgba(200,215,225,.75)'); bgd.addColorStop(.3, 'rgba(255,255,255,.92)'); bgd.addColorStop(1, 'rgba(170,185,195,.75)');
    g.fillStyle = bgd; g.beginPath(); g.roundRect(BX + 4, y - 13, BW + 6, 26, 3); g.fill(); g.restore();
    const xs = BX + 6, xb = xs + sy.blood * k, xv = xb + sy.vol * k;
    if (sy.blood > 0) { g.fillStyle = '#6e0a10'; g.fillRect(xs, y - 10, xb - xs, 20); }
    if (sy.vol > 0) { g.fillStyle = info.col; g.fillRect(xb, y - 10, xv - xb, 20); }
    g.strokeStyle = 'rgba(40,50,60,.6)'; g.lineWidth = 1; g.fillStyle = 'rgba(40,50,60,.8)'; g.font = '8px sans-serif'; g.textAlign = 'center';
    const step = cap <= 3 ? .1 : 1; for (let v = 0; v <= cap + 1e-6; v += step) { const xx = xs + v * k, big = cap <= 3 ? Math.abs(v * 2 - Math.round(v * 2)) < 1e-6 : true; g.beginPath(); g.moveTo(xx, y - 13); g.lineTo(xx, y - (big ? 6 : 9)); g.stroke(); if (big && (cap <= 3 || v % 2 === 0)) g.fillText(cap <= 3 ? v.toFixed(1) : v, xx, y - 15); }
    g.fillStyle = '#1d1f22'; g.fillRect(xv, y - 11, 7, 22);                         // ゴム
    g.fillStyle = '#f2f3f4'; g.fillRect(xv + 7, y - 3, 74, 6);                       // 押し子
    R.part(g, xv + 86, y, 6, 30, '#e9ecef', 0, 2);
    R.part(g, BX + BW + 12, y, 5, 40, '#e9ecef', 0, 2);
    g.restore();
  }

  function icon(id) {
    const s = b => `<svg viewBox="0 0 60 30" width="60" height="30">${b}</svg>`;
    const c = id === 'hep' ? '#efe6b8' : '#dcecf6';
    return s(`<rect x="4" y="12" width="6" height="6" fill="#ccc"/><rect x="10" y="8" width="30" height="14" rx="2" fill="${c}" stroke="#8a9399"/><rect x="40" y="13" width="14" height="4" fill="#eee" stroke="#999"/><rect x="54" y="8" width="3" height="14" fill="#ddd"/>`);
  }

  // 状態の初期値
  PS.Lumen = {
    fresh(kind, o) {
      const keys = kind === 'fdl' ? ['A', 'V'] : kind === 'cvc4' ? ['d', 'm', 'p', 'x'] : ['d', 'm', 'p'];
      const legs = {}; keys.forEach(k => { legs[k] = { clamp: true, cap: true, asp: 0, flush: 0, inj: 0 }; });
      return Object.assign({ kind, fdl: kind === 'fdl', keys, legs, syr: null, held: null, tray: ['saline'], assign: {}, drugs: [] }, o || {});
    },
    legY, judge, LX, CLX, BX, BW, stopX, DRUGS, chipsAt: S => chips(S.L),
  };
})();
