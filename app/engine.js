/*
  Логіка тесту «Старт у MilTech». Цей файл редагувати не потрібно —
  усе, що змінюється, лежить у папці settings/.
  Працює і в браузері (window.Engine), і в Node.js для тестів (require).
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- допоміжне ---------- */

  const asList = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []);

  // «Писати на Python» → «писати на Python», але «ІТ-фахівець» лишається без змін
  function lowerFirst(s) {
    if (!s || s.length < 2) return s || '';
    const second = s[1];
    return second === second.toLocaleLowerCase('uk') ? s[0].toLocaleLowerCase('uk') + s.slice(1) : s;
  }

  const fill = (tpl, vars) => String(tpl).replace(/\{(\w+|[а-яієїґ]+)\}/gi, (m, k) => (k in vars ? vars[k] : m));

  function directionCodes(texts) {
    return Object.keys(texts.напрями);
  }

  function questionByRole(questions, role) {
    return questions.find((q) => q.роль === role) || null;
  }

  function chosenOptions(question, answers) {
    const ids = asList(answers.values[question.id]);
    return question.варіанти.filter((o) => ids.includes(o.id));
  }

  /* ---------- бали ---------- */

  // Максимум, який напрям може набрати: найкращий варіант у питаннях з однією відповіддю,
  // сума позитивних балів (або найкращі N за «максимум») у питаннях з кількома;
  // «рахуватиЯкОдну: true» — максимум як за одну відповідь (кілька відповідей лише додають).
  function maxPoints(questions, dirs) {
    const max = {};
    for (const d of dirs) {
      let total = 0;
      for (const q of questions) {
        const pts = q.варіанти.map((o) => (o.бали && o.бали[d]) || 0).filter((p) => p > 0).sort((a, b) => b - a);
        if (!pts.length) continue;
        if (q.тип === 'один' || q.рахуватиЯкОдну) total += pts[0];
        else total += pts.slice(0, q.максимум || pts.length).reduce((s, p) => s + p, 0);
      }
      max[d] = total;
    }
    return max;
  }

  function scoreDirections(questions, texts, answers) {
    const dirs = directionCodes(texts);
    const max = maxPoints(questions, dirs);
    const points = Object.fromEntries(dirs.map((d) => [d, 0]));
    for (const q of questions) {
      for (const o of chosenOptions(q, answers)) {
        for (const [d, p] of Object.entries(o.бали || {})) if (d in points) points[d] += p;
      }
    }
    const interests = questionByRole(questions, 'інтереси');
    const chosenInterest = new Set(
      interests ? chosenOptions(interests, answers).flatMap((o) => Object.keys(o.бали || {})) : [],
    );
    return dirs.map((d, order) => ({
      код: d,
      бали: points[d],
      максимум: max[d],
      збіг: max[d] > 0 ? Math.min(100, Math.round((points[d] / max[d]) * 100)) : 0,
      обранийУІнтересах: chosenInterest.has(d),
      порядок: order,
    }));
  }

  /* ---------- вибір напрямів ---------- */

  function rank(scores) {
    return [...scores].sort(
      (a, b) =>
        b.збіг - a.збіг ||
        Number(b.обранийУІнтересах) - Number(a.обранийУІнтересах) ||
        b.бали - a.бали ||
        a.порядок - b.порядок,
    );
  }

  function isExplorer(questions, answers, scores, rules) {
    const interests = questionByRole(questions, 'інтереси');
    const saidUnknown = interests ? chosenOptions(interests, answers).some((o) => o.незнаю) : false;
    const top = Math.max(0, ...scores.map((s) => s.збіг));
    return saidUnknown || top < rules.режимДослідникаНижче;
  }

  function selectDirections(questions, answers, scores, rules) {
    const ranked = rank(scores);
    if (isExplorer(questions, answers, scores, rules)) {
      const picks = ranked.filter((s) => s.збіг > 0).slice(0, rules.максимумНапрямів);
      for (const code of rules.стартовіНапрями) {
        if (picks.length >= rules.максимумНапрямів) break;
        const s = ranked.find((r) => r.код === code);
        if (s && !picks.includes(s)) picks.push(s);
      }
      return { режим: 'дослідник', напрями: picks.map((s) => ({ код: s.код, збіг: s.збіг, група: 0, доповнення: false })) };
    }
    const picks = ranked.filter((s) => s.збіг >= rules.показуватиВід).slice(0, rules.максимумНапрямів);
    for (const s of ranked) {
      if (picks.length >= rules.мінімумНапрямів) break;
      if (!picks.includes(s)) picks.push(s);
    }
    let group = 0;
    return {
      режим: 'звичайний',
      напрями: picks.map((s, i) => {
        if (i > 0 && picks[i - 1].збіг - s.збіг > rules.рівноцінніЯкщоРізниця) group += 1;
        return { код: s.код, збіг: s.збіг, група: group, доповнення: s.збіг < rules.показуватиВід };
      }),
    };
  }

  /* ---------- готовність ---------- */

  function readiness(questions, texts, rules, answers, dir) {
    const skillsQ = questionByRole(questions, 'навички');
    const key = (texts.напрями[dir] && texts.напрями[dir].ключовіНавички) || [];
    const have = skillsQ ? asList(answers.values[skillsQ.id]) : [];
    const label = (id) => {
      const o = skillsQ && skillsQ.варіанти.find((x) => x.id === id);
      return o ? lowerFirst(o.текст) : id;
    };
    const ticked = key.filter((id) => have.includes(id));
    let bonus = 0;
    for (const q of questions) for (const o of chosenOptions(q, answers)) bonus += o.плюсДоГотовності || 0;
    const score = Math.min(100, Math.round(key.length ? (ticked.length / key.length) * 100 : 0) + bonus);
    const r = rules.готовність;
    const level = score >= r.готовіВід ? 3 : score >= r.єФундаментВід ? 2 : 1;
    return {
      бали: score,
      рівень: level,
      вжеЄ: ticked.map(label),
      підтягнути: key.filter((id) => !have.includes(id)).slice(0, 2).map(label),
    };
  }

  /* ---------- «Чому вам» і наступні кроки ---------- */

  function reasons(questions, texts, answers, dir) {
    const found = [];
    questions.forEach((q, index) => {
      if (!q.причина) return;
      const opts = chosenOptions(q, answers).filter((o) => ((o.бали && o.бали[dir]) || 0) > 0);
      if (!opts.length) return;
      found.push({
        інтерес: q.роль === 'інтереси',
        вага: Math.max(...opts.map((o) => o.бали[dir])),
        index,
        текст: fill(q.причина, { відповідь: opts.map((o) => lowerFirst(o.текст)).join(', ') }),
      });
    });
    found.sort((a, b) => Number(b.інтерес) - Number(a.інтерес) || b.вага - a.вага || a.index - b.index);
    const list = found.slice(0, 2).map((f) => f.текст);
    return list.length ? list : [texts.результат.загальнаПричина];
  }

  function nextSteps(questions, texts, answers, dir, level) {
    let intro = texts.результат.вступЗаЗамовчуванням;
    let note = null;
    for (const q of questions) {
      for (const o of chosenOptions(q, answers)) {
        if (o.вступ) intro = o.вступ;
        if (o.порада) note = o.порада;
      }
    }
    const steps = (texts.напрями[dir].наступніКроки || {})[level] || [];
    return { вступ: intro, кроки: steps, порада: note };
  }

  /* ---------- курси ---------- */

  function isActive(course, today) {
    return course.показувати === true && /^\d{4}-\d{2}-\d{2}$/.test(course.старт || '') && course.старт >= today;
  }

  function withMark(url, mark) {
    if (!url) return '';
    if (!mark) return url;
    return url + (url.includes('?') ? '&' : '?') + mark;
  }

  function courseCandidates(courses, dir, level, today, mark) {
    return courses
      .filter((c) => isActive(c, today) && Array.isArray(c.напрями) && c.напрями.includes(dir) && c.рівень <= level + 1)
      .map((c) => ({
        курс: c,
        підходить: c.рівень <= level ? 'рекомендуємо' : 'з підготовкою',
        посилання: withMark(c.посилання, mark),
      }))
      .sort(
        (a, b) =>
          Number(a.підходить !== 'рекомендуємо') - Number(b.підходить !== 'рекомендуємо') ||
          Number(!a.посилання) - Number(!b.посилання) ||
          Number(a.курс.напрями[0] !== dir) - Number(b.курс.напрями[0] !== dir) ||
          (b.курс.пріоритет || 0) - (a.курс.пріоритет || 0) ||
          a.курс.старт.localeCompare(b.курс.старт) ||
          a.курс.назва.localeCompare(b.курс.назва),
      );
  }

  /* ---------- повний результат ---------- */

  function compute(settings, answers, today) {
    const { questions, texts, rules, courses } = settings;
    const scores = scoreDirections(questions, texts, answers);
    const selection = selectDirections(questions, answers, scores, rules);
    const used = new Set();
    const shown = selection.напрями.map((s) => {
      const r = readiness(questions, texts, rules, answers, s.код);
      const pick = courseCandidates(courses, s.код, r.рівень, today, texts.посилання.мітка).find((c) => !used.has(c.курс.назва)) || null;
      if (pick) used.add(pick.курс.назва);
      return {
        ...s,
        готовність: selection.режим === 'дослідник' ? null : r,
        причини: reasons(questions, texts, answers, s.код),
        далі: nextSteps(questions, texts, answers, s.код, selection.режим === 'дослідник' ? 1 : r.рівень),
        курс: pick,
      };
    });
    return { режим: selection.режим, напрями: shown, усіБали: scores };
  }

  /* ---------- перевірка відповідей ---------- */

  function validateAnswer(q, value, otherText) {
    const list = asList(value);
    if (!list.length) return q.тип === 'один' ? 'оберіть' : 'оберітьКілька';
    if (q.максимум && list.length > q.максимум) return 'максимум';
    const other = q.варіанти.find((o) => o.інше);
    if (other && list.includes(other.id) && !(otherText || '').trim()) return 'уточніть';
    return null;
  }

  function toggle(q, current, id) {
    const opt = q.варіанти.find((o) => o.id === id);
    if (!opt) return current;
    if (current.includes(id)) return current.filter((x) => x !== id);
    if (opt.незнаю || opt.виключний) return [id];
    const exclusive = q.варіанти.filter((o) => o.незнаю || o.виключний).map((o) => o.id);
    const next = current.filter((x) => !exclusive.includes(x));
    if (q.максимум && next.length >= q.максимум) return next;
    return [...next, id];
  }

  /* ---------- перевірка налаштувань (для check.html) ---------- */

  function validateSettings(settings, today) {
    const errors = [];
    const warnings = [];
    const { questions, texts, rules, courses } = settings;
    if (!Array.isArray(questions)) return { errors: ['Файл questions.js: не знайдено список ПИТАННЯ.'], warnings };
    if (!texts || !texts.напрями) return { errors: ['Файл texts.js: не знайдено розділ «напрями».'], warnings };
    if (!Array.isArray(courses)) return { errors: ['Файл courses.js: не знайдено список КУРСИ.'], warnings };
    const dirs = directionCodes(texts);
    const dirList = dirs.join(', ');

    const qIds = new Set();
    for (const [i, q] of questions.entries()) {
      const where = `Питання ${i + 1} («${q.текст || q.id}»)`;
      if (!q.id) errors.push(`${where}: немає id.`);
      else if (qIds.has(q.id)) errors.push(`${where}: id «${q.id}» уже використано в іншому питанні.`);
      qIds.add(q.id);
      if (!['один', 'кілька'].includes(q.тип)) errors.push(`${where}: тип має бути "один" або "кілька".`);
      if (!q.текст) errors.push(`${where}: немає тексту питання.`);
      if (!Array.isArray(q.варіанти) || q.варіанти.length < 2) {
        errors.push(`${where}: потрібно щонайменше 2 варіанти.`);
        continue;
      }
      const oIds = new Set();
      for (const o of q.варіанти) {
        if (!o.id) errors.push(`${where}: у варіанта «${o.текст}» немає id.`);
        else if (oIds.has(o.id)) errors.push(`${where}: id варіанта «${o.id}» повторюється.`);
        oIds.add(o.id);
        if (!o.текст) errors.push(`${where}: у варіанта «${o.id}» немає тексту.`);
        for (const [d, p] of Object.entries(o.бали || {})) {
          if (!dirs.includes(d)) errors.push(`${where}, варіант «${o.текст}»: невідомий напрям «${d}». Можливі: ${dirList}.`);
          if (typeof p !== 'number') errors.push(`${where}, варіант «${o.текст}»: бали мають бути числом без лапок.`);
        }
      }
      if (q.причина && !q.причина.includes('{відповідь}')) warnings.push(`${where}: у шаблоні «причина» немає {відповідь}.`);
    }
    for (const role of ['навички', 'інтереси']) {
      const n = questions.filter((q) => q.роль === role).length;
      if (n !== 1) errors.push(`Має бути рівно одне питання з роль: "${role}" (зараз ${n}).`);
    }

    const skillsQ = questionByRole(questions, 'навички');
    const skillIds = skillsQ ? skillsQ.варіанти.map((o) => o.id) : [];
    const max = maxPoints(questions, dirs);
    for (const d of dirs) {
      const t = texts.напрями[d];
      const where = `Напрям ${d}`;
      for (const f of ['назва', 'коротко', 'опис']) if (!t[f]) errors.push(`${where}: не заповнено «${f}».`);
      for (const id of t.ключовіНавички || []) {
        if (!skillIds.includes(id)) errors.push(`${where}: ключова навичка «${id}» не знайдена в питанні про навички.`);
      }
      if (!(t.ключовіНавички || []).length) errors.push(`${where}: потрібна хоча б одна ключова навичка.`);
      for (const lvl of [1, 2, 3]) {
        if (!((t.наступніКроки || {})[lvl] || []).length) errors.push(`${where}: немає наступних кроків для рівня ${lvl}.`);
      }
      if (!max[d]) errors.push(`${where}: жоден варіант відповіді не дає йому балів — напрям ніколи не з'явиться.`);
    }
    for (const d of rules.стартовіНапрями || []) if (!dirs.includes(d)) errors.push(`Правила: невідомий стартовий напрям «${d}».`);

    const names = new Set();
    for (const [i, c] of courses.entries()) {
      const where = `Курс ${i + 1} («${c.назва || 'без назви'}»)`;
      if (!c.назва) errors.push(`${where}: немає назви.`);
      else if (names.has(c.назва)) errors.push(`${where}: курс з такою назвою вже є.`);
      names.add(c.назва);
      if (!Array.isArray(c.напрями) || !c.напрями.length) errors.push(`${where}: вкажіть напрями, наприклад ["ЕЛ"].`);
      else for (const d of c.напрями) if (!dirs.includes(d)) errors.push(`${where}: невідомий напрям «${d}». Можливі: ${dirList}.`);
      if (![1, 2, 3].includes(c.рівень)) errors.push(`${where}: рівень має бути 1, 2 або 3 (без лапок).`);
      if (typeof c.показувати !== 'boolean') errors.push(`${where}: показувати має бути true або false (без лапок).`);
      if (c.показувати) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(c.старт || '')) errors.push(`${where}: дата старту має бути у форматі "2026-11-23".`);
        else if (c.старт < today) warnings.push(`${where}: дата старту ${c.старт} уже минула — курс не показується.`);
        if (!c.датаТекстом) warnings.push(`${where}: не заповнено «датаТекстом».`);
      }
      if (c.посилання && !/^https:\/\/\S+$/.test(c.посилання)) errors.push(`${where}: посилання має починатися з https:// і не містити пробілів.`);
    }
    for (const d of dirs) {
      const active = courses.filter((c) => isActive(c, today) && (c.напрями || []).includes(d));
      if (!active.length) warnings.push(`Напрям ${d}: немає жодного активного курсу — люди побачать безкоштовні матеріали.`);
      else if (!active.some((c) => c.посилання)) warnings.push(`Напрям ${d}: усі курси без посилання — люди побачать «Курс готується».`);
    }
    const survey = texts.посилання && texts.посилання.опитування;
    if (!survey) warnings.push('Посилання на опитування Typeform не задано — блок з опитуванням не показується.');
    else if (!/^https:\/\/\S+$/.test(survey)) errors.push('Посилання на опитування має починатися з https://.');
    return { errors, warnings };
  }

  return {
    compute,
    scoreDirections,
    maxPoints,
    readiness,
    selectDirections,
    courseCandidates,
    validateAnswer,
    toggle,
    validateSettings,
    lowerFirst,
    fill,
  };
});
