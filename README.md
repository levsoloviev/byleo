# byleo.org

Сайт byleo.org на **GitHub Pages**: ветка `main`, корень репозитория. Подписку принимает маленькая функция на **Cloudflare Workers** (бесплатно): GitHub Pages умеет показывать только готовые файлы и не может хранить секретный ключ systeme.io.

```
index.html              ← главная = страница подписки на бесплатное Yoga Nidra аудио
assets/                 ← картинка, фото, превью для соцсетей
privacy/index.html      ← политика конфиденциальности (черновик — проверить)
CNAME                   ← домен byleo.org для GitHub Pages
_signup-worker/         ← код функции подписки для Cloudflare (GitHub Pages эту папку не показывает)
```

## Как работает подписка

1. Человек вводит email на byleo.org и нажимает кнопку.
2. Страница отправляет адрес функции подписки на Cloudflare. Её адрес записан в `index.html` в строке `SIGNUP_URL`.
3. Функция через API systeme.io находит или создаёт контакт и ставит ему тег `yoga-nidra-optin`. Если тега нет, она создаёт его при первой подписке.
4. Правило в systeme.io «тег добавлен» записывает человека на бесплатный курс и отправляет письмо с аудио.

Ключ API systeme.io хранится только в настройках функции на Cloudflare — его нет ни на странице, ни в этом репозитории.

## Запуск — один раз

### 1. DNS у Porkbun → GitHub Pages
Porkbun → Domain Management → byleo.org → **DNS**:
1. Удали записи-заглушки Porkbun: ALIAS/A для `byleo.org` и CNAME `www` → `pixie.porkbun.com`.
2. Добавь четыре записи **A** для `byleo.org` (поле Host пустое):
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. Добавь **CNAME**: Host `www` → `levsoloviev.github.io`
4. Подожди от 10 минут до пары часов. Потом в GitHub → Settings → Pages нажми **Check again**, а когда проверка пройдёт — включи **Enforce HTTPS**.

### 2. Ключ API в systeme.io
Аватар → **Settings** → **MCP & API keys** → создать ключ, например «byleo.org signup». Скопируй его сразу — потом он не показывается. Никуда его не пересылай.

### 3. Функция подписки на Cloudflare
1. Зарегистрируйся на cloudflare.com (бесплатно) → **Workers & Pages** → **Create** → **Create Worker** → назови `byleo-signup` → **Deploy**.
2. **Edit code** → удали пример, вставь всё из `_signup-worker/worker.js` → **Deploy**.
3. **Settings → Variables and Secrets** → **Add** → тип **Secret**, имя `SYSTEME_API_KEY`, значение — ключ из шага 2 → **Deploy**.
4. Скопируй адрес функции — он вида `https://byleo-signup.<твоё-имя>.workers.dev`.
5. В `index.html` замени `https://byleo-signup.REPLACE-ME.workers.dev` на этот адрес, закоммить и отправь на GitHub.

### 4. Правило в systeme.io
1. Создай бесплатный курс с уроком «Yoga Nidra»: видео и MP3.
2. **Automation → Rules → Create**:
   - Trigger: **Tag added** → `yoga-nidra-optin`
   - Actions: **Enroll in course** (бесплатный курс) и **Send email** (письмо с доступом к аудио).
3. Тег появится сам после первой подписки. Можно и заранее создать его в **Contacts → Tags** с тем же именем.

### 5. Проверка
Открой byleo.org на телефоне и подпишись своим адресом. Проверь, что в systeme.io появился контакт с тегом `yoga-nidra-optin`, а на почту пришло письмо.

## Если что-то не работает
- **На странице «Something went wrong»:** открой адрес функции в браузере — должно показать «byleo.org signup». Ошибки видны в Cloudflare → Workers → byleo-signup → **Logs**. Например, «find contact: 401» значит, что ключ неверный или не задан.
- **Сайт открывается с другого адреса** (не byleo.org и не www.byleo.org): добавь этот адрес в переменную `ALLOWED_ORIGINS` функции, через запятую.
