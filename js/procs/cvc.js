// procs/cvc.js — CVカテーテル（右内頸静脈・エコーガイド・Seldinger法）
// 根拠: CDC 2011（O'Grady, Clin Infect Dis 2011;52:e162-93）・ASA 2020（Anesthesiology 2020;132:8-43）・3SITES（Parienti, NEJM 2015;373:1220-9）。
// 先端位置: Imai 2026（J Anesth、メタ解析：Zone A＝CAJ付近で血栓・閉塞が少ない）・Baskin 2008（CAJ＝気管分岐部から椎体2つ下）・Stonelake 2006（Zone A/B/C）。
// 日本麻酔科学会「安全な中心静脈カテーテル挿入・管理のための手引き 2017」は名前のみ（本文の推奨は確認していない）。
(function () {
  const N = () => PS.Neck, LM = () => PS.Lumen;
  Object.assign(PS.Field.TOOLS, { saline: { t: '生食シリンジ', s: '' }, hep: { t: 'ヘパリン', s: '' } });

  function freshN(o) {
    return Object.assign({ held: null, probe: null, comp: false, color: false, long: false, tren: false, needle: null, wire: null, site: null, cut: false, dil: null, dilDone: false, cv: null, ooze: 0, mishap: null, dress: false, wireBack: false, tray: [] }, o || {});
  }
  const APEX_Y = 255, apx = () => N().ijX(APEX_Y);
  // 穿刺・拡張が済んで、ワイヤーだけ入っている状態
  const wired = o => freshN(Object.assign({ site: { x: apx(), y: APEX_Y }, wire: { len: 15 }, cut: true, dilDone: true, tren: true, probe: { x: apx(), y: APEX_Y + 20 } }, o || {}));
  const placed = o => wired(Object.assign({ wire: null, cv: { id: 'cvc4', n: 4, s: 17, tail: true, sut: true }, dress: true }, o || {}));

  const PT = `<div class="pt-row"><span>68歳 男性</span><span>165 cm / 60 kg</span></div>`;
  const CASE = `<div class="cc-h">CCU</div>${PT}<p>前壁STEMIでPCI後、<b>心原性ショック</b>。挿管・人工呼吸中。末梢ラインは1本。</p>
    <p>流すもの：<b>ノルアドレナリン</b>・<b>ドブタミン</b>・鎮静の<b>プロポフォール</b>・心房細動に<b>アミオダロン</b>・<b>ヘパリン持続</b>・維持輸液（ワンショットと採血もここから）。</p>`;

  const toolAt = (tool, done) => S => (done(S) || S.f.held === tool) ? null : 'tool-' + tool;
  const U = () => N().U;
  const alongU = (p, d) => ({ x: p.x + N().U.x * d, y: p.y + N().U.y * d });

  // ---------- お手本（頸部の座標） ----------
  const gripFirst = (fn, lbl) => S => { const f = S.f; if (f.wire && !f.wHold) { const gp = N().gripPos(S); return { tap: [gp.x, gp.y], label: [gp.x - 150, gp.y - 14, lbl || '左手でワイヤーを持つ'] }; } return fn(S); };
  const H = {
    probe: () => ({ tap: [apx(), APEX_Y + 20], label: [apx() - 120, APEX_Y + 20, 'プローブを当てる'] }),
    comp: S => ({ hold: [S.f.probe.x, S.f.probe.y], label: [S.f.probe.x - 130, S.f.probe.y, '押したまま（圧迫）'] }),
    entry: () => ({ tap: [apx(), APEX_Y], label: [apx() - 150, APEX_Y - 10, 'ここから刺す（三角の頂点）'] }),
    advance: S => { const n = S.f.needle; return { drag: [[n.ex + 46, n.ey - 20], [n.ex + 46, n.ey + 60]], label: [n.ex + 140, n.ey + 20, '奥へドラッグで進める'] }; },
    syr: S => { const h = N().hubPos(S); return { tap: [h.x, h.y - 40], label: [h.x - 120, h.y - 40, 'シリンジを外す'] }; },
    wireIn: S => { const h = N().hubPos(S); return { tap: [h.x, h.y], label: [h.x - 120, h.y, 'ハブに差し込む'] }; },
    feed: S => { const h = N().hubPos(S); return { tap: [h.x, h.y - 30], label: [h.x + 140, h.y - 30, 'タップで送る'] }; },
    needleOut: gripFirst(S => { const h = N().hubPos(S); return { tap: [h.x, h.y], label: [h.x + 130, h.y, S.f.needle && S.f.needle.cath ? 'タップで外套を抜く' : 'タップで針を抜く'] }; }),
    inner: S => { const h = N().hubPos(S); return { tap: [h.x, h.y - 40], label: [h.x + 150, h.y - 40, 'タップで内針を抜く'] }; },
    reSyr: S => { const h = N().hubPos(S); return S.f.needle.syr ? { tap: [h.x, h.y - 40], label: [h.x + 130, h.y - 40, 'タップで押し子を引く'] } : { tap: [h.x, h.y], label: [h.x + 140, h.y, '外套にシリンジを付ける'] }; },
    cut: gripFirst(S => { const e = N().entry(S); return { drag: [[e.x - 12, e.y - 3], [e.x + 12, e.y + 3]], label: [e.x + 110, e.y + 20, '刺入部を小さく切る'] }; }),
    tapSite: S => { const e = N().entry(S); return { tap: [e.x, e.y], label: [e.x + 110, e.y + 10, 'ワイヤーに通す'] }; },
    dilPush: gripFirst(S => { const h = N().dilHub(S); return { tap: [h.x, h.y], label: [h.x + 120, h.y, 'タップで進める'] }; }),
    dilPull: gripFirst(S => { const h = N().dilHub(S); return { tap: [h.x, h.y], label: [h.x + 110, h.y, 'タップで抜く'] }; }),
    cvPush: gripFirst(S => { const h = N().cvHub(S); return { tap: [h.x, h.y], label: [h.x + 130, h.y, 'タップで進める'] }; }, 'ハブから出た尻を持つ'),
    tailBack: S => { const f = S.f, gp = N().gripPos(S); if (!f.wHold) return { tap: [gp.x, gp.y], label: [gp.x + 130, gp.y, '皮膚の所でワイヤーを持つ'] }; return { tap: [gp.x, gp.y], label: [gp.x + 130, gp.y, 'タップで引き戻す'] }; },
    wireOut: S => { const gp = N().gripPos(S); return { tap: [gp.x, gp.y], label: [gp.x - 120, gp.y - 30, 'タップでワイヤーを抜く'] }; },
    suture: S => { const p = alongU(N().entry(S), 22); return { tap: [p.x, p.y], label: [p.x + 120, p.y, '翼を皮膚に縫う'] }; },
    dress: S => { const e = N().entry(S); return { tap: [e.x, e.y - 20], label: [e.x + 120, e.y - 20, '刺入部を覆う'] }; },
  };

  // ---------- 判定 ----------
  const entryOk = (a, S) => {
    if (a.type !== 'entry') return;
    const reset = () => { S.f.needle = null; };
    const dx = a.x - N().ijX(a.y);
    if (dx > 14) { reset(); return '内側すぎる。そこは<b>総頸動脈</b>の真上。エコーで内頸静脈が画面の真ん中に来る位置から刺す。'; }
    if (dx < -18) { reset(); return '外側すぎて内頸静脈から外れている。エコーで静脈を真ん中に。'; }
    if (a.y > 330) { reset(); return '鎖骨に近すぎる。真下に<b>肺尖（胸膜）</b>があり気胸の危険。胸鎖乳突筋の三角の頂点あたりから。'; }
    if (a.y < 190) { reset(); return { warn: '高すぎる。総頸動脈と重なりやすく、固定もしにくい。三角の頂点（輪状軟骨の高さ）あたりで。' }; }
    return true;
  };
  const punctOk = (a, S) => {
    if (a.type !== 'needle') return;
    const f = S.f, reset = () => { f.needle = null; };
    if (a.st === 'tent') return { warn: '前壁が押されてつぶれている（静脈は圧で簡単に潰れる）。もう少し進めると内腔に入る。' };
    if (a.st === 'through') return { warn: '<b>後壁を貫いた</b>。陰圧をかけたまま、ゆっくり引き戻して逆流が戻る所で止める。' };
    if (a.st === 'art') { f.mishap = 'a'; reset(); return '<b>鮮紅色・拍動性</b>＝総頸動脈を刺した。針を抜いて<b>5分以上圧迫</b>。針だけなら圧迫でよいが、ダイレーターやカテーテルを動脈に入れると大出血・脳梗塞になる。'; }
    if (a.st === 'pleura') { reset(); return '針が深すぎて<b>胸膜</b>に届いた（気胸）。内頸静脈は皮膚から1〜2 cm。エコーで針先を見失ったら進めない。'; }
    return a.st === 'lumen' || undefined;
  };
  const legState = (S, k) => S.L.legs[k];
  const legDone = (S, k) => { const l = legState(S, k); return l.asp >= 1 && l.flush >= 4 && l.clamp && l.cap && !(S.L.syr && S.L.syr.leg === k); };
  // どの内腔でも：クランプを開けたまま外す＝空気塞栓
  const airGuard = ok => (a, S, st) => {
    if (a.type === 'detach' && !a.clamp) { S.L.syr = { leg: a.k, type: a.syr, vol: 1, blood: 0 }; S.L.legs[a.k].cap = false; return '<b>クランプを開けたままシリンジを外した</b>。中心静脈は吸気で陰圧になり、<b>空気を引き込む（空気塞栓）</b>。先にクランプを閉じてから外す。'; }
    if (a.type === 'clamped') return { warn: 'クランプが閉じている。先にクランプを開ける。' };
    return ok(a, S, st);
  };
  function legHint(k) {
    return S => {
      const L = S.L, lg = L.legs[k], i = L.keys.indexOf(k), y = LM().legY(L, i), lm = LM();
      if (!L.syr) { if (lg.asp >= 1 && lg.flush >= 4) return null; return L.held ? { tap: [lm.LX, y], label: [lm.LX - 70, y - 30, 'ルアーにつなぐ'] } : null; }
      if (lg.clamp && !(lg.asp >= 1 && lg.flush >= 4)) return { tap: [lm.CLX, y], label: [lm.CLX, y - 30, 'クランプを開ける'] };
      const sx = lm.stopX(L.syr);
      if (lg.asp < 1) return { tap: [sx + 75, y], label: [sx + 60, y + 34, 'タップで引く（逆血）'] };
      if (lg.flush < 4) return { tap: [sx + 75, y], label: [sx + 60, y + 34, 'タップでフラッシュ'] };
      if (!lg.clamp) return { tap: [lm.CLX, y], label: [lm.CLX, y - 30, 'クランプを閉じる'] };
      return { tap: [lm.BX + 20, y], label: [lm.BX + 40, y - 30, 'シリンジを外す'] };
    };
  }
  const salineAt = k => S => (S.L.syr || S.L.held || legDone(S, k)) ? null : 'tool-saline';

  // ---------- ステップ ----------
  function prepSteps() {
    return [
      { scene: 'quiz', card: CASE, do: '清潔操作はどこまで？', opts: [{ id: 'max', t: '帽子・マスク・滅菌ガウン・滅菌手袋・全身を覆う大きなドレープ（マキシマル・バリアプリコーション）' }, { id: 'glove', t: '滅菌手袋と穴あきドレープ' }],
        ans: 'max', wrong: { glove: 'CVはカテーテル関連血流感染の元。小さなドレープでは足りない。' },
        after: 'CDC 2011：マキシマル・バリアプリコーション（IB）、皮膚消毒は<b>0.5%を超えるクロルヘキシジン含有アルコール</b>（IA）。挿入前に<b>全内腔を生食で満たして</b>おく（空気を入れない）。' },
      { scene: 'neck', mode: 'probe', tool: 'probe', at: toolAt('probe', S => !!S.f.probe), hint: H.probe, tray: ['probe'],
        do: 'エコーのプローブを取り、胸鎖乳突筋の三角の頂点に<b>横向き（短軸）</b>で当てる', tip: '器械台のプローブを持ち、黄色い点を押す。',
        ok: a => a.type === 'probe' || undefined,
        after: '総頸動脈（丸く壁が厚い）の<b>外側・浅く</b>に、楕円の内頸静脈。' },
      { scene: 'neck', mode: 'probe', hint: H.comp, tray: ['probe'], do: 'プローブで軽く<b>圧迫</b>して、潰れる方が静脈か確かめる', tip: 'プローブを押したまま少し待つ。',
        ok: a => a.type === 'probe' ? (a.comp || undefined) : undefined, after: '静脈は簡単に潰れ、動脈は潰れず拍動する。中に<b>血栓</b>（潰れない・中にエコー）がないかも見る。' },
      { scene: 'neck', at: 'usColor', tray: ['probe'], do: '<b>Color</b>（カラードプラ）で流れを見る', ok: a => a.type === 'color' ? (a.on || undefined) : undefined,
        after: '拍動して赤〜黄に光る＝動脈、ゆっくり青＝静脈（向きの色は設定で変わるので、色より拍動で見る）。' },
      { scene: 'neck', at: 'tren', tray: ['probe'], do: '<b>頭低位</b>（トレンデレンブルグ）にして静脈を太らせる', tip: 'エコーの下の「頭低位」を押す。',
        ok: a => a.type === 'tren' ? (a.on || undefined) : undefined,
        after: '内頸静脈が太くなった。刺しやすく、穿刺中に<b>空気を引き込みにくく</b>なる（静脈圧が上がる）。' },
      { scene: 'quiz', card: CASE, do: '頭はどのくらい左へ向ける？', opts: [{ id: 'small', t: 'わずか（正面〜30°くらい）' }, { id: 'big', t: 'できるだけ大きく（60〜90°）' }], ans: 'small',
        wrong: { big: '大きく回すほど、内頸静脈が<b>総頸動脈の上に重なる</b>（動脈穿刺が増える）。' },
        after: '回しすぎない。エコーで静脈と動脈が重なっていない向きを選ぶ。' },
    ];
  }
  function punctSteps() {
    return [
      { scene: 'neck', mode: 'needle', tool: 'cvneedle', at: toolAt('cvneedle', S => !!S.f.needle), hint: H.entry,
        do: '外套針（シリンジ付き）を取り、内頸静脈の真上（三角の頂点）の皮膚に当てる', tip: '器械台の「外套針＋シリンジ」を持ち、黄色い点を押す。', ok: entryOk },
      { scene: 'neck', mode: 'needle', hint: H.advance,
        do: '陰圧をかけながら、<b>同側の乳頭の方向</b>へ進める。エコーの白い点（針先）を追い、暗赤色の逆流で止める',
        tip: '奥（画面の上）へドラッグで進み、手前で戻る。エコーは針先の高さを追いかける（短軸・交差法）。',
        caution: ['内頸静脈は皮膚から1〜2 cm。深く進めない（胸膜・動脈）', '針先を見失ったら進めない'],
        ok: punctOk, after: '<b>暗赤色・拍動なし</b>の逆流。針を動かさないよう、手を患者に置いて固定。' },
      { scene: 'neck', mode: 'inner', hint: H.inner, do: '<b>外套を残して</b>、内針をシリンジごと抜く',
        tip: 'シリンジをタップ（手前へドラッグでもよい）。',
        caution: ['外套の先は針先より少し手前。逆血が出たら針をわずかに進めてから抜くと、外套が血管内に入る', '外套が一緒に抜けないよう、ハブを押さえる'],
        ok: a => a.type === 'innerOut' ? true : a.type === 'innerMid' ? { warn: '最後まで抜く。' } : undefined,
        after: '外套のハブから暗赤色の血がにじむ。ここからは柔らかい外套の中を通すので、針先で静脈を傷つけにくい。' },
      { scene: 'neck', mode: 'reSyr', hint: H.reSyr, do: '外套にシリンジを付け直し、引いて<b>血液がスムーズに引けるか</b>確かめる',
        tip: '外套の緑のハブを押してシリンジを付け、もう一度タップして引く。',
        ok: a => a.type === 'syrOn' ? undefined : a.type === 'catAsp' ? (a.ok ? true : { warn: 'まだ足りない。もう少し引く。' }) : undefined,
        after: 'スムーズに暗赤色が引ける＝<b>外套の先が静脈の中</b>。引けない時は外套が血管から抜けている：陰圧をかけながら少しずつ引き戻して探す。外套を押し込まない（だめなら刺し直す）。' },
      { scene: 'neck', mode: 'syr', hint: H.syr, do: '外套を動かさないように、シリンジを外す', ok: a => a.type === 'syrOff' || undefined,
        caution: ['ハブを開けている間は指で塞ぐ（自発呼吸があると空気を吸い込む）'],
        after: '内頸は圧が低く、血液はにじむ程度。拍動して噴けば動脈。' },
      { scene: 'neck', mode: 'wire', tool: 'cvwire', at: toolAt('cvwire', S => !!S.f.wire), hint: H.wireIn,
        do: 'ガイドワイヤーを取り、Jの先端を外套のハブに差し込む', ok: a => a.type === 'wireIn' ? true : a.type === 'wireBlocked' ? 'シリンジが付いたまま。先に外す。' : undefined },
      { scene: 'neck', mode: 'wire', hint: H.feed, do: 'ワイヤーを送る。体内に<b>15〜18 cm</b>（20 cmの目盛が皮膚の少し外）まで',
        tip: 'タップすると16〜17 cmまで送る。モニターの心電図も見る。ドラッグで自分で送り引きしてもよい。',
        caution: ['期外収縮が出たら深すぎ（右房〜右室）。引き戻す', '抵抗があれば押さない'],
        ok: a => { if (a.type !== 'wire') return; if (a.len > 19) return { warn: '<b>期外収縮</b>が出ている＝ワイヤーが右房に入った。手前へドラッグして期外収縮が消えるまで引く。' }; return (a.len >= 12 && a.len <= 19) || undefined; },
        after: 'ワイヤーの目盛（先端から 10・20・30 cm に帯）で深さが分かる。' },
      { scene: 'neck', mode: 'confirm', at: 'usLong', do: 'エコーを<b>長軸</b>にして、ワイヤーが<b>静脈の中</b>を通っているか確かめる', tip: 'エコーの下の「長軸」を押す。',
        ok: a => a.type === 'long' ? (a.on || undefined) : undefined,
        after: '内頸静脈の中を足側へ走るワイヤー＝静脈。ASA 2020：<b>ダイレーターや太いカテーテルを入れる前に</b>、ワイヤーが静脈にあることをエコー・圧波形などで確かめる。' },
      { scene: 'neck', mode: 'needleOut', hint: H.needleOut, set: S => { S.f.long = false; },
        do: '左手でワイヤーを持ち、外套を抜く', tip: 'まずハブの上のワイヤー（黄色の輪）を押して持つ。それから外套のハブをタップ。',
        caution: ['ここからカテーテルが入るまで、ワイヤーから手を離さない'],
        ok: a => a.type === 'needleOut' || undefined },
    ];
  }
  function insSteps() {
    return [
      { scene: 'neck', mode: 'cut', tool: 'scalpel', at: toolAt('scalpel', S => S.f.cut), hint: H.cut,
        do: 'メスで刺入部の皮膚を小さく切る', caution: ['刃先は上（皮膚側）へ。ワイヤーを切らない'],
        ok: a => a.type !== 'cut' ? undefined : a.ok ? true : { warn: a.why === 'far' ? 'ワイヤーの刺入部を横切るように。' : a.why === 'short' ? '短すぎ。2〜3 mmに。' : '長すぎ。小さく。' } },
      { scene: 'neck', mode: 'dil', tool: 'cvdil', at: toolAt('cvdil', S => !!S.f.dil), hint: S => S.f.dil ? H.dilPush(S) : gripFirst(H.tapSite)(S),
        do: 'ダイレーターをワイヤーに通し、<b>皮膚から静脈の壁まで</b>（2〜3 cm）だけ押し進める', tip: '刺入部を押してワイヤーに通し、もう一度ダイレーターをタップ。目盛で深さを見る。',
        caution: ['根元まで押し込まない（静脈の後壁・胸膜・縦隔の損傷）', 'ワイヤーが一緒に入っていかないか'],
        ok: a => { if (a.type === 'dilDeep') return 'ダイレーターを深く押し込みすぎた。内頸は皮膚から1〜2 cm。<b>皮膚〜静脈壁の通り道を広げるだけ</b>で、根元まで入れると後壁・胸膜・縦隔を傷つける。'; if (a.type === 'dil') return a.s >= 1.8 || undefined; } },
      { scene: 'neck', mode: 'dil', hint: H.dilPull, do: 'ダイレーターを抜き、刺入部を軽く押さえる', ok: a => a.type === 'dilOut' || undefined },
      { scene: 'neck', mode: 'cv', tool: 'cvc4', toolMsg: 'この症例は<b>4内腔</b>が要る（ノルアドレナリン・ドブタミン／プロポフォール／アミオダロン／維持輸液＋ヘパリン）。',
        at: toolAt('cvc4', S => !!S.f.cv), hint: S => S.f.cv ? null : gripFirst(H.tapSite)(S),
        do: 'CVカテーテル（クワッド）を取り、<b>先端をワイヤーの尻に通して</b>皮膚まで滑らせる', tip: '器械台で持ち、刺入部を押す。',
        ok: (a, S) => { if (a.type !== 'cvOn') return; if (a.id !== 'cvc4') { S.f.cv = null; S.f.wHold = true; return { warn: 'この症例は<b>クワッド</b>（4内腔）。' }; } return true; },
        after: 'カテーテルを皮膚まで滑らせると、<b>遠位（茶）のハブからワイヤーの尻</b>が出てくる。' },
      { scene: 'neck', mode: 'cv', hint: H.cvPush, do: '<b>ハブから出たワイヤーの尻を持ち</b>、カテーテルを <b>16〜18 cm</b> まで進める（先端をCAJ付近＝Zone Aへ）',
        tip: 'まず茶色のハブから出たワイヤー（黄色の輪）を押して持つ。それからカテーテルをタップ。皮膚の所の目盛を読む。',
        caution: ['尻を持たずに進めない（ワイヤーの体内遺残）', '期外収縮が出たら深すぎ'],
        ok: a => { if (a.type !== 'cv') return; if (a.s > 18.5) return { warn: '深すぎる（右房の奥・期外収縮）。16〜18 cmまで引く。' }; return (a.s >= 16 && a.s <= 18.5) || undefined; },
        after: '先端の目標は<b>上大静脈と右房の境（CAJ）付近＝Zone A</b>。この患者（165 cm）では右内頸から約17 cm（身長÷10 cm の式でも16.5 cm）。体格で変わるので、最後は胸部X線で確かめる。' },
      { scene: 'neck', mode: 'cvWireOut', hint: H.wireOut, do: 'カテーテルを押さえたまま、<b>ワイヤーを抜く</b>', tip: 'ハブから出たワイヤーをタップ。',
        ok: a => a.type === 'wireOut' ? true : a.type === 'wireOutMid' ? { warn: '最後まで抜く。' } : undefined,
        after: '抜いたワイヤーは<b>先端のJまで全部あるか</b>を必ず見て、器械台に戻す（ワイヤー遺残は起きてはならない事故）。遠位の内腔から血液がにじむ＝すぐシリンジで処理する。' },
      { scene: 'neck', mode: 'suture', tool: 'suture', at: toolAt('suture', S => S.f.cv && S.f.cv.sut), hint: H.suture,
        do: '固定の翼を皮膚に縫合する', ok: a => a.type === 'suture' || undefined },
      { scene: 'neck', mode: 'dress', tool: 'dressing', at: toolAt('dressing', S => S.f.dress), hint: H.dress,
        do: '刺入部を<b>透明ドレッシング</b>で覆う', ok: a => a.type === 'dress' || undefined,
        after: 'CDC 2011：滅菌ガーゼか滅菌の透明ドレッシング。透明は7日ごと、ガーゼは2日ごとに交換（汚れ・はがれたら随時）。' },
    ];
  }
  function flushSteps() {
    const st = [
      { scene: 'lumen', tool: 'saline', at: salineAt('d'), hint: legHint('d'), do: '<b>遠位（茶）</b>：生食シリンジを取ってルアーにつなぐ', tip: '器械台のシリンジを持ち、茶色のルアーを押す。',
        ok: airGuard(a => a.type === 'attach' ? (a.k === 'd' || { warn: 'まずワイヤーが通っていた遠位（茶）から。' }) : undefined) },
      { scene: 'lumen', hint: legHint('d'), do: '押し子を<b>引いて逆血</b>を確かめる', tip: '押し子のつまみをタップ（右へドラッグでもよい）。',
        ok: airGuard(a => a.type === 'asp' ? (a.ml >= 1 || undefined) : undefined), after: '暗赤色の血液がすっと引ける＝先端が血管内。' },
      { scene: 'lumen', hint: legHint('d'), do: '押して<b>フラッシュ</b>（血液を戻し、生食で内腔を満たす）', tip: '押し子をもう一度タップ（左へドラッグでもよい）。',
        ok: airGuard((a, S) => a.type === 'flush' ? (a.ml >= 4 || undefined) : undefined) },
      { scene: 'lumen', hint: legHint('d'), do: '<b>クランプを閉じてから</b>シリンジを外す', tip: 'クランプを押して閉じ、シリンジを押して外す。',
        ok: airGuard(a => a.type === 'detach' ? true : undefined), after: '外したルアーにはキャップ（閉鎖式コネクタ）をつける。' },
    ];
    [['m', '中間（青）'], ['p', '近位（白）'], ['x', '4本目（灰）']].forEach(([k, n]) => st.push({
      scene: 'lumen', tool: 'saline', at: salineAt(k), hint: legHint(k), do: `<b>${n}</b>も同じように：つなぐ → クランプを開ける → 逆血 → フラッシュ → クランプ → 外す`,
      ok: airGuard((a, S) => legDone(S, k) || undefined),
    }));
    st[st.length - 1].after = '全部の内腔で逆血とフラッシュができた。使い始める前に胸部X線。';
    return st;
  }
  function xrSteps() {
    return [
      { scene: 'xray', showCarina: true, note: S => `カテーテルを右内頸から ${S.x.cv} cm 入れて固定した。`,
        do: '先端の位置は？', opts: [{ id: 'a', t: 'Zone A：上大静脈の下部〜CAJ（気管分岐部から椎体2つ下あたり）＝よい' }, { id: 'b', t: 'Zone B：上大静脈の上部（気管分岐部の高さより上）' }, { id: 'ra', t: '右房の奥' }], ans: 'a',
        wrong: { b: 'Zone Bなら先端は気管分岐部の線より上で止まる。', ra: '右房の奥ならCAJの線よりさらに下、心陰影の中へ深く入る。' },
        after: '目印は2本。<b>気管分岐部</b>と、そこから<b>椎体2つ下＝CAJ（上大静脈と右房の境）</b>（Baskin 2008）。今は先端を<b>CAJ付近（Zone A）</b>に置くのが主流。上部上大静脈（Zone B）より<b>血栓が少なく（調整OR 0.17）、閉塞・機能不全も少ない（RR 0.44）</b>（Imai 2026 J Anesth、メタ解析15研究・主に観察研究）。タンポナーデは稀すぎて比べられていない。右房の奥深くは不整脈・穿孔のもと。' },
      { scene: 'xray', note: '右の肺尖・肺の外側を見る。', do: '気胸は？', opts: [{ id: 'no', t: 'なし（肺紋理が胸壁まで見える）' }, { id: 'yes', t: 'あり' }], ans: 'no',
        wrong: { yes: '右の肺尖まで肺紋理がある。胸膜の線も見えない。' },
        after: '内頸は鎖骨下より気胸が少ないが、低い位置で刺すと起こる。' },
    ];
  }

  // ---------- コース ----------
  const P = {
    id: 'cvc', title: 'CVカテーテル（右内頸）', total: 0,
    icon: '<svg viewBox="0 0 48 48" width="44" height="44"><path d="M10 8 C14 20 20 28 24 44" stroke="#2f6fd0" stroke-width="5" fill="none"/><path d="M24 30 L36 18" stroke="#f3f1ea" stroke-width="4"/><path d="M36 18 L44 10 M36 18 L46 18 M36 18 L42 26" stroke="#7a4a28" stroke-width="2.5"/></svg>',
    sub: 'トリプルかクワッドかを決め、エコーガイドで右内頸静脈に入れる。ワイヤーの管理、内腔のフラッシュ、胸部X線まで',
    lead: 'エコー（短軸・長軸）と心電図モニターを見ながら、針・ワイヤー・ダイレーター・カテーテルを手で進めます。ワイヤーは黄色の輪を押して持ちます。持たずに進めるとミスになります。ワイヤー・ダイレーター・カテーテルは<b>タップすると自動で進みます</b>（ドラッグで自分で動かしてもよい）。',
    initState: () => ({ f: freshN({ tray: ['probe'] }), card: CASE }),
    chapters: [
      { title: 'どれを入れるか', desc: '内腔の数と、何をどの内腔に流すか。', lessons: [
        { id: 'cvsel', title: 'トリプルかクワッドか', sub: '混ぜられない持続の数を数える',
          steps: [
            { scene: 'quiz', card: `<div class="cc-h">救急外来</div><div class="pt-row"><span>74歳 女性</span></div><p>尿路感染からの<b>敗血症性ショック</b>。挿管はしていない。流すのは<b>ノルアドレナリン</b>、維持輸液、抗菌薬（1日数回）、採血。</p>`,
              do: '何内腔のCVにする？', opts: [{ id: 'd', t: 'ダブル〜トリプル' }, { id: 'q', t: 'クワッド（多い方が安心）' }], ans: 'd',
              wrong: { q: '使う予定のない内腔は要らない。<b>CDC 2011：必要最小限の内腔数のものを（IB）</b>。内腔が多いほど太く（クワッドは8.5Fr前後）、1本あたりは細い。' },
              after: '数え方：<b>ノルアドレナリン単独で1本</b>、<b>メイン（輸液・抗菌薬・ワンショット・採血）で1本</b>＝2本で足りる。3本目は「次に足すカテコラミンやTPN用」の予備としてトリプルにすることが多い。' },
            { scene: 'quiz', card: CASE, do: 'この症例は？', opts: [{ id: 't', t: 'トリプル' }, { id: 'q', t: 'クワッド（またはトリプル＋末梢をもう1本）' }], ans: 'q',
              wrong: { t: '混ぜられない組み合わせを数えると4つ：<b>メイン（＋ヘパリン）／カテコラミン2種／プロポフォール／アミオダロン</b>。' },
              after: 'プロポフォール（脂肪乳剤）は単独、カテコラミンの内腔にはワンショットや他の薬を入れない、アミオダロンはヘパリンと配合変化。次のレッスンで実際に割り振る。' },
            { scene: 'quiz', card: `<div class="cc-h">救急外来</div><p>外傷の<b>出血性ショック</b>。急速輸液と大量輸血をしたい。</p>`,
              do: '何を入れる？', opts: [{ id: 'q', t: 'クワッドのCV（内腔が多いので速く入る）' }, { id: 'big', t: '太く短いライン：太い末梢、または 8.5〜9Fr の太いシース（イントロデューサー）' }], ans: 'big',
              wrong: { q: 'CVの内腔は<b>長くて細い</b>。流量は半径の4乗に比例し長さに反比例するので、急速輸液には向かない。' },
              after: '急速輸液・輸血は「太く短く」。スワンガンツを入れる予定があるときもイントロデューサーを選ぶ。' },
            { scene: 'quiz', card: `<p>AKIで<b>持続透析（CHDF）</b>も始めたい。</p>`, do: 'どうする？', opts: [{ id: 'fdl', t: '透析用のカテーテル（FDLなど）を別に入れる。輸液用の内腔が付いた3内腔型もある' }, { id: 'cv', t: 'CVの1本を透析に使う' }], ans: 'fdl',
              wrong: { cv: 'CVの内腔では細すぎて透析の血流（100〜200 mL/分以上）がとれない。' }, after: '透析カテーテルの入れ方は「FDL」のコースで。' },
            { scene: 'quiz', card: `<p>どこから入れるかも決める。</p>`, do: '感染と血栓が<b>いちばん少ない</b>部位は？', opts: [{ id: 'sc', t: '鎖骨下静脈' }, { id: 'ij', t: '内頸静脈' }, { id: 'fv', t: '大腿静脈' }], ans: 'sc',
              wrong: { ij: '内頸は中間。', fv: '大腿が最も多い。CDC 2011：成人では大腿を避ける（1A）。' },
              after: '3SITES（NEJM 2015）：鎖骨下が血流感染＋症候性深部静脈血栓で最も少なく、<b>気胸は多かった</b>。実際はエコーで刺しやすく圧迫もできる<b>内頸</b>を選ぶことが多い（このアプリも右内頸）。' },
          ],
          points: ['必要最小限の内腔数（CDC IB）。混ぜられない持続の数を数える', 'カテコラミンは単独、プロポフォールは単独、アミオダロンはヘパリンと分ける', '急速輸液・輸血は太く短いライン（CVは長く細い）', '鎖骨下は感染・血栓が少ないが気胸が多い（3SITES）'] },
        { id: 'cvassign', title: '内腔に薬を割り振る', sub: 'クワッドの4本に、混ぜられない組み合わせを分ける', card: CASE,
          init: S => { S.L = LM().fresh('cvc4', { tray: [], drugs: ['main', 'nad', 'dob', 'prop', 'amio', 'hep'] }); },
          steps: [
            { scene: 'quiz', card: CASE, do: 'クワッドのCVが入った。割り振りのルールを確認する。', opts: [{ id: 'ok', t: 'カテコラミンは単独（同士はよい）／プロポフォールは単独／アミオダロンはヘパリン・ワンショットの内腔と分ける' }], ans: 'ok' },
            { scene: 'lumen', mode: 'assign', at: 'assignDone', do: '下の薬を<b>内腔へドラッグ</b>し、「これで決定」を押す',
              tip: '薬の札を、内腔の名前の横（チューブの上）まで運ぶ。',
              ok: a => a.type === 'assign' ? (a.res.ok ? true : a.res.msg) : undefined,
              after: '例：遠位（いちばん太い）＝メイン＋ヘパリン（CVP測定・輸血もここ）、中間＝アミオダロン、近位＝ノルアドレナリン＋ドブタミン、4本目＝プロポフォール。<b>TPNを始めるなら専用の内腔</b>が要る（このままでは足りない＝末梢を足すか、薬を減らしてから）。' },
          ],
          points: ['カテコラミンの内腔はワンショット・フラッシュ・他の薬に使わない（押し出されて血圧が急変）', 'プロポフォールは単独', 'アミオダロン×ヘパリンは配合変化', '遠位はいちばん太い：CVP・輸血・粘稠な輸液', 'TPNは専用の内腔'] },
      ] },
      { title: '準備', desc: '清潔・エコーで静脈を確かめる・頭低位。', lessons: [
        { id: 'cvprep', title: 'エコーで内頸静脈を確かめる', sub: '短軸 → 圧迫 → Color → 頭低位 → 頭の向き',
          init: S => { S.f = freshN({ tray: ['probe'] }); }, steps: prepSteps(),
          points: ['マキシマル・バリアプリコーション、クロルヘキシジン・アルコール', '総頸動脈の外側・浅くにある、潰れる方が内頸静脈', '頭低位で太らせる（空気塞栓の予防にも）', '頭は回しすぎない（静脈が動脈に重なる）'] },
      ] },
      { title: '穿刺とワイヤー', desc: 'エコーで針先を追い、ワイヤーは心電図を見ながら。', lessons: [
        { id: 'cvpunct', title: '刺してワイヤーを入れる', sub: '外套針で穿刺 → 内針を抜く → 再吸引 → ワイヤー15〜18 cm → 長軸で確認 → 外套を抜く',
          init: S => { S.f = freshN({ tray: ['cvneedle', 'cvwire'], tren: true, probe: { x: apx(), y: APEX_Y + 20 } }); }, steps: punctSteps(),
          points: ['三角の頂点から、同側乳頭の方向へ。静脈は浅い（1〜2 cm）', 'ワイヤーは15〜18 cm。期外収縮が出たら引く', '拡張の前に、ワイヤーが静脈の中にあることをエコー（長軸）で確認', '針を抜く時はワイヤーを持つ'] },
      ] },
      { title: 'カテーテルを入れる', desc: 'ダイレーターは浅く、カテーテルはワイヤーの尻を持って。', lessons: [
        { id: 'cvins', title: 'カテーテルを入れて固定する', sub: '皮膚切開 → ダイレーター → カテーテル16〜18 cm → ワイヤー抜去 → 固定',
          init: S => { const tray = ['scalpel', 'cvdil', 'cvc3', 'cvc4', 'suture', 'dressing']; if (S.f && S.f.wire && S.f.site) Object.assign(S.f, { tray, long: false, color: false }); else S.f = wired({ cut: false, dilDone: false, tray }); }, steps: insSteps(),
          points: ['ダイレーターは皮膚〜静脈壁まで（根元まで入れない）', 'ハブからワイヤーの尻が出てから、それを持って進める', '右内頸は16〜18 cm前後（先端をCAJ付近へ）', '抜いたワイヤーは先端まで全部あるか確かめる'] },
        { id: 'cvflush', title: '内腔のフラッシュ', sub: '逆血 → フラッシュ → クランプ → 外す（全内腔）',
          init: S => { S.L = LM().fresh(S.f && S.f.cv ? S.f.cv.id : 'cvc4', { tray: ['saline'] }); Object.assign(S.L.legs.d, { clamp: false, cap: false, drip: true }); }, steps: flushSteps(),
          points: ['全内腔で逆血を確かめてからフラッシュ', 'クランプを閉じてからシリンジを外す（空気塞栓）', '開いたルアーは放置しない'] },
        { id: 'cvxr', title: '胸部X線で確かめる', sub: '先端の位置と気胸',
          init: S => { S.x = { cv: S.f && S.f.cv ? Math.round(S.f.cv.s * 2) / 2 : 17 }; }, steps: xrSteps(),
          points: ['先端はCAJ付近（Zone A）：気管分岐部から椎体2つ下あたり', 'Zone B（上部上大静脈）は血栓・閉塞が多い', '右房の奥深くは不整脈・穿孔', '肺尖まで肺紋理があるか（気胸）'] },
      ] },
      { title: 'トラブル', desc: '起きてはいけないことを、間違えて体験する。', lessons: [
        { id: 'cvart', title: 'ワイヤーが動脈に入っていた', sub: '長軸で気づく → 拡張しない',
          init: S => { S.f = freshN({ site: { x: N().caX(APEX_Y) - 4, y: APEX_Y }, wire: { len: 15, art: true }, tren: true, probe: { x: N().caX(APEX_Y), y: APEX_Y + 20 }, tray: ['probe'] }); },
          steps: [
            { scene: 'neck', at: 'usLong', tray: ['probe'], do: '針を抜いてワイヤーが残っている。拡張の前に<b>長軸</b>で確かめる', ok: a => a.type === 'long' ? (a.on || undefined) : undefined,
              after: 'ワイヤーが<b>拍動する壁の厚い血管</b>（総頸動脈）の中にある。逆流は暗く見えても、低酸素・低血圧では動脈血も暗く、拍動も弱いことがある。' },
            { scene: 'neck', tray: ['probe'], do: 'どうする？', opts: [{ id: 'pull', t: 'ワイヤーを抜いて5〜10分圧迫。静脈を確かめて刺し直す' }, { id: 'go', t: 'このまま拡張して入れ、あとでX線で確認' }, { id: 'xr', t: 'ワイヤーを残したまま胸部X線' }], ans: 'pull',
              wrong: { go: '<b>動脈にダイレーター・カテーテルを入れると大出血・脳梗塞・気道を圧迫する血腫</b>。細いワイヤーの段階なら抜いて圧迫で済む。', xr: '確認はエコーでできた。時間をかけず抜いて圧迫。' },
              after: 'もしダイレーターやカテーテルが<b>動脈に入ってしまったら、抜かずにそのまま</b>にして血管外科・IVRへ（ASA 2020）。' },
          ],
          points: ['拡張の前に、ワイヤーが静脈にあることを長軸で確認', 'ワイヤーまでなら抜いて圧迫', '太いものが動脈に入ったら抜かずに血管外科・IVRへ'] },
        { id: 'cvtail', title: 'ワイヤーの尻が出てこない', sub: 'ワイヤーが深すぎる → 皮膚の所で引き戻す',
          init: S => { S.f = wired({ wire: { len: 38 }, tray: ['cvc4'] }); },
          steps: [
            { scene: 'neck', mode: 'cv', tool: 'cvc4', at: toolAt('cvc4', S => !!S.f.cv), hint: S => S.f.cv ? null : H.tapSite(S),
              do: 'カテーテルをワイヤーに通して皮膚まで滑らせる（モニターの心電図も見る）', tip: '器械台で持ち、刺入部を押す。',
              ok: a => a.type === 'cvOn' || undefined,
              after: '<b>ハブからワイヤーの尻が出ていない</b>。ワイヤーが深く入りすぎている（期外収縮も出ている＝右室まで）。このまま進めるとワイヤーが体内に入ってしまう。' },
            { scene: 'neck', mode: 'cv', hint: H.tailBack, do: '<b>皮膚の所でワイヤーを持ち</b>、尻が遠位のハブから出るまで引き戻す',
              tip: 'まず皮膚とカテーテル先端の間のワイヤー（黄色の輪）を押して持つ。それからもう一度タップ。',
              ok: a => a.type === 'tailOut' || undefined, after: '茶色のハブから尻が出た。持ち替えて、ここを持つ。' },
            { scene: 'neck', mode: 'cv', hint: H.cvPush, do: '尻を持って、カテーテルを16〜18 cmまで進める',
              ok: a => { if (a.type !== 'cv') return; if (a.s > 18.5) return { warn: '深すぎる（右房の奥・期外収縮）。16〜18 cmまで引く。' }; return (a.s >= 16 && a.s <= 18.5) || undefined; }, },
            { scene: 'neck', mode: 'cvWireOut', hint: H.wireOut, do: 'ワイヤーを抜き、先端まで全部あるか確かめる', ok: a => a.type === 'wireOut' || undefined },
          ],
          points: ['カテーテルを皮膚に入れる前に、ハブからワイヤーの尻が出ているか', '出ていなければ皮膚の所でワイヤーを持って引き戻す', 'ワイヤーは15〜18 cmで十分（深すぎると不整脈）'] },
        { id: 'cvdeep', title: 'X線で先端がずれた・気胸', sub: '右房の奥／浅い（Zone B）／肺尖に気胸',
          init: S => { S.x = { cv: 21 }; },
          steps: [
            { scene: 'xray', showCarina: true, note: '右内頸から21 cm で固定した。', do: '先端は？', opts: [{ id: 'ra', t: '右房の奥（深すぎる）' }, { id: 'a', t: 'Zone A（CAJ付近・よい）' }], ans: 'ra',
              wrong: { a: 'CAJの線（気管分岐部から椎体2つ下）よりさらに下、心陰影の中＝右房の奥。' } },
            { scene: 'xray', showCarina: true, note: '', do: 'どうする？', opts: [{ id: 'pull', t: '清潔に4〜5 cm 引いて固定し直す' }, { id: 'push', t: 'そのまま使う' }, { id: 'swap', t: '抜いて入れ直す' }], ans: 'pull',
              wrong: { push: '右房内は不整脈・穿孔（タンポナーデ）・血栓のもと。', swap: '引くだけで直せる。押し戻すのは不潔になるのでしない。' },
              apply: S => { S.x = { cv: 17 }; }, after: '引いて17 cm。先端はCAJ付近（Zone A）に。<b>引くのはよいが、一度出した部分を押し戻さない</b>（不潔）。' },
            { scene: 'xray', showCarina: true, set: S => { S.x = { cv: 13.5 }; }, note: '別の患者。右内頸から13.5 cm で固定した。', do: '先端は気管分岐部の線より上（Zone B）。どうする？',
              opts: [{ id: 'keep', t: '押し込まずにそのまま使い、閉塞・血栓に注意する（次回はもう少し深く）' }, { id: 'push', t: 'ドレッシングを外して2〜3 cm押し込む' }],
              ans: 'keep', wrong: { push: '一度体外に出ていた部分を押し込むのは不潔（カテーテル感染）。' },
              after: 'Zone Bでも右からのカテーテルは血管壁と平行なので使える（Stonelake 2006）。ただしZone Aより<b>血栓・閉塞が多い</b>（Imai 2026）。どうしても直すならガイドワイヤーで入れ替える。最初から深さを合わせるのが一番。' },
            { scene: 'xray', set: S => { S.x = { cv: 14, ptx: true }; }, note: '別の患者。左内頸で何度か刺し直したあと、右から入れた。', do: '何が見える？', opts: [{ id: 'ptx', t: '右の肺尖に気胸（胸膜の線の外に肺紋理がない）' }, { id: 'none', t: '異常なし' }], ans: 'ptx',
              wrong: { none: '右の肺尖：細い白い線（臓側胸膜）の外側で肺紋理が消えている。' },
              after: '刺し直しが多い・低い位置で刺した・陽圧換気中は気胸に注意。小さければ経過観察、大きい・人工呼吸中なら胸腔ドレーン。' },
          ],
          points: ['先端はCAJ付近（Zone A）', '深ければ清潔に引く（押し戻さない）', '浅い（Zone B）は押し込まない。使えるが血栓・閉塞に注意', '肺尖の胸膜の線と肺紋理を見る'] },
      ] },
      { title: '通し実技', desc: 'ヒントなし。準備から胸部X線まで。', lessons: [
        { id: 'cvexam', title: '通し実技：右内頸CV', sub: '準備 → 穿刺 → カテーテル → フラッシュ → X線', exam: true, compose: ['cvprep', 'cvpunct', 'cvins', 'cvflush', 'cvxr'],
          points: ['静脈であることを3回確かめる：エコー（圧迫・Color）、逆流の色、長軸でワイヤー', 'ワイヤーから手を離さない・尻を持って進める', 'クランプを閉じてから外す'] },
      ] },
    ],
    refs: () => `<h2>根拠にしたガイドライン・試験</h2>
      <p class="mini">推奨クラスは原文で確認したものだけ書いた。</p>
      <h3>ガイドライン</h3><ul class="pts">
        <li><b>CDC 2011 Guidelines for the Prevention of Intravascular Catheter-Related Infections</b>（O'Grady, Clin Infect Dis 2011;52:e162-93）
          — 必要最小限の内腔数（IB）／マキシマル・バリアプリコーション（IB）／0.5%を超えるクロルヘキシジン含有アルコールで消毒（IA）／エコーガイド（IB）／成人では大腿を避ける（1A）・非トンネル型は鎖骨下を（IB）／ドレッシングは透明7日・ガーゼ2日ごと</li>
        <li><b>ASA 2020 Practice Guidelines for Central Venous Access</b>（Anesthesiology 2020;132:8-43）
          — 内頸はリアルタイムのエコーガイド／ダイレーター・太いカテーテルの前にワイヤーが静脈にあることを確認（エコー・圧波形など）／動脈に太いものが入ったら抜かずに外科・IVRへ／先端位置をX線などで確認</li>
        <li><b>INS Infusion Therapy Standards of Practice</b> — 先端は成人・小児ともCAJが最も安全（本文は未確認、二次資料で確認）</li>
        <li><b>日本麻酔科学会 安全な中心静脈カテーテル挿入・管理のための手引き 2017</b> — 本文の推奨は確認できていない</li></ul>
      <h3>先端の位置</h3><ul class="pts">
        <li><b>Imai 2026</b>（J Anesth、doi:10.1007/s00540-026-03883-w）：メタ解析15研究・9,589人。Zone A（CAJ・下部上大静脈・右房上部）はZone B（上部上大静脈）より<b>血栓が少ない（調整OR 0.17, 95%CI 0.05–0.59）</b>、<b>閉塞・機能不全も少ない（RR 0.44, 0.23–0.82）</b>。Zone C（左腕頭静脈）はZone Bと差が小さい。死亡・タンポナーデは推定できず。主に観察研究</li>
        <li><b>Stonelake & Bodenham 2006</b>（Br J Anaesth）：Zone A/B/C の分類。もとは「タンポナーデを避けて心膜翻転部より上」が主流で、右からはZone B、左からはZone Aが勧められていた</li>
        <li><b>Baskin 2008</b>（JVIR）：CAJは<b>気管分岐部から椎体2つ下</b>。一般に思われているより下にある</li></ul>
      <h3>試験</h3><ul class="pts">
        <li><b>3SITES</b>（Parienti, NEJM 2015;373:1220-9）：鎖骨下・内頸・大腿の無作為化。鎖骨下で血流感染＋症候性深部静脈血栓が最少、気胸は鎖骨下で多い</li></ul>
      <h3>ガイドラインではなく実務の目安</h3><ul class="pts">
        <li>右内頸の挿入長は身長÷10 cm（Peres 1990）が目安（165 cmで16.5 cm）。体格で変わるので胸部X線で確かめる</li>
        <li>カテコラミン・プロポフォールは単独の内腔、アミオダロン×ヘパリンは配合変化、TPNは専用の内腔（ASPEN）。配合の可否は各施設の配合表で確かめる</li>
        <li>内腔の色・太さ（遠位が最も太い）はメーカーで違う</li></ul>
      <h3>日本と海外で違うところ</h3>
      <table class="cmp"><tr><th></th><th>日本</th><th>海外</th></tr>
        <tr><td>部位</td><td>エコーで刺しやすい内頸が多い</td><td>CDCは感染予防の点で鎖骨下を推す（IB）。3SITESも同じ結果、ただし気胸が多い</td></tr>
        <tr><td>先端位置</td><td colspan="2">以前は日本も海外も「気管分岐部の高さ（心膜翻転部より上）」。今は海外（INS）も日本発のメタ解析（Imai 2026）もCAJ付近（Zone A）</td></tr>
        <tr><td>PICC</td><td colspan="2">末梢から入れる中心静脈カテーテル。長期の輸液・抗菌薬では選択肢になる</td></tr>
      </table>`,
  };
  P.total = P.chapters.reduce((n, c) => n + c.lessons.length, 0);
  PS.reg(P);
  PS.CVC = { freshN, wired, placed, H, legHint, legDone, airGuard, toolAt };
})();
