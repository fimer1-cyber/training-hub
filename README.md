# Training Hub

Сайт-библиотека тренировок на React, Vite, TypeScript и Supabase.

## Возможности

- Публичный подбор опубликованных тренировок по интенсивности и группе мышц.
- Администраторский вход по magic link на email.
- Создание, редактирование, удаление и публикация тренировок.
- Загрузка PDF, CSV, Excel, TXT и документов в Supabase Storage.
- Черновики доступны администратору; посетители видят только опубликованные записи.

## Локальный запуск

1. Установите Node.js LTS.
2. Скопируйте `.env.example` в `.env`.
3. Заполните `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` значениями проекта Supabase. Используйте только publishable/anon key, никогда не добавляйте service_role или secret key.
4. Установите зависимости: `npm install`.
5. Запустите: `npm run dev`.

## Публикация

Подключите репозиторий к Vercel или Netlify как Vite-приложение. Build command: `npm run build`; output directory: `dist`. Добавьте две переменные окружения из пункта 3 в настройки хостинга.

В Supabase Authentication → URL Configuration добавьте домен опубликованного сайта в Site URL и Redirect URLs, чтобы magic link возвращал администратора на сайт.

## Supabase

Используются таблицы `training_programs`, `admin_users` и bucket `training-files`. Доступ посетителей и администратора должен контролироваться RLS-политиками Supabase. Публичный клиент использует только publishable key.
