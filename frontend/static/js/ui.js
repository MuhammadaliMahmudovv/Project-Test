// Общие элементы интерфейса: модальное окно и просмотр картинки.
// Ничего не знают про API — только показывают и сообщают, что нажал пользователь.

// Модальное окно подтверждения. Возвращает Promise: true — «Да», false — «Отмена».
//
//   const ok = await showConfirm({
//       title: "Завершить тест?",
//       text: "Вы ответили на 8 из 10.",
//       confirmText: "Завершить",
//       cancelText: "Отмена",
//       danger: true,          // красная кнопка подтверждения
//       iconName: "flag",
//   });
function showConfirm(options) {
    return new Promise(function (resolve) {
        const previousFocus = document.activeElement;
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div class="modal-icon${options.danger ? " modal-icon-danger" : ""}">
                    ${icon(options.iconName || "alert-circle", "icon-lg")}
                </div>
                <h2 class="modal-title" id="modal-title">${options.title}</h2>
                <p class="modal-text">${options.text || ""}</p>
                <div class="modal-actions">
                    <button class="btn" data-answer="no">${options.cancelText}</button>
                    <button class="btn ${options.danger ? "btn-danger" : "btn-primary"}" data-answer="yes">
                        ${options.confirmText}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        document.body.classList.add("no-scroll");

        // Следующий кадр — чтобы сработала плавная анимация появления
        requestAnimationFrame(function () {
            backdrop.classList.add("open");
        });
        // Для опасного действия фокус на «Отмене» — чтобы случайный Enter не завершил тест
        backdrop.querySelector(options.danger ? '[data-answer="no"]' : '[data-answer="yes"]').focus();

        function close(answer) {
            document.removeEventListener("keydown", onKey);
            document.body.classList.remove("no-scroll");
            backdrop.classList.remove("open");
            setTimeout(function () {
                backdrop.remove();
            }, 180);
            if (previousFocus) {
                previousFocus.focus();
            }
            resolve(answer);
        }

        function onKey(event) {
            if (event.key === "Escape") {
                close(false);
            }
        }

        document.addEventListener("keydown", onKey);
        backdrop.addEventListener("click", function (event) {
            if (event.target === backdrop) {
                close(false); // клик по тёмному фону — как «Отмена»
            }
        });
        backdrop.querySelector('[data-answer="no"]').addEventListener("click", function () {
            close(false);
        });
        backdrop.querySelector('[data-answer="yes"]').addEventListener("click", function () {
            close(true);
        });
    });
}

// ---------- Всплывающие уведомления (toast) ----------
//   showToast("Нет связи с сервером", "error")   — красное
//   showToast("Сохранено", "success")            — зелёное
//   showToast("Подсказка")                       — обычное
// Исчезает само через 4 секунды или по клику.

function showToast(message, type) {
    let root = document.getElementById("toast-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "toast-root";
        root.className = "toast-root";
        root.setAttribute("aria-live", "polite");
        document.body.appendChild(root);
    }

    const icons = { error: "alert-circle", success: "check-circle", info: "alert-circle" };
    const kind = type || "info";
    const toast = document.createElement("div");
    toast.className = "toast toast-" + kind;
    toast.setAttribute("role", kind === "error" ? "alert" : "status");
    toast.innerHTML = `
        <span class="toast-icon">${icon(icons[kind] || icons.info)}</span>
        <span class="toast-text"></span>
        <button type="button" class="toast-close" aria-label="${t("common.close")}">${icon("x", "icon-sm")}</button>
    `;
    toast.querySelector(".toast-text").textContent = message; // textContent — защита от XSS
    root.appendChild(toast);

    // Не копим уведомления: максимум три на экране
    while (root.children.length > 3) {
        root.firstElementChild.remove();
    }

    requestAnimationFrame(function () {
        toast.classList.add("open");
    });

    function close() {
        toast.classList.remove("open");
        setTimeout(function () {
            toast.remove();
        }, 200);
    }

    toast.addEventListener("click", close);
    setTimeout(close, 4000);
}

// ---------- Скелетоны: серые заготовки, пока грузятся данные ----------
// kind — какая страница грузится, чтобы заготовка была похожа на неё.

function skeleton(kind) {
    const line = function (width, extra) {
        return `<div class="sk sk-line ${extra || ""}" style="width: ${width}"></div>`;
    };
    const card = function (inner) {
        return `<div class="card sk-card">${inner}</div>`;
    };
    const tileRow = `
        <div class="sk-row">
            <div class="sk sk-tile"></div>
            <div class="sk-col">${line("60%")}${line("35%", "sk-sm")}</div>
        </div>
    `;
    const pageHead = `
        <div class="sk-row sk-page-head">
            <div class="sk sk-tile sk-tile-lg"></div>
            <div class="sk-col">${line("180px", "sk-lg")}${line("260px", "sk-sm")}</div>
        </div>
    `;

    let html = "";
    if (kind === "home") {
        html = `
            <div class="sk sk-block sk-hero"></div>
            ${line("200px", "sk-lg sk-gap")}
            <div class="grid grid-2">${card(tileRow + line("90%") + line("70%"))}${card(tileRow + line("90%") + line("70%"))}</div>
        `;
    } else if (kind === "cards") {
        let cards = "";
        for (let i = 0; i < 6; i++) {
            cards += card(tileRow);
        }
        html = `
            ${pageHead}
            <div class="sk sk-block sk-exam"></div>
            ${line("220px", "sk-lg sk-gap")}
            <div class="grid">${cards}</div>
        `;
    } else if (kind === "form") {
        html = `
            ${pageHead}
            ${card(line("140px", "sk-lg") + '<div class="grid">' + card(tileRow) + card(tileRow) + card(tileRow) + "</div>" + line("100%", "sk-xl") + line("40%", "sk-xl"))}
        `;
    } else if (kind === "test") {
        let options = "";
        for (let i = 0; i < 4; i++) {
            options += '<div class="sk sk-option"></div>';
        }
        html = `
            <div class="sk-row sk-between">${line("200px", "sk-lg")}<div class="sk sk-pill"></div></div>
            ${line("100%", "sk-sm sk-gap")}
            <div class="sk-row">${'<div class="sk sk-square"></div>'.repeat(8)}</div>
            ${card(line("30%", "sk-sm") + line("85%", "sk-lg") + options)}
        `;
    } else {
        // "list" и всё остальное — заголовок и несколько строк
        let rows = "";
        for (let i = 0; i < 5; i++) {
            rows += card(tileRow);
        }
        html = `${pageHead}<div class="sk-list">${rows}</div>`;
    }
    return `<div class="skeleton" aria-busy="true" aria-label="${t("common.loading")}">${html}</div>`;
}

// ---------- Пустое состояние / ошибка на всю страницу ----------
//   stateBlock({ icon: "inbox", title: "...", text: "...", actionHtml: "<a ...>" })

function stateBlock(options) {
    return `
        <div class="state-block${options.danger ? " state-danger" : ""}">
            <div class="state-icon">${icon(options.icon, "icon-lg")}</div>
            <h2>${options.title}</h2>
            ${options.text ? `<p class="muted">${options.text}</p>` : ""}
            ${options.actionHtml || ""}
        </div>
    `;
}

// ---------- Тёмная / светлая тема ----------
// Начальную тему ставит маленький скрипт в <head> index.html (до отрисовки).
// Здесь — кнопка «солнце / луна» и запоминание выбора.

function isDarkTheme() {
    return document.documentElement.classList.contains("dark");
}

function applyTheme(theme, animate) {
    const root = document.documentElement;
    if (animate) {
        // Плавно меняем цвета только в момент переключения
        root.classList.add("theme-switching");
        setTimeout(function () {
            root.classList.remove("theme-switching");
        }, 300);
    }
    root.classList.toggle("dark", theme === "dark");
    updateThemeButton();
}

function updateThemeButton() {
    const button = document.getElementById("theme-toggle");
    if (!button) {
        return;
    }
    // В тёмной теме показываем солнце (переключить на светлую), в светлой — луну
    const label = isDarkTheme() ? t("theme.to_light") : t("theme.to_dark");
    button.innerHTML = icon(isDarkTheme() ? "sun" : "moon");
    button.title = label;
    button.setAttribute("aria-label", label);
}

function savedTheme() {
    try {
        return localStorage.getItem("theme");
    } catch (error) {
        return null;
    }
}

function initThemeToggle() {
    const button = document.getElementById("theme-toggle");
    updateThemeButton();

    button.addEventListener("click", function () {
        const theme = isDarkTheme() ? "light" : "dark";
        try {
            localStorage.setItem("theme", theme); // запоминаем выбор
        } catch (error) {
            // не удалось сохранить — тема всё равно переключится до перезагрузки
        }
        applyTheme(theme, true);
    });

    // Пока человек сам не выбрал тему — следуем за системой (например, ночной режим вечером)
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", function (event) {
        if (!savedTheme()) {
            applyTheme(event.matches ? "dark" : "light", true);
        }
    });
}

// Картинка на весь экран. Закрывается кликом в любом месте или клавишей Esc.
function openImage(src) {
    const viewer = document.createElement("div");
    viewer.className = "lightbox";
    viewer.innerHTML = `
        <img src="${src}" alt="">
        <button class="lightbox-close" aria-label="close">${icon("x", "icon-lg")}</button>
    `;
    document.body.appendChild(viewer);
    document.body.classList.add("no-scroll");
    requestAnimationFrame(function () {
        viewer.classList.add("open");
    });

    function close() {
        document.removeEventListener("keydown", onKey);
        document.body.classList.remove("no-scroll");
        viewer.classList.remove("open");
        setTimeout(function () {
            viewer.remove();
        }, 180);
    }

    function onKey(event) {
        if (event.key === "Escape") {
            close();
        }
    }

    document.addEventListener("keydown", onKey);
    viewer.addEventListener("click", close);
}

// Картинка вопроса, которую можно увеличить по клику
function zoomableImage(src) {
    return `
        <button type="button" class="image-zoom" data-src="${src}">
            <img src="${src}" class="question-image" alt="">
            <span class="image-zoom-hint">${icon("zoom-in", "icon-sm")}</span>
        </button>
    `;
}

// Навесить открытие на все картинки внутри container
function bindZoomableImages(container) {
    for (const button of container.querySelectorAll(".image-zoom")) {
        button.addEventListener("click", function () {
            openImage(button.dataset.src);
        });
    }
}
