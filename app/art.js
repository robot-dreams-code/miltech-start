/*
  Ілюстрації «Старт у MilTech»: розетка-радар, топографічні лінії, дрон, НРК, кадри з камер.
  Усе малюється кодом (SVG), без картинок. Цей файл редагувати не потрібно.
*/
(function () {
  'use strict';
  const f = (n) => Math.round(n * 10) / 10;

  // Тактична карта (вигляд згори): сітка квадратів з координатами, горизонталі висот, дорога, маршрут з точками
  function tacmap() {
    let grid = '', labels = '';
    for (let x = 0; x <= 1200; x += 120) grid += `M${x} 0V800`;
    for (let y = 0; y <= 800; y += 120) grid += `M0 ${y}H1200`;
    for (let x = 0; x < 1200; x += 240) for (let y = 0; y < 800; y += 240) labels += `<text x="${x + 6}" y="${y + 16}">${String(37 + x / 120).padStart(2, '0')}${String(12 + y / 120).padStart(2, '0')}</text>`;
    const hill = (cx, cy, rx, ry, n, ph) => {
      let d = '';
      for (let k = 1; k <= n; k++) {
        const sc = k / n;
        for (let s = 0; s <= 72; s++) {
          const t = (s / 72) * Math.PI * 2;
          const w = 1 + 0.18 * Math.sin(3 * t + ph + k * 0.3) + 0.08 * Math.sin(5 * t + ph * 2);
          d += `${s ? 'L' : 'M'}${f(cx + rx * sc * w * Math.cos(t))} ${f(cy + ry * sc * w * Math.sin(t))}`;
        }
        d += 'Z';
      }
      return d;
    };
    return `<svg class="tacmap" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor">
        <path d="${grid}" stroke-width="0.8" opacity="0.55"/>
        <path d="${hill(250, 220, 210, 150, 6, 0.4)}${hill(930, 560, 240, 170, 7, 1.7)}${hill(1010, 140, 140, 90, 4, 2.6)}" stroke-width="0.9" opacity="0.7"/>
        <path d="M-20 690C200 640 360 520 560 500S880 380 1220 330" stroke-width="5" opacity="0.35"/>
        <path d="M-20 704C200 654 362 534 562 514S882 394 1220 344" stroke-width="1" opacity="0.5"/>
        <path d="M80 120 330 330 610 300 760 470 1080 420" stroke-width="1.6" stroke-dasharray="8 7" opacity="0.9"/>
      </g>
      <g fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M80 108l10 18H70z M330 318l10 18h-20z M610 288l10 18h-20z M760 458l10 18h-20z"/><circle cx="1080" cy="420" r="9"/><path d="M1080 404v32M1064 420h32"/>
      </g>
      <g fill="currentColor" font-family="JetBrains Mono, monospace" font-weight="800" font-size="12" opacity="0.8">${labels}</g></svg>`;
  }

  // Профіль місцевості (вигляд збоку): пагорби з лісосмугою
  function terrain() {
    let top = 'M0 120';
    for (let x = 0; x <= 1600; x += 20) top += `L${x} ${f(120 - 26 * Math.sin(x / 260 + 0.6) - 12 * Math.sin(x / 90 + 1.2) - 6 * Math.abs(Math.sin(x / 23)))}`;
    let trees = '';
    for (let x = 40; x < 1600; x += 34) {
      const y = 120 - 26 * Math.sin(x / 260 + 0.6) - 12 * Math.sin(x / 90 + 1.2);
      if (Math.sin(x / 170) > 0.15) trees += `M${x - 7} ${f(y)}L${x} ${f(y - 16 - (x % 7))}L${x + 7} ${f(y)}Z`;
    }
    return `<svg class="terrain" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <path d="${trees}" fill="#26292b"/>
      <path d="${top}L1600 200L0 200Z" fill="#202325" stroke="rgba(229,232,236,0.35)" stroke-width="1.5"/>
      <path d="M0 150H1600" stroke="rgba(229,232,236,0.3)" stroke-width="1.5" stroke-dasharray="14 10"/><path d="M0 172H1600" stroke="rgba(229,232,236,0.08)" stroke-width="1"/></svg>`;
  }

  // Кадр камери дрона (OSD): кути, шкали висоти й курсу, приціл, телеметрія. Малюється HTML/CSS, щоб текст не розтягувався.
  function hud(labels) {
    const L = labels || ['REC', 'ALT 120 м', 'N 50°27′ E 30°31′', 'BAT 87 %'];
    return `<div class="hud" aria-hidden="true">
      <span class="hud__c hud__c--tl"></span><span class="hud__c hud__c--tr"></span><span class="hud__c hud__c--bl"></span><span class="hud__c hud__c--br"></span>
      <span class="hud__ladder hud__ladder--l"></span><span class="hud__ladder hud__ladder--r"></span><span class="hud__heading"></span>
      <span class="hud__t hud__t--tl"><i></i>${L[0]}</span><span class="hud__t hud__t--tr">${L[3]}</span>
      <span class="hud__t hud__t--bl">${L[1]}</span><span class="hud__t hud__t--br">${L[2]}</span>
    </div>`;
  }

  // Дрон (вигляд збоку), лайм з графітовою «гравюрою»
  function drone(cls = '') {
    return `<svg class="drone ${cls}" viewBox="0 0 260 124" aria-hidden="true" focusable="false">
      <g stroke="#181919" stroke-width="2.4" stroke-linejoin="round">
        <ellipse cx="44" cy="20" rx="40" ry="6" fill="#c6f432"/><ellipse cx="216" cy="20" rx="40" ry="6" fill="#c6f432"/>
        <rect x="38" y="20" width="12" height="22" rx="3" fill="#c6f432"/><rect x="210" y="20" width="12" height="22" rx="3" fill="#c6f432"/>
        <rect x="26" y="40" width="208" height="12" rx="6" fill="#c6f432"/>
        <rect x="88" y="30" width="84" height="38" rx="12" fill="#c6f432"/>
        <path d="M102 68 86 104M158 68 174 104M74 104h28M158 104h28" fill="none" stroke-linecap="round"/>
        <circle cx="130" cy="80" r="13" fill="#c6f432"/><circle cx="130" cy="80" r="5.5" fill="#181919"/>
      </g>
      <g stroke="#181919" stroke-width="1.2" opacity="0.55" fill="none">
        <path d="M96 38h68M96 45h68M96 52h68M96 59h68"/><path d="M14 20h60M186 20h60"/>
      </g></svg>`;
  }

  // Наземний роботизований комплекс (вигляд збоку)
  function ugv(cls = '') {
    const wheels = [48, 86, 124, 162, 198].map((x) => `<circle cx="${x}" cy="90" r="12" fill="#181919"/><circle cx="${x}" cy="90" r="4" fill="#c6f432"/>`).join('');
    return `<svg class="ugv ${cls}" viewBox="0 0 240 124" aria-hidden="true" focusable="false">
      <g stroke="#181919" stroke-width="2.4" stroke-linejoin="round">
        <path d="M58 40 50 4" fill="none" stroke-linecap="round"/>
        <rect x="150" y="18" width="10" height="26" fill="#c6f432"/><rect x="138" y="6" width="36" height="16" rx="4" fill="#c6f432"/>
        <path d="M40 72 52 40h140l14 32z" fill="#c6f432"/>
        <rect x="22" y="70" width="200" height="40" rx="20" fill="#c6f432"/>
      </g>${wheels}
      <g stroke="#181919" stroke-width="1.2" opacity="0.55"><path d="M62 50h126M58 58h138M54 66h146"/></g></svg>`;
  }

  // «Кадр з камери» для сцени: зерно, рельєф, приціл, телеметрія
  function feed(kind) {
    let scene = '';
    if (kind === 'air') {
      // вигляд згори: замкнені горизонталі, дорога, поле
      for (let k = 0; k < 7; k++) {
        let d = '';
        const base = 30 + k * 26;
        for (let s = 0; s <= 90; s++) {
          const t = (s / 90) * Math.PI * 2;
          const r = base * (1 + 0.16 * Math.sin(3 * t + k * 0.4) + 0.07 * Math.sin(5 * t + 1.3));
          d += `${s ? 'L' : 'M'}${f(430 + r * 1.35 * Math.cos(t))} ${f(150 + r * Math.sin(t))}`;
        }
        scene += `<path d="${d}Z"/>`;
      }
      scene += '<path d="M-10 330C120 300 220 250 330 236S560 214 660 120" stroke-width="7" stroke="#8d9093"/><path d="M-10 344C120 314 222 264 332 250S566 228 660 136" stroke-width="1.5"/>';
      scene += '<path d="M40 40l120 30-30 110-120-30z M60 200l90 20-20 90-90-20z" stroke-dasharray="4 5"/>';
    } else {
      // вигляд з землі: горизонт, колія, лісосмуга
      scene += '<path d="M0 170H640" stroke-width="1.5"/>';
      for (let i = -6; i <= 6; i++) scene += `<path d="M${320 + i * 18} 170L${320 + i * 150} 400"/>`;
      for (let j = 1; j < 7; j++) { const y = 170 + j * j * 6; scene += `<path d="M0 ${y}H640" opacity="${1 - j * 0.1}"/>`; }
      let trees = 'M0 170';
      for (let x = 0; x <= 640; x += 16) trees += `L${x} ${f(150 - 14 * Math.abs(Math.sin(x / 37)) - 8 * Math.abs(Math.sin(x / 11)))}`;
      scene += `<path d="${trees}L640 170Z" fill="#5d6063" stroke="none"/>`;
    }
    const hud = kind === 'air'
      ? ['ALT 120 м', 'DIST 2,4 км', 'BAT 64 %']
      : ['SPD 12 км/год', 'LINK 98 %', 'BAT 71 %'];
    return `<svg class="feed" viewBox="0 0 640 400" role="img" aria-label="${kind === 'air' ? 'Кадр із камери дрона' : 'Кадр із камери НРК'}" focusable="false">
      <defs>
        <filter id="grain-${kind}"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.28 0"/></filter>
        <radialGradient id="vig-${kind}" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></radialGradient>
      </defs>
      <rect width="640" height="400" fill="#3b3e41"/>
      <g fill="none" stroke="#a7abaf" stroke-width="1.1" opacity="0.8">${scene}</g>
      <rect width="640" height="400" filter="url(#grain-${kind})"/>
      <rect width="640" height="400" fill="url(#vig-${kind})"/>
      <g fill="none" stroke="#e5e8ec" stroke-width="2" opacity="0.9">
        <path d="M24 60V24h36M580 24h36v36M616 340v36h-36M60 376H24v-36"/>
        <path d="M320 176v-26M320 224v26M296 200h-26M344 200h26"/><circle cx="320" cy="200" r="4"/>
      </g>
      <g font-family="JetBrains Mono, monospace" font-weight="800" font-size="15" fill="#e5e8ec">
        <circle cx="44" cy="52" r="6" fill="#c6f432"/><text x="58" y="57">REC</text>
        <text x="596" y="57" text-anchor="end">${hud[2]}</text>
        <text x="44" y="358">${hud[0]}</text><text x="596" y="358" text-anchor="end">${hud[1]}</text>
      </g></svg>`;
  }

  window.Art = { tacmap, terrain, hud, drone, ugv, feed };
})();
