// Запуск: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../app/engine.js');
const load = require('./load-settings.js');

const S = load();
const TODAY = '2026-11-05';
const A = (values, other = {}) => ({ values, other, skipped: [] });
const run = (answers, today = TODAY, settings = S) => Engine.compute(settings, answers, today);
const byCode = (res) => Object.fromEntries(res.усіБали.map((s) => [s.код, s.збіг]));

const olena = A({
  who: 'it_qa', education: 'it_cs', skills: ['prog', 'python', 'testing', 'english'], practice: ['testing'],
  experience: 'y3plus', interests: ['tv', 'pz', 'bs'], platforms: ['air'], hands_or_code: 'code',
  role: 'check', workplace: 'computer', time: 'h6_10', goal: 'change_career',
});

test('налаштування без помилок', () => {
  const { errors } = Engine.validateSettings(S, TODAY);
  assert.deepEqual(errors, []);
});

test('максимум балів рахується автоматично', () => {
  const max = Engine.maxPoints(S.questions, Object.keys(S.texts.напрями));
  assert.deepEqual(max, { ЕЛ: 21, БС: 20, РТ: 19, МХ: 18, ПЗ: 18, ТВ: 18, СІ: 15, РЗ: 17, КБ: 17, ДА: 20 });
});

test('Олена: ТВ і ПЗ рівноцінні, БС третій; готовність і курси', () => {
  const r = run(olena);
  assert.equal(r.режим, 'звичайний');
  assert.deepEqual(byCode(r), { ЕЛ: 0, БС: 50, РТ: 0, МХ: 0, ПЗ: 78, ТВ: 83, СІ: 13, РЗ: 18, КБ: 35, ДА: 30 });
  assert.deepEqual(r.напрями.map((d) => [d.код, d.група]), [['ТВ', 0], ['ПЗ', 0], ['БС', 1]]);
  assert.deepEqual(r.напрями.map((d) => d.готовність.рівень), [3, 3, 2]);
  assert.deepEqual(r.напрями.map((d) => d.курс && d.курс.курс.назва), ['Drone Testing Engineer', 'C++ for Military Technology', 'Navigation System Engineering']);
  assert.ok(r.напрями[0].курс.посилання.includes('utm_source=miltech_start'));
  assert.match(r.напрями[0].причини[0], /^Вам цікаво знайти слабке місце системи/);
  assert.match(r.напрями[0].причини[1], /^Ви вже пробували тестувати пристрої/);
  assert.deepEqual(r.напрями[0].готовність.підтягнути, ['паяти й збирати схеми, працювати з мультиметром']);
});

test('аналітикиня з досвідом: OSINT і аналітика даних, курси з нових напрямів', () => {
  const r = run(A({ who: 'analyst', education: 'nontech', skills: ['data', 'research', 'english'], practice: ['osint', 'dashboards'],
    experience: 'y1_3', interests: ['rz', 'da'], platforms: ['info'], hands_or_code: 'code', role: 'analyze', workplace: 'computer', time: 'h3_6', goal: 'change_career' }));
  assert.deepEqual(r.напрями.slice(0, 2).map((d) => d.код).sort(), ['ДА', 'РЗ']);
  assert.ok(r.напрями.every((d) => d.курс));
  const names = r.напрями.map((d) => d.курс.курс.назва);
  assert.ok(names.some((n) => /OSINT|GEOINT/.test(n)));
  assert.ok(!names.includes('Payment Analytics'));
});

test('кібербезпека: пентест для того, хто вже в безпеці', () => {
  const r = run(A({ who: 'security', education: 'it_cs', skills: ['netsec', 'prog', 'python', 'english'], practice: ['ctf'],
    experience: 'y3plus', interests: ['kb'], platforms: ['info'], hands_or_code: 'code', role: 'check', workplace: 'computer', time: 'h6_10', goal: 'strengthen' }));
  assert.equal(r.напрями[0].код, 'КБ');
  assert.equal(r.напрями[0].курс.курс.назва, 'Cybersecurity of Military Systems');
});

test('детермінованість: однакові відповіді — однаковий результат', () => {
  assert.deepEqual(run(olena), run(olena));
});

test('усе «Поки не знаю» → «Дослідник» зі стартовими напрямами, без готовності', () => {
  const r = run(A({ who: 'unknown', education: 'unknown', skills: ['none'], practice: ['none'], experience: 'none',
    interests: ['unknown'], platforms: ['any'], hands_or_code: 'unknown', role: 'unknown', workplace: 'unknown', time: 'unknown', goal: 'unknown' }));
  assert.equal(r.режим, 'дослідник');
  assert.deepEqual(r.напрями.map((d) => d.код), ['ЕЛ', 'ПЗ', 'БС']);
  assert.ok(r.напрями.every((d) => d.готовність === null));
});

test('усі питання пропущено → «Дослідник», без помилок', () => {
  const r = run(A({}));
  assert.equal(r.режим, 'дослідник');
  assert.equal(r.напрями.length, 3);
});

test('«Поки не знаю» в інтересах вмикає «Дослідника» навіть з досвідом', () => {
  const r = run(A({ ...olena.values, interests: ['unknown'] }));
  assert.equal(r.режим, 'дослідник');
});

test('лише один напрям від 50 % → доповнюється другим з позначкою', () => {
  const r = run(A({ interests: ['rt'], platforms: ['ew'], hands_or_code: 'physical', workplace: 'field' }));
  assert.equal(r.напрями.length, 2);
  assert.equal(r.напрями[0].код, 'РТ');
  assert.equal(r.напрями[0].доповнення, false);
  assert.equal(r.напрями[1].доповнення, true);
});

test('однакові бали й однаковий максимум → порядок напрямів із налаштувань', () => {
  const r = run(A({ interests: ['tv', 'pz'], hands_or_code: 'both', skills: ['python'] }));
  const m = byCode(r);
  assert.equal(m.ПЗ, m.ТВ);
  assert.equal(r.режим, 'звичайний');
  assert.deepEqual(r.напрями.map((d) => [d.код, d.група, d.доповнення]), [['ПЗ', 0, true], ['ТВ', 0, true]]);
});

test('новачок без досвіду: «Старт з основ», курс для новачків, без принизливих формулювань', () => {
  const r = run(A({ who: 'nontech', education: 'nontech', skills: ['none'], practice: ['none'], experience: 'none',
    interests: ['mh'], platforms: ['any'], hands_or_code: 'physical', role: 'create', workplace: 'workshop', time: 'lt3', goal: 'change_career' }));
  const mh = r.напрями[0];
  assert.equal(mh.код, 'МХ');
  assert.equal(mh.готовність.рівень, 1);
  assert.equal(mh.курс.курс.рівень, 1);
  assert.equal(mh.курс.підходить, 'рекомендуємо');
  assert.ok(mh.далі.порада);
  const all = JSON.stringify(S.texts.рівні).toLowerCase();
  for (const bad of ['не підходить', 'недостатньо здібностей', 'низький рівень', 'не готові']) assert.ok(!all.includes(bad), bad);
});

test('курс на рівень вищий — «з підготовкою», на два вищий — не показується', () => {
  const c = (рівень) => ({ назва: 'X' + рівень, напрями: ['ЕЛ'], рівень, старт: '2027-01-01', датаТекстом: '', посилання: 'https://x.ua', показувати: true });
  const list = Engine.courseCandidates([c(2), c(3)], 'ЕЛ', 1, TODAY, '');
  assert.deepEqual(list.map((x) => [x.курс.назва, x.підходить]), [['X2', 'з підготовкою']]);
});

test('курси з минулою датою, приховані й чужих напрямів не показуються', () => {
  const base = { напрями: ['ЕЛ'], рівень: 1, старт: '2027-01-01', датаТекстом: '', посилання: '', показувати: true };
  const list = Engine.courseCandidates([
    { ...base, назва: 'past', старт: '2026-01-01' }, { ...base, назва: 'hidden', показувати: false },
    { ...base, назва: 'other', напрями: ['ПЗ'] }, { ...base, назва: 'ok' },
  ], 'ЕЛ', 3, TODAY, '');
  assert.deepEqual(list.map((x) => x.курс.назва), ['ok']);
});

test('курс з посиланням вище за анонс; пріоритет піднімає курс', () => {
  const base = { напрями: ['ЕЛ'], рівень: 1, старт: '2027-01-01', датаТекстом: '', показувати: true };
  const list = Engine.courseCandidates([
    { ...base, назва: 'announce', посилання: '', старт: '2026-12-01' },
    { ...base, назва: 'late', посилання: 'https://a.ua', старт: '2027-06-01' },
    { ...base, назва: 'promo', посилання: 'https://b.ua', старт: '2027-07-01', пріоритет: 5 },
  ], 'ЕЛ', 1, TODAY, '');
  assert.deepEqual(list.map((x) => x.курс.назва), ['promo', 'late', 'announce']);
});

test('один курс не повторюється у двох напрямах; без курсів — fallback (курс = null)', () => {
  const r = run(olena, TODAY, { ...S, courses: [] });
  assert.ok(r.напрями.every((d) => d.курс === null));
  const names = run(olena).напрями.map((d) => d.курс && d.курс.курс.назва).filter(Boolean);
  assert.equal(new Set(names).size, names.length);
});

test('напрям РТ: лише анонс без посилання; після старту — немає курсу', () => {
  const a = A({ interests: ['rt'], platforms: ['ew'], hands_or_code: 'physical', workplace: 'field' });
  const rt = run(a).напрями.find((d) => d.код === 'РТ');
  assert.equal(rt.курс.курс.назва, 'Electronic Warfare Systems Development');
  assert.equal(rt.курс.посилання, '');
  assert.equal(run(a, '2027-04-01').напрями.find((d) => d.код === 'РТ').курс, null);
});

test('валідація відповідей і перемикання варіантів', () => {
  const q = (id) => S.questions.find((x) => x.id === id);
  assert.equal(Engine.validateAnswer(q('who'), undefined), 'оберіть');
  assert.equal(Engine.validateAnswer(q('practice'), []), 'оберітьКілька');
  assert.equal(Engine.validateAnswer(q('who'), 'other', ' '), 'уточніть');
  assert.equal(Engine.validateAnswer(q('who'), 'other', 'Дизайнер'), null);
  assert.deepEqual(Engine.toggle(q('practice'), ['drone', 'solder'], 'none'), ['none']);
  assert.deepEqual(Engine.toggle(q('practice'), ['none'], 'drone'), ['drone']);
  assert.deepEqual(Engine.toggle(q('interests'), ['el', 'bs', 'rt'], 'mh'), ['el', 'bs', 'rt']);
});

test('перевірка налаштувань знаходить типові помилки людською мовою', () => {
  const broken = JSON.parse(JSON.stringify(S));
  broken.courses.push({ назва: 'Новий курс', напрями: ['EL'], рівень: '2', старт: '23.11.2026', посилання: 'robotdreams.cc', показувати: 'так' });
  const { errors } = Engine.validateSettings(broken, TODAY);
  const text = errors.join('\n');
  assert.match(text, /невідомий напрям «EL»/);
  assert.match(text, /рівень має бути 1, 2 або 3/);
  assert.match(text, /показувати має бути true або false/);
  assert.match(text, /дата старту має бути у форматі/);
  assert.match(text, /посилання має починатися з https/);
});

test('«ІТ» не перетворюється на «іТ» у причинах', () => {
  assert.equal(Engine.lowerFirst('ІТ-фахівець'), 'ІТ-фахівець');
  assert.equal(Engine.lowerFirst('Писати на Python'), 'писати на Python');
});
