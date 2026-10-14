// Завантажує файли налаштувань так само, як браузер (через window.*)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function loadSettings() {
  const window = {};
  const ctx = vm.createContext({ window });
  for (const f of ['questions.js', 'texts.js', 'courses.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'settings', f), 'utf8'), ctx, { filename: f });
  }
  // структуру клонуємо, щоб масиви й об'єкти були «рідними» для Node (deepEqual)
  const clone = (x) => JSON.parse(JSON.stringify(x));
  return { questions: clone(window.ПИТАННЯ), rules: clone(window.ПРАВИЛА), texts: clone(window.ТЕКСТИ), courses: clone(window.КУРСИ) };
};
