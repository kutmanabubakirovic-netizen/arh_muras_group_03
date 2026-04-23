/* ============================================================
   config.js — ARH_MURAS_GROUP
   НАСТРОЙКИ SUPABASE (заполните свои данные)
   ============================================================

   КАК ПОЛУЧИТЬ ДАННЫЕ (БЕСПЛАТНО):
   1. Зайдите на https://supabase.com → Sign Up
   2. Создайте новый Project
   3. В левом меню → Settings → API
   4. Скопируйте "Project URL" и "anon public" ключ сюда
   5. Создайте таблицу и хранилище (см. README.md)
   ============================================================ */

/* 🔧 ЗАМЕНИТЕ НА ВАШИ ДАННЫЕ С SUPABASE.COM */
const SUPABASE_URL  = 'https://ВАШПРОЕКТ.supabase.co';   /* ← URL вашего проекта Supabase     */
const SUPABASE_ANON = 'ваш-anon-public-ключ-здесь';      /* ← anon/public ключ с вкладки API  */

/* Название bucket в Supabase Storage (создать вручную) */
const STORAGE_BUCKET = 'project-photos';                  /* ← должен совпадать с именем bucket */

/* Количество проектов на одну страницу (менять при желании) */
const PAGE_SIZE = 20;                                     /* ← 20 карточек за раз              */

/* Пароли сотрудников (храните здесь, не в скрипте) */
/* ⚠️  НЕ ПУБЛИКУЙТЕ В ОТКРЫТЫХ РЕПОЗИТОРИЯХ если пароли важные */
const EMPLOYEES = {
  'admin':      'admin2026',   /* ← логин: пароль */
  'architect1': 'archi2026',
  'architect2': 'archi2026',
  'geodesy':    'geo2026',
  'designer':   'design2026',
  'landscape':  'land2026',
  'manager':    'manager2026'
};
