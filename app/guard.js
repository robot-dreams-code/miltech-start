/*
  Ловить помилки у файлах налаштувань і показує зрозуміле повідомлення замість порожньої сторінки.
  Підключається першим. Редагувати не потрібно.
*/
(function () {
  window.__settingsErrors = [];
  window.addEventListener('error', function (e) {
    var file = (e.filename || '').split('/').pop();
    window.__settingsErrors.push({ file: file, line: e.lineno, message: e.message });
  });
  window.showSettingsProblem = function (title, details) {
    document.body.innerHTML =
      '<div class="fatal" role="alert"><h1>' + title + '</h1>' + details +
      '<p>Відкрийте сторінку <code>check.html</code> у цій самій папці — вона покаже, що саме виправити.</p></div>';
  };
  window.checkSettingsLoaded = function () {
    var missing = [];
    if (!window.ПИТАННЯ || !window.ПРАВИЛА) missing.push('settings/questions.js');
    if (!window.ТЕКСТИ) missing.push('settings/texts.js');
    if (!window.КУРСИ) missing.push('settings/courses.js');
    if (!missing.length && !window.__settingsErrors.length) return true;
    var err = window.__settingsErrors[0];
    var where = err && err.file && err.line
      ? '<p>Помилка у файлі <code>' + err.file + '</code>, рядок ' + err.line + '.</p>'
      : '<p>Не вдалося прочитати: <code>' + missing.join(', ') + '</code>.</p>';
    window.showSettingsProblem(
      'Тест не запустився через помилку в налаштуваннях',
      where + '<p>Найчастіше це пропущена кома між блоками, незакрита лапка " або дужка.</p>'
    );
    return false;
  };
})();
