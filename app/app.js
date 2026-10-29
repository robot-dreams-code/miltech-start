/*
  Інтерфейс тесту «Старт у MilTech». Цей файл редагувати не потрібно —
  тексти, питання й курси лежать у папці settings/.
*/
(function () {
  'use strict';

  const main = document.getElementById('main');
  const T = window.ТЕКСТИ;
  const settings = { questions: window.ПИТАННЯ, rules: window.ПРАВИЛА, texts: T, courses: window.КУРСИ };
  const E = window.Engine;
  const STORAGE = 'miltech-start-v3';

  /* ---------- допоміжне ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fill = (tpl, vars) => esc(E.fill(tpl, vars));
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const ICON = {
    check: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
    alert: '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="10" r="8.5"/><path d="M10 5.5v5.5M10 14.2v.3"/></svg>',
    external: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9"/></svg>',
  };
  const newTab = '<span class="sr-only"> (відкриється в новій вкладці)</span>';
  const extLink = (href, text, cls, data = '') =>
    `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="${cls}" ${data}>${esc(text)}${ICON.external}${newTab}</a>`;
  const logo = (onDark) =>
    `<button type="button" class="logo" data-action="home" aria-label="robot_dreams — на головну тесту"><img src="app/img/${onDark ? 'logo-light' : 'logo-dark'}.png" alt="" width="240" height="145"></button>`;

  /* ---------- стан ---------- */
  let state = load() || fresh();
  function fresh() {
    return { screen: 'intro', i: 0, answers: { values: {}, other: {}, skipped: [] }, session: newId(), startedAt: Date.now(), rated: null };
  }
  function newId() {
    return (window.crypto && crypto.randomUUID && crypto.randomUUID()) || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }
  function load() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE)); } catch (e) { return null; }
  }
  function save() {
    try { sessionStorage.setItem(STORAGE, JSON.stringify(state)); } catch (e) { /* приватний режим */ }
  }
  let error = null;

  /* ---------- статистика (лише якщо налаштована) ---------- */
  function collecting() {
    const s = T.статистика || {};
    if (!s.адреса) return false;
    const now = new Date();
    if (s.початок && now < new Date(s.початок)) return false;
    if (s.кінець && now >= new Date(s.кінець)) return false;
    return true;
  }
  function track(event, data) {
    if (!collecting()) return;
    const body = JSON.stringify(Object.assign({ event, session_id: state.session, at: new Date().toISOString() }, data || {}));
    try {
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      if (!(navigator.sendBeacon && navigator.sendBeacon(T.статистика.адреса, blob))) {
        fetch(T.статистика.адреса, { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch (e) { /* статистика ніколи не ламає тест */ }
  }

  /* ---------- блоки питань ---------- */
  const A = window.Art;
  const QS = settings.questions;
  const BLOCKS = [];
  QS.forEach((q, i) => {
    const last = BLOCKS[BLOCKS.length - 1];
    if (last && last.назва === q.блок) last.кінець = i;
    else BLOCKS.push({ назва: q.блок || 'Питання', початок: i, кінець: i });
  });
  const blockOf = (i) => BLOCKS.findIndex((b) => i >= b.початок && i <= b.кінець);
  const count = (b) => b.кінець - b.початок + 1;
  const mins = (n) => Math.max(1, Math.round(n * 0.4));
  const nn = (n) => String(n).padStart(2, '0');
  // [слово] у тексті → підсвічене слово
  const mark = (t) => esc(t).replace(/\[([^\]]+)\]/g, '<span class="hl">$1</span>');

  /* ---------- верхня панель ---------- */
  function bar(kind) {
    const v = T.вступ;
    let mid = '';
    let right = '';
    if (kind === 'intro') {
      right = `<button type="button" class="btn btn--light btn--small" data-action="start">${esc(v.кнопка)} <span aria-hidden="true">→</span></button>`;
    } else {
      const done = kind === 'result';
      const b = done ? BLOCKS.length - 1 : blockOf(state.i);
      const frac = done ? 1 : (state.screen === 'block' ? state.i : state.i + 1) / QS.length;
      const C = 2 * Math.PI * 15;
      const dashes = BLOCKS.map((x, k) => {
        const inside = done || k < b ? 1 : k > b ? 0 : state.screen === 'block' ? 0.08 : (state.i - x.початок + 1) / count(x);
        return `<span><i style="width:${Math.round(inside * 100)}%"></i></span>`;
      }).join('');
      mid = `<span class="ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle cx="18" cy="18" r="15" class="ring__on" style="stroke-dasharray:${f2(C * frac)} ${f2(C)}"/></svg></span>
        <span class="bar__label"><b>${done ? '✓' : nn(b + 1)}</b> ${esc(done ? T.результат.мітка : BLOCKS[b].назва)}</span>
        <span class="dashes" aria-hidden="true">${dashes}</span>`;
      right = done
        ? `<button type="button" class="btn btn--ghost btn--small" data-action="restart">${esc(T.результат.пройтиЩе)}</button>`
        : `<span class="bar__count">${fill(T.кнопки.прогрес, { n: Math.min(state.i + 1, QS.length), всього: QS.length })}</span>`;
    }
    return `<header class="bar dark"><div class="wrap bar__in">
      ${logo(true)}${mid ? `<span class="bar__sep" aria-hidden="true"></span>${mid}` : ''}<span class="bar__right">${right}</span>
    </div></header>`;
  }
  function f2(n) { return Math.round(n * 100) / 100; }

  /* ---------- маршрут (хвиляста лінія з зупинками) ---------- */
  // stops: [{ num, title, sub, href? }]; here — індекс зупинки, де стоїть техніка
  function route(stops, here, vehicle, modern) {
    const n = stops.length;
    const ys = stops.map((_, i) => (i % 2 ? 62 : 38));
    // плавна крива через усі зупинки (Catmull-Rom → Безьє)
    const P = [[0, 50]].concat(stops.map((_, i) => [i * 100 + 50, ys[i]]), [[n * 100, 50]]);
    let d = `M${P[0][0]} ${P[0][1]}`;
    for (let k = 0; k < P.length - 1; k++) {
      const p0 = P[k - 1] || P[k], p1 = P[k], p2 = P[k + 1], p3 = P[k + 2] || p2;
      d += `C${f2(p1[0] + (p2[0] - p0[0]) / 6)} ${f2(p1[1] + (p2[1] - p0[1]) / 6)} ${f2(p2[0] - (p3[0] - p1[0]) / 6)} ${f2(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
    }
    const items = stops.map((s, i) => {
      const inner = `<span class="stop__num">${esc(s.num)}</span><span class="stop__title">${esc(s.title)}</span>${s.sub ? `<span class="stop__sub">${esc(s.sub)}</span>` : ''}`;
      return `<li class="stop ${i % 2 ? 'stop--down' : 'stop--up'}${i < here ? ' stop--done' : ''}${i === here ? ' stop--here' : ''}" style="--y:${ys[i]}%">
        <span class="stop__dot" aria-hidden="true">${i === here && vehicle ? vehicle : ''}</span>
        ${s.href ? `<a class="stop__label" href="${esc(s.href)}">${inner}</a>` : `<span class="stop__label">${inner}</span>`}
      </li>`;
    }).join('');
    return `<div class="route${modern ? ' route--modern' : ''}" style="--n:${n}">
      <svg class="route__wave" viewBox="0 0 ${n * 100} 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${modern
        ? `<defs><linearGradient id="rg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#e5e8ec" stop-opacity="0.15"/><stop offset="1" stop-color="#c6f432"/></linearGradient></defs>
          <path class="route__glow" d="${d}" stroke="url(#rg)" vector-effect="non-scaling-stroke"/><path class="route__line" d="${d}" stroke="url(#rg)" vector-effect="non-scaling-stroke"/>`
        : `<path d="${d}" vector-effect="non-scaling-stroke"/>`}</svg>
      <ol class="route__list">${items}</ol></div>`;
  }

  // Головний курс напряму для плиток на головній: спершу курси з лендингом, де напрям основний, потім за пріоритетом і датою
  function mainCourse(dir) {
    return E.courseCandidates(settings.courses, dir, 3, today(), T.посилання.мітка).find((c) => c.посилання && c.курс.напрями[0] === dir)
      || E.courseCandidates(settings.courses, dir, 3, today(), T.посилання.мітка).find((c) => c.посилання) || null;
  }

  /* ---------- головна ---------- */
  function intro() {
    const v = T.вступ;
    const sc = v.сцена;
    const dirs = Object.keys(T.напрями);
    const stops = BLOCKS.map((b, k) => ({ num: nn(k + 1), title: b.назва }));
    return `${bar('intro')}
    <section class="dark hero" aria-labelledby="hero-title">
      <div class="bgmap">${A.tacmap()}</div>
      <div class="wrap hero__in">${A.hud()}
        <h1 id="hero-title" tabindex="-1">${esc(v.заголовок)}</h1>
        <p class="hero__sub">${esc(v.підзаголовок)}</p>
        <p class="hero__time">${esc(v.час)}</p>
        <div class="hero__cta">
          <button type="button" class="btn btn--light btn--big" data-action="start">${esc(v.кнопка)} <span aria-hidden="true">→</span></button>
          <a class="btn btn--round" href="#scene" aria-label="${esc(v.гортайте)}"><span aria-hidden="true">↓</span></a>
        </div>
      </div>
      <div class="hero__ground" aria-hidden="true">${A.terrain()}<div class="hero__ugv">${A.ugv()}</div>${A.drone('hero__drone')}</div>
    </section>

    <section class="dark scene" id="scene" aria-labelledby="scene-q">
      <div class="wrap scene__grid">
        <div class="frame">${A.feed('air')}</div>
        <div class="beat__text">
          <p class="scene__lead">${mark(sc.кадр1)}</p>
          <p class="scene__q" id="scene-q"><span class="glyph" aria-hidden="true">?</span> ${mark(sc.кадр2)}</p>
          <div class="teaser" role="group" aria-labelledby="scene-q">
            ${sc.варіанти.map((o) => `<button type="button" class="teaser__opt" data-teaser="${esc(o.літера)}" aria-pressed="false"><b>${esc(o.літера)}</b><span>${esc(o.текст)}</span></button>`).join('')}
          </div>
          <div class="answer" id="answer" hidden>
            <p class="answer__verdict" data-verdict></p>
            <p class="answer__text">${mark(sc.відповідь)}</p>
            <button type="button" class="btn btn--lime" data-action="start">${esc(v.кнопка)} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </div>
    </section>

    <section class="light numbers" aria-labelledby="num-title">
      <div class="wrap numbers__grid">
        <div><h2 id="num-title">${esc(v.числоЗаголовок)}</h2><p class="numbers__text">${esc(v.числоТекст)}</p></div>
        <div class="numbers__pair" aria-hidden="true">
          <div><p class="big big--struck">${esc(v.числоБуло.число)}</p><p>${esc(v.числоБуло.підпис)}</p></div>
          <div><p class="big big--word">${esc(v.числоСтало.число)}</p><p>${esc(v.числоСтало.підпис)}</p></div>
        </div>
        <p class="sr-only">${esc(v.числоБуло.число)} ${esc(v.числоБуло.підпис)}; ${esc(v.числоСтало.число)} ${esc(v.числоСтало.підпис)}.</p>
      </div>
      ${v.ролі && v.ролі.length ? `<div class="roles" role="group" aria-label="${esc(v.роліЗаголовок)}">
        ${[0, 1].map((r) => { const part = v.ролі.filter((_, k) => k % 2 === r); return `<div class="roles__row${r ? ' roles__row--rev' : ''}"><ul class="roles__track">${part.concat(part).map((x, k) => `<li${k >= part.length ? ' aria-hidden="true"' : ''}>${esc(x)}</li>`).join('')}</ul></div>`; }).join('')}
      </div>` : ''}
      <div class="wrap">
        <h3 class="dirs__title">${esc(v.напрямиЗаголовок)}</h3>
        <ol class="tiles">
          ${dirs.map((d, i) => {
            const c = mainCourse(d);
            const inner = `<span class="tile__num">${nn(i + 1)}</span><span class="tile__name">${esc(T.напрями[d].коротко)}</span>${c ? `<span class="tile__course">${esc(v.доКурсу)}: ${esc(c.курс.назва)} ${ICON.external}</span>` : ''}`;
            return `<li>${c
              ? `<a class="tile" href="${esc(c.посилання)}" target="_blank" rel="noopener noreferrer" title="${esc(T.напрями[d].опис)}" data-course="${esc(c.курс.назва)}">${inner}${newTab}</a>`
              : `<div class="tile" title="${esc(T.напрями[d].опис)}">${inner}</div>`}</li>`;
          }).join('')}
        </ol>
      </div>
    </section>

    <section class="dark routebox" aria-labelledby="route-title">
      <div class="bgmap bgmap--soft">${A.tacmap()}</div>
      <div class="wrap">
        <div class="routebox__head"><h2 id="route-title">${esc(v.маршрутЗаголовок)}</h2>
          ${v.маршрутПідпис ? `<p>${esc(v.маршрутПідпис)}</p>` : ''}</div>
        ${route(stops, 0, A.drone('mini'))}
        <div class="routebox__cta">
          <button type="button" class="btn btn--lime btn--big" data-action="start">${esc(v.кнопкаВнизу)} <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </section>`;
  }

  /* ---------- заставка блоку ---------- */
  function blockScreen() {
    const k = blockOf(state.i);
    const b = BLOCKS[k];
    const Z = T.заставка;
    const stops = BLOCKS.map((x, j) => ({ num: nn(j + 1), title: x.назва }));
    return `${bar('q')}
    <section class="dark splash" aria-labelledby="block-title">
      <div class="bgmap">${A.tacmap()}</div>
      <div class="wrap splash__in">${A.hud(['REC', `БЛОК ${nn(k + 1)}/${nn(BLOCKS.length)}`, count(b) > 1 ? `ПИТАННЯ ${nn(state.i + 1)}–${nn(b.кінець + 1)}` : `ПИТАННЯ ${nn(state.i + 1)}`, 'LINK 98 %'])}
        <p class="hero__num" aria-hidden="true">${nn(k + 1)}</p>
        <h1 id="block-title" tabindex="-1"><span class="sr-only">Блок ${k + 1} з ${BLOCKS.length}: </span>${esc(b.назва)}</h1>
        ${(T.блоки || {})[b.назва] ? `<p class="splash__text">${esc(T.блоки[b.назва])}</p>` : ''}
        <div class="hero__cta">
          <button type="button" class="btn btn--ghost" data-action="back">${esc(Z.назад)}</button>
          <button type="button" class="btn btn--lime btn--big" data-action="go">${esc(Z.кнопка)} <span aria-hidden="true">→</span></button>
        </div>
        <div class="splash__route">${route(stops, k, k >= 3 ? A.ugv('mini') : A.drone('mini'))}</div>
      </div>
    </section>`;
  }

  /* ---------- питання ---------- */
  function question() {
    const q = QS[state.i];
    const many = q.тип === 'кілька';
    const chosen = [].concat(state.answers.values[q.id] || []);
    const atLimit = many && q.максимум && chosen.length >= q.максимум;
    const otherOpt = q.варіанти.find((o) => o.інше);
    const otherChosen = otherOpt && chosen.includes(otherOpt.id);
    const otherText = state.answers.other[q.id] || '';
    const last = state.i === QS.length - 1;
    const special = (o) => o.інше || o.незнаю || o.виключний;
    const options = q.варіанти.map((o) => {
      const checked = chosen.includes(o.id);
      const disabled = atLimit && !checked && !o.незнаю && !o.виключний;
      const solo = many && (o.незнаю || o.виключний); // знімає інші варіанти — показуємо як радіокнопку
      return `<label class="option option--${many && !solo ? 'many' : 'one'}${special(o) ? ' option--special' : ''}">
        <input type="${many ? 'checkbox' : 'radio'}" name="${esc(q.id)}" value="${esc(o.id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <span class="mark" aria-hidden="true">${ICON.check}</span><span>${esc(o.текст)}</span></label>`;
    }).join('');
    const errText = error ? fill(T.помилки[error] || error, { n: q.максимум || '' }) : '';
    return `${bar('q')}
    <div class="qpage">
      <form class="wrap qwrap question" data-form novalidate>
        <div>
          <p class="qnum"><span aria-hidden="true">${nn(state.i + 1)}</span><span class="sr-only">Питання ${state.i + 1} з ${QS.length}</span></p>
          <h1 id="q-title" tabindex="-1">${esc(q.текст)}</h1>
          ${q.підказка ? `<p class="hint" id="q-hint">${esc(q.підказка)}</p>` : ''}
        </div>
        <fieldset class="options${q.варіанти.length > 5 ? ' options--grid' : ''}" aria-labelledby="q-title" ${q.підказка ? 'aria-describedby="q-hint"' : ''}>${options}</fieldset>
        ${otherChosen ? `<div class="field">
          <label for="other">Ваш варіант</label>
          <input id="other" type="text" maxlength="100" value="${esc(otherText)}" aria-describedby="other-meta" ${error === 'уточніть' ? 'aria-invalid="true"' : ''}>
          <div class="meta" id="other-meta"><span data-count>${otherText.length} / 100</span></div>
        </div>` : ''}
        ${error ? `<div class="notice notice--error" role="alert">${ICON.alert}<div>${errText}</div></div>` : ''}
        <div class="qnav">
          <button type="button" class="btn btn--white" data-action="back">${esc(T.кнопки.назад)}</button>
          <div class="qnav__right">
            <button type="button" class="btn btn--link" data-action="skip">${esc(T.кнопки.пропустити)}</button>
            <button type="submit" class="btn btn--dark">${esc(last ? T.кнопки.показати : T.кнопки.далі)} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </form>
    </div>`;
  }

  /* ---------- результат ---------- */
  function subscribe(dark) {
    const L = T.посилання;
    const socials = (L.соцмережі || []).filter((x) => x.посилання)
      .map((x) => `<li>${extLink(x.посилання, x.назва, `btn btn--small ${dark ? 'btn--ghost' : 'btn--white'}`, `data-subscribe="${esc(x.назва)}"`)}</li>`).join('');
    return `<div class="subscribe">
      ${L.розсилка ? extLink(L.розсилка, T.результат.підписатися, 'btn btn--lime lime-btn', 'data-subscribe="розсилка"') : ''}
      ${socials ? `<ul class="subscribe__socials">${socials}</ul>` : ''}
    </div>`;
  }

  function courseBlock(d, dark) {
    const R = T.результат;
    const c = d.курс;
    if (!c) {
      const mats = (T.безкоштовніМатеріали || []).filter((m) => m.посилання)
        .map((m) => `<li>${extLink(m.посилання, m.назва, '')}</li>`).join('');
      return `<div class="course">
        ${mats ? `<p>${esc(R.немаєКурсу)}</p><ul>${mats}</ul>` : ''}
        <p>${esc(R.немаєКурсуАнонс)}</p>
        ${subscribe(dark)}
      </div>`;
    }
    const k = c.курс;
    const ready = c.підходить === 'рекомендуємо';
    const live = !!c.посилання;
    const fit = `<li class="pill ${ready ? 'pill--lime' : dark ? 'pill--outline' : 'pill--light'}">${esc(ready ? R.рекомендуємо : R.зПідготовкою)}</li>`;
    const status = live
      ? `<li class="pill pill--outline">${fill(R.старт, { дата: k.датаТекстом })}</li>`
      : `<li class="pill pill--soon">${esc(R.вРозробці)}</li>`;
    return `<div class="course">
      <ul class="pills">${fit}${status}</ul>
      <p class="muted">${esc(R.курс)}</p>
      <p class="course__name">${esc(k.назва)}</p>
      ${!live && k.датаТекстом ? `<p class="muted">${fill(R.орієнтовно, { дата: k.датаТекстом })}</p>` : ''}
      ${k.примітка ? `<p>${esc(k.примітка)}</p>` : ''}
      ${!ready ? `<p>${esc(R.порадаПідготовка)}</p>` : ''}
      ${live
        ? extLink(c.посилання, R.детальніше, 'btn btn--lime lime-btn', `data-course="${esc(k.назва)}"`)
        : `<p>${esc(R.анонсТекст)}</p>${subscribe(dark)}`}
    </div>`;
  }

  // Відповіді текстом для таблиці статистики: { "Текст питання": ["Варіант", …] }. Поле «Інше» не надсилаємо — там може бути що завгодно.
  function readableAnswers() {
    const out = {};
    for (const q of settings.questions) {
      const v = state.answers.values[q.id];
      const ids = v == null ? [] : [].concat(v);
      out[q.текст] = state.answers.skipped.includes(q.id) ? ['(пропущено)']
        : ids.map((id) => { const o = q.варіанти.find((x) => x.id === id); return o ? o.текст : id; });
    }
    return out;
  }

  // «Переглянути всі збіги»: усі напрями від найбільшого збігу до найменшого, з курсом під рівень людини
  function allMatches(res) {
    const R = T.результат;
    const shown = new Set(res.напрями.map((d) => d.код));
    const ranked = [...res.усіБали].sort((a, b) => b.збіг - a.збіг || Number(b.обранийУІнтересах) - Number(a.обранийУІнтересах) || b.бали - a.бали || a.порядок - b.порядок);
    const rows = ranked.map((sc, i) => {
      const lvl = E.readiness(settings.questions, T, settings.rules, state.answers, sc.код).рівень;
      const c = E.courseCandidates(settings.courses, sc.код, lvl, today(), T.посилання.мітка).find((x) => x.посилання)
        || E.courseCandidates(settings.courses, sc.код, lvl, today(), T.посилання.мітка)[0];
      const course = !c ? `<span class="muted">${esc(R.курсуНемає)}</span>`
        : c.посилання ? extLink(c.посилання, c.курс.назва, 'match__link', `data-course="${esc(c.курс.назва)}"`)
        : `<span>${esc(c.курс.назва)}</span> <span class="pill pill--soon">${esc(R.вРозробці)}</span>`;
      return `<li class="match${shown.has(sc.код) ? ' match--shown' : ''}">
        <span class="match__rank">${nn(i + 1)}</span>
        <span class="match__name"><b>${esc(T.напрями[sc.код].назва)}</b><span class="match__bar" aria-hidden="true"><i style="width:${sc.збіг}%"></i></span></span>
        <span class="match__pct">${sc.збіг} %</span>
        <span class="match__course"><span class="muted">${esc(R.курсНапряму)}:</span> ${course}</span>
      </li>`;
    }).join('');
    return `<details class="allmatch" data-allmatch>
      <summary><span>${esc(R.усіЗбігиКнопка)}</span><span class="allmatch__count">${ranked.length}</span></summary>
      <p class="muted">${esc(R.усіЗбігиТекст)}</p>
      <ol class="matches">${rows}</ol>
    </details>`;
  }

  // Форма тем для курсів: окремий блок поруч з акцією
  function surveyUrl(res) {
    const base = T.посилання.опитування;
    const top = res.напрями[0];
    const params = {
      direction: top ? T.напрями[top.код].коротко : '',
      directions: res.напрями.map((d) => T.напрями[d.код].коротко).join(', '),
      source: 'miltech_start',
    };
    // Typeform читає приховані поля з частини після «#»; пробіли кодуємо як %20, а не «+»
    const hash = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${base.split('#')[0]}#${hash}`;
  }
  function surveyBlock(res) {
    if (!T.посилання.опитування) return '';
    const S = T.опитування;
    return `<section class="offer offer--dark dark" aria-labelledby="survey-title">
      <div><h2 id="survey-title">${esc(S.заголовок)}</h2><p>${esc(S.текст)}</p></div>
      ${extLink(surveyUrl(res), S.кнопка, 'btn btn--lime lime-btn', 'data-survey')}
    </section>`;
  }

  // Акція (Skill Pack): показується, поки не вимкнена і не минула дата «до»
  function promoBlock() {
    const P = T.акція;
    if (!P || !P.показувати || !P.посилання || (P.до && today() > P.до)) return '';
    const tag = T.посилання.мітка;
    const url = tag ? `${P.посилання}${P.посилання.includes('?') ? '&' : '?'}${tag}` : P.посилання;
    return `<section class="offer offer--lime" aria-labelledby="promo-title">
      <div>${P.мітка ? `<p class="promo__tag">${esc(P.мітка)}</p>` : ''}<h2 id="promo-title">${esc(P.заголовок)}</h2><p>${esc(P.текст)}</p></div>
      ${extLink(url, P.кнопка, 'btn btn--dark', 'data-promo')}
    </section>`;
  }

  function result() {
    const R = T.результат;
    const res = E.compute(settings, state.answers, today());
    if (!state.reported) {
      state.reported = true;
      save();
      track('quiz_completed', {
        answers: state.answers.values, other: state.answers.other, skipped: state.answers.skipped,
        duration_sec: Math.round((Date.now() - state.startedAt) / 1000), mode: res.режим,
        scores: Object.fromEntries(res.усіБали.map((s) => [s.код, s.збіг])),
        shown: res.напрями.map((d) => d.код), courses: res.напрями.map((d) => (d.курс ? d.курс.курс.назва : '')),
        readable: readableAnswers(),
      });
    }
    const explorer = res.режим === 'дослідник';
    const top = res.напрями.filter((d) => d.група === 0).length;
    const lead = explorer ? esc(R.дослідникТекст) : top >= 2 ? fill(R.рівноцінні, { n: top }) : esc(R.одинГоловний);

    const g0 = res.напрями[0] && res.напрями[0].готовність;
    const lastCourse = res.напрями.map((d) => d.курс).find(Boolean);
    const stops = [{ num: 'СТАРТ', title: R.мапаСтарт, sub: g0 ? T.рівні[g0.рівень].назва : '' }]
      .concat(res.напрями.map((d, i) => ({ num: `НАПРЯМ ${nn(i + 1)}`, title: T.напрями[d.код].коротко, sub: explorer ? '' : `${d.збіг} % ${R.збіг.toLowerCase()}`, href: `#card-${i}` })))
      .concat([{ num: 'ФІНІШ', title: lastCourse ? lastCourse.курс.назва : R.мапаБезКурсу, sub: lastCourse ? R.мапаФініш : '', href: '#card-0' }]);
    const cards = res.напрями.map((d, i) => {
      const t = T.напрями[d.код];
      const dark = i === 0 || (!explorer && d.група === 0);
      const g = d.готовність;
      const tag = !explorer && d.група > 0 ? `<ul class="pills"><li class="pill pill--light">${esc(d.доповнення ? R.вартоПодивитися : R.такожПідходить)}</li></ul>` : '';
      const facts = !explorer ? `<div class="facts">
          <div class="fact fact--dark"><span class="fact__label">${esc(R.збіг)}</span><span class="fact__value">${d.збіг} %</span></div>
          <div class="fact fact--dark"><span class="fact__label">${esc(R.готовність)}</span><span class="fact__value">${esc(T.рівні[g.рівень].назва)}</span></div>
          <div class="fact fact--lime"><span class="fact__label">${esc(R.курс)}</span><span class="fact__value">${esc(d.курс ? d.курс.курс.назва : 'Безкоштовні матеріали')}</span></div>
        </div>` : '';
      return `<article class="card" id="card-${i}" aria-labelledby="dir-${i}">
        ${tag}
        <div class="card__plate ${dark ? 'card__plate--dark dark' : 'card__plate--light'}">
          <div class="card__title"><p class="card__num" aria-hidden="true">${nn(i + 1)}</p><h2 id="dir-${i}">${esc(t.назва)}</h2><p class="muted">${esc(t.опис)}</p></div>
          ${facts}
          <div class="card__cols">
            <div style="display:grid;gap:28px;align-content:start">
              <section><h3>${esc(R.чомуВам)}</h3><ul>${d.причини.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
              ${g ? `<section><h3>${esc(R.готовність)}</h3>
                <p>${esc(T.рівні[g.рівень].текст)}</p>
                ${g.вжеЄ.length ? `<p><strong>${esc(R.вжеЄ)}:</strong> ${esc(g.вжеЄ.join('; '))}.</p>` : ''}
                ${g.підтягнути.length ? `<p><strong>${esc(R.вартоПідтягнути)}:</strong> ${esc(g.підтягнути.join('; '))}.</p>` : ''}
              </section>` : ''}
            </div>
            <section><h3>${esc(R.щоВивчити)}</h3>
              <p>${esc(d.далі.вступ)}</p>
              <ol>${d.далі.кроки.map((x) => `<li><span>${esc(x)}</span></li>`).join('')}</ol>
              ${d.далі.порада ? `<p class="muted">${esc(d.далі.порада)}</p>` : ''}
            </section>
          </div>
          ${courseBlock(d, dark)}
        </div>
      </article>`;
    }).join('');

    const survey = surveyBlock(res);
    const promo = promoBlock();

    return `${bar('result')}
    <section class="dark rhead" aria-labelledby="result-title">
      <div class="bgmap bgmap--soft">${A.tacmap()}</div>
      <div class="wrap rhead__in">
        <h1 id="result-title" tabindex="-1">${esc(explorer ? R.дослідникЗаголовок : R.заголовок)}</h1>
        <p class="rhead__lead">${lead}</p>
        <div class="mapframe">${route(stops, res.напрями.length + 1, A.drone('mini'), true)}</div>
      </div>
    </section>
    <div class="wrap results">
      ${cards}
      ${allMatches(res)}
      ${promo || survey ? `<div class="offers${promo && survey ? ' offers--two' : ''}">${promo}${survey}</div>` : ''}
      <section class="closing" aria-labelledby="rate-title">
        <h2 id="rate-title">${esc(R.корисний)}</h2>
        <div class="row rating" role="group" aria-labelledby="rate-title">
          ${R.оцінки.map((o) => `<button type="button" class="btn btn--white" data-rate="${esc(o)}" aria-pressed="${state.rated === o}">${esc(o)}</button>`).join('')}
          ${state.rated ? `<span class="muted" role="status">${esc(R.дякуємо)}</span>` : ''}
        </div>
        <div class="row">
          <button type="button" class="btn btn--dark" data-action="restart">${esc(R.пройтиЩе)}</button>
          <button type="button" class="btn btn--link" data-action="share">${esc(R.поділитися)}</button>
        </div>
      </section>
    </div>`;
  }

  /* ---------- рендер ---------- */
  function render(focus) {
    main.innerHTML = state.screen === 'intro' ? intro() : state.screen === 'block' ? blockScreen() : state.screen === 'q' ? question() : result();
    document.body.dataset.screen = state.screen;
    save();
    if (focus === 'title') {
      const id = { q: 'q-title', block: 'block-title', result: 'result-title', intro: 'hero-title' }[state.screen];
      const t = document.getElementById(id);
      if (t) t.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } else if (focus) {
      const el = main.querySelector(focus);
      if (el) el.focus();
    }
  }

  function go(screen, i) {
    error = null;
    state.screen = screen;
    if (typeof i === 'number') state.i = i;
    render('title');
  }

  /* ---------- події ---------- */
  main.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action],[data-rate],[data-course],[data-survey],[data-subscribe],[data-teaser],[data-promo]');
    if (!t) return;
    if (t.dataset.rate) {
      state.rated = t.dataset.rate;
      track('result_rated', { value: t.dataset.rate });
      render(`[data-rate="${t.dataset.rate}"]`);
      return;
    }
    if ('teaser' in t.dataset) return teaser(t.dataset.teaser);
    if (t.dataset.course) return track('course_clicked', { course: t.dataset.course });
    if ('survey' in t.dataset) return track('survey_clicked');
    if (t.dataset.subscribe) return track('subscribe_clicked', { channel: t.dataset.subscribe });
    if ('promo' in t.dataset) return track('promo_clicked', { promo: 'skill_pack' });
    const q = settings.questions[state.i];
    switch (t.dataset.action) {
      case 'start':
      case 'restart':
        if (t.dataset.action === 'restart') track('quiz_restarted');
        state = fresh();
        track('quiz_started');
        go('block', 0);
        break;
      case 'go':
        go('q', state.i);
        break;
      case 'back':
        if (state.screen === 'block') state.i === 0 ? go('intro') : go('q', state.i - 1);
        else if (BLOCKS[blockOf(state.i)].початок === state.i) go('block', state.i);
        else go('q', state.i - 1);
        break;
      case 'skip':
        delete state.answers.values[q.id];
        delete state.answers.other[q.id];
        if (!state.answers.skipped.includes(q.id)) state.answers.skipped.push(q.id);
        next();
        break;
      case 'home':
        if (state.screen === 'intro') window.scrollTo({ top: 0, behavior: 'smooth' });
        else go('intro');
        break;
      case 'share': {
        const url = location.href.split('#')[0].split('?')[0];
        const done = () => { t.textContent = T.результат.скопійовано; };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => window.prompt('Скопіюйте посилання:', url));
        else window.prompt('Скопіюйте посилання:', url);
        break;
      }
    }
  });

  main.addEventListener('toggle', (e) => {
    if (e.target.matches && e.target.matches('[data-allmatch]') && e.target.open) track('all_matches_opened');
  }, true);

  main.addEventListener('change', (e) => {
    const input = e.target;
    if (!input.name || state.screen !== 'q') return;
    const q = settings.questions[state.i];
    const current = [].concat(state.answers.values[q.id] || []);
    state.answers.values[q.id] = q.тип === 'кілька' ? E.toggle(q, current, input.value) : input.value;
    state.answers.skipped = state.answers.skipped.filter((x) => x !== q.id);
    error = null;
    render(`input[name="${q.id}"][value="${input.value}"]`);
  });

  main.addEventListener('input', (e) => {
    if (e.target.id !== 'other') return;
    const q = settings.questions[state.i];
    state.answers.other[q.id] = e.target.value;
    const count = main.querySelector('[data-count]');
    if (count) count.textContent = `${e.target.value.length} / 100`;
    save();
  });

  main.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = settings.questions[state.i];
    error = E.validateAnswer(q, state.answers.values[q.id], state.answers.other[q.id]);
    if (error) return render(error === 'уточніть' ? '#other' : null);
    next();
  });

  function next() {
    if (state.i + 1 < QS.length) {
      track('step_viewed', { step: state.i + 2 });
      go(blockOf(state.i + 1) !== blockOf(state.i) ? 'block' : 'q', state.i + 1);
    } else {
      state.reported = false;
      go('result');
    }
  }

  // Сцена на головній: відповідь на «Як ви думаєте?» відкривається без перемальовування сторінки
  function teaser(letter) {
    const sc = T.вступ.сцена;
    main.querySelectorAll('[data-teaser]').forEach((b) => { if (b.classList.contains('teaser__opt')) b.setAttribute('aria-pressed', String(b.dataset.teaser === letter)); });
    const pick = sc.варіанти.find((o) => o.літера === letter);
    const box = document.getElementById('answer');
    const verdict = box.querySelector('[data-verdict]');
    verdict.textContent = pick ? (pick.правильний ? sc.правильно : sc.неправильно) : '';
    verdict.hidden = !pick;
    main.querySelectorAll('.teaser__opt').forEach((b) => {
      const o = sc.варіанти.find((x) => x.літера === b.dataset.teaser);
      b.classList.toggle('is-right', !!o.правильний);
      b.classList.toggle('is-wrong', !o.правильний && b.dataset.teaser === letter);
    });
    box.hidden = false;
    box.setAttribute('tabindex', '-1');
    box.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  render();
})();
