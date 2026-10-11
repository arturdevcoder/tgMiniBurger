# Burger Shop — Telegram Mini App

Меню бургеров, корзина и оформление заказа. Стек: React 18 + Vite.

## Запуск

```bash
npm install
npm run dev      # локальная разработка на http://localhost:5173
npm run build    # production-сборка в папку dist/
```

В обычном браузере приложение работает полностью (заказ выводится в консоль).

## Подключение к Telegram

1. Разместите `dist/` на HTTPS-хостинге (Vercel, Netlify, GitHub Pages, Cloudflare Pages)
   или для теста используйте туннель: `npx ngrok http 5173`.
2. Создайте бота через [@BotFather](https://t.me/BotFather): `/newbot`.
3. Укажите адрес приложения: `/newapp` или `/setmenubutton` с URL вашего сайта.
4. Откройте бота и нажмите кнопку меню — магазин откроется внутри Telegram.

## Как работает заказ

Кнопка «Оформить» в Telegram отправляет JSON через `Telegram.WebApp.sendData()`.
Бот получит его в обновлении `web_app_data`, например на Python (aiogram / python-telegram-bot):

```python
from aiogram import Router, F
from aiogram.types import Message
import json

router = Router()

@router.message(F.web_app_data)
async def on_order(message: Message):
    order = json.loads(message.web_app_data.data)
    await message.answer(f"Заказ принят! Итого: {order['total']} ₽")
```

Обратите внимание: `sendData` работает только если приложение открыто кнопкой
клавиатуры или меню бота (`reply_markup` с `web_app`), а не по inline-ссылке.

## Структура

```
src/
  App.jsx       — экраны меню, корзины и оформления, интеграция с MainButton/BackButton
  data.js       — меню и форматирование цены (редактируйте блюда здесь)
  styles.css    — стили на CSS-переменных Telegram (тема подстраивается автоматически)
  main.jsx      — точка входа
```
