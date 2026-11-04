// sc_field.js — 術野（鼠径部を上から見た図）。器械台から道具を取り、ドラッグで手を動かす。
// 右にエコー（短軸）と透視を同時に出す。
(function () {
  const FW = 720, FH = 480, CM = 40, CX = 360;
  const BIF_Y = 365;
  const NEEDLE_CM = 7;

  const TOOLS = {
    probe: { t: 'エコープローブ', s: 'リニア 12MHz' },
    marker: { t: 'ペアン', s: '透視のマーカー' },
    needle: { t: '穿刺針＋シリンジ', s: '18G・陰圧をかけて進む' },
    wire: { t: 'ガイドワイヤー', s: '0.035インチ・長尺' },
    scalpel: { t: 'メス', s: '11番' },
    dil8: { t: 'ダイレーター 8Fr', s: '' }, dil12: { t: 'ダイレーター 12Fr', s: '' }, dil16: { t: 'ダイレーター 16Fr', s: '' }, dil20: { t: 'ダイレーター 20Fr', s: '' }, dil24: { t: 'ダイレーター 24Fr', s: '' },
    canV21: { t: '脱血カニューレ 21Fr', s: '多孔・55cm', kind: 'V', fr: 21, len: 55 },
    canV25: { t: '脱血カニューレ 25Fr', s: '多孔・55cm', kind: 'V', fr: 25, len: 55 },
    canA17: { t: '送血カニューレ 17Fr', s: '18cm', kind: 'A', fr: 17, len: 18 },
    canA21: { t: '送血カニューレ 21Fr', s: '18cm', kind: 'A', fr: 21, len: 18 },
    forceps: { t: 'チューブ鉗子', s: 'カニューレをクランプ' },
    sheath6: { t: 'シース 6Fr', s: 'ダイレーター付き・止血弁' },
    suture: { t: '縫合糸', s: '皮膚に固定' },
    fdl15: { t: 'FDL 12Fr 15cm', s: 'ダブルルーメン・透析用', kind: 'V', fr: 12, len: 15, dl: true },
    fdl20: { t: 'FDL 12Fr 20cm', s: 'ダブルルーメン・透析用', kind: 'V', fr: 12, len: 20, dl: true },
    fdl25: { t: 'FDL 12Fr 25cm', s: 'ダブルルーメン・透析用', kind: 'V', fr: 12, len: 25, dl: true },
  };
  const LEVELS = [
    { name: '鼠径靱帯より頭側（外腸骨）', vs: [{ id: 'eia', k: 'a', x: -.55, y: 3.6, rx: .4, ry: .4 }, { id: 'eiv', k: 'v', x: .6, y: 3.8, rx: .62, ry: .45 }] },
    { name: '総大腿動静脈（骨頭の高さ）', vs: [{ id: 'cfa', k: 'a', x: -.55, y: 2.0, rx: .38, ry: .38 }, { id: 'cfv', k: 'v', x: .6, y: 2.2, rx: .7, ry: .5 }] },
    { name: '大腿動脈の分岐（SFA/DFA）', vs: [{ id: 'sfa', k: 'a', x: -.4, y: 1.9, rx: .3, ry: .3 }, { id: 'dfa', k: 'a', x: -.95, y: 2.7, rx: .27, ry: .27 }, { id: 'cfv', k: 'v', x: .55, y: 2.3, rx: .62, ry: .46 }] },
    { name: '分岐より足側（静脈が動脈の裏へ）', vs: [{ id: 'sfa', k: 'a', x: -.2, y: 2.0, rx: .3, ry: .3 }, { id: 'sfv', k: 'v', x: -.1, y: 2.85, rx: .5, ry: .36 }, { id: 'dfa', k: 'a', x: -1.0, y: 3.3, rx: .25, ry: .25 }] },
  ];
  const VNAME = { eia: '外腸骨動脈', eiv: '外腸骨静脈', cfa: '総大腿動脈', cfv: '総大腿静脈', sfa: '浅大腿動脈', dfa: '深大腿動脈', sfv: '大腿静脈' };

  // ---------- 座標 ----------
  const sgn = S => S.f.side === 'R' ? 1 : -1;
  const fx = (S, xcm) => CX + sgn(S) * xcm * CM;                    // 外側マイナスの cm → 術野 x
  const xcmOf = (S, x) => sgn(S) * (x - CX) / CM;
  function lig(S) { return S.f.side === 'R' ? [[190, 110], [540, 200]] : [[530, 110], [180, 200]]; }
  function ligY(S, x) { const [[x1, y1], [x2, y2]] = lig(S); return y1 + (y2 - y1) * (x - x1) / (x2 - x1); }
  function head(S) { return { x: S.f.side === 'R' ? 322 : 398, y: 262, r: 92 }; }
  function levelAt(S, x, y) { if (y < ligY(S, x)) return 0; if (y < BIF_Y) return 1; if (y < 410) return 2; return 3; }
  function vesselX(S, k) { return fx(S, k === 'a' ? -.55 : .6); }
  function hubPos(S) { const n = S.f.needle; return { x: n.ex, y: n.ey + (NEEDLE_CM - n.s) * 9 }; }
  function tipY(S) { const n = S.f.needle; return n.ey - n.s * .707 * CM; }
  // ダイレーター・カニューレの体外部分は斜め下へ逃がす（術野に収めるため）。u = 体外へ向かう単位ベクトル
  const ANG = .6435;
  function dirU(S) { const a = S.f.side === 'R' ? -ANG : ANG; return { x: -Math.sin(a), y: Math.cos(a), a }; }
  function along(S, from, d) { const e = from, u = dirU(S); return { x: e.x + u.x * d, y: e.y + u.y * d }; }
  function canExt(S) { const c = S.f.can; return c.dl ? Math.min(58, (c.len - c.s) * 2.4 + 24) : Math.min(110, (c.len - c.s) * 4 + 50); }
  function canHub(S) { const c = S.f.can; return along(S, { x: c.ex, y: c.ey }, canExt(S)); }
  function clampMark(S) { const c = S.f.can; return along(S, { x: c.ex, y: c.ey }, canExt(S) * .5); }
  function obtPos(S) { const c = S.f.can; return along(S, { x: c.ex, y: c.ey }, canExt(S) + 30 + c.obt * 70); }
  function entry(S) { return S.f.site || (S.f.needle ? { x: S.f.needle.ex, y: S.f.needle.ey } : null); }

  // 針先の状態（短軸エコー・逆流の判定）
  function needleState(S) {
    const n = S.f.needle; if (!n || n.s <= 0) return { st: 'out' };
    const d = n.s * .707, ty = tipY(S), lv = levelAt(S, n.ex, ty), xc = xcmOf(S, n.ex);
    for (const v of LEVELS[lv].vs) {
      const ry = v.k === 'v' && S.f.comp ? v.ry * .2 : v.ry;
      const q = ((xc - v.x) / v.rx) ** 2 + ((d - v.y) / ry) ** 2;
      if (q < 1) return { st: 'lumen', v, lv, yp: ty, d };
      if (Math.abs(xc - v.x) < v.rx * .9 && d > v.y + ry && d < v.y + ry + 1.2) return { st: 'through', v, lv, yp: ty, d };
      if (Math.abs(xc - v.x) < v.rx * .8 && d > v.y - ry - .25 && d <= v.y - ry) return { st: 'tent', v, lv, yp: ty, d };
    }
    return { st: 'tissue', lv, yp: ty, d };
  }

  // ---------- マウント ----------
  let ro, ro2, ro3, root, cv, g, usC, us, flC, fl, raf, mouse = { x: -99, y: -99, in: false }, drag = null, S0, T0 = performance.now(), speckle = null;

  PS.scene('field', {
    mount(host, S, st) {
      S0 = S;
      host.innerHTML = `<div class="field">
        <div class="fd-main"><canvas id="fld" width="${FW}" height="${FH}"></canvas><div class="fd-held" id="fdHeld"></div></div>
        <div class="fd-side">
          <div class="mon" id="usBox"><div class="mon-h">エコー 短軸 <span id="usLv"></span></div><canvas id="usC" width="360" height="250"></canvas>
            <div class="mon-btns"><button data-ctl="usColor" id="bColor">Color</button><button data-ctl="usMeasure" id="bMeas">計測</button></div></div>
          <div class="mon fl" id="flBox"><div class="mon-h">透視 <span id="flLbl"></span></div><div class="flwrap"><canvas id="flC" width="320" height="400"></canvas></div></div>
        </div></div>
        <div class="tray" id="tray"></div>`;
      root = host; cv = host.querySelector('#fld'); g = cv.getContext('2d'); ro = PS.fit(cv, cv.parentElement);
      usC = host.querySelector('#usC'); us = usC.getContext('2d'); ro3 = PS.hd(usC);
      flC = host.querySelector('#flC'); fl = flC.getContext('2d'); ro2 = PS.fit(flC, flC.parentElement);
      host.querySelector('#bColor').onclick = () => { S.f.color = !S.f.color; PS.emit({ type: 'color', on: S.f.color }); };
      host.querySelector('#bMeas').onclick = () => { S.f.meas = !S.f.meas; PS.emit({ type: 'measure', on: S.f.meas }); };
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up); cv.addEventListener('pointerleave', () => { mouse.in = false; });
      cv.addEventListener('pointercancel', up);
      const loop = () => { draw(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    },
    update(S, st) {
      S0 = S;
      const mons = st.mon || [];
      root.querySelector('#usBox').hidden = !mons.includes('us');
      root.querySelector('#flBox').hidden = !mons.includes('fl');
      root.querySelector('#bColor').classList.toggle('on', !!S.f.color);
      root.querySelector('#bMeas').classList.toggle('on', !!S.f.meas);
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
    unmount() { cancelAnimationFrame(raf); ro && ro.disconnect(); ro2 && ro2.disconnect(); ro3 && ro3.disconnect(); },
  });

  function curStep() { return PS.cur && PS.cur.steps[PS.cur.i]; }
  function mode() { const st = curStep(); return st && st.mode; }

  // ---------- 操作 ----------
  function down(e) {
    const S = S0, p = PS.cpos(cv, e), m = mode(), f = S.f;
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 合成イベントなど */ }
    drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, t0: performance.now(), moved: false };
    // ワイヤーを左手で持つ（持たずに針を抜く・器具を進めると、ワイヤーが抜ける／押し込まれる）
    if (f.wire && !f.wHold && ['needleOut', 'cut', 'dil', 'can', 'shOut', 'obt', 'obtOut'].includes(m) && near(p, gripPos(S), 20)) {
      f.wHold = true; drag = null; PS.emit({ type: 'wireHold' }); return;
    }
    const needTool = { probe: 'probe', marker: 'marker', needle: 'needle', wire: 'wire', cut: 'scalpel', dil: 'dil', can: 'can', clamp: 'forceps', suture: 'suture' }[m];
    const holding = needTool && f.held && (f.held.startsWith(needTool) || (needTool === 'dil' && f.held === 'sheath6') || (needTool === 'can' && f.held.startsWith('fdl')));
    if (m === 'probe') {
      if (!holding && !f.probe) return warnTool('probe');
      if (!f.probe) { f.probe = { x: p.x, y: p.y }; f.held = null; PS.refresh(); }
      drag.kind = 'probe'; drag.px = f.probe.x; drag.py = f.probe.y;
      drag.holdTimer = setTimeout(() => { if (drag && !drag.moved) { f.comp = true; } }, 320);
      return;
    }
    if (m === 'marker') {
      if (!holding) return warnTool('marker');
      f.marker = { x: p.x, y: p.y };
      const h = head(S), dy = (p.y - h.y) / h.r;
      let rel = dy < -1.05 ? 'above' : dy < -.4 ? 'upper' : dy <= .8 ? 'mid' : 'below';
      if (Math.abs(p.x - vesselX(S, 'a')) > 70) rel = 'off';
      PS.emit({ type: 'marker', rel });
      return;
    }
    if (m === 'needle') {
      if (!f.needle) {
        if (!holding) return warnTool('needle');
        if (!inWindow(p)) return;
        f.needle = { ex: p.x, ey: p.y, s: 0, syr: true }; f.held = null; f.site = null;
        f.probe = { x: p.x, y: p.y - 70 };
        PS.refresh(); PS.emit({ type: 'entry' });
        drag.kind = 'needle'; drag.s0 = 0; return;
      }
      drag.kind = 'needle'; drag.s0 = f.needle.s; return;
    }
    if (m === 'syr') {
      if (f.needle && near(p, hubPos(S), 70)) { f.needle.syr = false; PS.emit({ type: 'syrOff' }); }
      return;
    }
    if (m === 'wire') {
      if (!f.wire) {
        if (!holding) return warnTool('wire');
        const h = f.needle ? hubPos(S) : entry(S);
        if (!near(p, h, 70)) return PS.emit({ type: 'miss' });
        if (f.needle && f.needle.syr) return PS.emit({ type: 'wireBlocked' });
        f.wire = { k: f.side === 'R' ? 'V' : 'A', len: f.needle ? f.needle.s : 0 }; f.held = null;
        PS.refresh(); PS.emit({ type: 'wireIn' });
      }
      drag.kind = 'wire'; drag.l0 = f.wire.len; return;
    }
    if (m === 'needleOut') { if (f.needle) { drag.kind = 'needleOut'; drag.s0 = f.needle.s; } return; }
    if (m === 'cut') { if (!holding) return warnTool('scalpel'); drag.kind = 'cut'; return; }
    if (m === 'dil') {
      if (!f.dil) {
        if (!holding) return warnTool('dil');
        if (!near(p, entry(S), 70)) return PS.emit({ type: 'miss' });
        const sh = f.held === 'sheath6', fr = sh ? 6 : +f.held.slice(3);
        f.dil = { fr, s: 0, sh }; f.held = null; PS.refresh();
        PS.emit({ type: 'dilOn', fr });
        if (!f.dil) return;
      }
      drag.kind = 'dil'; drag.s0 = f.dil.s; return;
    }
    if (m === 'can') {
      if (!f.can) {
        if (!holding) return warnTool('can');
        if (!near(p, entry(S), 70)) return PS.emit({ type: 'miss' });
        const t = TOOLS[f.held];
        const e0 = entry(S);
        f.can = { id: f.held, kind: t.kind, fr: t.fr, len: t.len, s: 0, obt: t.dl ? 1 : 0, clamp: false, ex: e0.x, ey: e0.y, sut: false, dl: !!t.dl };
        if (t.dl) f.wHold = false;   // 尻は返血側（青）のハブから出る。持ち替える
        f.held = null; PS.refresh(); PS.emit({ type: 'canOn', id: f.can.id, kind: t.kind, dl: !!t.dl });
        if (!f.can) return;
      }
      drag.kind = 'can'; drag.s0 = f.can.s; return;
    }
    if (m === 'shOut') { if (f.dil && f.dil.sh) { drag.kind = 'shOut'; } return; }
    if (m === 'wireOut') { if (f.wire && f.can && near(p, gripPos(S), 34)) drag.kind = 'wireOut'; return; }
    if (m === 'obt' || m === 'obtOut') { if (f.can) { drag.kind = 'obt'; drag.o0 = f.can.obt; } return; }
    if (m === 'clamp') {
      if (!holding) return warnTool('forceps');
      if (!f.can) return;
      if (!near(p, clampMark(S), 45)) return PS.emit({ type: 'miss' });
      if (f.can.obt < .5) return PS.emit({ type: 'clampOnObt' });
      f.can.clamp = true; f.held = null; PS.refresh(); PS.emit({ type: 'clamp' });
      return;
    }
    if (m === 'suture') {
      if (!holding) return warnTool('suture');
      if (!f.can || !near(p, { x: f.can.ex, y: f.can.ey + 20 }, 60)) return PS.emit({ type: 'miss' });
      f.can.sut = true; f.held = null; PS.refresh(); PS.emit({ type: 'suture' });
    }
  }

  function move(e) {
    const p = PS.cpos(cv, e); mouse = { x: p.x, y: p.y, in: true };
    if (!drag) return;
    const S = S0, f = S.f;
    drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 6) drag.moved = true;
    const dy = drag.y0 - p.y;
    switch (drag.kind) {
      case 'probe':
        if (drag.moved && !f.comp) { f.probe.x = PS.clamp(drag.px + p.x - drag.x0, 200, 520); f.probe.y = PS.clamp(drag.py + p.y - drag.y0, 70, 430); }
        break;
      case 'needle': f.needle.s = PS.clamp(drag.s0 + dy / 30, 0, NEEDLE_CM - .3); f.probe = { x: f.needle.ex, y: tipY(S) }; flashUpdate(S); break;
      case 'needleOut':
        if (dy < 0 && f.wire && !f.wHold) { if (dy < -10) slip(S, 'out'); break; }
        if (dy < 0) f.needle.s = PS.clamp(drag.s0 + dy / 30, 0, NEEDLE_CM); break;
      case 'wire': f.wire.len = PS.clamp(drag.l0 + dy * .25, 0, PS.Fluoro.maxLen(f.wire.k)); break;
      case 'dil': {
        const ns = PS.clamp(drag.s0 - proj(S, p) / 16, 0, f.dilDepth + 2);
        if (f.wire && !f.wHold && ns > f.dil.s + .15) { slip(S, 'in'); break; }
        f.dil.s = ns; break;
      }
      case 'can': {
        const ns = PS.clamp(drag.s0 - proj(S, p) / 12, 0, Math.min(f.can.len, PS.Fluoro.maxLen(f.can.kind)));
        if (f.wire && !f.wHold && ns > f.can.s + .15) { slip(S, 'in'); break; }
        f.can.s = ns; break;
      }
      case 'shOut': drag.pull = Math.max(0, proj(S, p)); break;
      case 'obt': if (proj(S, p) > 0) f.can.obt = PS.clamp(drag.o0 + proj(S, p) / 70, 0, 1); break;
      case 'wireOut': drag.pull = Math.max(0, proj(S, p)); break;
    }
  }

  function up(e) {
    if (!drag) return;
    const S = S0, f = S.f, d = drag; drag = null;
    clearTimeout(d.holdTimer);
    switch (d.kind) {
      case 'probe': {
        const wasComp = f.comp; f.comp = false;
        PS.emit({ type: 'probe', level: levelAt(S, f.probe.x, f.probe.y), comp: wasComp, moved: d.moved });
        break;
      }
      case 'needle': {
        const ns = needleState(S);
        PS.emit({ type: 'needle', st: ns.st, kind: ns.v && ns.v.k, vid: ns.v && ns.v.id, lv: ns.lv, yp: ns.yp, d: ns.d });
        break;
      }
      case 'needleOut': if (f.needle.s <= .05) { f.site = { x: f.needle.ex, y: f.needle.ey }; f.needle = null; PS.emit({ type: 'needleOut' }); } break;
      case 'wire': PS.emit({ type: 'wire', len: f.wire.len, zone: PS.Fluoro.zone(f.wire.k, f.wire.len).id }); break;
      case 'cut': {
        const e0 = entry(S), L = Math.hypot(d.x - d.x0, d.y - d.y0);
        const dist = segDist(e0, d.x0, d.y0, d.x, d.y);
        const ok = dist < 14 && L > 12 && L < 90;
        if (ok) f.cut = true;
        PS.emit({ type: 'cut', ok, why: dist >= 14 ? 'far' : L <= 12 ? 'short' : 'long' });
        break;
      }
      case 'dil':
        if (f.dil.s >= f.dilDepth) PS.emit({ type: 'dilIn', fr: f.dil.fr, sh: f.dil.sh });
        else if (f.dil.s <= .05 && d.s0 > .05) { const fr = f.dil.fr; f.dil = null; f.dilsDone.push(fr); f.ooze = 1; PS.emit({ type: 'dilOut', fr }); }
        else PS.emit({ type: 'dilMid' });
        break;
      case 'shOut':
        if ((d.pull || 0) > 50) { f.sheath = { fr: f.dil.fr }; f.dil = null; f.wire = null; f.ooze = 0; PS.emit({ type: 'shOut' }); }
        else PS.emit({ type: 'shMid' });
        break;
      case 'can': PS.emit({ type: 'can', s: f.can.s, zone: PS.Fluoro.zone(f.can.kind, f.can.s).id, full: f.can.s >= f.can.len - .3 }); break;
      case 'wireOut': if ((d.pull || 0) > 60) { f.wire = null; f.wHold = false; PS.emit({ type: 'wireOut' }); } else PS.emit({ type: 'wireOutMid' }); break;
      case 'obt':
        if (f.can.obt >= .98) { f.can.obt = 1; f.wire = null; PS.emit({ type: 'obtOut', clamped: f.can.clamp }); }
        else if (f.can.obt >= .5) PS.emit({ type: 'obtHalf' });
        break;
    }
    PS.refresh();
  }

  // ワイヤーを持たずに操作したとき：抜くと一緒に抜けてくる、押すと体内へ押し込まれる（1回のドラッグで1回だけ）
  function slip(S, how) {
    if (drag.slipped) return; drag.slipped = true;
    const f = S.f, mx = PS.Fluoro.maxLen(f.wire.k);
    if (how === 'out') { f.wire.len = Math.max(5, f.wire.len - 6); }
    else f.wire.len = Math.min(mx, f.wire.len + 4);
    PS.emit({ type: 'slip', msg: how === 'out'
      ? 'ワイヤーを押さえずに針を抜いたので、<b>ワイヤーも一緒に抜けてきた</b>（透視で先端が下がった）。先に、ハブから出ているワイヤー（黄色の輪）を押して左手で持つ。'
      : 'ワイヤーを持たずに押したので、<b>ワイヤーごと体内へ押し込まれた</b>（迷入の危険）。器具の後ろから出ているワイヤー（黄色の輪）を左手で持ってから進める。' });
  }

  // ドラッグ量を「体外へ向かう方向」に射影（+＝引く、−＝押し込む）
  function proj(S, p) { const u = dirU(S); return (p.x - drag.x0) * u.x + (p.y - drag.y0) * u.y; }
  function flashUpdate(S) {
    const ns = needleState(S);
    S.f.needle.flash = ns.st === 'lumen' ? ns.v.k : null;
  }
  function warnTool(t) { PS.emit({ type: 'noTool', tool: t }); }
  function near(p, q, r) { return q && Math.hypot(p.x - q.x, p.y - q.y) < r; }
  function inWindow(p) { return p.x > 190 && p.x < 530 && p.y > 60 && p.y < 440; }
  function segDist(p, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1;
    const t = PS.clamp(((p.x - x1) * dx + (p.y - y1) * dy) / L, 0, 1);
    return Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy));
  }

  // ---------- 描画 ----------
  function beat(t) { const ph = (t * 1.5) % 1; return ph < .15 ? Math.sin(ph / .15 * Math.PI) : 0; }

  function draw() {
    const S = S0; if (!S) return;
    const t = (performance.now() - T0) / 1000, f = S.f;
    if (!f.wire) f.wHold = false;
    drawField(S, t);
    if (!root.querySelector('#usBox').hidden) drawUS(S, t);
    if (!root.querySelector('#flBox').hidden) drawFl(S, t);
  }

  // ---------- 術野の静的な部分（ドレープ・窓・ヨードを塗った皮膚） ----------
  let fieldBg = null, fieldKey = '';
  function makeFieldBg(S) {
    const R = PS.R, c = R.mk(FW, FH), g = c.getContext('2d'), sg = sgn(S);
    g.fillStyle = g.createPattern(R.drape('#2c6b99'), 'repeat'); g.fillRect(0, 0, FW, FH);
    g.drawImage(R.soft(FW, FH, 10, x => {   // 布のたわみ（大きくゆるい陰影）
      const r = R.rng(21);
      for (let i = 0; i < 7; i++) {
        x.save(); x.translate(r() * FW, r() * FH); x.rotate(r() * 3);
        const gr = x.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.45, 'rgba(255,255,255,.13)'); gr.addColorStop(.55, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gr; x.fillRect(-260, -40, 520, 80); x.restore();
      }
    }), 0, 0);
    g.save(); g.beginPath(); g.roundRect(185, 52, 350, 392, 26); g.clip();
    g.drawImage(R.iodineSkin(350, 392, sg > 0 ? 3 : 4), 185, 52);
    const gx = g.createLinearGradient(sg > 0 ? 185 : 535, 0, sg > 0 ? 535 : 185, 0);
    gx.addColorStop(0, 'rgba(25,8,0,.42)'); gx.addColorStop(.3, 'rgba(25,8,0,0)'); gx.addColorStop(.8, 'rgba(25,8,0,0)'); gx.addColorStop(1, 'rgba(25,8,0,.3)');
    g.fillStyle = gx; g.fillRect(185, 52, 350, 392);
    // 鼠径部のしわ（靱帯の少し足側）
    const L = lig(S);
    g.drawImage(R.soft(FW, FH, 3, x => { x.strokeStyle = 'rgba(40,10,0,.5)'; x.lineWidth = 5; x.beginPath(); x.moveTo(L[0][0], L[0][1] + 34); x.quadraticCurveTo((L[0][0] + L[1][0]) / 2, (L[0][1] + L[1][1]) / 2 + 50, L[1][0], L[1][1] + 30); x.stroke(); }), 0, 0);
    // 濡れたつや
    const r = R.rng(9);
    for (let i = 0; i < 7; i++) { const x = 210 + r() * 300, y = 80 + r() * 340, gr = g.createRadialGradient(x, y, 0, x, y, 30 + r() * 30); gr.addColorStop(0, 'rgba(255,240,220,.16)'); gr.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = gr; g.fillRect(x - 60, y - 60, 120, 120); }
    // ドレープの縁の内側の影
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 16; g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 14;
    g.beginPath(); g.roundRect(178, 45, 364, 406, 32); g.stroke();
    g.restore();
    // 粘着フィルムの縁
    g.strokeStyle = 'rgba(230,238,245,.5)'; g.lineWidth = 3; g.beginPath(); g.roundRect(182, 49, 356, 398, 28); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); g.roundRect(179, 46, 362, 404, 30); g.stroke();
    return c;
  }

  function drawField(S, t) {
    const f = S.f, R = PS.R;
    const key = f.side; if (!fieldBg || fieldKey !== key) { fieldBg = makeFieldBg(S); fieldKey = key; }
    g.drawImage(fieldBg, 0, 0);
    g.save();
    g.beginPath(); g.roundRect(185, 52, 350, 392, 26); g.clip();
    // 血管の走行（ガイドあり時だけ薄く。動脈は拍動）
    if (!S.exam && f.showVessels !== false) {
      const b = beat(t);
      g.lineCap = 'round';
      g.strokeStyle = `rgba(70,110,230,.22)`; g.lineWidth = 28;
      g.beginPath(); g.moveTo(vesselX(S, 'v') + sgn(S) * 6, 40); g.lineTo(vesselX(S, 'v'), BIF_Y); g.quadraticCurveTo(vesselX(S, 'v') - sgn(S) * 10, 420, vesselX(S, 'a') + sgn(S) * 8, 470); g.stroke();
      g.strokeStyle = `rgba(230,40,40,${.2 + .14 * b})`; g.lineWidth = 16 + 3 * b;
      g.beginPath(); g.moveTo(vesselX(S, 'a') - sgn(S) * 4, 40); g.lineTo(vesselX(S, 'a'), BIF_Y); g.lineTo(vesselX(S, 'a') + sgn(S) * 6, 470); g.stroke();
      g.lineWidth = 12; g.beginPath(); g.moveTo(vesselX(S, 'a'), BIF_Y - 5); g.quadraticCurveTo(vesselX(S, 'a') - sgn(S) * 30, 400, vesselX(S, 'a') - sgn(S) * 52, 470); g.stroke();
    }
    // 皮膚マーキング（消毒前にマーカーで書いた線）
    g.strokeStyle = 'rgba(45,10,70,.8)'; g.lineWidth = 2.5; g.setLineDash([9, 7]);
    const L = lig(S); g.beginPath(); g.moveTo(L[0][0], L[0][1]); g.lineTo(L[1][0], L[1][1]); g.stroke();
    if (f.headMarked) { const h = head(S); g.beginPath(); g.arc(h.x, h.y, h.r, 0, 7); g.stroke(); }
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,240,225,.85)'; g.font = '12px "Hiragino Sans", sans-serif'; g.textAlign = 'center';
    g.fillText('鼠径靱帯', (L[0][0] + L[1][0]) / 2 + sgn(S) * 40, (L[0][1] + L[1][1]) / 2 - 12);
    if (f.headMarked) { const h = head(S); g.fillText('大腿骨頭', h.x - sgn(S) * 62, h.y + h.r - 8); }
    // 出血・にじみ・切開
    const e0 = entry(S);
    if (e0 && f.needle && f.needle.s > 0) { g.fillStyle = 'rgba(40,5,0,.5)'; g.beginPath(); g.ellipse(e0.x, e0.y, 4, 3, 0, 0, 7); g.fill(); }
    if (e0 && (f.ooze || f.mishap)) blood(e0.x + 4, e0.y + 10, f.mishap ? 22 : 9, f.mishap === 'a', t);
    if (f.cut && e0) {
      g.strokeStyle = '#3a0505'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(e0.x - 9, e0.y + 3); g.lineTo(e0.x + 9, e0.y - 3); g.stroke();
      g.strokeStyle = 'rgba(190,30,30,.8)'; g.lineWidth = 1.4; g.stroke();
    }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '12px "Hiragino Sans", sans-serif'; g.textAlign = 'left';
    g.fillText(`↑ 頭側　${f.side === 'R' ? '右' : '左'}鼠径部`, 14, 22);
    g.textAlign = 'right'; g.fillText(f.side === 'R' ? '内側 →' : '← 内側', f.side === 'R' ? 706 : 140, 470);
    g.textAlign = 'left'; if (f.side === 'R') g.fillText('← 外側', 14, 470); else g.fillText('外側 →', 640, 470);

    if (f.marker) drawForcepsTip(f.marker.x, f.marker.y, -0.15);
    if (f.probe && (mode() === 'probe' || mode() === 'needle')) drawProbe(f.probe.x, f.probe.y, f.comp);
    if (f.wire) drawWireOut(S, t);
    if (f.needle) drawNeedle(S, t);
    if (f.dil) drawDil(S);
    if (f.sheath) drawSheath(S);
    if (f.can) f.can.dl ? drawFDL(S) : drawCan(S, t);
    if (f.wire && f.wHold) { const gp = gripPos(S), u = wireDir(S); R.fingers(g, gp.x, gp.y, Math.atan2(u.y, u.x) - Math.PI / 2, .9); }
    // ワイヤーを持つ場所の目印（持っていない時）
    if (f.wire && !f.wHold && !S.exam && ['needleOut', 'cut', 'dil', 'can'].includes(mode())) {
      const gp = gripPos(S), k = (t * 1.4) % 1;
      g.strokeStyle = `rgba(255,207,51,${1 - k})`; g.lineWidth = 2.5; g.beginPath(); g.arc(gp.x, gp.y, 8 + 14 * k, 0, 7); g.stroke();
    }
    const st = curStep();
    if (st && st.hint && !PS.cur.waiting) PS.drawHint(g, typeof st.hint === 'function' ? st.hint(S) : st.hint, t);
    if (f.held && mouse.in) drawHeld(f.held, mouse.x, mouse.y);
  }

  // 血だまり（暗赤色の中心・縁は薄く・表面のつや）。動脈は拍動でにじむ
  function blood(x, y, r, art, t) {
    const rr = r * (art ? 1 + .08 * beat(t) : 1);
    const gr = g.createRadialGradient(x - rr * .2, y - rr * .2, 1, x, y, rr);
    gr.addColorStop(0, art ? 'rgba(175,10,10,.95)' : 'rgba(85,6,6,.95)'); gr.addColorStop(.75, art ? 'rgba(140,8,8,.85)' : 'rgba(70,4,4,.85)'); gr.addColorStop(1, 'rgba(60,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * .75, 0, 0, 7); g.fill();
    g.fillStyle = gr; g.beginPath(); g.ellipse(x + 2, y + rr * .9, rr * .28, rr * .8, 0, 0, 7); g.fill();   // 垂れ
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - rr * .35, y - rr * .3, rr * .22, rr * .1, -.5, 0, 7); g.fill();
  }

  function dilExt(S) { return Math.max(30, (S.f.dilDepth + 6 - S.f.dil.s) * 6); }
  function dilHub(S) { return along(S, entry(S), dilExt(S)); }

  // ---------- ワイヤーの体外部分：ハブから出て、ドレープの上で大きくループさせて置く ----------
  function wireStart(S) {
    const f = S.f;
    if (f.needle) { const h = hubPos(S); return { x: h.x, y: h.y + (f.needle.syr ? 0 : 14) }; }
    if (f.can && f.can.dl) { const l = fdlLegs(S).V; return { x: l.x + l.ux * 12, y: l.y + l.uy * 12 }; }
    if (f.can) return obtPos(S);
    if (f.dil) return along(S, dilHub(S), f.dil.sh ? 52 : 18);
    if (f.sheath) return along(S, entry(S), 70);
    return entry(S);
  }
  // FDL の手元：Y字のハブから脱血（赤）・返血（青）の延長チューブが分かれる
  function fdlLegs(S) {
    const h = canHub(S), u = dirU(S), base = Math.atan2(u.y, u.x), o = {};
    [['A', .42], ['V', -.42]].forEach(([k, da]) => { const a = base + da * sgn(S); o[k] = { x: h.x + Math.cos(a) * 48, y: h.y + Math.sin(a) * 48, ux: Math.cos(a), uy: Math.sin(a), a, cl: { x: h.x + Math.cos(a) * 28, y: h.y + Math.sin(a) * 28 } }; });
    return o;
  }
  function wireDir(S) { const f = S.f; if (f.can && f.can.dl) { const l = fdlLegs(S).V; return { x: l.ux, y: l.uy }; } return f.needle ? { x: 0, y: 1 } : (f.can || f.dil || f.sheath) ? dirU(S) : { x: 0, y: 1 }; }
  function gripPos(S) { const f = S.f, h = wireStart(S), u = wireDir(S);
    if (f.can && f.can.dl) { const l = fdlLegs(S).V; return { x: h.x + l.ux * 18, y: h.y + l.uy * 18 }; }
    const d = f.dil ? 34 : (f.needle || f.can || f.sheath) ? 24 : 50; return { x: h.x + u.x * d, y: h.y + u.y * d }; }
  function wirePts(S) {
    const h = wireStart(S), u = wireDir(S), sg = sgn(S);
    const a = { x: h.x + u.x * 60, y: h.y + u.y * 60 };
    const C = { x: CX + sg * 268, y: 395 }, R0 = 46;
    const pts = [[h.x, h.y]];
    const ent = { x: C.x - sg * R0, y: C.y };
    for (let i = 1; i <= 16; i++) {   // ハブ → ループの入口（3次ベジエ）
      const k = i / 16, m = 1 - k;
      const c1 = a, c2 = { x: ent.x - sg * 10, y: ent.y + 70 };
      pts.push([m * m * m * h.x + 3 * m * m * k * c1.x + 3 * m * k * k * c2.x + k * k * k * ent.x, m * m * m * h.y + 3 * m * m * k * c1.y + 3 * m * k * k * c2.y + k * k * k * ent.y]);
    }
    for (let i = 1; i <= 40; i++) { const an = Math.PI + i / 40 * Math.PI * 1.9; pts.push([C.x + sg * R0 * Math.cos(an), C.y + R0 * .82 * Math.sin(an)]); }
    const last = pts[pts.length - 1]; pts.push([last[0] + sg * 30, last[1] + 40]);
    return pts;
  }
  function drawWireOut(S, t) {
    const R = PS.R, pts = wirePts(S);
    R.tube(g, pts, 3, '#55606b', { hi: 'rgba(255,255,255,.6)', sb: 3, sx: 1.5, sy: 2.5 });
    // 後端（柔らかい側）
    const e = pts[pts.length - 1]; g.fillStyle = '#2b3138'; g.beginPath(); g.arc(e[0], e[1], 2.2, 0, 7); g.fill();
    // 体内の推定（ガイド時）
    const f = S.f;
    if (!S.exam) { const e1 = entry(S) || { x: pts[0][0], y: pts[0][1] }; g.strokeStyle = 'rgba(255,255,255,.4)'; g.setLineDash([3, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(e1.x, e1.y); g.lineTo(e1.x, e1.y - Math.min(160, f.wire.len * 3)); g.stroke(); g.setLineDash([]); }
  }

  // ---------- 器具 ----------
  function drawProbe(x, y, comp) {
    const R = PS.R;
    g.save(); g.translate(x, y + (comp ? 2 : 0));
    // ケーブル
    R.tube(g, [[0, 12], [6, 50], [70, 70], [140, 90], [210, 130]], 9, '#2c3137', { hi: 'rgba(255,255,255,.25)' });
    // ゼリー
    const gl = g.createRadialGradient(0, 0, 4, 0, 0, 52); gl.addColorStop(0, 'rgba(210,235,255,.45)'); gl.addColorStop(1, 'rgba(210,235,255,0)');
    g.fillStyle = gl; g.beginPath(); g.ellipse(0, 0, 54, 20, 0, 0, 7); g.fill();
    // 本体
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = comp ? 4 : 9; g.shadowOffsetX = comp ? 1 : 4; g.shadowOffsetY = comp ? 2 : 6;
    const bd = g.createLinearGradient(0, -14, 0, 14); bd.addColorStop(0, '#f4f6f8'); bd.addColorStop(.5, '#d9dee3'); bd.addColorStop(1, '#9aa3ab');
    g.fillStyle = bd; g.beginPath(); g.roundRect(-42, -13, 84, 26, 9); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#c3cad1'; g.beginPath(); g.roundRect(-14, 10, 28, 12, 4); g.fill();
    g.fillStyle = '#7fd0ff'; g.beginPath(); g.arc(-35, 0, 3, 0, 7); g.fill();                  // 向きのマーカー（患者右）
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-36, -9); g.lineTo(36, -9); g.stroke();
    if (comp) { g.fillStyle = '#ffcf33'; g.font = 'bold 12px "Hiragino Sans", sans-serif'; g.textAlign = 'center'; g.fillText('圧迫中', 0, -20); }
    g.restore();
  }

  function drawNeedle(S, t) {
    const R = PS.R, n = S.f.needle, h = hubPos(S);
    if (!S.exam && n.s > 0) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(n.ex, n.ey); g.lineTo(n.ex, tipY(S)); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(n.ex, tipY(S), 3, 0, 7); g.fill(); }
    R.metal(g, n.ex, n.ey, h.x, h.y, 3);
    R.part(g, h.x, h.y + 7, 12, 14, '#e2779b', 0, 2);                         // 18G のハブ（ピンク）
    if (n.syr) {
      const y0 = h.y + 14, y1 = y0 + 64;
      g.save();
      g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 4;
      const bg = g.createLinearGradient(h.x - 13, 0, h.x + 13, 0); bg.addColorStop(0, 'rgba(200,215,225,.75)'); bg.addColorStop(.3, 'rgba(255,255,255,.9)'); bg.addColorStop(1, 'rgba(170,185,195,.75)');
      g.fillStyle = bg; g.beginPath(); g.roundRect(h.x - 12, y0, 24, 64, 3); g.fill();
      g.restore();
      if (n.flash) {
        const pul = n.flash === 'a' ? beat(t) : 0, hh = n.flash === 'a' ? 26 + 10 * pul : 22;
        const bc = g.createLinearGradient(h.x - 10, 0, h.x + 10, 0);
        bc.addColorStop(0, n.flash === 'a' ? '#a30d14' : '#3d0508'); bc.addColorStop(.35, n.flash === 'a' ? '#ef2b2b' : '#6e0a10'); bc.addColorStop(1, n.flash === 'a' ? '#8a0a10' : '#300306');
        g.fillStyle = bc; g.fillRect(h.x - 10.5, y0 + 2, 21, hh);
      }
      g.strokeStyle = 'rgba(40,50,60,.55)'; g.lineWidth = 1;
      for (let k = 0; k < 9; k++) { const yy = y0 + 6 + k * 6; g.beginPath(); g.moveTo(h.x - 12, yy); g.lineTo(h.x - (k % 2 ? 8 : 5), yy); g.stroke(); }
      g.fillStyle = '#1d1f22'; g.fillRect(h.x - 11, y0 + 46, 22, 7);                  // ゴム（少し引いて陰圧）
      g.fillStyle = '#f2f3f4'; g.fillRect(h.x - 3, y0 + 53, 6, 26);
      R.part(g, h.x, y1 + 18, 28, 5, '#e9ecef', 0, 2);
      R.part(g, h.x, y0 + 2, 32, 4, '#e9ecef', 0, 1);
    } else if (n.flash) {
      // シリンジを外した後の逆流（動脈は拍動して噴く）
      const art = n.flash === 'a', b = beat(t);
      g.fillStyle = art ? '#d81a1a' : '#5a0609';
      if (art) { g.beginPath(); g.ellipse(h.x, h.y + 20 + 14 * b, 3.5 + b, 7 + 8 * b, 0, 0, 7); g.fill(); }
      else { const k = (t * .8) % 1; g.beginPath(); g.ellipse(h.x, h.y + 18 + k * 18, 3, 4.5, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(h.x - 1, h.y + 17, 1.2, 0, 7); g.fill();
    }
  }

  const DILC = { 8: '#f5f5f2', 12: '#ffffff', 16: '#a7d3f2', 20: '#93dca7', 24: '#f3cf93' };
  function drawDil(S) {
    const R = PS.R, d = S.f.dil, e = entry(S), L = dilExt(S), u = dirU(S);
    const w = d.sh ? 8 : 4 + d.fr * .55, tip = { x: e.x - u.x * 2, y: e.y - u.y * 2 }, hb = along(S, e, L);
    // 皮膚がダイレーターの周りでへこむ
    g.fillStyle = 'rgba(30,8,0,.35)'; g.beginPath(); g.ellipse(e.x, e.y, w * .9, w * .6, u.a, 0, 7); g.fill();
    if (d.sh) {
      R.tube(g, [[tip.x, tip.y], [hb.x, hb.y]], w, '#3f4a55', { cap: 'butt', hi: 'rgba(255,255,255,.35)' });
      const vh = along(S, e, L + 8); R.part(g, vh.x, vh.y, 18, 16, '#2a62b8', u.a, 3);
      const cp = along(S, e, L + 18); R.part(g, cp.x, cp.y, 14, 6, '#1d1f22', u.a, 2);
      const dl = along(S, e, L + 44); R.tube(g, [[cp.x, cp.y], [dl.x, dl.y]], 4, '#f2f2f0', { cap: 'butt' });
      R.part(g, dl.x, dl.y, 12, 9, '#e8e8e4', u.a, 2);
      // 側管＋三方活栓
      const sp = { x: vh.x + Math.cos(u.a) * 10, y: vh.y + Math.sin(u.a) * 10 };
      R.tube(g, [[sp.x, sp.y], [sp.x + sgn(S) * 30, sp.y + 10], [sp.x + sgn(S) * 52, sp.y + 34]], 3.2, '#e8eef3', { hi: 'rgba(255,255,255,.8)' });
      R.part(g, sp.x + sgn(S) * 56, sp.y + 38, 12, 12, '#3a7bd5', 0, 2);
    } else {
      R.tube(g, [[tip.x, tip.y], [hb.x, hb.y]], w, DILC[d.fr] || '#ffffff', { cap: 'butt', edge: '#7c8791' });
      R.part(g, hb.x + u.x * 8, hb.y + u.y * 8, w + 6, 16, '#56616d', u.a, 3);
    }
    const lb = along(S, e, L + (d.sh ? 60 : 30));
    g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(d.sh ? '6Fr' : d.fr + 'Fr', lb.x + sgn(S) * 18, lb.y);
  }

  // 留置したシース（止血弁つきハブ＋側管＋三方活栓）
  function drawSheath(S) {
    const R = PS.R, e = entry(S), u = dirU(S), L = 46;
    const hb = along(S, e, L);
    g.fillStyle = 'rgba(30,8,0,.35)'; g.beginPath(); g.ellipse(e.x, e.y, 7, 5, u.a, 0, 7); g.fill();
    R.tube(g, [[e.x, e.y], [hb.x, hb.y]], 8, '#3f4a55', { cap: 'butt', hi: 'rgba(255,255,255,.35)' });
    const vh = along(S, e, L + 8); R.part(g, vh.x, vh.y, 18, 16, '#2a62b8', u.a, 3);
    const cp = along(S, e, L + 18); R.part(g, cp.x, cp.y, 14, 6, '#1d1f22', u.a, 2);
    const sp = { x: vh.x + Math.cos(u.a) * 10, y: vh.y + Math.sin(u.a) * 10 };
    R.tube(g, [[sp.x, sp.y], [sp.x + sgn(S) * 30, sp.y + 10], [sp.x + sgn(S) * 52, sp.y + 34]], 3.2, '#e8eef3', { hi: 'rgba(255,255,255,.8)' });
    R.part(g, sp.x + sgn(S) * 56, sp.y + 38, 12, 12, '#3a7bd5', 0, 2);
    g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('シース 6Fr', sp.x + sgn(S) * 70, sp.y + 64);
  }

  function drawCan(S, t) {
    const R = PS.R, c = S.f.can, e = { x: c.ex, y: c.ey }, L = canExt(S), u = dirU(S);
    const w = c.fr / 1.5, cmY = L * .5;
    g.fillStyle = 'rgba(30,8,0,.4)'; g.beginPath(); g.ellipse(e.x, e.y, w * .85, w * .55, u.a, 0, 7); g.fill();
    g.save(); g.translate(e.x, e.y); g.rotate(u.a);
    // 本体：透明・ワイヤー補強
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 4;
    g.fillStyle = 'rgba(205,220,228,.55)'; g.fillRect(-w / 2, 0, w, L);
    g.shadowColor = 'transparent';
    const bgr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    bgr.addColorStop(0, 'rgba(120,135,145,.55)'); bgr.addColorStop(.3, 'rgba(255,255,255,.55)'); bgr.addColorStop(.7, 'rgba(235,242,246,.35)'); bgr.addColorStop(1, 'rgba(110,125,135,.6)');
    g.fillStyle = bgr; g.fillRect(-w / 2, 0, w, L);
    if (c.obt > 0.3) {
      const y2 = c.clamp ? cmY : Math.min(L, L * c.obt * 1.3);
      const bl = g.createLinearGradient(-w / 2, 0, w / 2, 0);
      bl.addColorStop(0, c.kind === 'V' ? '#2a0306' : '#7a070c'); bl.addColorStop(.35, c.kind === 'V' ? '#6a0a12' : '#d5121c'); bl.addColorStop(1, c.kind === 'V' ? '#26030a' : '#6a060c');
      g.fillStyle = bl; g.fillRect(-w / 2 + 2, 0, w - 4, y2);
    }
    g.strokeStyle = 'rgba(70,80,90,.55)'; g.lineWidth = .9;
    for (let y = 3; y < L - 3; y += 3.2) { g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y + 2.2); g.stroke(); }
    // 深さの目盛（5 cm ごと）
    g.fillStyle = 'rgba(20,30,40,.85)'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center';
    for (let cm = Math.ceil(c.s / 5) * 5; cm <= c.len; cm += 5) { const y = (cm - c.s) * 4; if (y < 4 || y > L - 6) continue; g.fillRect(-w / 2, y, w, 1.6); g.save(); g.translate(w / 2 + 7, y + 3); g.rotate(-Math.PI / 2); g.fillText(cm, 0, 0); g.restore(); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-w / 2 + 2.5, 2); g.lineTo(-w / 2 + 2.5, L - 2); g.stroke();
    if (!c.clamp && c.obt < 1 && !S.exam && c.obt >= .5) { g.strokeStyle = 'rgba(255,207,51,.9)'; g.setLineDash([3, 3]); g.lineWidth = 2; g.strokeRect(-w, cmY - 9, w * 2, 18); g.setLineDash([]); }
    g.restore();
    // ハブ（3/8 インチのコネクタ）
    const hb = along(S, e, L + 9), col = c.kind === 'V' ? '#2f6fd0' : '#d03a3a';
    R.part(g, hb.x, hb.y, w + 9, 18, col, u.a, 3);
    [4, 10].forEach(k => { const q = along(S, e, L + 18 + k); R.part(g, q.x, q.y, w + 1 - k * .2, 5, '#e9edf0', u.a, 2); });
    if (c.obt < 1) {
      const oy = L + 30 + c.obt * 70, a1 = along(S, e, L + 24), a2 = along(S, e, oy + 6);
      R.tube(g, [[a1.x, a1.y], [a2.x, a2.y]], Math.max(4, w - 5), '#f4f4f2', { cap: 'butt' });
      const oc = along(S, e, oy + 14); R.part(g, oc.x, oc.y, 26, 16, '#ececea', u.a, 5);
    }
    const h = canHub(S);
    g.fillStyle = '#fff'; g.font = 'bold 11px "Hiragino Sans", sans-serif'; g.textAlign = 'center';
    g.fillText(c.kind === 'V' ? '脱血' : '送血', h.x - u.y * 32 * (S.f.side === 'R' ? 1 : -1), h.y + 4);
    if (c.obt < 1) { const o = obtPos(S); g.fillStyle = '#fff'; g.font = '11px "Hiragino Sans", sans-serif'; g.fillText('内筒', o.x + (S.f.side === 'R' ? 30 : -30), o.y + 4); }
    if (c.clamp) { const m = clampMark(S); drawClamp(m.x, m.y); }
    if (c.sut) { g.strokeStyle = '#1b2a3a'; g.lineWidth = 1.6; [-1, 1].forEach(s => { const x = e.x + s * (w / 2 + 8), y = e.y + 14; g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke(); g.beginPath(); g.moveTo(x, y); g.lineTo(e.x, e.y + 22); g.stroke(); }); }
  }

  // FDL：白い不透明なカテーテル（1 cm ごとの目盛）＋固定の翼＋Y字ハブ＋赤/青の延長チューブ・クランプ
  function drawFDL(S) {
    const R = PS.R, c = S.f.can, e = { x: c.ex, y: c.ey }, L = canExt(S), u = dirU(S), hb = canHub(S), w = 7.5;
    g.fillStyle = 'rgba(30,8,0,.4)'; g.beginPath(); g.ellipse(e.x, e.y, w * .9, w * .6, u.a, 0, 7); g.fill();
    R.tube(g, [[e.x, e.y], [hb.x, hb.y]], w, '#f4f3ee', { cap: 'butt', edge: '#8d918a' });
    g.fillStyle = 'rgba(25,30,35,.85)'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center';
    for (let cm = Math.ceil(c.s); cm <= c.len; cm++) { const d = (cm - c.s) * 2.4; if (d < 3 || d > L - 4) continue; const q = along(S, e, d); g.save(); g.translate(q.x, q.y); g.rotate(u.a); g.fillStyle = 'rgba(25,30,35,.85)'; g.fillRect(-w / 2, 0, cm % 5 ? w * .4 : w, 1.2); if (cm % 5 === 0) { g.rotate(-Math.PI / 2); g.fillText(cm, -2, w + 4); } g.restore(); }
    const wg = along(S, e, Math.max(18, L - 14)); R.part(g, wg.x, wg.y, 34, 9, '#e9e6dc', u.a, 3);
    R.part(g, hb.x, hb.y, 22, 24, '#e7e3d6', u.a, 5);
    const lg = fdlLegs(S);
    ['A', 'V'].forEach(k => {
      const l = lg[k], col = k === 'A' ? '#d0302c' : '#2f6fd0';
      R.tube(g, [[hb.x + l.ux * 10, hb.y + l.uy * 10], [l.x, l.y]], 5, '#eef2f4', { hi: 'rgba(255,255,255,.7)' });
      R.part(g, l.cl.x, l.cl.y, 16, 10, col, l.a, 2);
      R.part(g, l.x, l.y, 12, 14, col, l.a + Math.PI / 2, 2);
      if (!S.exam) { g.fillStyle = '#fff'; g.font = 'bold 11px "Hiragino Sans", sans-serif'; g.textAlign = 'center'; g.fillText(k === 'A' ? '脱血 A' : '返血 V', l.x - l.uy * 30 * (k === 'A' ? 1 : -1) * sgn(S), l.y + l.ux * 30 * (k === 'A' ? 1 : -1) * sgn(S) + 4); }
    });
    if (c.sut) { g.strokeStyle = '#1b2a3a'; g.lineWidth = 1.6; [-1, 1].forEach(s => { const x = wg.x + s * 16 * Math.cos(u.a + Math.PI / 2), y = wg.y + s * 16 * Math.sin(u.a + Math.PI / 2); g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4); g.stroke(); }); }
  }

  function drawClamp(x, y) {
    const R = PS.R;
    R.metal(g, x - 24, y - 3, x + 58, y + 10, 4.5); R.metal(g, x - 24, y + 3, x + 58, y - 6, 4.5);
    g.save(); g.fillStyle = '#25292e'; g.beginPath(); g.roundRect(x - 26, y - 6, 22, 12, 4); g.fill(); g.restore();   // ゴムの爪
    g.save(); g.strokeStyle = '#a9b1b9'; g.lineWidth = 3.5; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
    g.beginPath(); g.ellipse(x + 68, y + 14, 9, 7, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(x + 68, y - 10, 9, 7, 0, 0, 7); g.stroke(); g.restore();
  }
  function drawForcepsTip(x, y, an) {
    const R = PS.R;
    g.save(); g.translate(x, y); g.rotate(an);
    R.metal(g, 0, 0, -7, 80, 3.6); R.metal(g, 0, 0, 7, 80, 3.6);
    g.strokeStyle = '#a9b1b9'; g.lineWidth = 3.2; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
    g.beginPath(); g.ellipse(-11, 91, 8, 9, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(11, 91, 8, 9, 0, 0, 7); g.stroke();
    g.restore();
  }

  function drawHeld(id, x, y) {
    const R = PS.R;
    if (id === 'probe') return drawProbe(x, y, false);
    if (id === 'marker' || id === 'forceps') return drawForcepsTip(x, y, -0.15);
    g.save(); g.globalAlpha = .95;
    if (id === 'needle') { R.metal(g, x, y, x, y + 56, 3); R.part(g, x, y + 63, 12, 14, '#e2779b', 0, 2); R.part(g, x, y + 104, 24, 64, '#e8eef2', 0, 3); }
    else if (id === 'wire') {
      // フープ（ワイヤーの入った輪）と J 矯正器
      R.tube(g, [[x, y], [x, y + 26]], 7, '#e9eef2', { cap: 'butt' });
      g.strokeStyle = '#3d7dd8'; g.lineWidth = 5; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 5; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + 44, y + 70, 40 - i * 4, 0, 7); g.stroke(); }
      g.shadowColor = 'transparent'; g.strokeStyle = '#55606b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 26); g.quadraticCurveTo(x, y + 60, x + 6, y + 70); g.stroke();
      g.beginPath(); g.arc(x + 3, y - 2, 3, Math.PI * .5, Math.PI * 2.2); g.stroke();
    }
    else if (id === 'scalpel') {
      g.fillStyle = '#dfe4e8'; g.strokeStyle = '#8a9399'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y + 22); g.lineTo(x - 3, y + 24); g.closePath(); g.fill(); g.stroke();
      R.part(g, x, y + 64, 9, 80, '#cfd5da', 0, 3);
    }
    else if (id === 'sheath6') { R.tube(g, [[x, y], [x, y + 70]], 8, '#3f4a55', { cap: 'butt' }); R.part(g, x, y + 78, 18, 16, '#2a62b8', 0, 3); R.tube(g, [[x, y + 86], [x, y + 112]], 4, '#f2f2f0', { cap: 'butt' }); }
    else if (id.startsWith('dil')) { const fr = +id.slice(3); R.tube(g, [[x, y], [x, y + 110]], 4 + fr * .55, DILC[fr] || '#fff', { cap: 'butt', edge: '#7c8791' }); R.part(g, x, y + 118, 4 + fr * .55 + 6, 16, '#56616d', 0, 3); }
    else if (id.startsWith('fdl')) { R.tube(g, [[x, y], [x, y + 110]], 7.5, '#f4f3ee', { cap: 'butt', edge: '#8d918a' }); R.part(g, x, y + 118, 22, 20, '#e7e3d6', 0, 4); R.tube(g, [[x, y + 126], [x - 26, y + 176]], 5, '#eef2f4'); R.tube(g, [[x, y + 126], [x + 26, y + 176]], 5, '#eef2f4'); R.part(g, x - 28, y + 180, 12, 14, '#d0302c', 0, 2); R.part(g, x + 28, y + 180, 12, 14, '#2f6fd0', 0, 2); }
    else if (id.startsWith('can')) { const t = TOOLS[id], w = t.fr / 1.5; R.tube(g, [[x, y], [x, y + 120]], w, '#dfe9ee', { cap: 'butt', edge: '#7e8d97' }); R.part(g, x, y + 128, w + 9, 18, t.kind === 'V' ? '#2f6fd0' : '#d03a3a', 0, 3); }
    else if (id === 'suture') { g.strokeStyle = '#b8bfc6'; g.lineWidth = 2; g.beginPath(); g.arc(x, y + 8, 8, Math.PI, 0); g.stroke(); g.strokeStyle = '#1b2a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 8, y + 8); g.bezierCurveTo(x + 20, y + 40, x - 20, y + 60, x + 10, y + 90); g.stroke(); }
    g.restore();
  }

  // ---------- エコー ----------
  function usLevel(S) {
    const f = S.f;
    if (f.needle) return levelAt(S, f.needle.ex, tipY(S));
    if (f.probe) return levelAt(S, f.probe.x, f.probe.y);
    return 1;
  }

  function drawUS(S, t) {
    const R = PS.R, f = S.f, W = 360, H = 250, PX = 50, cx = W / 2;
    us.fillStyle = '#000'; us.fillRect(0, 0, W, H);
    if (!f.probe && !f.needle) { us.fillStyle = '#7f8a94'; us.font = '13px "Hiragino Sans", sans-serif'; us.textAlign = 'center'; us.fillText('プローブを皮膚に当てると画像が出ます', W / 2, H / 2); return; }
    const lv = usLevel(S), L = LEVELS[lv], b = beat(t);
    const tis = R.usTissue(W, H, PX, { fat: .85 + lv * .05, fascia: .95 + lv * .05, seed: 11 + lv * 3, att: .14 });
    us.save();
    if (f.comp) { us.translate(0, -6); us.scale(1, 1.03); }
    us.drawImage(tis, 0, 0);
    const X = xcm => cx + sgn(S) * xcm * PX;
    if (lv === 1) R.usBone(us, X(-1.6), 4.6 * PX, 2.0 * PX, .9 * PX, H);
    if (lv >= 2) R.usBone(us, X(-1.2), 4.9 * PX, 1.1 * PX, .5 * PX, H, Math.PI, Math.PI * 2);
    if (lv === 0) { us.strokeStyle = 'rgba(230,230,220,.6)'; us.lineWidth = 3; us.beginPath(); us.moveTo(0, 2.6 * PX); us.quadraticCurveTo(cx, 2.4 * PX, W, 2.8 * PX); us.stroke(); }
    const ns = f.needle ? needleState(S) : null;
    const geo = L.vs.map(v => {
      let rx = v.rx, ry = v.ry;
      if (v.k === 'a') { rx *= 1 + .07 * b; ry *= (f.comp ? .9 : 1) * (1 + .07 * b); }
      else ry *= f.comp ? .18 : 1;
      let tent = ns && ns.v === v && ns.st === 'tent' ? .25 : 0;
      return { v, x0: X(v.x), y0: (v.y + tent * .5) * PX, rx: rx * PX, ry: (ry - tent * .5) * PX };
    });
    geo.forEach(q => R.usVessel(us, q.x0, q.y0, q.rx, q.ry, q.v.k === 'a', H));
    // 血管内のワイヤー・カニューレ（短軸で明るい点／二重の輪）
    const inV = geo.find(q => (f.wire && !f.needle) && ((f.wire.k === 'V' && q.v.k === 'v') || (f.wire.k === 'A' && q.v.k === 'a')));
    if (inV) {
      if (f.can && f.can.s > 1) { us.strokeStyle = 'rgba(255,255,255,.85)'; us.lineWidth = 2; const r = Math.min(inV.rx, inV.ry) * .75; us.beginPath(); us.arc(inV.x0, inV.y0, r, 0, 7); us.stroke(); us.beginPath(); us.arc(inV.x0, inV.y0, r - 3, 0, 7); us.stroke(); }
      else R.usNeedleDot(us, inV.x0, inV.y0 + inV.ry * .4, false);
    }
    if (f.color) {
      R.usColorBox(us, 40, 30, 250, 170);
      geo.forEach(q => { if (q.v.k === 'a' || !f.comp) R.usColor(us, q.x0, q.y0, q.rx, q.ry, q.v.k === 'a', b); });
    }
    us.restore();
    // 計測（キャリパー）
    if (f.meas && lv === 1) {
      us.strokeStyle = '#d6ff4d'; us.fillStyle = '#d6ff4d'; us.lineWidth = 1; us.font = '10px Menlo, monospace'; us.textAlign = 'left';
      geo.forEach((q, i) => {
        us.setLineDash([2, 3]); us.beginPath(); us.moveTo(q.x0 - q.rx, q.y0); us.lineTo(q.x0 + q.rx, q.y0); us.stroke(); us.setLineDash([]);
        [q.x0 - q.rx, q.x0 + q.rx].forEach(x => { us.beginPath(); us.moveTo(x - 4, q.y0); us.lineTo(x + 4, q.y0); us.moveTo(x, q.y0 - 4); us.lineTo(x, q.y0 + 4); us.stroke(); });
        us.fillText(`${i + 1}`, q.x0 + q.rx + 4, q.y0 - 3);
        us.fillText(`D${i + 1} ${(q.v.rx * 20).toFixed(1)}mm ${q.v.id.toUpperCase()}`, 46, H - 34 + i * 12);
      });
    }
    if (ns && ns.st !== 'out') R.usNeedleDot(us, cx + sgn(S) * xcmOf(S, f.needle.ex) * PX, ns.d * PX, ns.st === 'lumen');
    R.mottle(us, W, H, .14);
    R.usUI(us, 0, 0, W, H, PX, { color: f.color, info: ['L12-3', '12.0MHz', 'Gn 54', f.color ? 'CF 6.3MHz' : 'DR 60', 'FR 29'], focus: 2.2 });
    if (!S.exam) {
      us.font = '11px "Hiragino Sans", sans-serif'; us.fillStyle = 'rgba(255,255,255,.75)';
      geo.forEach(q => { us.textAlign = 'center'; us.fillText(q.v.k === 'a' ? 'A' : 'V', q.x0, q.y0 - q.ry - 6); });
      us.fillStyle = 'rgba(200,210,220,.7)'; us.textAlign = 'left'; us.fillText(f.side === 'R' ? '外側' : '内側', 64, H - 6); us.textAlign = 'right'; us.fillText(f.side === 'R' ? '内側' : '外側', W - 70, H - 6);
    }
    root.querySelector('#usLv').textContent = S.exam ? '' : L.name;
  }

  // ---------- 透視 ----------
  function drawFl(S, t) {
    const f = S.f, FL = PS.Fluoro;
    const zoom = curStep() && curStep().flView === 'pelvis';
    const hd = FL.HEADS[f.side];
    const view = zoom ? { cx: hd.x, cy: hd.y - 5, scale: 2.4 } : { cx: 200, cy: 330, scale: .62 };
    const objs = { guide: !S.exam };
    const toFl = p => ({ x: hd.x + (p.x - head(S).x) * .25, y: hd.y + (p.y - head(S).y) * .25 });
    if (f.marker) objs.marker = toFl(f.marker);
    if (f.wire) objs.wire = { k: f.wire.k, len: f.wire.len };
    if (f.dil) objs.dil = { k: f.side === 'R' ? 'V' : 'A', len: f.dil.s, fr: f.dil.fr };
    if (f.can) objs.can = { k: f.can.kind, len: f.can.s, kind: f.can.kind };
    FL.draw(fl, 320, 400, view, objs, t);
    let lbl = '';
    const tipOf = f.can ? ['先端', f.can.kind, f.can.s] : f.wire ? ['ワイヤー', f.wire.k, f.wire.len] : null;
    if (tipOf && !S.exam) lbl = `${tipOf[0]}: ${FL.zone(tipOf[1], tipOf[2]).t}（体内 ${Math.round(tipOf[2])} cm）`;
    if (zoom && f.marker && !S.exam) lbl = 'ペアン先端と大腿骨頭の位置関係';
    if (curStep() && curStep().flNote) lbl = curStep().flNote + (lbl ? '　' + lbl : '');
    root.querySelector('#flLbl').textContent = lbl;
  }

  // ---------- 器械アイコン ----------
  function icon(id) {
    const s = (b) => `<svg viewBox="0 0 60 30" width="60" height="30">${b}</svg>`;
    if (id === 'probe') return s('<rect x="4" y="9" width="30" height="12" rx="4" fill="#e8eaec" stroke="#7b8288"/><path d="M34 15 C45 15 48 5 58 6" stroke="#5b6168" stroke-width="3" fill="none"/>');
    if (id === 'marker' || id === 'forceps') return s('<path d="M4 15 L40 11 M4 15 L40 19" stroke="#8d969e" stroke-width="3"/><circle cx="46" cy="9" r="5" stroke="#8d969e" stroke-width="2.5" fill="none"/><circle cx="46" cy="21" r="5" stroke="#8d969e" stroke-width="2.5" fill="none"/>');
    if (id === 'needle') return s('<path d="M2 15 H22" stroke="#9aa1a8" stroke-width="2"/><rect x="22" y="11" width="6" height="8" fill="#e5c33c"/><rect x="28" y="9" width="24" height="12" rx="2" fill="#eef4f7" stroke="#8a9399"/><rect x="52" y="13" width="7" height="4" fill="#bfc6cc"/>');
    if (id === 'wire') return s('<circle cx="40" cy="15" r="11" stroke="#3a3f45" stroke-width="2" fill="none"/><circle cx="40" cy="15" r="8" stroke="#3a3f45" stroke-width="1.5" fill="none"/><path d="M29 15 H6 a3 3 0 1 1 0-6" stroke="#3a3f45" stroke-width="2" fill="none"/>');
    if (id === 'scalpel') return s('<path d="M4 15 L16 11 L18 18 Z" fill="#d6dbe0" stroke="#8a9399"/><rect x="18" y="12" width="38" height="6" rx="2" fill="#5c6670"/>');
    if (id === 'sheath6') return s('<path d="M2 15 L8 12 H40 V18 H8 Z" fill="#2b2f35"/><rect x="40" y="9" width="9" height="12" fill="#3b6fc4"/><path d="M49 15 H58" stroke="#e9e9e9" stroke-width="3"/><path d="M44 21 C46 27 52 28 56 28" stroke="#8a9399" stroke-width="2" fill="none"/>');
    if (id.startsWith('dil')) { const fr = +id.slice(3); return s(`<path d="M2 15 L12 ${15 - fr / 5} H50 V${15 + fr / 5} H12 Z" fill="#fff" stroke="#6d7680"/><rect x="50" y="9" width="8" height="12" fill="#4f5a66"/>`); }
    if (id.startsWith('fdl')) return s('<rect x="2" y="12" width="34" height="6" rx="3" fill="#f4f3ee" stroke="#8d918a"/><rect x="34" y="9" width="8" height="12" rx="2" fill="#e7e3d6" stroke="#999"/><path d="M42 13 L52 6 M42 17 L52 24" stroke="#bbb" stroke-width="2.5"/><rect x="51" y="2" width="7" height="7" fill="#d0302c"/><rect x="51" y="21" width="7" height="7" fill="#2f6fd0"/>');
    if (id.startsWith('can')) { const v = id.includes('V'); return s(`<rect x="2" y="11" width="44" height="8" rx="3" fill="#eef4f7" stroke="#6d7680"/><rect x="46" y="9" width="12" height="12" fill="${v ? '#2f6fd0' : '#d03a3a'}"/>${v ? '<circle cx="8" cy="15" r="1.3" fill="#6d7680"/><circle cx="14" cy="15" r="1.3" fill="#6d7680"/><circle cx="20" cy="15" r="1.3" fill="#6d7680"/>' : ''}`); }
    if (id === 'suture') return s('<path d="M6 20 A8 8 0 0 1 22 20" stroke="#222" stroke-width="2" fill="none"/><path d="M22 20 C30 4 40 26 56 10" stroke="#555" stroke-width="1.5" fill="none"/>');
    return '';
  }

  PS.Field = { icon, fdlLegs, gripPos, wireStart, dirU, along, obtPos, TOOLS, LEVELS, VNAME, levelAt, ligY, head, vesselX, hubPos, tipY, canHub, clampMark, entry, needleState, dilHub, BIF_Y, CM };
})();
