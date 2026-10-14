/*
  СТАТИСТИКА «СТАРТ У MILTECH» — скрипт для Google Таблиці

  Що робить:
  • приймає анонімні події з тесту й записує їх на аркуш «Події» (кожна подія — рядок);
  • збирає аркуш «Зведення»: скільки людей почали й завершили тест, на якому питанні кидають,
    які напрями випадають, які відповіді обирають, на які курси й соцмережі клікають;
  • оновлює «Зведення» за графіком:
      – перші 14 днів після вебінару — кожні 10 годин;
      – наступні 14 днів — раз на добу;
      – після 28 днів — останнє оновлення, далі збір і оновлення зупиняються самі.

  Як встановити — покроково у файлі «ЯК-РЕДАГУВАТИ.md», розділ «Статистика».
  Змінюйте тут лише дату нижче.
*/

// ▼▼▼ ДАТА Й ЧАС ПОЧАТКУ ВЕБІНАРУ (київський час). Формат: "РРРР-ММ-ДДTГГ:ХХ:00+02:00" ▼▼▼
const ПОЧАТОК = "2026-11-05T18:30:00+02:00";
// ▲▲▲ Більше нічого змінювати не потрібно ▲▲▲

const ДНІВ_ЧАСТО = 14;       // скільки днів оновлювати кожні 10 годин
const ГОДИН_ЧАСТО = 10;
const ДНІВ_РАЗ_НА_ДОБУ = 14;  // скільки днів після цього оновлювати раз на добу
const ГОДИН_РІДКО = 24;

const ДЕНЬ = 24 * 60 * 60 * 1000;
const ГОДИНА = 60 * 60 * 1000;
const КІНЕЦЬ = () => new Date(new Date(ПОЧАТОК).getTime() + (ДНІВ_ЧАСТО + ДНІВ_РАЗ_НА_ДОБУ) * ДЕНЬ);

const НАЗВИ_НАПРЯМІВ = {
  ЕЛ: "Електроніка", БС: "Безпілотні системи", РТ: "Радіо і РЕБ", МХ: "Механіка і 3D",
  ПЗ: "Софт", ТВ: "Тестування", СІ: "Системна інженерія",
};
const ПОДІЇ = ["Час", "Подія", "Сесія", "Крок", "Курс", "Канал", "Оцінка", "Тривалість, с", "Режим", "Показані напрями", "Курси в результаті", "Дані"];

/* ───────── 1. Приймання подій із тесту ───────── */
function doPost(e) {
  const now = new Date();
  if (now >= КІНЕЦЬ()) return ok_(); // після 28 днів нічого не записуємо
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return ok_(); }
  if (!d || typeof d.event !== 'string') return ok_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = аркуш_('Події', ПОДІЇ);
    sh.appendRow([
      now, d.event, String(d.session_id || '').slice(0, 40), d.step || '', d.course || '', d.channel || '', d.value || '',
      d.duration_sec || '', d.mode || '', (d.shown || []).join(', '), (d.courses || []).filter(String).join(', '),
      JSON.stringify(d).slice(0, 45000),
    ]);
  } finally { lock.releaseLock(); }
  return ok_();
}
function ok_() { return ContentService.createTextOutput('ok'); }

/* ───────── 2. Графік оновлення ───────── */
// Запускається щогодини (тригер створює функція «встановити»). Сама вирішує, чи пора оновлювати.
function щогодини() {
  const now = Date.now();
  const start = new Date(ПОЧАТОК).getTime();
  if (now < start) return;                                  // вебінар ще не почався
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('останнєОновлення') || 0);
  const днів = (now - start) / ДЕНЬ;
  if (днів >= ДНІВ_ЧАСТО + ДНІВ_РАЗ_НА_ДОБУ) {              // 28 днів минуло: фінальне оновлення і стоп
    оновитиЗведення();
    ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
    props.setProperty('зупинено', new Date().toISOString());
    return;
  }
  const інтервал = (днів < ДНІВ_ЧАСТО ? ГОДИН_ЧАСТО : ГОДИН_РІДКО) * ГОДИНА;
  if (now - last >= інтервал - 5 * 60 * 1000) оновитиЗведення(); // запас 5 хв на неточність тригера
}

// Запустіть ОДИН раз вручну після вставлення скрипту (див. інструкцію).
function встановити() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('щогодини').timeBased().everyHours(1).create();
  PropertiesService.getScriptProperties().deleteAllProperties();
  аркуш_('Події', ПОДІЇ);
  оновитиЗведення();
}

/* ───────── 3. Зведення ───────── */
function оновитиЗведення() {
  const ss = SpreadsheetApp.getActive();
  const ev = аркуш_('Події', ПОДІЇ);
  const всі = ev.getLastRow() > 1 ? ev.getRange(2, 1, ev.getLastRow() - 1, ПОДІЇ.length).getValues() : [];
  // Пробні проходження до початку вебінару лишаються на аркуші «Події», але у зведення не рахуються.
  const rows = всі.filter((r) => new Date(r[0]).getTime() >= new Date(ПОЧАТОК).getTime());
  const пробних = всі.length - rows.length;

  const сесії = (name) => new Set(rows.filter((r) => r[1] === name).map((r) => r[2]));
  const почали = сесії('quiz_started');
  const завершили = rows.filter((r) => r[1] === 'quiz_completed');
  const завершилиСесії = new Set(завершили.map((r) => r[2]));
  const лічильник = () => new Map();
  const додати = (m, k, n) => m.set(k, (m.get(k) || 0) + (n || 1));
  const відсоток = (a, b) => (b ? Math.round((a / b) * 100) + ' %' : '—');

  // воронка: до якого кроку дійшли (унікальні сесії)
  const кроки = лічильник();
  const дійшли = new Map();
  rows.filter((r) => r[1] === 'step_viewed').forEach((r) => {
    const s = Number(r[3]); if (!s) return;
    if (!(дійшли.get(r[2]) >= s)) дійшли.set(r[2], s);
  });
  почали.forEach((s) => { if (!дійшли.has(s)) дійшли.set(s, 1); });
  const maxStep = Math.max(1, ...дійшли.values());
  for (let k = 1; k <= maxStep; k++) кроки.set(k, [...дійшли.values()].filter((v) => v >= k).length);

  const тривалості = завершили.map((r) => Number(r[7])).filter((n) => n > 0 && n < 3600).sort((a, b) => a - b);
  const медіана = тривалості.length ? тривалості[Math.floor(тривалості.length / 2)] : 0;

  const головний = лічильник(), будь = лічильник(), режим = лічильник(), курсиПоказ = лічильник();
  const відповіді = new Map(); // питання → Map(варіант → кількість)
  завершили.forEach((r) => {
    let d = {}; try { d = JSON.parse(r[11]); } catch (e) {}
    const shown = d.shown || [];
    if (shown[0]) додати(головний, НАЗВИ_НАПРЯМІВ[shown[0]] || shown[0]);
    shown.forEach((c) => додати(будь, НАЗВИ_НАПРЯМІВ[c] || c));
    додати(режим, d.mode === 'дослідник' ? 'Дослідник (ще шукає)' : 'Звичайний результат');
    (d.courses || []).filter(String).forEach((c) => додати(курсиПоказ, c));
    Object.entries(d.readable || {}).forEach(([q, opts]) => {
      if (!відповіді.has(q)) відповіді.set(q, new Map());
      (opts.length ? opts : ['(без відповіді)']).forEach((o) => додати(відповіді.get(q), o));
    });
  });
  const кліки = (name, col) => { const m = лічильник(); rows.filter((r) => r[1] === name).forEach((r) => додати(m, r[col] || '—')); return m; };
  const курсиКлік = кліки('course_clicked', 4), підписки = кліки('subscribe_clicked', 5), оцінки = кліки('result_rated', 6);
  const опитування = rows.filter((r) => r[1] === 'survey_clicked').length;

  // ── запис ──
  let sh = ss.getSheetByName('Зведення');
  if (!sh) sh = ss.insertSheet('Зведення', 0);
  sh.clear();
  const out = [];
  const блок = (title, header, data) => { out.push([title, '', '']); if (header) out.push(header); data.forEach((x) => out.push(x)); out.push(['', '', '']); };
  const сорт = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);

  const start = new Date(ПОЧАТОК).getTime();
  const днів = (Date.now() - start) / ДЕНЬ;
  const графік = днів < 0 ? 'вебінар ще не почався' : днів < ДНІВ_ЧАСТО ? 'оновлюється кожні 10 годин'
    : днів < ДНІВ_ЧАСТО + ДНІВ_РАЗ_НА_ДОБУ ? 'оновлюється раз на добу' : 'збір завершено, це фінальні дані';
  out.push(['Старт у MilTech — статистика', '', '']);
  out.push(['Оновлено', Utilities.formatDate(new Date(), 'Europe/Kyiv', 'dd.MM.yyyy HH:mm'), графік]);
  if (пробних) out.push(['Пробних подій до вебінару (не враховані)', пробних, '']);
  out.push(['', '', '']);
  блок('Головне', ['Показник', 'Значення', 'Частка'], [
    ['Почали тест', почали.size, ''],
    ['Завершили тест', завершилиСесії.size, відсоток(завершилиСесії.size, почали.size)],
    ['Середній час проходження (медіана), хв', медіана ? Math.round((медіана / 60) * 10) / 10 : '—', ''],
    ['Перейшли на сторінку курсу', [...курсиКлік.values()].reduce((a, b) => a + b, 0), ''],
    ['Клікнули «Підписатися» / соцмережі', [...підписки.values()].reduce((a, b) => a + b, 0), ''],
    ['Перейшли в опитування', опитування, ''],
  ]);
  блок('Де кидають тест (скільки людей дійшли до питання)', ['Питання №', 'Людей', 'Від тих, хто почав'],
    [...кроки.entries()].map(([k, v]) => [k, v, відсоток(v, почали.size)]));
  блок('Головний напрям у результаті', ['Напрям', 'Людей', 'Частка'], сорт(головний).map(([k, v]) => [k, v, відсоток(v, завершили.length)]));
  блок('Напрям серед показаних (будь-яке місце)', ['Напрям', 'Людей', 'Частка'], сорт(будь).map(([k, v]) => [k, v, відсоток(v, завершили.length)]));
  блок('Тип результату', ['Тип', 'Людей', 'Частка'], сорт(режим).map(([k, v]) => [k, v, відсоток(v, завершили.length)]));
  блок('Курси, які тест рекомендував', ['Курс', 'Разів показано', ''], сорт(курсиПоказ).map(([k, v]) => [k, v, '']));
  блок('Кліки на курси', ['Курс', 'Кліків', ''], сорт(курсиКлік).map(([k, v]) => [k, v, '']));
  блок('Кліки «Підписатися»', ['Куди', 'Кліків', ''], сорт(підписки).map(([k, v]) => [k, v, '']));
  блок('«Результат був корисним?»', ['Відповідь', 'Людей', 'Частка'], сорт(оцінки).map(([k, v]) => [k, v, відсоток(v, [...оцінки.values()].reduce((a, b) => a + b, 0))]));
  out.push(['ВІДПОВІДІ НА ПИТАННЯ (серед тих, хто завершив; у питаннях з кількома відповідями сума більша за 100 %)', '', '']);
  out.push(['', '', '']);
  відповіді.forEach((m, q) => блок(q, ['Варіант', 'Людей', 'Частка'], сорт(m).map(([k, v]) => [k, v, відсоток(v, завершили.length)])));

  sh.getRange(1, 1, out.length, 3).setValues(out);
  sh.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  out.forEach((r, i) => {
    if (r[1] === '' && r[2] === '' && r[0] && i > 0) sh.getRange(i + 1, 1).setFontWeight('bold').setBackground('#C6F432');
    if (['Показник', 'Питання №', 'Напрям', 'Тип', 'Курс', 'Куди', 'Відповідь', 'Варіант'].includes(r[0])) sh.getRange(i + 1, 1, 1, 3).setFontColor('#666666');
  });
  sh.setColumnWidth(1, 460); sh.setColumnWidth(2, 140); sh.setColumnWidth(3, 200);
  PropertiesService.getScriptProperties().setProperty('останнєОновлення', String(Date.now()));
}

function аркуш_(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); sh.getRange(1, 1, 1, header.length).setFontWeight('bold'); }
  return sh;
}
