// sc_neck.js — 右内頸静脈。CVカテーテルの挿入
// 座標は「頭側を上・内側を右」で持ち、画面には180°回して出す（術者は患者の頭側に立つ：手前＝頭、右＝患者の右）。
// 針・ダイレーター・カテーテルは皮膚から45°で足側へ進む。体外の部分は頭側へ出る。
// 右にエコー（短軸／長軸）と心電図モニター。
(function () {
  const FW = 720, FH = 480, CM = 30, NL = 6.4, WTOT = 60, COS = Math.SQRT1_2;
  const NT = {
    cvneedle: { t: '外套針＋シリンジ', s: '18G・外套つき・陰圧をかけて進む' },
    cvwire: { t: 'ガイドワイヤー', s: '0.032インチ・60cm・目盛つき' },
    cvdil: { t: 'ダイレーター', s: '8Fr・皮膚〜静脈壁まで' },
    cvc3: { t: 'CVカテーテル トリプル', s: '7Fr・20cm・3内腔', n: 3 },
    cvc4: { t: 'CVカテーテル クワッド', s: '8.5Fr・20cm・4内腔', n: 4 },
    dressing: { t: '透明ドレッシング', s: '刺入部を覆う' },
  };
  Object.assign(PS.Field.TOOLS, NT);
  const TOOLS = PS.Field.TOOLS;

  // ---------- 解剖（術野の座標） ----------
  const ijX = y => 330 + (y - 60) * 110 / 380;          // 内頸静脈の走行
  const caX = y => ijX(y) + 36;                          // 総頸動脈（内側）
  const dIJ = y => 1.0 + (y - 60) * .0016;               // 内頸静脈の中心の深さ（cm）
  const pleuraD = y => y < 360 ? 99 : 2.1 + (450 - y) / 90 * 1.5;   // 鎖骨の上で肺尖が浅くなる
  const SCM_S = [[232, 36], [380, 255], [498, 446]], SCM_C = [[372, 262], [384, 446]];
  const ZONES = [[7, 'ij', '内頸静脈'], [11, 'bc', '腕頭静脈'], [17.5, 'svc', '上大静脈'], [20, 'ra', '右房'], [99, 'rv', '右室']];   // 165 cm：気管分岐部14 cm、CAJ≒17.5 cm
  const zone = L => { for (const z of ZONES) if (L < z[0]) return { id: z[1], t: z[2] }; };
  const U = (() => { const x = -.22, y = -1, n = Math.hypot(x, y); return { x: x / n, y: y / n, a: Math.atan2(y / n, x / n) }; })();   // 体外へ（頭側・少し外側）
  const along = (p, d) => ({ x: p.x + U.x * d, y: p.y + U.y * d });

  function vgeo(S, y) {   // その高さの血管（cm。x は総頸動脈の中心を0、外側がマイナス）
    const tr = S.f.tren ? 1 : 0;
    return { ij: { x: (ijX(y) - caX(y)) / CM, y: dIJ(y), rx: .68 + .14 * tr, ry: .4 + .28 * tr }, ca: { x: 0, y: dIJ(y) + .32, rx: .32, ry: .32 } };
  }
  const entry = S => S.f.site || (S.f.needle ? { x: S.f.needle.ex, y: S.f.needle.ey } : null);
  const tipY = S => { const n = S.f.needle; return n.ey + n.s * COS * CM; };
  const hubPos = S => { const n = S.f.needle; return { x: n.ex, y: n.ey - 12 - (NL - n.s) * 10 }; };

  function needleState(S) {
    const n = S.f.needle; if (!n || n.s <= 0) return { st: 'out' };
    const y = tipY(S), d = n.s * COS, xc = (n.ex - caX(y)) / CM, V = vgeo(S, y), ca = V.ca, ij = V.ij;
    if (((xc - ca.x) / ca.rx) ** 2 + ((d - ca.y) / ca.ry) ** 2 < 1) return { st: 'art', y, d };
    const ry = ij.ry * (S.f.comp ? .2 : 1);
    if (((xc - ij.x) / ij.rx) ** 2 + ((d - ij.y) / ry) ** 2 < 1) return { st: 'lumen', y, d };
    if (Math.abs(xc - ij.x) < ij.rx * .9 && d > ij.y + ry && d < ij.y + ry + 1.0) return { st: 'through', y, d };
    if (Math.abs(xc - ij.x) < ij.rx * .8 && d > ij.y - ry - .3 && d <= ij.y - ry) return { st: 'tent', y, d };
    if (d > pleuraD(y) && Math.abs(xc - ij.x) < 1.8) return { st: 'pleura', y, d };
    return { st: 'tissue', y, d };
  }

  // ---------- 体外のワイヤー ----------
  const DIL_LEN = 10, CV_LEN = 20, HUBX = 28;    // カテーテル＋ハブ・延長チューブ ≒ 28 cm
  const extLen = S => WTOT - S.f.wire.len;        // 体外に出ている長さ（cm）
  const tailOut = S => !!S.f.cv && extLen(S) > HUBX;   // ハブ（遠位）からワイヤーの尻が出ているか
  function dilExt(S) { return (DIL_LEN - S.f.dil.s) * 8 + 14; }
  function dilHub(S) { return along(entry(S), dilExt(S)); }
  function cvGap(S) { return S.f.cv.s < .05 && !S.f.cv.tail ? 30 : 0; }    // 通しただけで、まだ皮膚に届いていない
  function cvExt(S) { return (CV_LEN - S.f.cv.s) * 7 + 10 + cvGap(S); }
  function cvHub(S) { return along(entry(S), cvExt(S)); }
  const LEGC = { d: '#7a4a28', m: '#2f6fd0', p: '#f2f2ee', x: '#8f979e' };
  function legs(S) {   // 延長チューブの先（ルアー）。0 番が遠位（ワイヤーが出る）
    const h = cvHub(S), n = S.f.cv.n, out = [];
    const keys = n === 4 ? ['d', 'm', 'p', 'x'] : ['d', 'm', 'p'];
    keys.forEach((k, i) => { const a = U.a + (i - (n - 1) / 2) * .34; out.push({ k, x: h.x + Math.cos(a) * 64, y: h.y + Math.sin(a) * 64, a }); });
    return out;
  }
  function wireStart(S) {
    const f = S.f;
    if (f.needle) { const h = hubPos(S); return { x: h.x, y: h.y - 10 }; }
    if (f.cv) { if (f.cv.tail) { const l = legs(S)[0]; return { x: l.x + Math.cos(l.a) * 12, y: l.y + Math.sin(l.a) * 12 }; } return along(entry(S), 4); }
    if (f.dil) return along(dilHub(S), 16);
    return entry(S);
  }
  function gripPos(S) {
    const f = S.f, h = wireStart(S);
    if (f.cv && !f.cv.tail) return along(entry(S), 15);
    if (f.cv) { const l = legs(S)[0]; return { x: h.x + Math.cos(l.a) * 16, y: h.y + Math.sin(l.a) * 16 }; }
    return along(h, f.needle ? 22 : f.dil ? 26 : 44);
  }
  function wirePts(S) {
    const f = S.f, h = wireStart(S);
    if (f.cv && f.cv.tail) {   // 尻が短く出ているだけ
      const l = legs(S)[0], L = Math.min(150, (extLen(S) - HUBX) * 7 + 10);
      const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push([h.x + Math.cos(l.a) * L * k - 30 * k * k, h.y + Math.sin(l.a) * L * k + 10 * k * k]); }
      return pts;
    }
    if (f.cv) {   // 皮膚〜カテーテル先端の間だけ見える。残りはカテーテルの中
      const a = entry(S), b = along(a, cvGap(S)); return [[a.x, a.y], [b.x, b.y]];
    }
    const C = { x: 92, y: 300 }, R0 = 50, a = along(h, 70);
    const pts = [[h.x, h.y]], ent = { x: C.x + R0, y: C.y };
    for (let i = 1; i <= 16; i++) {
      const k = i / 16, m = 1 - k, c1 = a, c2 = { x: ent.x + 40, y: ent.y - 90 };
      pts.push([m * m * m * h.x + 3 * m * m * k * c1.x + 3 * m * k * k * c2.x + k * k * k * ent.x, m * m * m * h.y + 3 * m * m * k * c1.y + 3 * m * k * k * c2.y + k * k * k * ent.y]);
    }
    for (let i = 1; i <= 40; i++) { const an = i / 40 * Math.PI * 1.85; pts.push([C.x + R0 * Math.cos(an), C.y + R0 * .85 * Math.sin(an)]); }
    const last = pts[pts.length - 1]; pts.push([last[0] + 26, last[1] - 40]);
    return pts;
  }

  // ---------- マウント ----------
  let ro, ro2, ro3, root, cv, g, usC, us, ecC, ec, raf, mouse = { x: -99, y: -99, in: false }, drag = null, S0, T0 = performance.now();
  const ecg = { beats: [], next: 0 };

  PS.scene('neck', {
    mount(host, S) {
      S0 = S;
      host.innerHTML = `<div class="field">
        <div class="fd-main"><canvas id="fld" width="${FW}" height="${FH}"></canvas><div class="fd-held" id="fdHeld"></div></div>
        <div class="fd-side">
          <div class="mon" id="usBox"><div class="mon-h">エコー <b id="usAx">短軸</b><span id="usLv"></span></div><canvas id="usC" width="360" height="250"></canvas>
            <div class="mon-btns"><button data-ctl="usColor" id="bColor">Color</button><button data-ctl="usLong" id="bLong">長軸</button><button data-ctl="tren" id="bTren">頭低位</button></div></div>
          <div class="mon" id="ecBox"><div class="mon-h">モニター <span id="ecLbl"></span></div><canvas id="ecC" width="340" height="110"></canvas></div>
        </div></div>
        <div class="tray" id="tray"></div>`;
      root = host; cv = host.querySelector('#fld'); g = cv.getContext('2d'); ro = PS.fit(cv, cv.parentElement); cv._flip = VIEW;
      usC = host.querySelector('#usC'); us = usC.getContext('2d'); ro3 = PS.hd(usC);
      ecC = host.querySelector('#ecC'); ec = ecC.getContext('2d'); ro2 = PS.hd(ecC);
      host.querySelector('#bColor').onclick = () => { S0.f.color = !S0.f.color; PS.refresh(); PS.emit({ type: 'color', on: S0.f.color }); };
      host.querySelector('#bLong').onclick = () => { S0.f.long = !S0.f.long; PS.refresh(); PS.emit({ type: 'long', on: S0.f.long }); };
      host.querySelector('#bTren').onclick = () => { S0.f.tren = !S0.f.tren; PS.refresh(); PS.emit({ type: 'tren', on: S0.f.tren }); };
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up); cv.addEventListener('pointerleave', () => { mouse.in = false; });
      cv.addEventListener('pointercancel', up);
      ecg.beats = []; ecg.next = 0;
      const loop = () => { draw(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    },
    update(S, st) {
      S0 = S;
      const mons = st.mon || ['us', 'ecg'];
      root.querySelector('#usBox').hidden = !mons.includes('us');
      root.querySelector('#ecBox').hidden = !mons.includes('ecg');
      root.querySelector('#bColor').classList.toggle('on', !!S.f.color);
      root.querySelector('#bLong').classList.toggle('on', !!S.f.long);
      root.querySelector('#bTren').classList.toggle('on', !!S.f.tren);
      root.querySelector('#usAx').textContent = S.f.long ? '長軸' : '短軸';
      const tray = st.tray || S.f.tray || [];
      root.querySelector('#tray').innerHTML = `<div class="tray-h">器械台</div>` + tray.map(id => {
        const t = TOOLS[id];
        return `<button class="tool ${S.f.held === id ? 'held' : ''}" data-ctl="tool-${id}" data-id="${id}"><span class="t-ic">${icon(id)}</span><span class="t-n">${t.t}</span><span class="t-s">${t.s}</span></button>`;
      }).join('');
      root.querySelectorAll('.tool').forEach(b => b.onclick = () => {
        const id = b.dataset.id;
        S.f.held = S.f.held === id ? null : id;
        PS.refresh();
        PS.emit({ type: 'pick', id: S.f.held, name: TOOLS[id].t });
      });
      root.querySelector('#fdHeld').textContent = S.f.held ? `手に持っている: ${TOOLS[S.f.held].t}（器械台でもう一度押すと戻す）` : '';
      cv.style.cursor = S.f.held ? 'none' : 'grab';
    },
    unmount() { anim = null; cancelAnimationFrame(raf); ro && ro.disconnect(); ro2 && ro2.disconnect(); ro3 && ro3.disconnect(); },
  });

  const curStep = () => PS.cur && PS.cur.steps[PS.cur.i];
  const mode = () => { const st = curStep(); return st && st.mode; };
  const near = (p, q, r) => q && Math.hypot(p.x - q.x, p.y - q.y) < r;
  const warnTool = t => PS.emit({ type: 'noTool', tool: t });
  const proj = p => (p.x - drag.x0) * U.x + (p.y - drag.y0) * U.y;    // ＋＝体外へ引く、−＝押し込む
  // 目標の深さで一度止まる（コツッ）。そのまま hold だけ余分に動かすと越えられる。押しても引いても効く
  const stop = (s0, raw, T, hold) => s0 < T - .05 && raw > T ? (raw - T < hold ? T : raw - hold) : s0 > T + .05 && raw < T ? (T - raw < hold ? T : raw + hold) : raw;

  // ---------- 操作 ----------
  function down(e) {
    const S = S0, p = PS.cpos(cv, e), m = mode(), f = S.f;
    if (anim) return;   // 自動で動いている間は待つ
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 合成イベント */ }
    drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false };
    if (f.wire && !f.wHold && ['needleOut', 'cut', 'dil', 'cv'].includes(m) && near(p, gripPos(S), 20)) {
      f.wHold = true; drag = null; PS.emit({ type: 'wireHold', msg: f.cv && f.cv.tail ? 'ハブから出たワイヤーの尻を持った。これでカテーテルを進められる。' : undefined }); return;
    }
    const has = id => f.held && [].concat(id).some(k => f.held === k);
    if (m === 'probe') {
      if (!has('probe') && !f.probe) return warnTool('probe');
      if (!f.probe) { f.probe = { x: p.x, y: p.y }; f.held = null; PS.refresh(); }
      drag.kind = 'probe'; drag.px = f.probe.x; drag.py = f.probe.y;
      drag.holdTimer = setTimeout(() => { if (drag && !drag.moved) f.comp = true; }, 320);
      return;
    }
    if (m === 'needle') {
      if (!f.needle) {
        if (!has(['cvneedle', 'needle'])) return warnTool('cvneedle');
        if (p.x < 170 || p.x > 560 || p.y < 60 || p.y > 440) return;
        f.needle = { ex: p.x, ey: p.y, s: 0, syr: true, inner: true, cath: f.held === 'cvneedle', asp: 0 }; f.held = null; f.site = null; f.probe = { x: p.x, y: p.y + 20 };
        PS.refresh(); PS.emit({ type: 'entry', x: p.x, y: p.y });
        if (!f.needle) return;
      }
      drag.kind = 'needle'; drag.s0 = f.needle.s; return;
    }
    if (m === 'inner') { const h = hubPos(S); if (f.needle && f.needle.inner && near(p, { x: h.x, y: h.y - 40 }, 60)) drag.kind = 'inner'; return; }
    if (m === 'reSyr') {
      const n = f.needle, h = hubPos(S); if (!n) return;
      if (!n.syr) { if (near(p, h, 45)) { n.syr = true; n.asp = 0; PS.emit({ type: 'syrOn' }); } return; }
      if (near(p, { x: h.x, y: h.y - 40 }, 60)) { drag.kind = 'asp'; drag.a0 = n.asp; }
      return;
    }
    if (m === 'syr') { if (f.needle && near(p, { x: hubPos(S).x, y: hubPos(S).y - 40 }, 60)) { f.needle.syr = false; PS.emit({ type: 'syrOff' }); } return; }
    if (m === 'wire') {
      if (!f.wire) {
        if (!has('cvwire')) return warnTool('cvwire');
        if (!f.needle || !near(p, hubPos(S), 50)) return PS.emit({ type: 'miss' });
        if (f.needle.syr) return PS.emit({ type: 'wireBlocked' });
        f.wire = { len: f.needle.s, art: f.needle.art }; f.held = null; PS.refresh(); PS.emit({ type: 'wireIn' });
        drag.fresh = true;
      }
      drag.kind = 'wire'; drag.l0 = f.wire.len; return;
    }
    if (m === 'needleOut') { if (f.needle) { drag.kind = 'needleOut'; drag.s0 = f.needle.s; } return; }
    if (m === 'cut') { if (!has('scalpel')) return warnTool('scalpel'); drag.kind = 'cut'; return; }
    if (m === 'dil') {
      if (!f.dil) {
        if (!has('cvdil')) return warnTool('cvdil');
        if (!near(p, entry(S), 50)) return PS.emit({ type: 'miss' });
        f.dil = { s: 0 }; f.held = null; PS.refresh(); PS.emit({ type: 'dilOn' });
        drag.fresh = true;
      }
      drag.kind = 'dil'; drag.s0 = f.dil.s; return;
    }
    if (m === 'cv') {
      if (!f.cv) {
        if (!has(['cvc3', 'cvc4'])) return warnTool(curStep().tool ? [].concat(curStep().tool)[0] : 'cvc3');
        if (!near(p, entry(S), 50)) return PS.emit({ type: 'miss' });
        f.cv = { id: f.held, n: TOOLS[f.held].n, s: 0, tail: false, sut: false };
        f.held = null; f.wHold = false;
        f.cv.tail = tailOut(S);
        PS.refresh(); PS.emit({ type: 'cvOn', id: f.cv.id, tail: f.cv.tail });
        return;
      }
      // 尻が出ていない：皮膚のところでワイヤーを持って引き戻す
      if (!f.cv.tail && f.wHold && near(p, gripPos(S), 26)) { drag.kind = 'wireBack'; drag.l0 = f.wire.len; return; }
      drag.kind = 'cv'; drag.s0 = f.cv.s; return;
    }
    if (m === 'cvWireOut') { if (f.wire && f.cv && near(p, gripPos(S), 34)) { drag.kind = 'wireOut'; } return; }
    if (m === 'suture') {
      if (!has('suture')) return warnTool('suture');
      if (!f.cv || !near(p, along(entry(S), 22), 40)) return PS.emit({ type: 'miss' });
      f.cv.sut = true; f.held = null; PS.refresh(); PS.emit({ type: 'suture' }); return;
    }
    if (m === 'dress') {
      if (!has('dressing')) return warnTool('dressing');
      if (!near(p, entry(S), 60)) return PS.emit({ type: 'miss' });
      f.dress = true; f.held = null; PS.refresh(); PS.emit({ type: 'dress' });
    }
  }

  function move(e) {
    const p = PS.cpos(cv, e); mouse = { x: p.x, y: p.y, in: true };
    if (!drag) return;
    const S = S0, f = S.f;
    drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 6) drag.moved = true;
    const dy = p.y - drag.y0;   // ＋＝足側（針・ワイヤーが進む向き）
    switch (drag.kind) {
      case 'probe': if (drag.moved && !f.comp) { f.probe.x = PS.clamp(drag.px + p.x - drag.x0, 200, 560); f.probe.y = PS.clamp(drag.py + p.y - drag.y0, 70, 430); } break;
      case 'needle': f.needle.s = PS.clamp(drag.s0 + dy / 30, 0, NL - .4); f.probe = { x: f.needle.ex, y: tipY(S) }; { const ns = needleState(S); f.needle.flash = ns.st === 'lumen' ? 'v' : ns.st === 'art' ? 'a' : null; } break;
      case 'needleOut':
        if (dy > 0) break;
        if (f.wire && !f.wHold) { if (dy < -10) slip(S, 'out'); break; }
        f.needle.s = PS.clamp(drag.s0 + dy / 30, 0, NL); break;
      case 'inner': drag.pull = Math.max(0, drag.y0 - p.y); f.needle.pull = Math.min(drag.pull, 60); break;
      case 'asp': f.needle.asp = PS.clamp(drag.a0 + (drag.y0 - p.y) / 50, 0, 1); break;
      case 'wire': f.wire.len = PS.clamp(stop(drag.l0, drag.l0 + dy * .3, 16.5, 12), f.needle ? f.needle.s : 0, 45); break;
      case 'dil': {
        const ns = PS.clamp(stop(drag.s0, drag.s0 - proj(p) / 7, 2.5, 4), 0, DIL_LEN - 1);
        if (f.wire && !f.wHold && ns > f.dil.s + .15) { slip(S, 'in'); break; }
        if (f.wire && !f.wHold && ns < f.dil.s - .3) { slip(S, 'out'); break; }
        if (ns > 4.6 && !drag.deep) { drag.deep = true; f.dil.s = 4.6; PS.emit({ type: 'dilDeep' }); break; }
        if (!drag.deep) f.dil.s = ns; break;
      }
      case 'wireBack': {
        const L = PS.clamp(drag.l0 - (drag.y0 - p.y) * .35, 4, 45);   // 上（体外）へ引くと抜けてくる
        f.wire.len = L;
        if (!f.cv.tail && tailOut(S)) { f.cv.tail = true; f.wHold = false; drag = null; PS.emit({ type: 'tailOut' }); }
        break;
      }
      case 'cv': {
        const ns = PS.clamp(stop(drag.s0, drag.s0 - proj(p) / 5, 17, 6), 0, CV_LEN);
        if (ns > f.cv.s + .15 && (!f.cv.tail || !f.wHold)) { slip(S, f.cv.tail ? 'in' : 'noTail'); break; }
        f.cv.s = ns; break;
      }
      case 'wireOut': drag.pull = Math.max(0, -(p.y - drag.y0) + (p.x - drag.x0) * -.3); break;
    }
  }

  function up() {
    if (!drag) return;
    const S = S0, f = S.f, d = drag; drag = null;
    clearTimeout(d.holdTimer);
    if (!d.moved && !d.fresh && AUTO.includes(d.kind) && tapAuto(S, d.kind)) { PS.refresh(); return; }   // タップ＝自動で進む
    switch (d.kind) {
      case 'probe': { const wc = f.comp; f.comp = false; PS.emit({ type: 'probe', y: f.probe.y, x: f.probe.x, comp: wc, moved: d.moved }); break; }
      case 'needle': { const ns = needleState(S); PS.emit({ type: 'needle', st: ns.st, y: ns.y, d: ns.d }); break; }
      case 'inner': f.needle.pull = 0; if ((d.pull || 0) > 45) { const n = f.needle; n.inner = false; n.syr = false; n.flash = n.art ? 'a' : 'v'; PS.emit({ type: 'innerOut' }); } else PS.emit({ type: 'innerMid' }); break;
      case 'asp': PS.emit({ type: 'catAsp', ok: f.needle.asp >= .6, art: !!f.needle.art }); break;
      case 'needleOut': if (f.needle && f.needle.s <= .05) { f.site = { x: f.needle.ex, y: f.needle.ey }; f.needle = null; PS.emit({ type: 'needleOut' }); } break;
      case 'wire': PS.emit({ type: 'wire', len: f.wire.len, zone: zone(f.wire.len).id }); break;
      case 'cut': {
        const e0 = entry(S), L = Math.hypot(d.x - d.x0, d.y - d.y0), dist = segDist(e0, d.x0, d.y0, d.x, d.y);
        const ok = dist < 14 && L > 10 && L < 70; if (ok) f.cut = true;
        PS.emit({ type: 'cut', ok, why: dist >= 14 ? 'far' : L <= 10 ? 'short' : 'long' }); break;
      }
      case 'dil':
        if (d.deep) break;
        if (f.dil.s <= .05 && d.s0 > .05) { f.dil = null; f.dilDone = true; f.ooze = 1; PS.emit({ type: 'dilOut' }); }
        else PS.emit({ type: 'dil', s: f.dil.s });
        break;
      case 'cv': PS.emit({ type: 'cv', s: f.cv.s, zone: zone(f.cv.s).id }); break;
      case 'wireOut': if ((d.pull || 0) > 60) { f.wire = null; f.wHold = false; f.wireBack = true; PS.emit({ type: 'wireOut' }); } else PS.emit({ type: 'wireOutMid' }); break;
    }
    PS.refresh();
  }

  // ---------- タップで自動 ----------
  // ワイヤー・ダイレーター・カテーテルなどは、タップすると目標の深さまで自動で動く（ドラッグでも動かせる）。
  // ワイヤーを持っていない時の「一緒に入る／抜ける」はタップでも起こる。
  const AUTO = ['wire', 'needleOut', 'inner', 'asp', 'dil', 'cv', 'wireBack', 'wireOut'];
  let anim = null;
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const autoRun = (dur, step, done) => { anim = { t0: performance.now(), dur, step, done }; const iv = setInterval(() => { if (!anim) return clearInterval(iv); stepAnim(); }, 30); };   // 描画が止まっていても（裏のタブなど）進める
  const tween = (o, key, to, dur, done) => { const from = o[key]; autoRun(dur, e => { o[key] = from + (to - from) * e; }, done); };
  function stepAnim() {
    if (!anim) return;
    const a = anim, k = Math.min(1, (performance.now() - a.t0) / a.dur);
    if (a.step(ease(k)) === true || k >= 1) { anim = null; a.done(); PS.refresh(); }
  }
  function slipNow(S, how) { drag = {}; slip(S, how); drag = null; }
  function tapAuto(S, kind) {
    const f = S.f;
    switch (kind) {
      case 'wire': {
        const L = f.wire.len, T = L > 19 ? 17 : L < 15 ? 16.5 : null;
        if (T == null) return false;
        tween(f.wire, 'len', T, PS.clamp(Math.abs(T - L) * 90, 500, 1500), () => PS.emit({ type: 'wire', len: f.wire.len, zone: zone(f.wire.len).id }));
        return true;
      }
      case 'needleOut':
        if (f.wire && !f.wHold) { slipNow(S, 'out'); return true; }
        tween(f.needle, 's', 0, 700, () => { f.site = { x: f.needle.ex, y: f.needle.ey }; f.needle = null; PS.emit({ type: 'needleOut' }); });
        return true;
      case 'inner':
        autoRun(600, e => { f.needle.pull = 60 * e; }, () => { const n = f.needle; n.pull = 0; n.inner = false; n.syr = false; n.flash = n.art ? 'a' : 'v'; PS.emit({ type: 'innerOut' }); });
        return true;
      case 'asp': tween(f.needle, 'asp', .9, 700, () => PS.emit({ type: 'catAsp', ok: true, art: !!f.needle.art })); return true;
      case 'dil': {
        const out = f.dil.s >= 1.8;
        if (f.wire && !f.wHold) { slipNow(S, out ? 'out' : 'in'); return true; }
        if (!out) tween(f.dil, 's', 2.5, 900, () => PS.emit({ type: 'dil', s: f.dil.s }));
        else tween(f.dil, 's', 0, 800, () => { f.dil = null; f.dilDone = true; f.ooze = 1; PS.emit({ type: 'dilOut' }); });
        return true;
      }
      case 'cv': {
        if (f.wire && (!f.cv.tail || !f.wHold)) { slipNow(S, f.cv.tail ? 'in' : 'noTail'); return true; }
        const s0 = f.cv.s, T = s0 > 18.5 || s0 < 16 ? 17 : null;
        if (T == null) return false;
        tween(f.cv, 's', T, PS.clamp(Math.abs(T - s0) * 80, 500, 1500), () => PS.emit({ type: 'cv', s: f.cv.s, zone: zone(f.cv.s).id }));
        return true;
      }
      case 'wireBack': {
        const L0 = f.wire.len;
        autoRun(1400, e => { f.wire.len = L0 - (L0 - 4) * e; return tailOut(S); }, () => { if (tailOut(S)) { f.cv.tail = true; f.wHold = false; PS.emit({ type: 'tailOut' }); } });
        return true;
      }
      case 'wireOut': tween(f.wire, 'len', 0, 900, () => { f.wire = null; f.wHold = false; f.wireBack = true; PS.emit({ type: 'wireOut' }); }); return true;
    }
    return false;
  }

  function slip(S, how) {
    if (drag.slipped) return; drag.slipped = true;
    const f = S.f;
    if (how === 'out') f.wire.len = Math.max(3, f.wire.len - 6); else f.wire.len = Math.min(45, f.wire.len + 4);
    PS.emit({ type: 'slip', msg: {
      out: 'ワイヤーを押さえずに針を抜いたので、<b>ワイヤーも一緒に抜けてきた</b>。先に、ハブから出ているワイヤー（黄色の輪）を左手で持つ。',
      in: 'ワイヤーを持たずに押したので、<b>ワイヤーごと体内へ押し込まれた</b>（不整脈・ワイヤー遺残の危険）。後ろから出ているワイヤー（黄色の輪）を持ってから進める。',
      noTail: '<b>カテーテルのハブからワイヤーの尻が出ていない</b>のに進めた。ワイヤーごと押し込まれる＝<b>ワイヤーの体内遺残</b>の典型。皮膚のところでワイヤーを持ち、尻がハブから出るまで引き戻す。',
    }[how] });
  }
  function segDist(p, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1, t = PS.clamp(((p.x - x1) * dx + (p.y - y1) * dy) / L, 0, 1);
    return Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy));
  }

  // ---------- 描画 ----------
  const beat = t => { const ph = (t * 1.4) % 1; return ph < .15 ? Math.sin(ph / .15 * Math.PI) : 0; };
  function draw() {
    const S = S0; if (!S) return;
    stepAnim();
    const t = (performance.now() - T0) / 1000, f = S.f;
    if (!f.wire) f.wHold = false;
    drawField(S, t);
    if (!root.querySelector('#usBox').hidden) drawUS(S, t);
    if (!root.querySelector('#ecBox').hidden) drawECG(S, t);
  }

  // 画面には 0.81 倍・180°回して出す（頭側に下顎・耳・頬まで見えるように）。内部座標で見える範囲は x −121〜768, y −110〜482
  const VIEW = { ox: 622, oy: 391, s: .81 };
  const BX = -140, BY = -130, BW = 930, BH = 620;
  const win = q => { q.beginPath(); q.roundRect(150, -96, 420, 550, 26); };   // ドレープの穴
  let bgC = null;
  function makeBg() {
    const R = PS.R, c = R.mk(BW, BH), x = c.getContext('2d');
    const soft = (k, fn) => x.drawImage(R.soft(BW, BH, k, q => { q.translate(-BX, -BY); fn(q); }), BX, BY);
    x.translate(-BX, -BY);
    x.fillStyle = x.createPattern(R.drape('#2c6b99'), 'repeat'); x.fillRect(BX, BY, BW, BH);
    // ドレープの下の体の盛り上がり：後頭部（左上）・鼻とあご（右上＝顔は左を向く）・右肩（左下）・胸（下）
    soft(8, q => {
      const dome = (cx, cy, rx, ry, a) => { q.save(); q.translate(cx, cy); q.scale(1, ry / rx); const gr = q.createRadialGradient(-rx * .2, -rx * .3, rx * .05, 0, 0, rx); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.65, `rgba(255,255,255,${a * .35})`); gr.addColorStop(.9, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr; q.beginPath(); q.arc(0, 0, rx, 0, 7); q.fill(); q.restore(); };
      dome(60, -150, 170, 150, .3);      // 後頭部（枕の上）
      dome(690, -70, 120, 110, .38);     // 鼻・あご
      dome(20, 480, 200, 160, .3);       // 右肩
      dome(470, 610, 340, 170, .22);     // 胸
    });
    soft(10, q => { const r = R.rng(33); for (let i = 0; i < 7; i++) { q.save(); q.translate(BX + r() * BW, BY + r() * BH); q.rotate(r() * 3); const gr = q.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.45, 'rgba(255,255,255,.13)'); gr.addColorStop(.55, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr; q.fillRect(-260, -40, 520, 80); q.restore(); } });
    x.save(); win(x); x.clip();
    x.drawImage(R.iodineSkin(420, 550, 7), 150, -96);
    // 顔（消毒は下顎まで）：耳の下 → 下顎枝 → 下顎角 → 下縁 → あご
    const face = q => { q.beginPath(); q.moveTo(140, -110); q.lineTo(140, -4); q.quadraticCurveTo(178, 22, 210, 24); q.quadraticCurveTo(252, 22, 266, 28); q.quadraticCurveTo(272, 74, 292, 100); q.quadraticCurveTo(430, 70, 640, 44); q.lineTo(640, -110); q.closePath(); };
    soft(2, q => {
      q.save(); face(q); q.clip();
      q.fillStyle = '#c98a62'; q.fillRect(140, -110, 500, 220);
      const r = R.rng(5);
      for (let i = 0; i < 90; i++) { q.fillStyle = r() < .5 ? `rgba(150,80,50,${.05 + r() * .1})` : `rgba(235,180,145,${.05 + r() * .12})`; q.beginPath(); q.ellipse(140 + r() * 500, -110 + r() * 220, 8 + r() * 30, 5 + r() * 14, r() * 3, 0, 7); q.fill(); }
      const gr = q.createRadialGradient(430, -40, 10, 430, -30, 220); gr.addColorStop(0, 'rgba(250,205,170,.45)'); gr.addColorStop(.6, 'rgba(250,205,170,.1)'); gr.addColorStop(1, 'rgba(90,40,20,.25)');
      q.fillStyle = gr; q.fillRect(140, -110, 500, 220);
      q.fillStyle = 'rgba(200,90,70,.12)'; q.beginPath(); q.ellipse(470, -60, 70, 36, -.1, 0, 7); q.fill();   // 頬の赤み
      // 髪：耳の上と後ろ（外側）、もみあげ（耳の前）
      q.fillStyle = '#2a1c15';
      q.beginPath(); q.moveTo(140, -110); q.lineTo(312, -110); q.quadraticCurveTo(300, -94, 292, -76); q.quadraticCurveTo(284, -56, 274, -44); q.quadraticCurveTo(262, -60, 250, -96); q.lineTo(176, -96); q.quadraticCurveTo(160, -50, 166, -6); q.quadraticCurveTo(152, 6, 140, 8); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(140,105,80,.45)'; q.lineWidth = 1.3;
      for (let i = 0; i < 14; i++) { q.beginPath(); q.moveTo(150 + i * 11, -110); q.quadraticCurveTo(156 + i * 10, -100, 160 + i * 9, -92 + (i > 9 ? 30 : 0)); q.stroke(); }
      for (let i = 0; i < 6; i++) { q.beginPath(); q.moveTo(144 + i * 4, -96); q.quadraticCurveTo(152 + i * 3, -50, 146 + i * 3, 0); q.stroke(); }
      q.restore();
      // 消毒の境目（にじむ）
      q.strokeStyle = 'rgba(156,85,36,.6)'; q.lineWidth = 16; face(q); q.stroke();
      // 下顎の下の影・下顎の縁の光
      q.strokeStyle = 'rgba(25,6,0,.5)'; q.lineWidth = 20; q.beginPath(); q.moveTo(274, 34); q.quadraticCurveTo(280, 86, 300, 114); q.quadraticCurveTo(430, 84, 640, 60); q.stroke();
      q.strokeStyle = 'rgba(255,215,180,.28)'; q.lineWidth = 8; q.beginPath(); q.moveTo(262, 22); q.quadraticCurveTo(268, 66, 288, 92); q.quadraticCurveTo(430, 62, 640, 36); q.stroke();
    });
    // 右の耳（上が頭頂側。後ろ＝外側に耳輪、前＝内側に耳珠、下に耳たぶ）
    x.save(); x.translate(214, -40);
    const ear = () => { x.beginPath(); x.moveTo(30, -50); x.bezierCurveTo(10, -62, -26, -58, -36, -32); x.bezierCurveTo(-46, -6, -36, 22, -22, 40); x.bezierCurveTo(-12, 56, 8, 62, 16, 48); x.bezierCurveTo(22, 38, 22, 28, 26, 20); x.bezierCurveTo(34, 6, 40, -10, 40, -26); x.bezierCurveTo(40, -38, 36, -46, 30, -50); x.closePath(); };
    x.shadowColor = 'rgba(20,4,0,.6)'; x.shadowBlur = 14; x.shadowOffsetX = -6; x.shadowOffsetY = 7;
    const eg = x.createRadialGradient(-10, -8, 4, 0, 0, 64); eg.addColorStop(0, '#e3a988'); eg.addColorStop(1, '#a8603e');
    ear(); x.fillStyle = eg; x.fill(); x.shadowColor = 'transparent';
    x.save(); ear(); x.clip();
    x.strokeStyle = 'rgba(255,230,205,.7)'; x.lineWidth = 5; x.beginPath(); x.moveTo(24, -50); x.bezierCurveTo(4, -58, -26, -52, -32, -30); x.bezierCurveTo(-40, -4, -30, 20, -18, 34); x.stroke();       // 耳輪の縁
    x.strokeStyle = 'rgba(110,50,25,.55)'; x.lineWidth = 7; x.beginPath(); x.moveTo(18, -40); x.bezierCurveTo(-2, -46, -20, -38, -24, -22); x.bezierCurveTo(-28, -2, -20, 14, -10, 26); x.stroke();   // 耳輪の内側の溝
    x.strokeStyle = 'rgba(240,195,165,.75)'; x.lineWidth = 6; x.beginPath(); x.moveTo(-10, 26); x.bezierCurveTo(-18, 6, -16, -18, 0, -30); x.moveTo(-12, -8); x.lineTo(14, -34); x.stroke();   // 対輪（Y字）
    x.fillStyle = 'rgba(80,28,12,.7)'; x.beginPath(); x.ellipse(12, -4, 14, 20, .25, 0, 7); x.fill();      // 耳甲介
    x.fillStyle = 'rgba(25,5,0,.9)'; x.beginPath(); x.ellipse(22, -2, 5, 7, 0, 0, 7); x.fill();             // 外耳道
    x.restore();
    x.fillStyle = '#d99b7a'; x.beginPath(); x.ellipse(34, 0, 7, 11, .1, 0, 7); x.fill();                      // 耳珠
    x.strokeStyle = 'rgba(255,230,205,.5)'; x.lineWidth = 2; x.beginPath(); x.ellipse(34, 0, 7, 11, .1, 2, 4.5); x.stroke();
    x.fillStyle = 'rgba(190,90,60,.3)'; x.beginPath(); x.ellipse(0, 46, 13, 10, 0, 0, 7); x.fill();         // 耳たぶ
    x.restore();
    soft(6, q => {
      // 胸鎖乳突筋（盛り上がり：光の当たる側と影）
      const ridge = (P, w) => { q.lineCap = 'round'; q.strokeStyle = 'rgba(255,225,190,.2)'; q.lineWidth = w; q.beginPath(); P.forEach((p, i) => i ? q.lineTo(p[0] - 6, p[1]) : q.moveTo(p[0] - 6, p[1])); q.stroke(); q.strokeStyle = 'rgba(30,8,0,.32)'; q.lineWidth = w * .5; q.beginPath(); P.forEach((p, i) => i ? q.lineTo(p[0] + w * .45, p[1]) : q.moveTo(p[0] + w * .45, p[1])); q.stroke(); };
      ridge(SCM_S, 40); ridge(SCM_C, 26);
      // 胸鎖乳突筋の三角（くぼみ）・鎖骨上窩
      q.fillStyle = 'rgba(30,8,0,.22)'; q.beginPath(); q.moveTo(378, 262); q.lineTo(470, 432); q.lineTo(392, 436); q.fill();
      q.fillStyle = 'rgba(30,8,0,.35)'; q.beginPath(); q.ellipse(280, 410, 95, 32, -.05, 0, 7); q.fill();
      // 鎖骨（盛り上がり）
      q.strokeStyle = 'rgba(255,225,190,.3)'; q.lineWidth = 16; q.beginPath(); q.moveTo(160, 436); q.quadraticCurveTo(330, 426, 520, 446); q.stroke();
      q.strokeStyle = 'rgba(30,8,0,.35)'; q.lineWidth = 10; q.beginPath(); q.moveTo(160, 452); q.quadraticCurveTo(330, 444, 520, 462); q.stroke();
      // 気管・甲状軟骨・胸骨切痕
      q.strokeStyle = 'rgba(255,225,190,.24)'; q.lineWidth = 40; q.beginPath(); q.moveTo(552, 110); q.lineTo(548, 440); q.stroke();
      q.strokeStyle = 'rgba(30,8,0,.3)'; q.lineWidth = 6; q.beginPath(); q.moveTo(530, 110); q.lineTo(526, 440); q.stroke();
      q.strokeStyle = 'rgba(30,8,0,.18)'; q.lineWidth = 3; for (let y = 230; y < 430; y += 17) { q.beginPath(); q.moveTo(534, y); q.quadraticCurveTo(552, y + 5, 570, y); q.stroke(); }   // 気管輪
      // 甲状軟骨（のど仏）：V字の盛り上がり
      q.fillStyle = 'rgba(255,230,195,.45)'; q.beginPath(); q.moveTo(530, 140); q.quadraticCurveTo(552, 128, 574, 140); q.lineTo(556, 200); q.lineTo(548, 200); q.closePath(); q.fill();
      q.fillStyle = 'rgba(30,8,0,.4)'; q.beginPath(); q.moveTo(528, 146); q.lineTo(548, 204); q.lineTo(540, 206); q.lineTo(520, 150); q.fill();
      q.fillStyle = 'rgba(255,225,190,.25)'; q.beginPath(); q.ellipse(552, 222, 16, 9, 0, 0, 7); q.fill();   // 輪状軟骨
      q.fillStyle = 'rgba(30,8,0,.45)'; q.beginPath(); q.ellipse(548, 454, 30, 16, 0, 0, 7); q.fill();
    });
    // 濡れたつや
    const r = R.rng(12);
    for (let i = 0; i < 7; i++) { const px = 180 + r() * 360, py = 130 + r() * 300, gr = x.createRadialGradient(px, py, 0, px, py, 30 + r() * 30); gr.addColorStop(0, 'rgba(255,240,220,.15)'); gr.addColorStop(1, 'rgba(255,240,220,0)'); x.fillStyle = gr; x.fillRect(px - 60, py - 60, 120, 120); }
    x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 16; x.strokeStyle = 'rgba(0,0,0,.9)'; x.lineWidth = 14;
    x.beginPath(); x.roundRect(143, -103, 434, 564, 32); x.stroke();
    x.restore();
    x.strokeStyle = 'rgba(230,238,245,.5)'; x.lineWidth = 3; x.beginPath(); x.roundRect(147, -99, 426, 556, 28); x.stroke();
    return c;
  }

  // 術野の座標 → 画面（180°回す）。文字は回さず、あとで画面に書く
  const vp = p => ({ x: VIEW.ox - VIEW.s * p.x, y: VIEW.oy - VIEW.s * p.y });
  let labels = [];
  const lbl = (s, x, y, o) => labels.push(Object.assign({ s, x, y, dx: 0, dy: 0, font: '12px "Hiragino Sans", sans-serif', color: '#fff', align: 'center' }, o));
  const flipHint = h => {
    if (!h) return h;
    const P = ([x, y]) => [VIEW.ox - VIEW.s * x, VIEW.oy - VIEW.s * y], o = {};
    if (h.drag) o.drag = h.drag.map(P);
    if (h.tap) o.tap = P(h.tap);
    if (h.hold) o.hold = P(h.hold);
    if (h.label) o.label = [...P(h.label), h.label[2]];
    return o;
  };
  function drawField(S, t) {
    const f = S.f, R = PS.R;
    if (!bgC) bgC = makeBg();
    labels = [];
    g.save(); g.translate(VIEW.ox, VIEW.oy); g.rotate(Math.PI); g.scale(VIEW.s, VIEW.s);
    g.drawImage(bgC, BX, BY);
    g.save(); win(g); g.clip();
    if (!S.exam && f.showVessels !== false) {
      const b = beat(t);
      g.lineCap = 'round';
      g.strokeStyle = `rgba(70,110,230,${f.tren ? .3 : .2})`; g.lineWidth = f.tren ? 30 : 22;
      g.beginPath(); for (let y = 40; y <= 470; y += 10) y === 40 ? g.moveTo(ijX(y), y) : g.lineTo(ijX(y), y); g.stroke();
      g.strokeStyle = `rgba(230,40,40,${.2 + .14 * b})`; g.lineWidth = 15 + 3 * b;
      g.beginPath(); for (let y = 40; y <= 470; y += 10) y === 40 ? g.moveTo(caX(y), y) : g.lineTo(caX(y), y); g.stroke();
    }
    // 皮膚マーキング（胸鎖乳突筋の2つの頭と鎖骨）
    g.strokeStyle = 'rgba(45,10,70,.8)'; g.lineWidth = 2.5; g.setLineDash([9, 7]);
    const ln = P => { g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
    ln([[250, 70], [380, 255], [470, 432]]); ln([[380, 255], [392, 436]]); ln([[165, 438], [330, 430], [515, 446]]);
    g.setLineDash([]);
    [['胸骨頭', 470, 360], ['鎖骨頭', 350, 400], ['鎖骨', 250, 425], ['甲状軟骨（のど仏）', 515, 172], ['気管', 552, 330], ['胸骨切痕', 548, 438], ['右耳', 200, 30], ['顔（左＝正中側を向いている）', 440, -40], ['下顎', 420, 100]].forEach(([s, x, y]) => lbl(s, x, y, { color: 'rgba(255,240,225,.9)' }));
    const e0 = entry(S);
    if (e0 && f.needle && f.needle.s > 0) { g.fillStyle = 'rgba(40,5,0,.5)'; g.beginPath(); g.ellipse(e0.x, e0.y, 4, 3, 0, 0, 7); g.fill(); }
    if (e0 && (f.ooze || f.mishap)) blood(e0.x - 6, e0.y + 8, f.mishap ? 20 : 8, f.mishap === 'a', t);
    if (f.cut && e0) { g.strokeStyle = '#3a0505'; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(e0.x - 8, e0.y - 2); g.lineTo(e0.x + 8, e0.y + 2); g.stroke(); g.strokeStyle = 'rgba(190,30,30,.8)'; g.lineWidth = 1.3; g.stroke(); }
    g.restore();

    if (f.probe && (mode() === 'probe' || mode() === 'needle') && !f.needle) drawProbe(f.probe.x, f.probe.y, f.comp);
    if (f.probe && f.needle && mode() === 'needle') drawProbe(f.needle.ex, tipY(S) + 18, false);
    if (f.wire) drawWire(S);
    if (f.needle) drawNeedle(S, t);
    if (f.dil) drawDil(S);
    if (f.cv) drawCV(S);
    if (f.dress && e0) drawDress(e0);
    if (f.wire && f.wHold) { const gp = gripPos(S); R.fingers(g, gp.x, gp.y, U.a + Math.PI / 2, .9); }
    if (f.wire && !f.wHold && !S.exam && ['needleOut', 'cut', 'dil', 'cv'].includes(mode())) {
      const gp = gripPos(S), k = (t * 1.4) % 1;
      g.strokeStyle = `rgba(255,207,51,${1 - k})`; g.lineWidth = 2.5; g.beginPath(); g.arc(gp.x, gp.y, 8 + 14 * k, 0, 7); g.stroke();
    }
    if (f.held && mouse.in) drawHeld(f.held, mouse.x, mouse.y);
    g.restore();
    // ここから画面の向き
    labels.forEach(l => { const p = vp(l); g.font = l.font; g.textAlign = l.align; g.fillStyle = l.color; g.fillText(l.s, p.x + l.dx, p.y + l.dy); });
    const tag = (s, x, y, al) => { g.font = '12px "Hiragino Sans", sans-serif'; g.textAlign = al; const w = g.measureText(s).width, x0 = al === 'left' ? x : al === 'right' ? x - w : x - w / 2; g.fillStyle = 'rgba(10,16,24,.62)'; g.beginPath(); g.roundRect(x0 - 5, y - 13, w + 10, 18, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(s, x, y); };
    tag(`↑ 足側（奥）　右頸部を頭側から見ている（頭を左へ向けている）${f.tren ? '・頭低位' : ''}`, 14, 20, 'left');
    tag('← 内側（正中）', 14, 470, 'left'); tag('外側 →', 706, 470, 'right');
    tag('↓ 頭側（あなたが立つ側）', 300, 470, 'center');
    drawMap();
    if (f.cv && !S.exam) {   // 皮膚の目盛を読む
      const p = vp(e0);
      g.fillStyle = 'rgba(20,24,30,.8)'; g.fillRect(p.x + 22, p.y - 8, 92, 20);
      g.fillStyle = '#ffcf33'; g.font = 'bold 12px "Hiragino Sans", sans-serif'; g.textAlign = 'left'; g.fillText(`皮膚で ${f.cv.s.toFixed(0)} cm`, p.x + 28, p.y + 6);
    }
    const st = curStep();
    if (st && st.hint && !PS.cur.waiting) PS.drawHint(g, flipHint(typeof st.hint === 'function' ? st.hint(S) : st.hint), t);
  }

  // 右上の見取り図：仰臥位の患者を上から。頭が手前（あなた）、足が奥。見えている所＝右頸部
  function drawMap() {
    const X = 588, Y = 30, W = 122, H = 236, cx = X + W / 2;
    g.save();
    g.fillStyle = 'rgba(12,18,26,.82)'; g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
    g.beginPath(); g.roundRect(X, Y, W, H, 8); g.fill(); g.stroke();
    g.fillStyle = '#cfd8e3'; g.font = 'bold 11px "Hiragino Sans", sans-serif'; g.textAlign = 'center';
    g.fillText('いまの視点', cx, Y + 15);
    g.font = '10px "Hiragino Sans", sans-serif'; g.fillStyle = '#8fa1b5';
    g.fillText('足', cx, Y + 30); g.textAlign = 'left'; g.fillText('左', X + 6, Y + 120); g.textAlign = 'right'; g.fillText('右', X + W - 6, Y + 120);
    // ベッドと体（頭が下）
    g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(cx - 34, Y + 36, 68, 146, 6); g.fill();
    const skin = '#d9a27c';
    g.fillStyle = skin;
    g.beginPath(); g.moveTo(cx - 13, Y + 40); g.lineTo(cx + 13, Y + 40); g.lineTo(cx + 15, Y + 92); g.lineTo(cx - 15, Y + 92); g.fill();   // 脚
    g.beginPath(); g.roundRect(cx - 20, Y + 88, 40, 56, 8); g.fill();   // 体幹
    g.beginPath(); g.roundRect(cx - 28, Y + 96, 8, 44, 4); g.fill(); g.beginPath(); g.roundRect(cx + 20, Y + 96, 8, 44, 4); g.fill();   // 腕
    g.fillRect(cx - 5, Y + 142, 10, 10);   // 首
    g.beginPath(); g.ellipse(cx, Y + 162, 12, 13, 0, 0, 7); g.fill();   // 頭
    g.beginPath(); g.moveTo(cx - 11, Y + 158); g.lineTo(cx - 17, Y + 163); g.lineTo(cx - 10, Y + 166); g.fill();   // 鼻＝左を向く
    g.fillStyle = '#5a3a28'; g.beginPath(); g.ellipse(cx + 4, Y + 165, 8, 9, 0, 0, 7); g.fill();   // 後頭部の髪
    // 見えている範囲
    g.strokeStyle = '#ffcf33'; g.lineWidth = 2; g.strokeRect(cx + 1, Y + 136, 16, 18);
    g.fillStyle = '#ffcf33'; g.font = '10px "Hiragino Sans", sans-serif'; g.textAlign = 'left'; g.fillText('← ここ', cx + 20, Y + 148);
    // あなた
    g.fillStyle = '#2f9be0'; g.beginPath(); g.arc(cx, Y + 200, 7, 0, 7); g.fill();
    g.beginPath(); g.ellipse(cx, Y + 216, 18, 7, 0, Math.PI, 0); g.fill();
    g.strokeStyle = '#2f9be0'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, Y + 190); g.lineTo(cx, Y + 180); g.stroke();
    g.beginPath(); g.moveTo(cx - 4, Y + 184); g.lineTo(cx, Y + 179); g.lineTo(cx + 4, Y + 184); g.stroke();
    g.fillStyle = '#cfd8e3'; g.textAlign = 'center'; g.fillText('あなた（頭側に立つ）', cx, Y + 230);
    g.restore();
  }

  function blood(x, y, r, art, t) {
    const rr = r * (art ? 1 + .08 * beat(t) : 1), gr = g.createRadialGradient(x - rr * .2, y - rr * .2, 1, x, y, rr);
    gr.addColorStop(0, art ? 'rgba(175,10,10,.95)' : 'rgba(85,6,6,.95)'); gr.addColorStop(.75, art ? 'rgba(140,8,8,.85)' : 'rgba(70,4,4,.85)'); gr.addColorStop(1, 'rgba(60,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * .75, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - rr * .35, y - rr * .3, rr * .22, rr * .1, -.5, 0, 7); g.fill();
  }

  // ワイヤー（体外）：目盛（先端から 10・20・30 cm に黒い帯）
  function drawWire(S) {
    const R = PS.R, pts = wirePts(S);
    R.tube(g, pts, 2.6, '#5d6873', { hi: 'rgba(255,255,255,.6)', sb: 3, sx: 1.5, sy: 2.5 });
    const f = S.f; if (f.cv && !f.cv.tail) return;
    // 弧長に沿って目盛を置く（体外の長さ＝WTOT−len を経路の長さに対応させる）
    const segL = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segL.push(l); tot += l; }
    const ext = f.cv ? extLen(S) - HUBX : extLen(S), scale = tot / Math.max(1, ext);
    [10, 20, 30].forEach((mk, k) => {
      const dcm = mk - f.wire.len - (f.cv ? HUBX : 0); if (dcm < 0 || dcm > ext) return;
      let dd = dcm * scale, i = 0; while (i < segL.length && dd > segL[i]) { dd -= segL[i]; i++; } if (i >= segL.length) return;
      const a = pts[i], b = pts[i + 1], tt = dd / segL[i], x = a[0] + (b[0] - a[0]) * tt, y = a[1] + (b[1] - a[1]) * tt, an = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.save(); g.translate(x, y); g.rotate(an); g.fillStyle = '#15191d'; for (let j = 0; j <= k; j++) g.fillRect(j * 4.5, -2, 2.6, 4); g.restore();
    });
    const e = pts[pts.length - 1]; g.fillStyle = '#2b3138'; g.beginPath(); g.arc(e[0], e[1], 2, 0, 7); g.fill();
  }

  function drawProbe(x, y, comp) {
    const R = PS.R;
    g.save(); g.translate(x, y + (comp ? 2 : 0));
    R.tube(g, [[0, -12], [6, -50], [70, -64], [140, -60], [210, -90]], 9, '#2c3137', { hi: 'rgba(255,255,255,.25)' });
    const gl = g.createRadialGradient(0, 0, 4, 0, 0, 48); gl.addColorStop(0, 'rgba(210,235,255,.45)'); gl.addColorStop(1, 'rgba(210,235,255,0)');
    g.fillStyle = gl; g.beginPath(); g.ellipse(0, 0, 50, 18, 0, 0, 7); g.fill();
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = comp ? 4 : 9; g.shadowOffsetX = comp ? 1 : 4; g.shadowOffsetY = comp ? 2 : 6;
    const bd = g.createLinearGradient(0, -12, 0, 12); bd.addColorStop(0, '#f4f6f8'); bd.addColorStop(.5, '#d9dee3'); bd.addColorStop(1, '#9aa3ab');
    g.fillStyle = bd; g.beginPath(); g.roundRect(-38, -12, 76, 24, 9); g.fill(); g.shadowColor = 'transparent';
    g.fillStyle = '#7fd0ff'; g.beginPath(); g.arc(-31, 0, 3, 0, 7); g.fill();
    g.restore();
    if (comp) lbl('圧迫中', x, y, { font: 'bold 12px "Hiragino Sans", sans-serif', color: '#ffcf33', dy: 30 });
  }

  function drawNeedle(S, t) {
    const R = PS.R, n = S.f.needle, h = hubPos(S);
    if (!S.exam && n.s > 0) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(n.ex, n.ey); g.lineTo(n.ex, tipY(S)); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(n.ex, tipY(S), 3, 0, 7); g.fill(); }
    const pl = n.inner ? (n.pull || 0) : 0;
    if (n.inner) R.metal(g, n.ex, n.ey, h.x, h.y - pl, 2.6);
    if (n.cath) {   // 外套（半透明のプラスチック）と緑のハブ
      g.lineCap = 'round'; g.strokeStyle = 'rgba(230,242,236,.7)'; g.lineWidth = 6; g.beginPath(); g.moveTo(n.ex, n.ey); g.lineTo(h.x, h.y + 10); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(n.ex - 2, n.ey); g.lineTo(h.x - 2, h.y + 10); g.stroke();
      R.part(g, h.x, h.y + 4, 14, 14, '#3aa35b', 0, 3);
    }
    if (n.inner) R.part(g, h.x, h.y - 6 - pl, 11, 13, '#e2779b', 0, 2);
    if (n.syr) {
      const y1 = h.y - (n.inner ? 13 + pl : 3), y0 = y1 - 60;
      g.save(); g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 4;
      const bg = g.createLinearGradient(h.x - 11, 0, h.x + 11, 0); bg.addColorStop(0, 'rgba(200,215,225,.75)'); bg.addColorStop(.3, 'rgba(255,255,255,.9)'); bg.addColorStop(1, 'rgba(170,185,195,.75)');
      g.fillStyle = bg; g.beginPath(); g.roundRect(h.x - 11, y0, 22, 60, 3); g.fill(); g.restore();
      if (!n.inner ? n.asp > .02 : n.flash) {
        const art = n.inner ? n.flash === 'a' : !!n.art, hh = !n.inner ? 40 * n.asp : art ? 24 + 10 * beat(t) : 20, bc = g.createLinearGradient(h.x - 9, 0, h.x + 9, 0);
        bc.addColorStop(0, art ? '#a30d14' : '#3d0508'); bc.addColorStop(.35, art ? '#ef2b2b' : '#6e0a10'); bc.addColorStop(1, art ? '#8a0a10' : '#300306');
        g.fillStyle = bc; g.fillRect(h.x - 9.5, y1 - 2 - hh, 19, hh);
      }
      g.strokeStyle = 'rgba(40,50,60,.55)'; g.lineWidth = 1;
      for (let k = 0; k < 8; k++) { const yy = y1 - 6 - k * 6; g.beginPath(); g.moveTo(h.x - 11, yy); g.lineTo(h.x - (k % 2 ? 7 : 4), yy); g.stroke(); }
      g.fillStyle = '#1d1f22'; g.fillRect(h.x - 10, y0 + 8, 20, 7);
      g.fillStyle = '#f2f3f4'; g.fillRect(h.x - 3, y0 - 22, 6, 30);
      R.part(g, h.x, y0 - 24, 26, 5, '#e9ecef', 0, 2);
    } else if (n.flash) {
      const art = n.flash === 'a', b = beat(t);
      g.fillStyle = art ? '#d81a1a' : '#4a0508';
      if (art) { g.beginPath(); g.ellipse(h.x, h.y - 18 - 14 * b, 3.5 + b, 7 + 8 * b, 0, 0, 7); g.fill(); }
      else { g.beginPath(); g.arc(h.x, h.y - 13, 3.2, 0, 7); g.fill(); }   // 内頸は圧が低く、にじむ程度（呼吸で引き込むこともある）
    }
  }

  function drawDil(S) {
    const R = PS.R, e = entry(S), L = dilExt(S), hb = along(e, L);
    g.fillStyle = 'rgba(30,8,0,.35)'; g.beginPath(); g.ellipse(e.x, e.y, 6, 4, U.a, 0, 7); g.fill();
    R.tube(g, [[e.x, e.y], [hb.x, hb.y]], 5.5, '#f4f4f0', { cap: 'butt', edge: '#7c8791' });
    const c = along(e, L + 8); R.part(g, c.x, c.y, 11, 16, '#2a62b8', U.a + Math.PI / 2, 3);
    // 深さの目盛（cm）
    g.fillStyle = 'rgba(30,40,50,.8)'; for (let cm = 1; cm < DIL_LEN; cm++) { const y = (cm - S.f.dil.s) * 8; if (y < 3 || y > L - 2) continue; const q = along(e, y); g.fillRect(q.x - 3, q.y, 6, 1); }
  }

  function drawCV(S) {
    const R = PS.R, f = S.f, c = f.cv, e = entry(S), gap = cvGap(S), st = along(e, gap), L = cvExt(S), hb = cvHub(S);
    if (!gap) { g.fillStyle = 'rgba(30,8,0,.35)'; g.beginPath(); g.ellipse(e.x, e.y, 6, 4, U.a, 0, 7); g.fill(); }
    R.tube(g, [[st.x, st.y], [hb.x, hb.y]], c.n === 4 ? 6.5 : 5.6, '#f3f1ea', { cap: 'butt', edge: '#8c8f88' });
    // 1 cm ごとの目盛・5 cm ごとの数字
    g.fillStyle = 'rgba(25,30,35,.85)';
    for (let cm = 1; cm <= CV_LEN; cm++) {
      const d = (cm - c.s) * 7 + gap; if (d < 2 || d > L - 4) continue;
      const q = along(e, d); g.fillRect(q.x - 3, q.y, cm % 5 ? 3 : 6, cm % 5 ? 1 : 1.6);
      if (cm % 5 === 0) lbl(String(cm), q.x + 10, q.y, { font: 'bold 8px sans-serif', color: 'rgba(25,30,35,.85)', dy: 3 });
    }
    // 固定用の翼（クランプウィング）
    const w = along(e, gap + 22 + Math.max(0, (CV_LEN - c.s) * 0));
    if (c.s > CV_LEN - 8) { R.part(g, w.x, w.y, 30, 8, '#e9e6dc', U.a + Math.PI / 2, 3); }
    // ハブ・延長チューブ・クランプ・ルアー
    R.part(g, hb.x, hb.y, 18, 20, '#e7e3d6', U.a + Math.PI / 2, 4);
    legs(S).forEach((l, i) => {
      const a0 = { x: hb.x + Math.cos(l.a) * 8, y: hb.y + Math.sin(l.a) * 8 };
      R.tube(g, [[a0.x, a0.y], [l.x, l.y]], 3.4, '#eef2f4', { hi: 'rgba(255,255,255,.7)' });
      const cl = { x: hb.x + Math.cos(l.a) * 36, y: hb.y + Math.sin(l.a) * 36 };
      R.part(g, cl.x, cl.y, 12, 6, '#f2f2f2', l.a, 2);
      R.part(g, l.x, l.y, 10, 12, LEGC[l.k], l.a + Math.PI / 2, 2);
    });
    if (!S.exam) { const l0 = legs(S)[0]; lbl('遠位（茶）', l0.x, l0.y, { font: '11px "Hiragino Sans", sans-serif', align: 'left', dx: 14, dy: 4 }); }
    if (c.sut) { g.strokeStyle = '#1b2a3a'; g.lineWidth = 1.6; [-1, 1].forEach(s => { const p = along(e, 22), x = p.x + s * 17, y = p.y; g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4); g.stroke(); }); }
  }
  function drawDress(e) {
    g.save(); g.fillStyle = 'rgba(220,235,245,.18)'; g.strokeStyle = 'rgba(240,248,255,.7)'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(e.x - 50, e.y - 70, 100, 96, 14); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(e.x - 20, e.y - 40, 26, 8, -.4, 0, 7); g.fill(); g.restore();
  }

  function drawHeld(id, x, y) {
    const R = PS.R;
    if (id === 'probe') return drawProbe(x, y, false);
    g.save(); g.globalAlpha = .95;
    if (id === 'cvneedle') { R.metal(g, x, y, x, y - 56, 2.6); g.strokeStyle = 'rgba(230,242,236,.8)'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y - 52); g.stroke(); R.part(g, x, y - 56, 14, 12, '#3aa35b', 0, 3); R.part(g, x, y - 68, 11, 12, '#e2779b', 0, 2); R.part(g, x, y - 104, 22, 60, '#e8eef2', 0, 3); }
    if (id === 'needle') { R.metal(g, x, y, x, y - 56, 2.6); R.part(g, x, y - 62, 11, 13, '#e2779b', 0, 2); R.part(g, x, y - 100, 22, 60, '#e8eef2', 0, 3); }
    else if (id === 'cvwire') {
      R.tube(g, [[x, y], [x, y - 22]], 7, '#e9eef2', { cap: 'butt' });
      g.strokeStyle = '#3d7dd8'; g.lineWidth = 4.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x - 40, y - 60, 34 - i * 4, 0, 7); g.stroke(); }
      g.strokeStyle = '#55606b'; g.lineWidth = 2; g.beginPath(); g.arc(x + 3, y + 2, 3, -Math.PI * .5, Math.PI * 1.2); g.stroke();
    }
    else if (id === 'scalpel') { g.fillStyle = '#dfe4e8'; g.strokeStyle = '#8a9399'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y - 22); g.lineTo(x - 3, y - 24); g.closePath(); g.fill(); g.stroke(); R.part(g, x, y - 64, 9, 80, '#cfd5da', 0, 3); }
    else if (id === 'cvdil') { R.tube(g, [[x, y], [x, y - 90]], 5.5, '#f4f4f0', { cap: 'butt', edge: '#7c8791' }); R.part(g, x, y - 98, 16, 11, '#2a62b8', 0, 3); }
    else if (id === 'cvc3' || id === 'cvc4') {
      R.tube(g, [[x, y], [x, y - 110]], id === 'cvc4' ? 6.5 : 5.6, '#f3f1ea', { cap: 'butt', edge: '#8c8f88' }); R.part(g, x, y - 118, 20, 18, '#e7e3d6', 0, 4);
      (id === 'cvc4' ? ['d', 'm', 'p', 'x'] : ['d', 'm', 'p']).forEach((k, i, A) => { const a = -Math.PI / 2 + (i - (A.length - 1) / 2) * .34, ex = x + Math.cos(a) * 60, ey = y - 124 + Math.sin(a) * 60; R.tube(g, [[x, y - 124], [ex, ey]], 3.4, '#eef2f4'); R.part(g, ex, ey, 10, 12, LEGC[k], a + Math.PI / 2, 2); });
    }
    else if (id === 'suture') { g.strokeStyle = '#b8bfc6'; g.lineWidth = 2; g.beginPath(); g.arc(x, y - 8, 8, 0, Math.PI); g.stroke(); g.strokeStyle = '#1b2a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 8, y - 8); g.bezierCurveTo(x - 20, y - 40, x + 20, y - 60, x - 10, y - 90); g.stroke(); }
    else if (id === 'dressing') { g.fillStyle = 'rgba(220,235,245,.35)'; g.strokeStyle = 'rgba(240,248,255,.9)'; g.lineWidth = 2; g.beginPath(); g.roundRect(x - 50, y - 60, 100, 90, 14); g.fill(); g.stroke(); }
    g.restore();
  }

  // ---------- エコー ----------
  function usY(S) { const f = S.f; if (f.needle) return tipY(S); if (f.probe) return f.probe.y; const e = entry(S); return e ? e.y + 30 : 255; }
  function usX(S) { const f = S.f; if (f.needle) return f.needle.ex; if (f.probe) return f.probe.x; const e = entry(S); return e ? e.x : ijX(255); }
  function drawUS(S, t) {
    const R = PS.R, f = S.f, W = 360, H = 250, PX = 50;
    us.fillStyle = '#000'; us.fillRect(0, 0, W, H);
    if (!f.probe && !f.needle && !f.wire && !f.cv) { us.fillStyle = '#7f8a94'; us.font = '13px "Hiragino Sans", sans-serif'; us.textAlign = 'center'; us.fillText('プローブを皮膚に当てると画像が出ます', W / 2, H / 2); root.querySelector('#usLv').textContent = ''; return; }
    if (f.long) return drawLong(S, t);
    const y = usY(S), b = beat(t), V = vgeo(S, y), x0 = (usX(S) - caX(y)) / CM;
    const X = xcm => W / 2 - (xcm - x0) * PX;   // 頭側から当てる：画面の左＝内側、右＝外側（術者の手の向きと同じ）
    const tis = R.usTissue(W, H, PX, { skin: .1, fat: .32, fascia: .38, seed: 41, att: .16, fibAng: .05, deepFascia: Math.round((dIJ(y) - V.ij.ry - .12) * 10) / 10 });
    us.save(); if (f.comp) { us.translate(0, -5); us.scale(1, 1.03); }
    us.drawImage(tis, 0, 0);
    // 甲状腺（内側・均一でやや明るい）、椎体の横突起（深部の骨）、肺尖（鎖骨の近く）
    us.save(); us.fillStyle = 'rgba(200,200,195,.22)'; us.beginPath(); us.ellipse(X(1.6), (dIJ(y) - .1) * PX, .9 * PX, .7 * PX, -.2, 0, 7); us.fill(); us.restore();
    R.usBone(us, X(-.5), (dIJ(y) + 2.2) * PX, 1.3 * PX, .45 * PX, H);
    if (y > 360) {
      const pd = pleuraD(y) * PX;
      us.strokeStyle = 'rgba(245,245,240,.85)'; us.lineWidth = 3; us.beginPath(); us.moveTo(X(-3.5), pd + 8); us.quadraticCurveTo(X(-1.4), pd - 6, X(.2), pd + 12); us.stroke();
      for (let k = 1; k < 3; k++) { us.strokeStyle = `rgba(230,230,225,${.3 / k})`; us.lineWidth = 2; us.beginPath(); us.moveTo(X(-3.2), pd + 8 + k * 30); us.quadraticCurveTo(X(-1.4), pd - 6 + k * 30, X(0), pd + 12 + k * 30); us.stroke(); }
    }
    const ns = f.needle ? needleState(S) : null;
    const ijRy = V.ij.ry * (f.comp ? .15 : 1) * (ns && ns.st === 'tent' ? .55 : 1) * (1 + .06 * Math.sin(t * 1.6));
    const caR = V.ca.rx * (1 + .07 * b);
    R.usVessel(us, X(V.ca.x), V.ca.y * PX, caR * PX, caR * PX, true, H);
    R.usVessel(us, X(V.ij.x), (V.ij.y + (ns && ns.st === 'tent' ? .12 : 0)) * PX, V.ij.rx * PX, Math.max(1.5, ijRy * PX), false, H);
    // 血管内のワイヤー・カテーテル
    if (!f.needle && (f.wire || f.cv)) {
      const art = f.wire && f.wire.art, q = art ? { x: X(V.ca.x), y: V.ca.y * PX, r: caR * PX } : { x: X(V.ij.x), y: V.ij.y * PX, r: V.ij.ry * PX };
      if (f.cv && f.cv.s > 1.5) { us.strokeStyle = 'rgba(255,255,255,.85)'; us.lineWidth = 1.6; us.beginPath(); us.arc(q.x, q.y + q.r * .3, 5, 0, 7); us.stroke(); us.beginPath(); us.arc(q.x, q.y + q.r * .3, 3, 0, 7); us.stroke(); }
      else if (f.dil && f.dil.s > 1.5) { us.strokeStyle = 'rgba(255,255,255,.85)'; us.lineWidth = 2; us.beginPath(); us.arc(q.x, q.y + q.r * .2, 4.5, 0, 7); us.stroke(); }
      else R.usNeedleDot(us, q.x, q.y + q.r * .35, false);
    }
    if (f.color) {
      R.usColorBox(us, 40, 20, 260, 150);
      R.usColor(us, X(V.ca.x), V.ca.y * PX, caR * PX, caR * PX, true, b);
      if (!f.comp) R.usColor(us, X(V.ij.x), V.ij.y * PX, V.ij.rx * PX, ijRy * PX, false, b);
    }
    us.restore();
    if (ns && ns.st !== 'out') R.usNeedleDot(us, W / 2, ns.d * PX, ns.st === 'lumen');
    R.mottle(us, W, H, .14);
    R.usUI(us, 0, 0, W, H, PX, { color: f.color, info: ['L12-3', '11.0MHz', 'Gn 50', f.color ? 'CF 6.3MHz' : 'DR 60', 'FR 31'], focus: 1.6 });
    if (!S.exam) {
      us.font = '11px "Hiragino Sans", sans-serif'; us.fillStyle = 'rgba(255,255,255,.75)'; us.textAlign = 'center';
      us.fillText('IJV', X(V.ij.x), (V.ij.y - V.ij.ry) * PX - 6); us.fillText('CA', X(V.ca.x) - 18, V.ca.y * PX + caR * PX + 12);
      us.fillStyle = 'rgba(200,210,220,.7)'; us.textAlign = 'left'; us.fillText('内側', 64, H - 6); us.textAlign = 'right'; us.fillText('外側', W - 70, H - 6);
    }
    root.querySelector('#usLv').textContent = S.exam ? '' : y < 200 ? '高い（甲状軟骨の高さ）' : y < 330 ? '三角の頂点〜輪状軟骨の高さ' : '鎖骨のすぐ上（肺尖が近い）';
  }
  // 長軸（左＝頭側）：静脈の中を通るワイヤー（またはカテーテル）を確かめる
  function drawLong(S, t) {
    const R = PS.R, f = S.f, W = 360, H = 250, PX = 50, y = 280, V = vgeo(S, y), b = beat(t);
    us.drawImage(R.usTissue(W, H, PX, { skin: .1, fat: .32, fascia: .38, seed: 43, att: .16, fibAng: .02 }), 0, 0);
    const vein = (cy, r, art) => {
      us.fillStyle = '#050505'; us.fillRect(0, cy - r, W, r * 2);
      us.strokeStyle = art ? 'rgba(230,230,225,.85)' : 'rgba(200,200,195,.6)'; us.lineWidth = art ? 2.4 : 1.3;
      us.beginPath(); us.moveTo(0, cy - r); us.lineTo(W, cy - r); us.moveTo(0, cy + r); us.lineTo(W, cy + r); us.stroke();
      const gr = us.createLinearGradient(0, cy + r, 0, cy + r + 60); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); us.fillStyle = gr; us.fillRect(0, cy + r, W, 60);
    };
    const art = f.wire && f.wire.art, cy = (art ? V.ca.y + .2 : V.ij.y) * PX, r = (art ? V.ca.ry * (1 + .1 * b) : V.ij.ry) * PX;
    vein(cy, r, art);
    const e = { x: 40, y: 4 }, hit = { x: 120, y: cy - r * .2 };
    if (f.cv) { us.strokeStyle = 'rgba(255,255,255,.85)'; us.lineWidth = 1.5; [-3, 3].forEach(o => { us.beginPath(); us.moveTo(e.x, e.y + o); us.lineTo(hit.x, hit.y + o); us.lineTo(W, cy + o); us.stroke(); }); }
    else if (f.wire) { us.strokeStyle = 'rgba(255,255,255,.95)'; us.lineWidth = 2; us.beginPath(); us.moveTo(e.x, e.y); us.lineTo(hit.x, hit.y); us.quadraticCurveTo(hit.x + 40, cy + r * .4, W, cy + r * .3); us.stroke(); for (let k = 1; k < 4; k++) { us.strokeStyle = `rgba(255,255,255,${.3 / k})`; us.beginPath(); us.moveTo(hit.x + 30, cy + r * .4 + k * 7); us.lineTo(W, cy + r * .3 + k * 7); us.stroke(); } }
    if (f.color) { us.save(); us.beginPath(); us.rect(40, cy - r, 260, r * 2); us.clip(); us.fillStyle = art ? `rgba(230,${60 + 150 * b},30,${.5 + .4 * b})` : 'rgba(40,90,230,.75)'; us.fillRect(40, cy - r, 260, r * 2); us.restore(); }
    R.mottle(us, W, H, .14);
    R.usUI(us, 0, 0, W, H, PX, { color: f.color, info: ['L12-3', '11.0MHz', 'Gn 50', 'LONG', 'FR 31'], focus: 1.6 });
    if (!S.exam) { us.font = '11px "Hiragino Sans", sans-serif'; us.fillStyle = 'rgba(255,255,255,.75)'; us.textAlign = 'left'; us.fillText('頭側', 64, H - 6); us.textAlign = 'right'; us.fillText('足側', W - 70, H - 6); us.textAlign = 'center'; us.fillText(art ? '拍動する壁の厚い血管' : '内頸静脈', W / 2 + 60, cy - r - 6); }
    root.querySelector('#usLv').textContent = S.exam ? '' : '長軸：ワイヤーがどの血管の中か';
  }

  // ---------- 心電図（ワイヤー・カテーテルが右房〜右室に触れると期外収縮） ----------
  function irritable(S) { const f = S.f; return (f.wire && !f.wire.art && f.wire.len > 19) || (f.cv && f.cv.s > 19); }
  function drawECG(S, t) {
    const W = 340, H = 110, hr = 88, rr = 60 / hr, span = 4;
    while (ecg.next < t + .5) {
      const pvc = irritable(S) && Math.random() < (S.f.wire && S.f.wire.len > 25 ? .7 : .45) && ecg.beats.length && ecg.beats[ecg.beats.length - 1].k === 'n';
      ecg.beats.push({ at: pvc ? ecg.next - rr * .35 : ecg.next, k: pvc ? 'v' : 'n' });
      ecg.next += pvc ? rr * 1.3 : rr * (1 + (Math.random() - .5) * .04);
    }
    ecg.beats = ecg.beats.filter(b => b.at > t - span - 1);
    ec.fillStyle = '#05080a'; ec.fillRect(0, 0, W, H);
    ec.strokeStyle = 'rgba(40,90,60,.35)'; ec.lineWidth = 1; for (let x = 0; x < W; x += 20) { ec.beginPath(); ec.moveTo(x, 0); ec.lineTo(x, H); ec.stroke(); }
    const gs = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
    const val = tau => { let v = 0; for (const b of ecg.beats) { const d = tau - b.at; if (d < -.3 || d > .6) continue; if (b.k === 'n') v += .12 * gs(d, -.16, .03) - .1 * gs(d, -.02, .01) + 1 * gs(d, 0, .012) - .25 * gs(d, .025, .012) + .25 * gs(d, .25, .05); else v += -1.1 * gs(d, .02, .04) + .6 * gs(d, .09, .04) - .45 * gs(d, .3, .07); } return v; };
    ec.strokeStyle = '#46e07a'; ec.lineWidth = 1.6; ec.beginPath();
    for (let x = 0; x < 250; x++) { const tau = t - span + x / 250 * span, yy = 60 - val(tau) * 34; x ? ec.lineTo(x, yy) : ec.moveTo(x, yy); }
    ec.stroke();
    const pvcs = ecg.beats.filter(b => b.k === 'v' && b.at > t - 3).length;
    ec.fillStyle = '#46e07a'; ec.font = 'bold 26px Menlo, monospace'; ec.textAlign = 'right'; ec.fillText(String(hr + (pvcs ? 6 : 0)), W - 8, 40);
    ec.font = '10px Menlo, monospace'; ec.fillText('HR', W - 8, 14);
    ec.fillStyle = '#39c6ff'; ec.font = 'bold 18px Menlo, monospace'; ec.fillText('97', W - 8, 82); ec.font = '10px Menlo, monospace'; ec.fillText('SpO2', W - 8, 100);
    ec.fillStyle = 'rgba(255,255,255,.6)'; ec.textAlign = 'left'; ec.fillText('II', 4, 12);
    root.querySelector('#ecLbl').textContent = pvcs ? '期外収縮' : '';
  }

  function icon(id) {
    const s = b => `<svg viewBox="0 0 60 30" width="60" height="30">${b}</svg>`;
    if (id === 'cvwire') return s('<circle cx="40" cy="15" r="11" stroke="#3d7dd8" stroke-width="3" fill="none"/><path d="M29 15 H6 a3 3 0 1 1 0-6" stroke="#3a3f45" stroke-width="2" fill="none"/><path d="M16 13v4M19 13v4" stroke="#111" stroke-width="1.5"/>');
    if (id === 'cvdil') return s('<path d="M2 15 L10 13 H46 V17 H10 Z" fill="#fff" stroke="#6d7680"/><rect x="46" y="10" width="8" height="10" fill="#2a62b8"/>');
    if (id === 'cvc3' || id === 'cvc4') { const n = id === 'cvc4' ? 4 : 3, cols = ['#7a4a28', '#2f6fd0', '#f2f2ee', '#8f979e']; let legsS = ''; for (let i = 0; i < n; i++) { const y = 15 + (i - (n - 1) / 2) * 6; legsS += `<path d="M36 15 L50 ${y}" stroke="#bbb" stroke-width="2"/><rect x="50" y="${y - 2.5}" width="8" height="5" fill="${cols[i]}" stroke="#666" stroke-width=".5"/>`; } return s(`<rect x="2" y="13" width="30" height="4" rx="2" fill="#f3f1ea" stroke="#8c8f88"/><rect x="30" y="10" width="7" height="10" rx="2" fill="#e7e3d6" stroke="#999"/>${legsS}`); }
    if (id === 'cvneedle') return s('<path d="M2 15 H22" stroke="#9aa3ab" stroke-width="1.6"/><path d="M8 15 H24" stroke="#dfeee6" stroke-width="4" stroke-linecap="round" opacity=".9"/><rect x="22" y="10" width="7" height="10" rx="1.5" fill="#3aa35b"/><rect x="29" y="11" width="5" height="8" fill="#e2779b"/><rect x="34" y="9" width="22" height="12" rx="2" fill="#eef3f6" stroke="#9aa6b0"/>');
    if (id === 'dressing') return s('<rect x="12" y="4" width="36" height="22" rx="5" fill="#e3f1fa" stroke="#9ab"/><circle cx="30" cy="15" r="3" fill="#c88"/>');
    // 共通の道具は術野と同じ絵
    return PS.Field.icon(id);
  }

  PS.Neck = { ijX, caX, dIJ, tipY, hubPos, entry, gripPos, wireStart, legs, cvHub, dilHub, along, zone, needleState, U, CM, tailOut };
})();
