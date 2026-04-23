/* ============================================================
   ARH_MURAS_GROUP — animations.js v3.0
   
   СОДЕРЖИТ:
   ├── 1. ТЁМНАЯ/СВЕТЛАЯ ТЕМА
   ├── 2. ПРОГРЕСС-БАР ПРОКРУТКИ
   ├── 3. ТЕНЬ ШАПКИ ПРИ СКРОЛЛЕ
   ├── 4. REVEAL-АНИМАЦИИ (Intersection Observer)
   └── 5. BURGER-МЕНЮ (мобильное)
   ============================================================ */

/* ============================================================
   1. ТЁМНАЯ/СВЕТЛАЯ ТЕМА
   ============================================================ */

const themeToggle = document.getElementById('themeToggle'); /* ← кнопка ◐ в шапке          */
const htmlEl      = document.documentElement;               /* ← <html data-theme="...">   */

/* Загружаем сохранённую тему.
   localStorage здесь ОК — это только настройка отображения, не данные */
const savedTheme = localStorage.getItem('arh_theme') || 'light'; /* ← 'light' или 'dark'   */
htmlEl.setAttribute('data-theme', savedTheme);

/* Иконка кнопки зависит от темы */
function updateThemeIcon() {
  if (!themeToggle) return;
  const isDark = htmlEl.getAttribute('data-theme') === 'dark';
  themeToggle.setAttribute('title', isDark ? 'Светлая тема' : 'Тёмная тема');
  /* Иконка: ◐ = полутень (универсальная), можно поменять на эмодзи 🌙/☀️ */
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = htmlEl.getAttribute('data-theme');
    const next    = current === 'light' ? 'dark' : 'light'; /* ← переключаем  */
    htmlEl.setAttribute('data-theme', next);
    localStorage.setItem('arh_theme', next);                /* ← запоминаем   */
    updateThemeIcon();
  });
  updateThemeIcon(); /* ← инициализируем иконку                             */
}

/* ============================================================
   2. ПРОГРЕСС-БАР ПРОКРУТКИ
   (тонкая золотая полоска вверху страницы)
   ============================================================ */

const progressBar = document.getElementById('scrollProgress'); /* ← div шириной 0–100%    */

if (progressBar) {
  window.addEventListener('scroll', () => {
    const scrollTop  = window.scrollY;                               /* ← сколько прокручено */
    const docHeight  = document.body.scrollHeight - window.innerHeight; /* ← полная высота  */
    const pct        = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct.toFixed(1) + '%';
  }, { passive: true }); /* passive: true — не блокируем рендер             */
}

/* ============================================================
   3. ТЕНЬ ШАПКИ ПРИ ПРОКРУТКЕ
   ============================================================ */

const siteHeader = document.getElementById('siteHeader'); /* ← <header class="site-header"> */

if (siteHeader) {
  window.addEventListener('scroll', () => {
    /* Если страница прокручена > 50px — добавляем тень */
    siteHeader.style.boxShadow = window.scrollY > 50
      ? '0 4px 40px rgba(0,0,0,0.08)'
      : 'none';
  }, { passive: true });
}

/* ============================================================
   4. REVEAL-АНИМАЦИИ
   Элементы с классом .reveal появляются при прокрутке к ним.
   Используем IntersectionObserver — это производительнее scroll event.
   ============================================================ */

const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
/* ↑ Все три класса:
   .reveal       — появляется снизу вверх
   .reveal-left  — появляется слева
   .reveal-right — появляется справа                                       */

if (revealEls.length > 0) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        /* Задержка между элементами — эффект каскада (60мс на каждый)    */
        setTimeout(() => entry.target.classList.add('visible'), i * 60);
        /* Отписываемся от наблюдения — анимация только один раз          */
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,                /* ← 10% элемента должно быть видно   */
    rootMargin: '0px 0px -40px 0px' /* ← срабатывает чуть раньше края   */
  });

  revealEls.forEach(el => observer.observe(el));
}

/* ============================================================
   5. BURGER-МЕНЮ (мобильное)
   Открытие/закрытие навигации на экранах < 768px
   ============================================================ */

const burgerBtn = document.getElementById('burgerBtn'); /* ← кнопка ☰                     */
const mainNav   = document.getElementById('mainNav');   /* ← <nav class="main-nav">        */

if (burgerBtn && mainNav) {
  burgerBtn.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open'); /* ← переключаем класс              */
    burgerBtn.setAttribute('aria-expanded', isOpen); /* ← для доступности               */
    document.body.style.overflow = isOpen ? 'hidden' : ''; /* ← блокируем скролл        */
  });

  /* Закрываем меню при клике на ссылку */
  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      burgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  /* Закрываем при клике вне меню */
  document.addEventListener('click', e => {
    if (mainNav.classList.contains('open') &&
        !mainNav.contains(e.target) &&
        !burgerBtn.contains(e.target)) {
      mainNav.classList.remove('open');
      burgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
}

/* ============================================================
   РЕЗЕРВНАЯ функция submitForm (если script.js не загружен)
   ============================================================ */
if (typeof submitForm === 'undefined') {
  window.submitForm = function(e) {
    e.preventDefault();
    const name  = document.getElementById('cName')?.value.trim();
    const phone = document.getElementById('cPhone')?.value.trim();
    if (!name || !phone) { alert('Заполните имя и телефон'); return; }
    const btn = document.querySelector('.btn-submit-form');
    if (btn) { btn.textContent = 'ОТПРАВЛЯЕМ...'; btn.disabled = true; }
    setTimeout(() => {
      if (btn) { btn.textContent = 'ОТПРАВИТЬ ЗАЯВКУ →'; btn.disabled = false; }
      const success = document.getElementById('formSuccess');
      if (success) { success.classList.add('visible'); }
      document.getElementById('contactForm')?.reset();
      setTimeout(() => success?.classList.remove('visible'), 6000);
    }, 1200);
  };
}
