# Quiet paragraph editor · 20 October 2026

[Открыть редактор](http://127.0.0.1:8780/2026-10-20-quiet-editor/live/index.html?skin=groove&edit=1) · [Пульт](http://127.0.0.1:8780/2026-10-20-quiet-editor/live/index.html?skin=groove)

Редактор общий для всех14 выбранных пультов. Одна компактная строка: текущий абзац, короткий статус синхронизации, Done. Ни больших рекламных заголовков, ни технического подвала. Текст получает оставшуюся высоту и прокручивается внутри поля. Тёплый светлый набор на тихом тёмном фоне сохраняет язык приложения без имитации панели прибора. Восстановление черновика/конфликт показываются только при соответствующем состоянии.

Размер и положение модального окна следуют height/width/offsetTop/offsetLeft VisualViewport; слушатели установлены до фокусировки поля. Учитываются верхний, нижний и боковые safe-area inset. Done в закреплённой верхней строке, touch target не меньше44px. Сброшен стандартный max-width диалога, отнимавший38px на узких экранах. Фокус открывает текст, остаётся внутри modal и возвращается к Quick Edit. Native skin picker сохраняет прежний вид.

Серверная синхронизация, пауза, наблюдение другого телефона, offline drafts и разрешение конфликтов не изменены. Preview честно помечен Preview и меняет только синтетический абзац.

## Проверка

- 90 unit tests, production build и diff check прошли.
- 18 browser cases прошли в Chromium/Firefox/WebKit: четыре сценария Quick Edit, парный текущий абзац с живой синхронизацией и geometry/focus проверка VisualViewport. После последней CSS-правки затронутые6 geometry/drawer cases прошли повторно.
- Видимая область250px,320px,700px с offsetTop44/76/96px и offsetLeft20px проверена независимо от layout viewport390×844. Safe insets47px сверху,34px снизу,44px по бокам заданы явно как симуляция; кнопка и текст одновременно внутри области. Отдельно проверены реальное изменение размера viewport, landscape и узкий320px экран.
- Статическая сборка:9 состояний в3 движках, поля/Done видны, edit/close/reopen/picker работают,0 page errors и0 session/account/API запросов. Снимки390×660,320×250,700×260 просмотрены визуально; отдельные simulated-* снимки показывают тест со смещением и safe insets.

Браузерная эмуляция не является физической проверкой Safari/iPhone/Android или экранной клавиатуры. Старые превью сохранены. Production/staging не изменялись. Слияния и публикации нет. Статусы GitHub не объявляются пройденными без результата.

Воспроизведение: node docs/design/2026-10-20-quiet-editor/build-review.mjs, затем node docs/design/2026-10-20-quiet-editor/verify-review.mjs при работающем локальном сервере8780. Парная проверка: npx playwright test test/e2e/paragraph-viewport.spec.ts test/e2e/quick-edit.spec.ts test/e2e/remote-viewport.spec.ts --grep 'paragraph|typing|draft|storage|conflict'.
