// sc_quiz.js — 判断の場面（症例カード＋選択肢）。選択肢そのものはエンジンが下に出す
(function () {
  let root;
  PS.scene('quiz', {
    mount(host) { root = host; host.innerHTML = '<div class="quiz"><div class="case-card" id="qCard"></div></div>'; },
    update(S, st) {
      const card = typeof st.card === 'function' ? st.card(S) : (st.card || S.card || '');
      root.querySelector('#qCard').innerHTML = card;
    },
    unmount() { },
  });
})();
