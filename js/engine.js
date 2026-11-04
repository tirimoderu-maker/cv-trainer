// engine.js — 手技の一覧・コース・1ステップずつの進行・矢印・シート
(function () {
  const PS = window.PS = { scenes: {}, procs: {}, cur: null, exam: false };
  const $ = (s, el = document) => el.querySelector(s);
  PS.$ = $;
  PS.reg = p => { PS.procs[p.id] = p; };
  PS.scene = (name, impl) => { PS.scenes[name] = impl; };
  PS.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 進捗 ----------
  const KEY = 'procsim.v1';
  function loadP() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function saveP(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* 保存できなくても続行 */ } }
  PS.progress = loadP();

  // ---------- ホーム ----------
  PS.boot = function () {
    $('#homeBack').onclick = () => showHub();
    $('#cMenu').onclick = () => quitLesson();
    $('#sheetBg').onclick = () => closeSheet();
    window.addEventListener('resize', () => placePointer());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
    if (PS.single) return showCourse(PS.single);   // 共有版：1つの手技だけ
    const last = (location.hash || '').slice(1);
    if (last && PS.procs[last]) showCourse(last); else showHub();
  };

  function showHub() {
    if (PS.single) return showCourse(PS.single);
    location.hash = '';
    $('#homeTitle').textContent = '循環器救急 手技トレーナー';
    $('#homeSub').textContent = '器械台から道具を取って、術野で手を動かしながら覚える。光っているところ・点線の手の動きをなぞれば進めます。';
    $('#homeBack').hidden = true; $('#course').hidden = true; $('#hub').hidden = false;
    const cards = Object.values(PS.procs).map(p => {
      const done = countDone(p);
      return `<button class="pcard" data-proc="${p.id}">
        <div class="p-ic">${p.icon || ''}</div>
        <div class="p-t">${p.title}</div><div class="p-s">${p.sub}</div>
        <div class="p-prog"><i style="width:${Math.round(100 * done / p.total)}%"></i></div>
        <div class="p-n">${done} / ${p.total} レッスン</div></button>`;
    }).join('');
    const soon = (PS.upcoming || []).map(u => `<div class="pcard soon"><div class="p-t">${u.t}</div><div class="p-s">${u.s}</div><div class="p-n">準備中</div></div>`).join('');
    $('#hub').innerHTML = `<div class="pgrid">${cards}${soon}</div>`;
    $('#hub').querySelectorAll('[data-proc]').forEach(b => b.onclick = () => showCourse(b.dataset.proc));
  }

  function countDone(p) {
    const pr = PS.progress[p.id] || {};
    return p.chapters.reduce((n, c) => n + c.lessons.filter(l => pr[l.id]).length, 0);
  }

  function showCourse(pid) {
    const p = PS.procs[pid];
    location.hash = pid;
    $('#homeTitle').textContent = p.title;
    $('#homeSub').innerHTML = p.lead;
    $('#homeBack').hidden = !!PS.single; $('#hub').hidden = true; $('#course').hidden = false;
    const pr = PS.progress[pid] || {};
    let nextMarked = false;
    const html = p.chapters.map((c, ci) => `
      <section class="chap"><h2><span class="no">${ci + 1}</span>${c.title}</h2><p class="cdesc">${c.desc}</p>
      <div class="lgrid">${c.lessons.map(l => {
        const d = pr[l.id]; let cls = 'lcard';
        if (!d && !nextMarked) { cls += ' next'; nextMarked = true; }
        if (l.exam) cls += ' exam';
        return `<button class="${cls}" data-les="${l.id}"><div class="lt">${l.title}</div><div class="ls">${l.sub}</div>${d ? `<span class="done">✓${d.score != null ? ' ' + d.score + '点' : ''}</span>` : ''}</button>`;
      }).join('')}</div></section>`).join('');
    const refs = p.refs ? `<button class="refbtn" id="refBtn">根拠にしたガイドライン・試験と、日本と海外の違い</button>` : '';
    $('#course').innerHTML = refs + html;
    $('#course').querySelectorAll('[data-les]').forEach(b => b.onclick = () => startLesson(pid, b.dataset.les));
    if (p.refs) $('#refBtn').onclick = () => openSheet(p.refs());
  }

  // ---------- レッスン ----------
  function findLesson(p, lid) {
    for (const c of p.chapters) for (const l of c.lessons) if (l.id === lid) return l;
  }

  function buildSteps(p, l) {
    if (!l.compose) return l.steps;
    // 通し実技: 複数レッスンのステップをつなぐ（各レッスンの冒頭で init を当て直す）
    const out = [];
    l.compose.forEach(id => {
      const src = findLesson(p, id);
      src.steps.forEach((st, i) => {
        if (i === 0) out.push(Object.assign({}, st, { set: S => { src.init && src.init(S); st.set && st.set(S); }, lessonTitle: src.title }));
        else out.push(Object.assign({}, st, { lessonTitle: src.title }));
      });
    });
    return out;
  }

  function startLesson(pid, lid) {
    if (PS.cur) unmountScene();
    const p = PS.procs[pid], l = findLesson(p, lid);
    const S = p.initState();
    S.exam = !!l.exam;
    PS.exam = !!l.exam;
    if (!l.compose && l.init) l.init(S);
    PS.cur = { p, l, S, steps: buildSteps(p, l), i: 0, sceneName: null, scene: null, mistakes: 0, hints: 0, t0: Date.now(), waiting: false };
    $('#home').hidden = true; $('#play').hidden = false;
    showStep();
  }

  function quitLesson() {
    unmountScene();
    PS.cur = null; hidePointer();
    $('#play').hidden = true; $('#home').hidden = false;
    const pid = (location.hash || '').slice(1);
    if (pid && PS.procs[pid]) showCourse(pid); else showHub();
  }

  function unmountScene() {
    const c = PS.cur; if (!c || !c.scene) return;
    c.scene.unmount && c.scene.unmount();
    c.scene = null; c.sceneName = null;
    $('#stage').innerHTML = '';
  }

  function showStep() {
    const c = PS.cur, st = c.steps[c.i];
    c.waiting = false;
    st.set && st.set(c.S);
    if (c.sceneName !== st.scene || st.remount) {
      unmountScene();
      c.sceneName = st.scene; c.scene = PS.scenes[st.scene];
      c.scene.mount($('#stage'), c.S, st);
    }
    c.scene.update(c.S, st);
    renderCoach();
    renderOpts();
    setTimeout(placePointer, 30);
  }
  PS.refresh = () => { const c = PS.cur; if (!c) return; c.scene.update(c.S, c.steps[c.i]); placePointer(); };

  function stepBar() {
    const c = PS.cur;
    return `<span class="c-step">${c.steps.map((s, k) => `<i class="${k < c.i ? 'd' : k === c.i ? 'c' : ''}"></i>`).join('')}</span>`;
  }

  function renderCoach(fb) {
    const c = PS.cur, st = c.steps[c.i];
    const lt = st.lessonTitle && c.l.compose ? `${c.l.title}｜${st.lessonTitle}` : c.l.title;
    $('#cTitle').innerHTML = `<b>${lt}</b> ・ ${c.i + 1} / ${c.steps.length}${stepBar()}`;
    $('#cDo').innerHTML = c.waiting ? `<span class="okmark">✓</span> ${st.doneText || 'できました'}` : st.do;
    const aft = typeof st.after === 'function' ? st.after(c.S) : st.after;
    const tip = c.waiting ? (aft || '') : (c.S.exam ? '' : (st.tip || ''));
    $('#cTip').innerHTML = tip;
    const cau = !c.waiting && st.caution ? st.caution.map(x => `<span class="cau">⚠ ${x}</span>`).join('') : '';
    if (cau) $('#cTip').innerHTML += `<div class="caus">${cau}</div>`;
    const f = $('#cFb');
    if (fb) { f.hidden = false; f.className = 'c-fb ' + fb.kind; f.innerHTML = fb.html; } else f.hidden = true;
    const acts = [];
    if (c.waiting) acts.push(`<button class="primary" data-ctl="next" id="bNext">${c.i + 1 < c.steps.length ? '次へ →' : 'まとめへ →'}</button>`);
    else {
      if (c.S.exam && st.tip) acts.push(`<button id="bHint">ヒント</button>`);
      if (st.skip && !c.S.exam) acts.push(`<button id="bSkip">${st.skip}</button>`);
    }
    $('#cActions').innerHTML = acts.join('');
    if ($('#bNext')) $('#bNext').onclick = () => advance();
    if ($('#bHint')) $('#bHint').onclick = () => { c.hints++; $('#cTip').innerHTML = st.tip; };
    if ($('#bSkip')) $('#bSkip').onclick = () => success();
  }

  function renderOpts() {
    const c = PS.cur, st = c.steps[c.i], o = $('#opts');
    if (!st.opts || c.waiting) { o.hidden = true; o.innerHTML = ''; return; }
    o.hidden = false;
    o.innerHTML = (st.q ? `<div class="o-q">${st.q}</div>` : '') + `<div class="o-list">${st.opts.map(x => `<button class="obtn" data-ctl="opt-${x.id}" data-id="${x.id}">${x.t}</button>`).join('')}</div>`;
    o.querySelectorAll('.obtn').forEach(b => b.onclick = () => PS.emit({ type: 'opt', id: b.dataset.id }));
  }

  // ---------- 判定 ----------
  PS.emit = function (a) {
    const c = PS.cur; if (!c || c.waiting) return;
    const st = c.steps[c.i];
    // 道具まわりの共通の声かけ（ミスには数えない）
    const tname = id => (PS.Field && PS.Field.TOOLS[id] && PS.Field.TOOLS[id].t) || (id === 'saline' ? '生食シリンジ' : id);
    const want = st.tool ? [].concat(st.tool) : null;
    if (a.type === 'noTool') { renderCoach({ kind: 'warn', html: `まず器械台から「${tname(want ? want[0] : a.tool)}」を取ります。` }); return placePointer(); }
    // 手技の基本動作のミス（ワイヤーを離した等）。どのステップでも数える
    if (a.type === 'slip') return wrong(a.msg);
    if (a.type === 'wireHold') { renderCoach({ kind: 'info', html: a.msg || '左手でワイヤーを保持。以後、ワイヤーから手を離さない。' }); return placePointer(); }
    if (a.type === 'miss') { renderCoach({ kind: 'warn', html: st.missMsg || 'そこではありません。黄色い点線のお手本の位置で操作します。' }); return placePointer(); }
    if (a.type === 'pick') {
      if (a.id && want && !want.some(t => a.id === t)) { renderCoach({ kind: 'warn', html: st.toolMsg || `今使うのは「${tname(want[0])}」です。` }); return placePointer(); }
      renderCoach(); return placePointer();
    }
    let r;
    if (st.ok) r = st.ok(a, c.S, st);
    else if (st.ans != null && a.type === 'opt') {
      const ans = [].concat(st.ans);
      r = ans.includes(a.id) ? true : ((st.wrong && st.wrong[a.id]) || 'ちがいます。もう一度考えてみましょう。');
    }
    if (r === true) success();
    else if (typeof r === 'string') wrong(r);
    else if (r && r.warn) { renderCoach({ kind: 'warn', html: r.warn }); placePointer(); }
    else placePointer();
  };

  function wrong(msg) {
    const c = PS.cur; c.mistakes++;
    renderCoach({ kind: 'ng', html: msg });
    const o = $('#opts'); if (!o.hidden) { o.classList.remove('shake'); void o.offsetWidth; o.classList.add('shake'); }
    placePointer();
  }

  function success() {
    const c = PS.cur, st = c.steps[c.i];
    st.apply && st.apply(c.S);
    c.scene.update(c.S, st);
    const coach = $('#coach'); coach.classList.remove('ok'); void coach.offsetWidth; coach.classList.add('ok');
    if (st.after) { c.waiting = true; renderCoach(); renderOpts(); setTimeout(placePointer, 30); }
    else { c.waiting = 'auto'; setTimeout(() => { if (PS.cur === c && c.waiting === 'auto') advance(); }, 650); }   // 進むまでの間の操作は数えない
  }

  function advance() {
    const c = PS.cur; if (!c) return;
    if (c.i + 1 >= c.steps.length) return finishLesson();
    c.i++; showStep();
  }

  function finishLesson() {
    const c = PS.cur, p = c.p, l = c.l;
    const pr = PS.progress[p.id] = PS.progress[p.id] || {};
    const sec = Math.round((Date.now() - c.t0) / 1000);
    let score = null;
    if (l.exam) score = Math.max(0, 100 - c.mistakes * 6 - c.hints * 3);
    pr[l.id] = { at: Date.now(), score, sec };
    saveP(PS.progress);
    hidePointer();
    const pts = (l.points || []).map(x => `<li>${x}</li>`).join('');
    const examHtml = l.exam ? `<div class="score"><b>${score}</b> 点<span>ミス ${c.mistakes} ・ ヒント ${c.hints} ・ ${Math.floor(sec / 60)}分${sec % 60}秒</span></div>` : '';
    const nextL = nextLesson(p, l);
    openSheet(`<h2>${l.title} — おわり</h2>${examHtml}${pts ? `<h3>ここだけ覚える</h3><ul class="pts">${pts}</ul>` : ''}${l.refs ? `<p class="refs">${l.refs}</p>` : ''}
      <div class="sheet-act"><button id="sCourse">コースへ戻る</button>${nextL ? `<button class="primary" id="sNext">次: ${nextL.title} →</button>` : ''}<button id="sAgain">もう一度</button></div>`, true);
    $('#sCourse').onclick = () => { closeSheet(); quitLesson(); };
    $('#sAgain').onclick = () => { closeSheet(); unmountScene(); startLesson(p.id, l.id); };
    if (nextL) $('#sNext').onclick = () => { closeSheet(); unmountScene(); startLesson(p.id, nextL.id); };
  }

  function nextLesson(p, l) {
    const all = p.chapters.flatMap(c => c.lessons);
    const i = all.indexOf(l);
    return all[i + 1];
  }

  // ---------- 矢印（DOM の対象を指す。キャンバス内の手の動きは各シーンが描く） ----------
  function placePointer() {
    const c = PS.cur, ptr = $('#pointer');
    if (!c) return hidePointer();
    const st = c.steps[c.i];
    let at = c.waiting ? 'next' : (typeof st.at === 'function' ? st.at(c.S) : st.at);
    if (!at || (c.S.exam && !c.waiting)) return hidePointer();
    const el = document.querySelector(`[data-ctl="${at}"]`);
    if (!el) return hidePointer();
    const r = el.getBoundingClientRect();
    if (!r.width) return hidePointer();
    ptr.hidden = false;
    const ring = ptr.querySelector('.ring'), ar = ptr.querySelector('.arrow');
    ring.style.left = (r.left - 5 + scrollX) + 'px'; ring.style.top = (r.top - 5 + scrollY) + 'px';
    ring.style.width = (r.width + 10) + 'px'; ring.style.height = (r.height + 10) + 'px';
    const up = r.top < 70;
    ar.textContent = up ? '▲' : '▼';
    ar.style.left = (r.left + r.width / 2 - 11 + scrollX) + 'px';
    ar.style.top = (up ? r.bottom + 6 : r.top - 34) + scrollY + 'px';
    ar.classList.toggle('up', up);
  }
  PS.placePointer = placePointer;
  function hidePointer() { $('#pointer').hidden = true; }

  // ---------- シート ----------
  function openSheet(html, keep) {
    $('#sheet').innerHTML = (keep ? '' : '<button class="sheet-x" id="sheetX">×</button>') + html;
    $('#sheet').hidden = false; $('#sheetBg').hidden = false;
    if ($('#sheetX')) $('#sheetX').onclick = closeSheet;
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBg').hidden = true; }
  PS.openSheet = openSheet;

  // ---------- 共通ユーティリティ ----------
  PS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PS.lerp = (a, b, t) => a + (b - a) * t;
  // キャンバスのクリック位置を内部座標へ
  // 描画は論理サイズ（cv._lw × cv._lh）のまま、実際の画素は表示サイズ×画面の倍率で持つ（Retina でぼやけない）
  const lw = cv => cv._lw || cv.width, lh = cv => cv._lh || cv.height;
  PS.lw = lw; PS.lh = lh;
  function setRes(cv, cssW) {
    if (!cv._lw) { cv._lw = cv.width; cv._lh = cv.height; }
    const k = PS.clamp(Math.round(cssW / cv._lw * (window.devicePixelRatio || 1) * 4) / 4, 1, 2.5);
    if (cv._k === k) return;
    cv._k = k; cv.width = Math.round(cv._lw * k); cv.height = Math.round(cv._lh * k);
    cv.getContext('2d').setTransform(k, 0, 0, k, 0, 0);
  }
  PS.cpos = (cv, e) => {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * lw(cv) / r.width, y = (e.clientY - r.top) * lh(cv) / r.height;
    const f = cv._flip; if (!f) return { x, y };   // _flip：画面を180°回した術野（頭側に立つ視点）。{ox, oy, s} で縮小・ずらしも
    return f === true ? { x: lw(cv) - x, y: lh(cv) - y } : { x: (f.ox - x) / f.s, y: (f.oy - y) / f.s };
  };
  // キャンバスを枠いっぱい（縦横比を保って）に広げる
  PS.fit = (cv, box) => {
    const ro = new ResizeObserver(() => {
      const r = box.getBoundingClientRect(), k = Math.min(r.width / lw(cv), r.height / lh(cv));
      const w = Math.floor(lw(cv) * k);
      cv.style.width = w + 'px'; cv.style.height = Math.floor(lh(cv) * k) + 'px';
      if (w > 0) setRes(cv, w);
      PS.placePointer && PS.placePointer();
    });
    ro.observe(box); return ro;
  };
  // 幅がCSSで決まるキャンバス（モニター類）の解像度だけ合わせる
  PS.hd = cv => {
    const ro = new ResizeObserver(() => { const w = cv.getBoundingClientRect().width; if (w > 0) setRes(cv, w); });
    ro.observe(cv); return ro;
  };
  // 手の動きのお手本（点線の矢印＋手のアイコンが往復）
  PS.drawHint = (g, h, t) => {
    if (!h || PS.exam) return;
    g.save();
    g.strokeStyle = 'rgba(255,207,51,.95)'; g.fillStyle = 'rgba(255,207,51,.95)'; g.lineWidth = 3;
    if (h.drag) {
      const [[x1, y1], [x2, y2]] = h.drag;
      g.setLineDash([8, 7]); g.lineDashOffset = -t * 30;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
      const an = Math.atan2(y2 - y1, x2 - x1);
      g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 14 * Math.cos(an - .45), y2 - 14 * Math.sin(an - .45)); g.lineTo(x2 - 14 * Math.cos(an + .45), y2 - 14 * Math.sin(an + .45)); g.closePath(); g.fill();
      const k = (t * 0.6) % 1;
      PS.drawFinger(g, PS.lerp(x1, x2, k), PS.lerp(y1, y2, k));
    }
    if (h.tap) {
      const [x, y] = h.tap, k = (t * 1.2) % 1;
      g.globalAlpha = 1 - k; g.beginPath(); g.arc(x, y, 8 + 22 * k, 0, 7); g.stroke(); g.globalAlpha = 1;
      g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      PS.drawFinger(g, x + 4, y + 4);
    }
    if (h.hold) {
      const [x, y] = h.hold, k = (t * 0.8) % 1;
      g.beginPath(); g.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
      PS.drawFinger(g, x + 4, y + 4);
    }
    if (h.label) {
      const [x, y, s] = h.label;
      g.font = 'bold 13px "Hiragino Sans", sans-serif';
      const w = g.measureText(s).width + 14;
      g.fillStyle = 'rgba(20,24,30,.85)'; g.fillRect(x - w / 2, y - 11, w, 22);
      g.fillStyle = '#ffcf33'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y + 1);
    }
    g.restore();
  };
  PS.drawFinger = (g, x, y) => {
    g.save(); g.translate(x, y);
    g.fillStyle = '#b9a6e8'; g.strokeStyle = '#4b3a86'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(9, 16, 10, 12, -.3, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(-3, -2, 7, 20, 3.5); g.fill(); g.stroke();
    g.restore();
  };
})();
