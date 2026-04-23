/* ============================================================
   ARH_MURAS_GROUP — script.js v3.0
   Хранилище: Supabase (база данных + Storage для фото)
   Совместим с Vercel — данные видны всем пользователям
   
   ⚠️  ПЕРЕД ИСПОЛЬЗОВАНИЕМ: заполните config.js
   ============================================================

   СТРУКТУРА ФАЙЛА:
   ├── 1. ИНИЦИАЛИЗАЦИЯ SUPABASE
   ├── 2. АУТЕНТИФИКАЦИЯ СОТРУДНИКОВ
   ├── 3. РЕНДЕР КАРТОЧЕК И ГАЛЕРЕЯ
   ├── 4. ПАГИНАЦИЯ (бесконечная прокрутка)
   ├── 5. ФИЛЬТРЫ И ПОИСК
   ├── 6. ФОРМА ДОБАВЛЕНИЯ ПРОЕКТА
   ├── 7. ЗАГРУЗКА ФОТО В SUPABASE STORAGE
   ├── 8. ПРОСМОТР ПРОЕКТА (МОДАЛКА)
   ├── 9. УДАЛЕНИЕ ПРОЕКТА
   ├── 10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   └── 11. ФОРМА ЗАЯВКИ (главная страница)
   ============================================================ */

/* ============================================================
   1. ИНИЦИАЛИЗАЦИЯ SUPABASE
   ============================================================ */

/* Supabase SDK загружается через <script> в HTML (CDN).
   config.js должен быть подключён ДО этого файла */
let supabase = null; /* ← главный клиент Supabase, создаётся ниже */

/* Проверяем, что config.js загружен и данные заполнены */
if (typeof SUPABASE_URL !== 'undefined' &&
    SUPABASE_URL !== 'https://ВАШПРОЕКТ.supabase.co') {
  /* Если данные заполнены — создаём клиент */
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  } catch (e) {
    console.warn('Supabase SDK не загружен или ошибка:', e);
  }
} else {
  /* Если config.js не заполнен — показываем предупреждение в консоли */
  console.warn(
    '⚠️  ARH_MURAS: Заполните config.js данными из supabase.com!\n' +
    'Проекты не будут сохраняться до заполнения.'
  );
}

/* ============================================================
   2. АУТЕНТИФИКАЦИЯ СОТРУДНИКОВ
   (локальная — без Supabase Auth, для простоты)
   ============================================================ */

/* Читаем состояние входа из sessionStorage.
   sessionStorage (в отличие от localStorage) очищается при закрытии вкладки — это правильно.
   Данные проектов при этом НЕ удаляются — они в Supabase */
let isLoggedIn  = sessionStorage.getItem('arh_logged_in') === 'true'; /* ← вошёл ли сотрудник    */
let currentUser = sessionStorage.getItem('arh_user') || '';           /* ← логин текущего юзера  */

/* Показать форму входа */
function loginPrompt() {
  /* Получаем логин и пароль через prompt (можно заменить красивой модалкой) */
  const username = prompt('Логин сотрудника:');
  if (!username) return; /* ← пользователь нажал "Отмена" */

  const password = prompt('Пароль:');
  if (!password) return;

  /* Проверяем пару логин/пароль по словарю из config.js */
  if (EMPLOYEES[username] && EMPLOYEES[username] === password) {
    isLoggedIn  = true;
    currentUser = username;
    /* Сохраняем в sessionStorage (не localStorage!) */
    sessionStorage.setItem('arh_logged_in', 'true');
    sessionStorage.setItem('arh_user', username);
    updateAuthUI();
    showNotification(`✓ Добро пожаловать, ${username}!`, 'success');
  } else {
    showNotification('❌ Неверный логин или пароль', 'error');
  }
}

/* Выход из системы */
function logout() {
  if (!confirm('Выйти из системы?')) return;
  isLoggedIn  = false;
  currentUser = '';
  sessionStorage.removeItem('arh_logged_in');
  sessionStorage.removeItem('arh_user');
  updateAuthUI();
  /* Перерисовываем карточки — убираем кнопки удаления */
  refreshAllCards();
}

/* Обновляем видимость кнопок в шапке */
function updateAuthUI() {
  const adminControls = document.getElementById('adminControls'); /* ← блок с "+" и "Выйти"   */
  const staffBtn      = document.getElementById('staffLoginBtn'); /* ← кнопка "только для..."  */

  if (isLoggedIn) {
    /* Сотрудник вошёл: показываем admin-панель */
    if (adminControls) adminControls.style.display = 'flex';
    if (staffBtn) {
      staffBtn.textContent = `${currentUser} · Выйти`;
      staffBtn.onclick     = logout;
      staffBtn.style.color = 'var(--accent)';
    }
  } else {
    /* Не вошёл: прячем admin-панель */
    if (adminControls) adminControls.style.display = 'none';
    if (staffBtn) {
      staffBtn.textContent = 'только для сотрудников ›';
      staffBtn.onclick     = loginPrompt;
      staffBtn.style.color = '';
    }
  }
}

/* ============================================================
   3. РЕНДЕР КАРТОЧЕК И ГАЛЕРЕЯ
   ============================================================ */

/* Глобальный массив с загруженными проектами.
   НЕ хранит все 10k проектов — только текущую страницу */
let projectsCache = []; /* ← текущая пачка карточек в DOM         */
let slideIndexes  = {}; /* ← слайд-индексы для каждой карточки    */

/* Инициализация страницы */
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();             /* ← показываем/прячем кнопки              */
  if (document.getElementById('gal')) {
    /* Мы на странице projects.html */
    loadProjects(true);       /* ← первая загрузка (сброс пагинации)     */
    setupFilters();           /* ← кнопки фильтров                       */
    setupDragDrop();          /* ← drag & drop для загрузки фото         */
    setupInfiniteScroll();    /* ← бесконечная прокрутка                 */
    setupTouchSwipe();        /* ← свайп на мобильных                    */
  }
});

/* Построить одну карточку проекта и добавить в галерею */
function renderCard(p) {
  const gal = document.getElementById('gal');
  if (!gal) return;

  /* Создаём div-карточку */
  const card    = document.createElement('div');
  card.className = 'album-card';
  card.id        = `item-${p.id}`;     /* ← уникальный id для удаления     */
  card.dataset.cat  = p.cat;           /* ← категория для фильтра           */
  card.dataset.name = (p.name || '').toLowerCase(); /* ← для поиска        */

  /* Строим HTML слайдера (массив image_urls из Supabase) */
  const urls = Array.isArray(p.image_urls) ? p.image_urls : [];

  const imgs = urls.map((u, i) =>
    /* loading="lazy" — браузер сам загрузит когда карточка станет видимой */
    `<img src="${escHtml(u)}" class="${i === 0 ? 'active' : ''}" alt="Фото ${i + 1}" loading="lazy">`
  ).join('');

  /* Точки навигации слайдера (только если фото > 1) */
  const dots = urls.length > 1
    ? `<div class="slide-dots">${urls.map((_, i) =>
        `<span class="slide-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`
      ).join('')}</div>`
    : '';

  /* Стрелки слайдера */
  const arrows = urls.length > 1
    ? `<button class="slide-arrow prev" aria-label="Назад"  onclick="slideCard(event,'${p.id}',-1)">‹</button>
       <button class="slide-arrow next" aria-label="Вперёд" onclick="slideCard(event,'${p.id}',1)">›</button>`
    : '';

  /* Кнопка удаления — только для admin или автора */
  const canDelete = isLoggedIn && (currentUser === p.uploaded_by || currentUser === 'admin');
  const deleteBtn = canDelete
    ? `<button class="delete-btn" title="Удалить проект" onclick="deleteProj(event,'${p.id}')">×</button>`
    : '';

  /* Мета-строка: кто добавил */
  const metaInfo = p.uploaded_by
    ? `<span class="card-meta-info">Добавил: ${escHtml(p.uploaded_by)} · ${escHtml(p.upload_date || '')}</span>`
    : '';

  card.innerHTML = `
    ${deleteBtn}
    <div class="slider-wrap" id="sw-${p.id}">
      <span class="card-cat-badge">${escHtml(p.cat)}</span>
      ${imgs}
      ${urls.length > 0
        ? `<span class="img-count">${urls.length} фото</span>`
        : `<div class="card-no-photo">📷</div>`
      }
      ${dots}
      ${arrows}
    </div>
    <div class="card-content" onclick="openProj('${p.id}')">
      <div class="card-title">${escHtml(p.name)}</div>
      <div class="card-meta">
        <span>${escHtml(p.cat)}</span>
        ${p.year ? `<span>${escHtml(p.year)}</span>` : ''}
        ${p.area ? `<span>${escHtml(p.area)}</span>` : ''}
      </div>
      ${metaInfo}
    </div>
  `;

  gal.appendChild(card);

  /* Вешаем события на точки слайдера */
  card.querySelectorAll('.slide-dot').forEach(dot => {
    dot.addEventListener('click', e => {
      e.stopPropagation();
      goToSlide(p.id, parseInt(dot.dataset.idx, 10));
    });
  });
}

/* Перерисовать все карточки (нужно после выхода/входа — обновить кнопки удаления) */
function refreshAllCards() {
  const gal = document.getElementById('gal');
  if (!gal) return;
  gal.innerHTML = ''; /* ← очищаем */
  slideIndexes  = {};
  projectsCache.forEach(p => renderCard(p));
}

/* ============================================================
   4. ПАГИНАЦИЯ — загрузка порциями для поддержки 10k+ проектов
   ============================================================ */

let currentPage   = 0;   /* ← текущая "страница" (смещение)              */
let isLoading     = false; /* ← идёт ли загрузка (чтобы не дублировать) */
let hasMorePages  = true;  /* ← есть ли ещё проекты в базе              */
let activeFilter  = 'all'; /* ← текущий активный фильтр                  */
let searchQuery   = '';    /* ← текущий поисковый запрос                  */

/* Загрузить проекты из Supabase */
async function loadProjects(reset = false) {
  if (isLoading) return;   /* ← уже идёт загрузка — пропускаем            */
  if (!hasMorePages && !reset) return; /* ← проектов больше нет           */

  /* Если reset=true — начинаем с начала (при фильтре или поиске) */
  if (reset) {
    currentPage  = 0;
    hasMorePages = true;
    projectsCache = [];
    const gal = document.getElementById('gal');
    if (gal) gal.innerHTML = '';
  }

  isLoading = true;
  showLoadingSpinner(true);

  /* Если Supabase не настроен — показываем подсказку */
  if (!supabase) {
    showLoadingSpinner(false);
    isLoading = false;
    checkEmpty();
    return;
  }

  try {
    /* Строим запрос к Supabase */
    let query = supabase
      .from('projects')               /* ← имя таблицы в Supabase          */
      .select('*')                    /* ← все поля                         */
      .order('created_at', { ascending: false }) /* ← новые сверху         */
      .range(
        currentPage * PAGE_SIZE,      /* ← от (страница × размер)          */
        (currentPage + 1) * PAGE_SIZE - 1 /* ← до                         */
      );

    /* Применяем фильтр по категории */
    if (activeFilter !== 'all') {
      query = query.eq('cat', activeFilter); /* ← cat = 'Жилая' и т.д.     */
    }

    /* Применяем поиск по названию (ilike = case-insensitive LIKE) */
    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`); /* ← содержит строку */
    }

    const { data, error } = await query;

    if (error) throw error;

    /* Если вернулось меньше PAGE_SIZE — больше страниц нет */
    hasMorePages = data.length === PAGE_SIZE;
    currentPage++;

    /* Рендерим карточки */
    data.forEach(p => {
      projectsCache.push(p);
      renderCard(p);
    });

    checkEmpty();

  } catch (err) {
    console.error('Ошибка загрузки проектов:', err);
    showNotification('⚠️ Не удалось загрузить проекты. Проверьте config.js', 'error');
  } finally {
    isLoading = false;
    showLoadingSpinner(false);
  }
}

/* Бесконечная прокрутка: когда пользователь докрутил до 80% страницы —
   подгружаем следующую порцию */
function setupInfiniteScroll() {
  window.addEventListener('scroll', () => {
    const scrolled  = window.scrollY + window.innerHeight; /* ← сколько проскроллено      */
    const total     = document.body.scrollHeight;          /* ← высота всей страницы      */
    if (scrolled >= total * 0.8 && hasMorePages && !isLoading) {
      loadProjects(); /* ← подгружаем следующую порцию                       */
    }
  }, { passive: true }); /* passive: true — не блокируем рендер             */
}

/* ============================================================
   5. ФИЛЬТРЫ И ПОИСК
   ============================================================ */

function setupFilters() {
  /* Обработка кнопок фильтра */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      /* Снимаем active со всех */
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter; /* ← сохраняем активный фильтр     */
      loadProjects(true);                /* ← перезагружаем с новым фильтром */
    });
  });

  /* Поиск — debounce 350мс чтобы не делать запрос на каждую букву */
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let searchTimer; /* ← таймер для debounce */
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer); /* ← сбрасываем предыдущий таймер         */
      searchTimer = setTimeout(() => {
        searchQuery = searchInput.value.trim().toLowerCase();
        loadProjects(true); /* ← перезагружаем с новым поисковым запросом  */
      }, 350);
    });
  }
}

/* ============================================================
   6. ФОРМА ДОБАВЛЕНИЯ ПРОЕКТА
   ============================================================ */

/* Открыть модалку добавления */
function openForm() {
  if (!isLoggedIn) { loginPrompt(); return; } /* ← проверка входа          */
  const modal = document.getElementById('formModal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden'; /* ← блокируем скролл страницы  */
}

/* Закрыть и сбросить форму */
function closeForm() {
  const modal = document.getElementById('formModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';

  /* Сбрасываем все поля */
  ['pName', 'pCat', 'pDesc', 'pYear', 'pArea'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  /* Сбрасываем загруженные файлы */
  const fInp = document.getElementById('fInp');
  if (fInp) fInp.value = '';

  /* Очищаем превью */
  const strip = document.getElementById('previewStrip');
  if (strip) strip.innerHTML = '';

  /* Сбрасываем превью-URL (чтобы не было утечки памяти) */
  previewObjectUrls.forEach(url => URL.revokeObjectURL(url));
  previewObjectUrls = [];

  /* Восстанавливаем подпись в зоне drop */
  const dzText = document.querySelector('#dropZone p');
  if (dzText) dzText.textContent = 'Перетащите фото сюда или нажмите для выбора';

  /* Сбрасываем прогресс */
  setUploadProgress(0);
}

/* ============================================================
   7. ЗАГРУЗКА ФОТО В SUPABASE STORAGE
   ============================================================ */

let previewObjectUrls = []; /* ← URL.createObjectURL() нужно освобождать  */

/* Превью выбранных файлов (до загрузки) */
function previewFiles(files) {
  const strip = document.getElementById('previewStrip');
  if (!strip) return;

  /* Освобождаем старые превью */
  previewObjectUrls.forEach(url => URL.revokeObjectURL(url));
  previewObjectUrls = [];
  strip.innerHTML   = '';

  const limit = Math.min(files.length, 20); /* ← максимум 20 фото          */

  for (let i = 0; i < limit; i++) {
    const img = document.createElement('img');
    const url = URL.createObjectURL(files[i]); /* ← временный URL           */
    img.src   = url;
    img.title = files[i].name;
    strip.appendChild(img);
    previewObjectUrls.push(url); /* ← запомним чтобы потом освободить      */
  }

  /* Обновляем текст в дропзоне */
  const dzText = document.querySelector('#dropZone p');
  if (dzText) dzText.textContent = `Выбрано: ${limit} фото`;
}

/* Drag & Drop */
function setupDragDrop() {
  const dz   = document.getElementById('dropZone');
  const fInp = document.getElementById('fInp');
  if (!dz || !fInp) return;

  /* Разрешаем дроп */
  dz.addEventListener('dragover', e => {
    e.preventDefault();
    dz.classList.add('drag-over'); /* ← CSS-класс подсветки                */
  });

  dz.addEventListener('dragleave', () => {
    dz.classList.remove('drag-over');
  });

  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag-over');
    /* Передаём файлы в превью */
    previewFiles(e.dataTransfer.files);
    /* Записываем файлы в input (для uploadProject) */
    try {
      fInp.files = e.dataTransfer.files;
    } catch (_) {
      /* Firefox может не поддерживать прямое присвоение files */
      window._droppedFiles = e.dataTransfer.files;
    }
  });
}

/* Сжатие изображения перед загрузкой.
   Уменьшает размер файла без заметной потери качества */
function compressImage(file, maxWidth = 1400, quality = 0.82) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        /* Вычисляем новые размеры (не увеличиваем маленькие фото) */
        const ratio  = Math.min(maxWidth / img.width, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);

        /* Рисуем сжатое изображение */
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

        /* Конвертируем в Blob (JPEG с заданным качеством) */
        canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Прогресс-бар загрузки */
function setUploadProgress(pct) {
  const bar = document.getElementById('uploadProgress');
  if (!bar) return;
  bar.style.width   = `${pct}%`;          /* ← процент заполнения          */
  bar.style.display = pct > 0 ? 'block' : 'none'; /* ← скрываем при 0%   */
}

/* Загрузить новый проект в Supabase */
async function uploadProject() {
  if (!isLoggedIn) { showNotification('❌ Войдите в систему', 'error'); return; }
  if (!supabase) {
    showNotification('❌ Настройте Supabase в config.js', 'error');
    return;
  }

  /* Читаем значения полей формы */
  const name  = document.getElementById('pName')?.value.trim();
  const cat   = document.getElementById('pCat')?.value;
  const desc  = document.getElementById('pDesc')?.value.trim();
  const year  = document.getElementById('pYear')?.value.trim();
  const area  = document.getElementById('pArea')?.value.trim();

  /* Получаем файлы (из input или из drag & drop) */
  const files = document.getElementById('fInp')?.files || window._droppedFiles;

  /* Валидация */
  if (!name)                      { showNotification('Укажите название объекта', 'error');    return; }
  if (!cat)                       { showNotification('Выберите категорию',        'error');    return; }
  if (!files || files.length < 1) { showNotification('Добавьте хотя бы одно фото', 'error'); return; }

  /* Блокируем кнопку */
  const btn = document.querySelector('.btn-submit');
  if (btn) { btn.textContent = 'ЗАГРУЖАЕМ...'; btn.disabled = true; }

  try {
    const limit    = Math.min(files.length, 20); /* ← максимум 20 фото     */
    const imageUrls = [];                          /* ← публичные URL после загрузки */

    /* Загружаем каждый файл */
    for (let i = 0; i < limit; i++) {
      /* Обновляем прогресс-бар */
      setUploadProgress(Math.round(((i) / limit) * 90));

      /* Сжимаем перед загрузкой */
      const compressed = await compressImage(files[i]);

      /* Уникальное имя файла: timestamp + случайный суффикс */
      const ext      = 'jpg';                              /* ← всегда jpeg после сжатия  */
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const path     = `${currentUser}/${filename}`;       /* ← папка по логину сотрудника */

      /* Загружаем в Supabase Storage */
      const { error: storageErr } = await supabase
        .storage
        .from(STORAGE_BUCKET) /* ← bucket из config.js                    */
        .upload(path, compressed, {
          contentType: 'image/jpeg',
          upsert: false          /* ← не перезаписывать если уже есть     */
        });

      if (storageErr) throw new Error(`Ошибка Storage: ${storageErr.message}`);

      /* Получаем публичный URL загруженного файла */
      const { data: urlData } = supabase
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      imageUrls.push(urlData.publicUrl); /* ← сохраняем URL в массив       */
    }

    setUploadProgress(95); /* ← 95% — фото загружены, сохраняем в БД      */

    /* Формируем запись для таблицы projects */
    const project = {
      name,
      cat,
      description:  desc || null,        /* ← null если пусто              */
      year:         year || null,
      area:         area || null,
      image_urls:   imageUrls,           /* ← массив публичных URL          */
      uploaded_by:  currentUser,
      upload_date:  new Date().toLocaleDateString('ru-RU') /* ← "22.04.2026" */
    };

    /* Вставляем в таблицу Supabase */
    const { data: inserted, error: dbErr } = await supabase
      .from('projects')
      .insert(project)
      .select()  /* ← возвращает вставленную запись с id                  */
      .single();

    if (dbErr) throw new Error(`Ошибка БД: ${dbErr.message}`);

    setUploadProgress(100);

    /* Добавляем карточку в начало галереи без перезагрузки */
    projectsCache.unshift(inserted);
    const gal = document.getElementById('gal');
    if (gal) {
      const tempDiv = document.createElement('div');
      gal.insertBefore(tempDiv, gal.firstChild);
      tempDiv.replaceWith(tempDiv); /* placeholder */
    }
    renderCardAtStart(inserted); /* ← добавляем первым                     */

    closeForm();
    checkEmpty();
    showNotification('✓ Проект успешно опубликован!', 'success');

  } catch (err) {
    console.error('Ошибка загрузки:', err);
    showNotification('Ошибка: ' + err.message, 'error');
  } finally {
    if (btn) { btn.textContent = 'ОПУБЛИКОВАТЬ ПРОЕКТ'; btn.disabled = false; }
    setUploadProgress(0);
  }
}

/* Добавить карточку в НАЧАЛО галереи (для только что загруженных) */
function renderCardAtStart(p) {
  const gal = document.getElementById('gal');
  if (!gal) return;

  /* Создаём временный контейнер, рендерим в него */
  const temp = document.createDocumentFragment();
  const card = document.createElement('div');
  temp.appendChild(card);

  /* Используем renderCard логику напрямую */
  const urls = Array.isArray(p.image_urls) ? p.image_urls : [];
  card.className     = 'album-card';
  card.id            = `item-${p.id}`;
  card.dataset.cat   = p.cat;
  card.dataset.name  = (p.name || '').toLowerCase();

  const imgs   = urls.map((u, i) =>
    `<img src="${escHtml(u)}" class="${i === 0 ? 'active' : ''}" alt="Фото ${i + 1}" loading="lazy">`
  ).join('');
  const dots   = urls.length > 1
    ? `<div class="slide-dots">${urls.map((_, i) =>
        `<span class="slide-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`
      ).join('')}</div>` : '';
  const arrows = urls.length > 1
    ? `<button class="slide-arrow prev" aria-label="Назад"  onclick="slideCard(event,'${p.id}',-1)">‹</button>
       <button class="slide-arrow next" aria-label="Вперёд" onclick="slideCard(event,'${p.id}',1)">›</button>` : '';
  const deleteBtn = `<button class="delete-btn" title="Удалить" onclick="deleteProj(event,'${p.id}')">×</button>`;

  card.innerHTML = `
    ${deleteBtn}
    <div class="slider-wrap" id="sw-${p.id}">
      <span class="card-cat-badge">${escHtml(p.cat)}</span>
      ${imgs}
      ${urls.length > 0 ? `<span class="img-count">${urls.length} фото</span>` : ''}
      ${dots}${arrows}
    </div>
    <div class="card-content" onclick="openProj('${p.id}')">
      <div class="card-title">${escHtml(p.name)}</div>
      <div class="card-meta">
        <span>${escHtml(p.cat)}</span>
        ${p.year ? `<span>${escHtml(p.year)}</span>` : ''}
        ${p.area ? `<span>${escHtml(p.area)}</span>` : ''}
      </div>
      <span class="card-meta-info">Добавил: ${escHtml(p.uploaded_by)} · ${escHtml(p.upload_date || '')}</span>
    </div>
  `;

  gal.insertBefore(card, gal.firstChild); /* ← вставляем ПЕРВЫМ            */

  /* Точки */
  card.querySelectorAll('.slide-dot').forEach(dot => {
    dot.addEventListener('click', e => {
      e.stopPropagation();
      goToSlide(p.id, parseInt(dot.dataset.idx, 10));
    });
  });
}

/* ============================================================
   СЛАЙДЕР КАРТОЧЕК
   ============================================================ */

/* Перейти к следующему/предыдущему слайду */
function slideCard(e, id, dir) {
  e.stopPropagation(); /* ← не открываем модалку просмотра при клике        */
  const p = projectsCache.find(x => x.id == id); /* ← находим проект       */
  if (!p) return;
  const urls = Array.isArray(p.image_urls) ? p.image_urls : [];
  const cur  = slideIndexes[id] || 0;
  const next = (cur + dir + urls.length) % urls.length; /* ← цикличный     */
  goToSlide(id, next);
}

/* Перейти к конкретному слайду */
function goToSlide(id, idx) {
  slideIndexes[id] = idx;
  const sw = document.getElementById(`sw-${id}`);
  if (!sw) return;
  /* Переключаем активный класс на нужное фото */
  sw.querySelectorAll('img').forEach((img, i) => img.classList.toggle('active', i === idx));
  /* Переключаем точки */
  sw.querySelectorAll('.slide-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

/* Touch-свайп на мобильных для слайдера карточек */
function setupTouchSwipe() {
  /* Вешаем через делегирование на галерею */
  const gal = document.getElementById('gal');
  if (!gal) return;

  let touchStartX = 0;

  gal.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX; /* ← запоминаем начало свайпа */
  }, { passive: true });

  gal.addEventListener('touchend', e => {
    const dx      = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 40) return; /* ← меньше 40px — не считаем за свайп  */

    /* Находим ближайший slider-wrap */
    const sw = e.target.closest('.slider-wrap');
    if (!sw) return;

    const id  = sw.id.replace('sw-', ''); /* ← извлекаем id из "sw-123"   */
    const dir = dx < 0 ? 1 : -1;         /* ← dx < 0 = свайп влево = вперёд */
    const p   = projectsCache.find(x => x.id == id);
    if (!p) return;

    const urls = Array.isArray(p.image_urls) ? p.image_urls : [];
    if (urls.length < 2) return;

    const cur  = slideIndexes[id] || 0;
    const next = (cur + dir + urls.length) % urls.length;
    goToSlide(id, next);
  }, { passive: true });
}

/* ============================================================
   8. ПРОСМОТР ПРОЕКТА (МОДАЛКА)
   ============================================================ */

function openProj(id) {
  /* Находим проект в кэше по id */
  const p = projectsCache.find(x => x.id == id);
  if (!p) return;

  const urls = Array.isArray(p.image_urls) ? p.image_urls : [];

  /* Заполняем поля модалки */
  document.getElementById('vTitle').textContent    = p.name;
  document.getElementById('vCatBadge').textContent = p.cat;
  document.getElementById('vCat').textContent      = p.cat;
  document.getElementById('vDesc').textContent     = p.description || 'Описание не добавлено.';

  /* Год */
  const yw = document.getElementById('vYearWrap');
  if (p.year) { yw.style.display = ''; document.getElementById('vYear').textContent = p.year; }
  else        { yw.style.display = 'none'; }

  /* Площадь */
  const aw = document.getElementById('vAreaWrap');
  if (p.area) { aw.style.display = ''; document.getElementById('vArea').textContent = p.area; }
  else        { aw.style.display = 'none'; }

  /* Фотографии */
  const photosEl    = document.getElementById('vPhotos');
  photosEl.innerHTML = urls.map(u =>
    `<img src="${escHtml(u)}" alt="${escHtml(p.name)}" loading="lazy">`
  ).join('');

  /* Открываем модалку */
  const modal = document.getElementById('viewModal');
  modal.classList.add('open');
  modal.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function closeProject() {
  document.getElementById('viewModal')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ============================================================
   9. УДАЛЕНИЕ ПРОЕКТА
   ============================================================ */

async function deleteProj(e, id) {
  e.stopPropagation();
  if (!isLoggedIn) { showNotification('❌ Нет доступа', 'error'); return; }

  const project = projectsCache.find(x => x.id == id);

  /* Проверяем права: только автор или admin могут удалять */
  if (project && currentUser !== project.uploaded_by && currentUser !== 'admin') {
    showNotification('❌ Вы можете удалять только свои проекты', 'error');
    return;
  }

  if (!confirm('Удалить этот проект и все его фотографии?')) return;

  if (!supabase) { showNotification('❌ Настройте Supabase', 'error'); return; }

  try {
    /* Удаляем фото из Storage */
    if (project && Array.isArray(project.image_urls)) {
      const paths = project.image_urls.map(url => {
        /* Извлекаем путь файла из публичного URL */
        /* URL выглядит как: https://xxx.supabase.co/storage/v1/object/public/project-photos/user/file.jpg */
        const parts = url.split(`/${STORAGE_BUCKET}/`);
        return parts[1] || null;
      }).filter(Boolean);

      if (paths.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(paths);
        /* Ошибки удаления из Storage не критичны — продолжаем */
      }
    }

    /* Удаляем запись из таблицы */
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    /* Убираем карточку из DOM */
    document.getElementById(`item-${id}`)?.remove();

    /* Убираем из кэша */
    projectsCache = projectsCache.filter(x => x.id != id);

    checkEmpty();
    showNotification('✓ Проект удалён', 'success');

  } catch (err) {
    console.error('Ошибка удаления:', err);
    showNotification('Ошибка удаления: ' + err.message, 'error');
  }
}

/* ============================================================
   10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */

/* Показать/скрыть спиннер загрузки */
function showLoadingSpinner(show) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

/* Проверить пустую галерею */
function checkEmpty() {
  const empty = document.getElementById('emptyState');
  if (!empty) return;
  /* Пустая галерея = нет карточек И нет загрузки */
  const gal  = document.getElementById('gal');
  const count = gal ? gal.querySelectorAll('.album-card').length : 0;
  empty.classList.toggle('visible', count === 0 && !isLoading);
}

/* Уведомление (заменяет alert()) */
function showNotification(msg, type = 'info') {
  /* Убираем старое если есть */
  document.getElementById('notification')?.remove();

  const n = document.createElement('div');
  n.id        = 'notification';
  n.className = `notification notification--${type}`; /* ← success / error / info */
  n.textContent = msg;
  document.body.appendChild(n);

  /* Показываем */
  requestAnimationFrame(() => n.classList.add('visible'));

  /* Автоматически скрываем через 4 секунды */
  setTimeout(() => {
    n.classList.remove('visible');
    setTimeout(() => n.remove(), 400); /* ← ждём конца анимации            */
  }, 4000);
}

/* Экранирование HTML (защита от XSS) */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Закрытие по Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeProject(); /* ← закрыть просмотр                                  */
    closeForm();    /* ← закрыть форму добавления                           */
  }
});

/* Закрытие модалки просмотра при клике на фон */
document.getElementById('viewModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeProject(); /* ← клик на фон (не на контент)  */
});

/* ============================================================
   11. ФОРМА ЗАЯВКИ (главная страница index.html)
   ============================================================ */

function submitForm(e) {
  e.preventDefault();

  const name  = document.getElementById('cName')?.value.trim();
  const phone = document.getElementById('cPhone')?.value.trim();

  /* Простая валидация */
  if (!name || !phone) {
    showNotification('Заполните имя и телефон', 'error');
    return;
  }

  const btn = document.querySelector('.btn-submit-form');
  if (btn) { btn.textContent = 'ОТПРАВЛЯЕМ...'; btn.disabled = true; }

  /* TODO: Подключить реальную отправку (Formspree / EmailJS / API)
     Пример с Formspree:
     fetch('https://formspree.io/f/ВАШ_ID', {
       method: 'POST',
       body: JSON.stringify({ name, phone }),
       headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
     })
  */
  setTimeout(() => {
    if (btn) { btn.textContent = 'ОТПРАВИТЬ ЗАЯВКУ →'; btn.disabled = false; }
    const success = document.getElementById('formSuccess');
    if (success) { success.classList.add('visible'); }
    document.getElementById('contactForm')?.reset();
    setTimeout(() => success?.classList.remove('visible'), 6000);
  }, 1000);
}
