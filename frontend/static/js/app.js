// Страницы сайта. Адрес страницы хранится после # в адресной строке,
// например  /#/session/5  — так страница не перезагружается при переходах.

const app = document.getElementById("app");
const nav = document.getElementById("nav");

let currentTimer = null; // таймер теста, чтобы остановить его при уходе со страницы
let testKeyHandler = null; // стрелки ← → на странице теста, чтобы отключить их при уходе

const DIFFICULTY_LABELS = {
    easy: "Лёгкий",
    medium: "Средний",
    hard: "Сложный",
};

// ---------- Вспомогательные функции ----------

// Защита от XSS: текст из базы вставляем в HTML только через эту функцию
function esc(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

// "2.00" -> "2", "1.50" -> "1.5"
function formatNumber(value) {
    return String(Number(value));
}

const OPTION_LETTERS = "ABCDEFGH";

// Варианты всегда в одном порядке (по id) — чтобы буква «B» во время теста
// и в разборе результата обозначала один и тот же вариант
function sortedOptions(question) {
    return [...question.options].sort(function (a, b) {
        return a.id - b.id;
    });
}

function optionLetter(index) {
    return OPTION_LETTERS[index] || String(index + 1);
}

function formatDate(value) {
    if (!value) {
        return "";
    }
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// Пока данные грузятся — серая заготовка страницы (см. skeleton в ui.js)
function showLoading(kind) {
    app.innerHTML = skeleton(kind);
}

// Страница не загрузилась: всплывающее уведомление + блок с кнопкой «Повторить»
function showError(error) {
    // 404 от Django приходит по-английски («No ... matches the given query») — заменяем на понятный текст
    const message = error.status === 404 ? t("error.not_found") : error.message;
    showToast(message, "error");
    app.innerHTML = stateBlock({
        icon: "alert-circle",
        title: t("error.title"),
        text: esc(message),
        danger: true,
        actionHtml: `<button type="button" class="btn btn-primary" id="retry-btn">${icon("history")}${t("error.retry")}</button>`,
    });
    document.getElementById("retry-btn").addEventListener("click", router);
}

// Название теста для карточек: экзамен → тема → предмет → категория
function sessionTitle(session) {
    if (session.exam_title) {
        return session.exam_title;
    }
    if (session.topic_title) {
        return session.topic_title;
    }
    if (session.subject_title) {
        return cleanSubjectTitle(session.subject_title);
    }
    return session.category_title;
}

// Вид теста: экзамен, тренировка или работа над ошибками (иконка + текст)
function sessionMode(session) {
    if (session.mode === "exam") {
        return { icon: "trophy", title: t("test.mode.exam") };
    }
    if (session.retry_of) {
        return { icon: "rotate-ccw", title: t("test.mode.mistakes") };
    }
    return { icon: "book-open", title: t("test.mode.practice") };
}

function stopTimer() {
    if (currentTimer) {
        clearInterval(currentTimer);
        currentTimer = null;
    }
}

function removeTestKeys() {
    if (testKeyHandler) {
        document.removeEventListener("keydown", testKeyHandler);
        testKeyHandler = null;
    }
}

// Одна ссылка в шапке. На телефоне текст скрывается — остаётся иконка
function navLink(href, iconName, label, id) {
    const hash = location.hash || "#/";
    // «Админка» подсвечена на всех своих страницах (#/admin/questions и т.д.)
    const inAdmin = href === "#/admin" && hash.startsWith("#/admin");
    const active = href !== "#" && (hash === href || inAdmin) ? " active" : "";
    const idAttr = id ? ` id="${id}"` : "";
    return `
        <a href="${href}" class="nav-link${active}"${idAttr} title="${label}">
            ${icon(iconName)}<span class="nav-label">${label}</span>
        </a>
    `;
}

function renderNav() {
    if (isLoggedIn()) {
        nav.innerHTML =
            navLink("#/", "house", t("nav.home")) +
            navLink("#/history", "history", t("nav.history")) +
            (isStaff() ? navLink("#/admin", "shield", t("nav.admin")) : "") +
            navLink("#", "log-out", t("nav.logout"), "logout-link");
        document.getElementById("logout-link").addEventListener("click", logout);
    } else {
        nav.innerHTML =
            navLink("#/login", "log-in", t("nav.login")) +
            navLink("#/register", "user", t("nav.register"));
    }
}

async function logout(event) {
    event.preventDefault();

    // Сначала спрашиваем, точно ли пользователь хочет выйти
    const ok = await showConfirm({
        title: t("logout.confirm.title"),
        text: t("logout.confirm.text"),
        confirmText: t("logout.confirm.yes"),
        cancelText: t("logout.confirm.no"),
        iconName: "log-out",
    });
    if (!ok) {
        return;
    }

    try {
        await api("POST", "/logout/", { refresh: getRefreshToken() });
    } catch (error) {
        // Даже если сервер не ответил — выходим на этом устройстве
    }
    clearTokens();
    forgetMe();
    try {
        localStorage.removeItem("username");
    } catch (error) {
        // ничего страшного
    }
    location.hash = "#/login";
}

// ---------- Вход и регистрация ----------

function pageLogin() {
    renderAuthForm(
        {
            title: t("auth.login.title"),
            subtitle: t("auth.login.subtitle"),
            button: t("auth.login.button"),
            switchText: t("auth.no_account"),
            switchLink: "#/register",
            switchLabel: t("nav.register"),
        },
        async function (username, password) {
            const data = await api("POST", "/login/", { username: username, password: password });
            saveTokens(data.access, data.refresh);
            rememberUsername(username);
            await loadMe();
        }
    );
}

// Логин нужен только для приветствия на главной — храним в браузере
function rememberUsername(username) {
    try {
        localStorage.setItem("username", username);
    } catch (error) {
        // недоступно — приветствие будет без имени
    }
}

function pageRegister() {
    renderAuthForm(
        {
            title: t("auth.register.title"),
            subtitle: t("auth.register.subtitle"),
            button: t("auth.register.button"),
            switchText: t("auth.have_account"),
            switchLink: "#/login",
            switchLabel: t("nav.login"),
        },
        async function (username, password) {
            await api("POST", "/register/", { username: username, password: password });
            // После регистрации сразу входим
            const data = await api("POST", "/login/", { username: username, password: password });
            saveTokens(data.access, data.refresh);
            rememberUsername(username);
            await loadMe();
        }
    );
}

function renderAuthForm(texts, onSubmit) {
    app.innerHTML = `
        <div class="card auth-card">
            <div class="auth-icon">${icon("graduation-cap", "icon-lg")}</div>
            <h1 class="auth-title">${texts.title}</h1>
            <p class="muted auth-subtitle">${texts.subtitle}</p>
            <form id="auth-form">
                <label>${t("auth.username")}
                    <span class="input-icon">
                        ${icon("user", "icon-sm")}
                        <input name="username" required autocomplete="username">
                    </span>
                </label>
                <label>${t("auth.password")}
                    <span class="input-icon">
                        ${icon("lock", "icon-sm")}
                        <input name="password" type="password" required autocomplete="current-password">
                    </span>
                </label>
                <div id="form-error"></div>
                <button type="submit" class="btn btn-primary btn-block">${texts.button}</button>
            </form>
            <p class="auth-switch muted">
                ${texts.switchText} <a href="${texts.switchLink}">${texts.switchLabel}</a>
            </p>
        </div>
    `;

    const form = document.getElementById("auth-form");
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;

        try {
            await onSubmit(form.username.value.trim(), form.password.value);
            location.hash = "#/";
        } catch (error) {
            document.getElementById("form-error").innerHTML =
                `<div class="alert alert-error">${esc(error.message)}</div>`;
            button.disabled = false;
        }
    });
}

// ---------- Иконки и цвета предметов ----------

// Подбираем иконку и цвет по slug или названию (у тем в API есть только название).
// Чтобы добавить новый предмет — допишите строку сюда.
const SUBJECT_VISUALS = [
    { match: "matematika", icon: "calculator", tint: "indigo" },
    { match: "fizika", icon: "atom", tint: "blue" },
    { match: "kimyo", icon: "flask", tint: "violet" },
    { match: "biologiya", icon: "leaf", tint: "emerald" },
    { match: "tarix", icon: "landmark", tint: "amber" },
    { match: "ona-tili", icon: "pencil", tint: "rose" },
    { match: "ingliz", icon: "globe", tint: "cyan" },
    { match: "belgi", icon: "signpost", tint: "amber" },
    { match: "svetofor", icon: "traffic-light", tint: "rose" },
    { match: "chorraha", icon: "car", tint: "blue" },
    { match: "yordam", icon: "heart", tint: "emerald" },
];

function subjectVisual(slugOrTitle) {
    const text = (slugOrTitle || "").toLowerCase();
    for (const item of SUBJECT_VISUALS) {
        if (text.includes(item.match)) {
            return item;
        }
    }
    return { icon: "book-open", tint: "indigo" };
}

// Цветной квадратик с иконкой
function tileIcon(iconName, tint, size) {
    return `<span class="tile-icon tint-${tint}${size ? " tile-icon-" + size : ""}">${icon(iconName)}</span>`;
}

// Обязательный предмет ДТМ отличаем по слову «majburiy» в названии или slug.
// В API отдельного поля для этого нет.
function isMandatory(subject) {
    return /majburiy/i.test(subject.title) || /majburiy/i.test(subject.slug);
}

// «Matematika (majburiy)» → «Matematika»
function cleanSubjectTitle(title) {
    return title.replace(/\s*\(majburiy\)\s*/i, " ").trim();
}

// ---------- Главная ----------

async function pageHome() {
    // Цифры (предметы, темы, вопросы) считает сервер — /api/categories/
    const results = await Promise.all([
        api("GET", "/sessions/?status=in_progress"),
        api("GET", "/categories/"),
    ]);
    const active = results[0];
    let dtm = null;
    let avto = null;
    for (const category of results[1]) {
        if (category.slug === "dtm") {
            dtm = category;
        }
        if (category.slug === "avto") {
            avto = category;
        }
    }

    let username = null;
    try {
        username = localStorage.getItem("username");
    } catch (error) {
        // недоступно — просто без имени
    }
    const hello = username ? t("home.hello_name", { name: esc(username) }) : t("home.hello");

    let activeHtml = "";
    if (active.length > 0) {
        const session = active[0];
        const title = sessionTitle(session);
        activeHtml = `
            <a href="#/session/${session.id}" class="active-test">
                <span class="active-test-icon">${icon("clock")}</span>
                <span class="active-test-body">
                    <span class="active-test-title">${t("home.active.title")}</span>
                    <span class="active-test-name">${esc(title)}</span>
                </span>
                <span class="btn btn-primary">${t("home.active.button")}${icon("arrow-right")}</span>
            </a>
        `;
    }

    let dtmStats = "";
    if (dtm) {
        dtmStats = `
            <span class="stat-chip">${icon("book-open", "icon-sm")}${tn("plural.subjects", dtm.subjects_count)}</span>
            <span class="stat-chip">${icon("list", "icon-sm")}${tn("plural.questions", dtm.questions_count)}</span>
        `;
    }
    let avtoStats = "";
    if (avto) {
        avtoStats = `
            <span class="stat-chip">${icon("layers", "icon-sm")}${tn("plural.topics", avto.topics_count)}</span>
            <span class="stat-chip">${icon("list", "icon-sm")}${tn("plural.questions", avto.questions_count)}</span>
        `;
    }

    app.innerHTML = `
        <section class="hero">
            <p class="hero-hello">${hello}</p>
            <h1 class="hero-title">${t("home.title")}</h1>
            <p class="hero-text">${t("home.text")}</p>
            <div class="hero-actions">
                <a href="#/dtm" class="btn btn-primary">${icon("graduation-cap")}${t("home.start_dtm")}</a>
                <a href="#/avto" class="btn btn-light">${icon("car")}${t("home.start_avto")}</a>
            </div>
        </section>

        ${activeHtml}

        <h2>${t("home.choose")}</h2>
        <div class="grid grid-2">
            <a href="#/dtm" class="card card-link direction-card">
                ${tileIcon("graduation-cap", "indigo", "lg")}
                <h3>ДТМ</h3>
                <p class="muted">${t("home.dtm.text")}</p>
                <div class="stat-chips">${dtmStats}</div>
                <span class="card-arrow">${icon("arrow-right")}</span>
            </a>
            <a href="#/avto" class="card card-link direction-card">
                ${tileIcon("car", "amber", "lg")}
                <h3>Авто</h3>
                <p class="muted">${t("home.avto.text")}</p>
                <div class="stat-chips">${avtoStats}</div>
                <span class="card-arrow">${icon("arrow-right")}</span>
            </a>
        </div>
    `;
}

// ---------- Карточка экзамена с градиентом ----------

function renderExamHero(exam) {
    let chips = `
        <span class="exam-chip">${icon("list", "icon-sm")}${tn("plural.questions", exam.questions_count)}</span>
        <span class="exam-chip">${icon("clock", "icon-sm")}${t("exam.minutes", { count: exam.time_limit })}</span>
    `;
    if (exam.max_mistakes !== null) {
        chips += `<span class="exam-chip">${icon("alert-circle", "icon-sm")}${t("exam.max_mistakes", { times: tn("plural.times", exam.max_mistakes) })}</span>`;
    } else {
        chips += `<span class="exam-chip">${icon("layers", "icon-sm")}${tn("plural.sections", exam.sections.length)}</span>`;
    }

    return `
        <a href="#/exam/${exam.id}" class="exam-hero">
            <span class="exam-hero-icon">${icon("trophy", "icon-lg")}</span>
            <span class="exam-hero-body">
                <span class="exam-hero-title">${esc(exam.title)}</span>
                <span class="exam-chips">${chips}</span>
            </span>
            <span class="btn btn-white">${t("exam.start")}${icon("arrow-right")}</span>
        </a>
    `;
}

function renderExamList(exams) {
    if (exams.length === 0) {
        return `<p class="muted">${t("category.no_exams")}</p>`;
    }
    let html = '<div class="exam-list">';
    for (const exam of exams) {
        html += renderExamHero(exam);
    }
    html += "</div>";
    return html;
}

// Карточка предмета или темы
function renderSubjectCard(href, slug, title, extraHtml) {
    const visual = subjectVisual(slug);
    return `
        <a href="${href}" class="card card-link subject-card">
            ${tileIcon(visual.icon, visual.tint)}
            <span class="subject-card-body">
                <span class="subject-card-title">${esc(title)}</span>
                ${extraHtml || ""}
            </span>
            ${icon("chevron-right", "subject-card-arrow")}
        </a>
    `;
}

// ---------- ДТМ ----------

async function pageDTM() {
    const results = await Promise.all([api("GET", "/tests/"), api("GET", "/exams/?category=dtm")]);
    const categories = results[0];
    const exams = results[1];

    if (categories.length === 0) {
        app.innerHTML = `<p class="muted">${t("category.not_found")}</p>`;
        return;
    }
    const category = categories[0];

    let mandatoryHtml = "";
    let profileHtml = "";
    for (const subject of category.subjects) {
        // topics_count и questions_count считает сервер
        const meta = `
            <span class="subject-card-meta">
                ${tn("plural.topics", subject.topics_count)} · ${tn("plural.questions", subject.questions_count)}
            </span>
        `;
        const card = renderSubjectCard(
            "#/subject/" + esc(subject.slug),
            subject.slug,
            cleanSubjectTitle(subject.title),
            meta
        );
        if (isMandatory(subject)) {
            mandatoryHtml += card;
        } else {
            profileHtml += card;
        }
    }

    let subjectsHtml = "";
    if (mandatoryHtml) {
        subjectsHtml += `
            <div class="section-head">
                <h2>${t("category.mandatory")}</h2>
                <p class="muted">${t("category.mandatory.text")}</p>
            </div>
            <div class="grid">${mandatoryHtml}</div>
        `;
    }
    if (profileHtml) {
        subjectsHtml += `
            <div class="section-head">
                <h2>${mandatoryHtml ? t("category.profile") : t("category.subjects")}</h2>
                ${mandatoryHtml ? `<p class="muted">${t("category.profile.text")}</p>` : ""}
            </div>
            <div class="grid">${profileHtml}</div>
        `;
    }

    app.innerHTML = `
        <div class="page-head">
            ${tileIcon("graduation-cap", "indigo", "lg")}
            <div>
                <h1>${esc(category.title)}</h1>
                <p class="muted">${t("home.dtm.text")}</p>
            </div>
        </div>
        <h2>${t("category.exam")}</h2>
        ${renderExamList(exams)}
        ${subjectsHtml}
    `;
}

async function pageSubject(slug) {
    const subjects = await api("GET", "/subjects/" + slug + "/topics/");
    if (subjects.length === 0) {
        app.innerHTML = `<p class="muted">${t("subject.not_found")}</p>`;
        return;
    }
    const subject = subjects[0];
    const visual = subjectVisual(subject.slug);

    app.innerHTML = `
        <a href="#/dtm" class="back-link">${icon("arrow-left", "icon-sm")}${t("common.back")}</a>
        <div class="page-head">
            ${tileIcon(visual.icon, visual.tint, "lg")}
            <div>
                <h1>${esc(cleanSubjectTitle(subject.title))}</h1>
                <p class="muted">
                    ${tn("plural.topics", subject.topics_count)} · ${tn("plural.questions", subject.questions_count)}
                </p>
            </div>
        </div>
        <div class="card">
            <h2>${t("practice.title")}</h2>
            <div id="practice-form"></div>
        </div>
    `;
    // subject передаём целиком: в нём есть questions_count и difficulty_counts для «Все темы»
    renderPracticeForm(document.getElementById("practice-form"), subject, subject.topics);
}

// ---------- Авто ----------

async function pageAvto() {
    const results = await Promise.all([api("GET", "/avto/"), api("GET", "/exams/?category=avto")]);
    const categories = results[0];
    const exams = results[1];

    if (categories.length === 0) {
        app.innerHTML = `<p class="muted">${t("category.not_found")}</p>`;
        return;
    }
    const category = categories[0];

    app.innerHTML = `
        <div class="page-head">
            ${tileIcon("car", "amber", "lg")}
            <div>
                <h1>${esc(category.title)}</h1>
                <p class="muted">${t("home.avto.text")}</p>
            </div>
        </div>
        <h2>${t("category.exam.avto")}</h2>
        ${renderExamList(exams)}
        <div class="card">
            <h2>${t("category.topics")}</h2>
            <div id="practice-form"></div>
        </div>
    `;
    // У Авто нет предметов, поэтому тренировка только по одной теме
    renderPracticeForm(document.getElementById("practice-form"), null, category.topics);
}

// ---------- Тренировка: форма настроек ----------

// Сколько минут даём на один вопрос, когда время подставляется автоматически
const MINUTES_PER_QUESTION = 2;
const MAX_TIME_LIMIT = 240;

// subject = null значит, что «все темы» выбрать нельзя (как в Авто).
// Количество вопросов в базе приходит с сервера: questions_count и difficulty_counts
// у предмета и у каждой темы.
function renderPracticeForm(container, subject, topics) {
    if (!subject && topics.length === 0) {
        container.innerHTML = `<p class="muted">${t("practice.no_topics")}</p>`;
        return;
    }

    const topicsById = {};
    for (const topic of topics) {
        topicsById[topic.id] = topic;
    }

    // Сколько вопросов есть в базе для выбранной темы и сложности
    function availableCount(topicValue, difficulty) {
        const counts = topicValue ? topicsById[topicValue] : subject;
        if (!counts) {
            return 0;
        }
        return difficulty ? counts.difficulty_counts[difficulty] : counts.questions_count;
    }

    // Темы — карточками. Значение "" означает «все темы предмета»
    let topicsHtml = "";
    let firstAvailableChecked = false;
    if (subject) {
        topicsHtml += `
            <label class="choice-card">
                <input type="radio" name="topic" value="" checked>
                ${tileIcon("layers", "indigo", "sm")}
                <span class="choice-card-body">
                    <span>${t("practice.all_topics")}</span>
                    <small class="muted">${tn("plural.questions", subject.questions_count)}</small>
                </span>
            </label>
        `;
        firstAvailableChecked = true;
    }
    for (const topic of topics) {
        const visual = subjectVisual(topic.title);
        const empty = topic.questions_count === 0;
        let checked = "";
        if (!firstAvailableChecked && !empty) {
            checked = " checked";
            firstAvailableChecked = true;
        }
        topicsHtml += `
            <label class="choice-card${empty ? " is-disabled" : ""}">
                <input type="radio" name="topic" value="${topic.id}"${checked}${empty ? " disabled" : ""}>
                ${tileIcon(visual.icon, visual.tint, "sm")}
                <span class="choice-card-body">
                    <span>${esc(topic.title)}</span>
                    <small class="muted">${tn("plural.questions", topic.questions_count)}</small>
                </span>
            </label>
        `;
    }

    const difficulties = [
        ["", t("practice.any")],
        ["easy", t("practice.easy")],
        ["medium", t("practice.medium")],
        ["hard", t("practice.hard")],
    ];
    let difficultyHtml = "";
    for (const [value, label] of difficulties) {
        // data-level — для цвета: лёгкий зелёный, средний жёлтый, сложный красный
        difficultyHtml += `
            <label class="segment" data-level="${value || "any"}">
                <input type="radio" name="difficulty" value="${value}"${value === "" ? " checked" : ""}>
                <span>${label}</span>
            </label>
        `;
    }

    // novalidate — отключаем стандартные подсказки браузера, показываем свои
    container.innerHTML = `
        <form id="start-practice" novalidate>
            <div class="field">
                <span class="field-label">${t("practice.topic")}</span>
                <div class="choice-grid">${topicsHtml}</div>
            </div>
            <div class="field">
                <span class="field-label">${t("practice.difficulty")}</span>
                <div class="segmented">${difficultyHtml}</div>
            </div>
            <div class="row">
                <label>${t("practice.count")}
                    <input name="questions_count" type="number" min="1" inputmode="numeric" placeholder="0">
                    <span class="field-error" id="count-error"></span>
                </label>
                <label>${t("practice.time")}
                    <input name="time_limit" type="number" min="1" max="240" inputmode="numeric" placeholder="0">
                    <span class="field-error" id="time-error"></span>
                </label>
            </div>
            <div id="form-error"></div>
            <button type="submit" class="btn btn-primary btn-lg">${icon("play")}${t("practice.start")}</button>
        </form>
    `;

    const form = document.getElementById("start-practice");
    const submitButton = form.querySelector('button[type="submit"]');
    const countInput = form.questions_count;
    const timeInput = form.time_limit;

    function selectedTopic() {
        const checked = form.querySelector('input[name="topic"]:checked');
        return checked ? checked.value : "";
    }

    function selectedDifficulty() {
        const checked = form.querySelector('input[name="difficulty"]:checked');
        return checked ? checked.value : "";
    }

    // Обновляем счётчики у сложностей, подсказку и проверку полей
    function update() {
        const topicValue = selectedTopic();

        // Сложность, по которой 0 вопросов, выбрать нельзя
        for (const input of form.querySelectorAll('input[name="difficulty"]')) {
            const count = availableCount(topicValue, input.value);
            input.disabled = count === 0;
            input.closest(".segment").classList.toggle("is-disabled", count === 0);
            if (input.checked && input.disabled) {
                form.querySelector('input[name="difficulty"][value=""]').checked = true;
            }
        }

        const available = availableCount(topicValue, selectedDifficulty());
        countInput.max = Math.min(available, 100);

        validate();
    }

    // Возвращает true, если всё заполнено правильно
    function validate() {
        const available = availableCount(selectedTopic(), selectedDifficulty());
        let countError = "";
        let timeError = "";

        if (available === 0) {
            countError = t("practice.none");
        } else if (countInput.value !== "") {
            const count = Number(countInput.value);
            if (!Number.isInteger(count) || count < 1) {
                countError = t("practice.count_invalid");
            } else if (count > available) {
                countError = t("practice.too_many", { count: tn("plural.questions", available) });
            } else if (count > 100) {
                countError = t("practice.max_100");
            }
        }

        if (timeInput.value !== "") {
            const minutes = Number(timeInput.value);
            if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
                timeError = t("practice.time_invalid");
            }
        }

        document.getElementById("count-error").textContent = countError;
        document.getElementById("time-error").textContent = timeError;
        countInput.classList.toggle("is-invalid", countError !== "");
        timeInput.classList.toggle("is-invalid", timeError !== "");
        submitButton.disabled = countError !== "" || timeError !== "";
        return countError === "" && timeError === "";
    }

    // Время считается само: вопросов × 2 мин. Если пользователь изменил время вручную —
    // больше не перезаписываем. Если очистил поле — снова считаем автоматически.
    let timeEditedByUser = false;

    function autoFillTime() {
        if (timeEditedByUser) {
            return;
        }
        const count = Number(countInput.value);
        if (countInput.value !== "" && Number.isInteger(count) && count > 0) {
            timeInput.value = Math.min(count * MINUTES_PER_QUESTION, MAX_TIME_LIMIT);
        } else {
            timeInput.value = "";
        }
    }

    form.addEventListener("change", update);
    countInput.addEventListener("input", function () {
        autoFillTime();
        validate();
    });
    timeInput.addEventListener("input", function () {
        timeEditedByUser = timeInput.value !== "";
        validate();
    });
    update();

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!validate()) {
            return;
        }

        // Отправляем только заполненные поля — остальное сервер возьмёт по умолчанию
        const body = {};
        const topicValue = selectedTopic();
        if (topicValue) {
            body.topic = Number(topicValue);
        } else {
            body.subject = subject.id;
        }
        if (selectedDifficulty()) {
            body.difficulty = selectedDifficulty();
        }
        if (countInput.value) {
            body.questions_count = Number(countInput.value);
        }
        if (timeInput.value) {
            body.time_limit = Number(timeInput.value);
        }

        await startSession(form, "/sessions/practice/", body);
    });
}

async function startSession(form, url, body) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const session = await api("POST", url, body);
        location.hash = "#/session/" + session.id;
    } catch (error) {
        document.getElementById("form-error").innerHTML =
            `<div class="alert alert-error">${icon("alert-circle")}${esc(error.message)}</div>`;
        button.disabled = false;
    }
}

// ---------- Экзамен: страница перед началом ----------

async function pageExam(examId) {
    // Отдельного адреса для одного экзамена нет, поэтому ищем в общем списке
    const exams = await api("GET", "/exams/");
    let exam = null;
    for (const item of exams) {
        if (item.id === examId) {
            exam = item;
        }
    }
    if (!exam) {
        app.innerHTML = `<p class="muted">${t("exam.not_found")}</p>`;
        return;
    }

    let sectionsHtml = "";
    let choiceCount = 0;
    const fixedSubjectIds = [];
    for (const section of exam.sections) {
        if (section.is_choice) {
            choiceCount += 1;
        }
        if (section.subject) {
            fixedSubjectIds.push(section.subject.id);
        }
        const visual = section.subject ? subjectVisual(section.subject.slug) : { icon: "plus", tint: "indigo" };
        sectionsHtml += `
            <div class="section-row">
                ${tileIcon(visual.icon, visual.tint, "sm")}
                <span class="section-row-title">
                    ${esc(section.title)}
                    ${section.is_choice ? `<span class="badge badge-primary">${t("exam.choice")}</span>` : ""}
                </span>
                <span class="section-row-meta">
                    <b>${tn("plural.questions", section.questions_count)}</b>
                    <span class="muted">${t("exam.points", { points: formatNumber(section.points) })}</span>
                </span>
            </div>
        `;
    }

    let chips = `
        <span class="exam-chip">${icon("list", "icon-sm")}${tn("plural.questions", exam.questions_count)}</span>
        <span class="exam-chip">${icon("clock", "icon-sm")}${t("exam.minutes", { count: exam.time_limit })}</span>
    `;
    if (exam.max_mistakes !== null) {
        chips += `<span class="exam-chip">${icon("alert-circle", "icon-sm")}${t("exam.max_mistakes", { times: tn("plural.times", exam.max_mistakes) })}</span>`;
    }

    app.innerHTML = `
        <a href="javascript:history.back()" class="back-link">${icon("arrow-left", "icon-sm")}${t("common.back")}</a>
        <div class="exam-banner">
            <span class="exam-hero-icon">${icon("trophy", "icon-lg")}</span>
            <div>
                <h1>${esc(exam.title)}</h1>
                <div class="exam-chips">${chips}</div>
            </div>
        </div>
        <div class="card">
            <h2>${t("exam.sections")}</h2>
            <div class="section-list">${sectionsHtml}</div>
        </div>
        <form id="start-exam">
            <div id="subject-choice"></div>
            <div id="form-error"></div>
            <button type="submit" class="btn btn-primary btn-lg btn-block">${icon("play")}${t("exam.start_exam")}</button>
        </form>
    `;

    const choiceContainer = document.getElementById("subject-choice");
    if (exam.subject_pairs.length > 0) {
        // Разрешены только определённые пары предметов — показываем карточками
        let pairsHtml = "";
        for (const pair of exam.subject_pairs) {
            const first = subjectVisual(pair.first_subject.slug);
            const second = subjectVisual(pair.second_subject.slug);
            pairsHtml += `
                <label class="choice-card pair-card">
                    <input type="radio" name="pair" value="${pair.first_subject.id},${pair.second_subject.id}" required>
                    <span class="pair-icons">
                        ${tileIcon(first.icon, first.tint, "sm")}
                        ${tileIcon(second.icon, second.tint, "sm")}
                    </span>
                    <span class="pair-names">
                        <b>${esc(cleanSubjectTitle(pair.first_subject.title))}</b>
                        <span class="muted">+ ${esc(cleanSubjectTitle(pair.second_subject.title))}</span>
                    </span>
                    <span class="choice-check">${icon("check", "icon-sm")}</span>
                </label>
            `;
        }
        choiceContainer.innerHTML = `
            <div class="card">
                <h2>${t("exam.choose_pair")}</h2>
                <div class="choice-grid choice-grid-wide">${pairsHtml}</div>
            </div>
        `;
    } else if (choiceCount > 0) {
        // Пар нет — можно выбрать любые предметы категории, кроме обязательных
        const categories = await api("GET", "/tests/");
        let options = `<option value="">${t("exam.choose_placeholder")}</option>`;
        for (const subject of categories[0].subjects) {
            if (!fixedSubjectIds.includes(subject.id)) {
                options += `<option value="${subject.id}">${esc(cleanSubjectTitle(subject.title))}</option>`;
            }
        }
        let selectsHtml = "";
        for (let i = 1; i <= choiceCount; i++) {
            selectsHtml += `<label>${t("exam.choose_subject", { number: i })}<select name="subject" required>${options}</select></label>`;
        }
        choiceContainer.innerHTML = `
            <div class="card">
                <h2>${t("exam.choose_pair")}</h2>
                ${selectsHtml}
            </div>
        `;
    }

    const form = document.getElementById("start-exam");
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        let subjects = [];
        const checkedPair = form.querySelector('input[name="pair"]:checked');
        if (checkedPair) {
            subjects = checkedPair.value.split(",").map(Number);
        } else {
            for (const select of form.querySelectorAll('select[name="subject"]')) {
                subjects.push(Number(select.value));
            }
        }

        await startSession(form, "/sessions/exam/", { exam: exam.id, subjects: subjects });
    });
}

// ---------- Тест: прохождение или результат ----------

async function pageSession(sessionId) {
    const session = await api("GET", "/sessions/" + sessionId + "/");
    if (session.status === "finished") {
        renderResult(session);
    } else {
        renderTest(session);
    }
}

// Есть ли ответ на вопрос. selected_options — список id выбранных вариантов
// (у обычного вопроса в нём один вариант, у «нескольких ответов» — сколько выбрали)
function isAnswered(item) {
    return item.selected_options.length > 0;
}

function renderTest(session) {
    const questions = session.questions;

    // Если вернулись к тесту (например, после отключения света) — открываем первый вопрос без ответа
    let current = 0;
    for (let i = 0; i < questions.length; i++) {
        if (!isAnswered(questions[i])) {
            current = i;
            break;
        }
    }

    const modeIcon = sessionMode(session).icon;
    const modeTitle = sessionMode(session).title;

    app.innerHTML = `
        <div class="test-top">
            <div class="test-header">
                <div class="test-title">
                    <span class="test-title-icon">${icon(modeIcon)}</span>
                    <h1>${modeTitle}</h1>
                </div>
                <div class="timer" id="timer">
                    ${icon("clock")}<span id="timer-text"></span>
                </div>
            </div>
            <div class="progress-row">
                <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>
                <span class="progress-text" id="progress-text"></span>
            </div>
        </div>
        <div class="question-nav" id="question-nav"></div>
        <div class="card question-card" id="question-box"></div>
        <div class="test-actions">
            <button class="btn btn-prev" id="prev-btn" title="${t("test.prev")}">
                ${icon("arrow-left")}<span class="btn-label">${t("test.prev")}</span>
            </button>
            <button class="btn btn-primary btn-next" id="next-btn">
                <span class="btn-label">${t("test.next")}</span>${icon("arrow-right")}
            </button>
            <button class="btn btn-danger btn-finish" id="finish-btn">
                ${icon("flag")}<span>${t("test.finish")}</span>
            </button>
        </div>
    `;

    function countAnswered() {
        let answered = 0;
        for (const item of questions) {
            if (isAnswered(item)) {
                answered += 1;
            }
        }
        return answered;
    }

    // Полоска «Отвечено X из Y»
    function showProgress() {
        const answered = countAnswered();
        const percent = questions.length ? (answered * 100) / questions.length : 0;
        document.getElementById("progress-bar").style.width = percent + "%";
        document.getElementById("progress-text").textContent = t("test.answered", {
            done: answered,
            total: questions.length,
        });
    }

    // Номера вопросов: отвеченные закрашены, текущий с обводкой, остальные серые
    function showNav() {
        let html = "";
        for (let i = 0; i < questions.length; i++) {
            let className = "nav-item";
            if (isAnswered(questions[i])) {
                className += " answered";
            }
            if (i === current) {
                className += " current";
            }
            html += `<button class="${className}" data-index="${i}">${i + 1}</button>`;
        }
        const navBox = document.getElementById("question-nav");
        navBox.innerHTML = html;
        for (const button of navBox.querySelectorAll("button")) {
            button.addEventListener("click", function () {
                goTo(Number(button.dataset.index));
            });
        }
        showProgress();
    }

    function showQuestion() {
        const item = questions[current];
        const question = item.question;

        let imageHtml = "";
        if (question.image) {
            imageHtml = zoomableImage(esc(question.image));
        }

        let optionsHtml = "";
        const options = sortedOptions(question);
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const selected = item.selected_options.includes(option.id);
            optionsHtml += `
                <button class="option${selected ? " selected" : ""}" data-option="${option.id}">
                    <span class="option-letter">${optionLetter(i)}</span>
                    <span class="option-text">${esc(option.text)}</span>
                </button>
            `;
        }

        const box = document.getElementById("question-box");
        box.innerHTML = `
            <div class="question-meta">
                <span class="question-number">${t("test.question_of", {
                    number: current + 1,
                    total: questions.length,
                })}</span>
                <span class="badge">${esc(item.section)} · ${t("test.points", {
                    points: formatNumber(item.points),
                })}</span>
            </div>
            <p class="question-text">${esc(question.text)}</p>
            ${imageHtml}
            ${question.is_multiple ? `<p class="multi-hint">${icon("check-square", "icon-sm")}${t("test.multi_hint")}</p>` : ""}
            <div class="options${question.is_multiple ? " options-multi" : ""}">${optionsHtml}</div>
        `;

        for (const button of box.querySelectorAll(".option")) {
            button.addEventListener("click", function () {
                selectOption(item, Number(button.dataset.option));
            });
        }
        bindZoomableImages(box);

        updateButtons();
    }

    // Когда отвечены все вопросы, «Далее» превращается в «Закончить тест»,
    // а отдельная красная кнопка «Завершить» прячется — чтобы не было двух одинаковых
    function updateButtons() {
        const allAnswered = countAnswered() === questions.length;
        const nextBtn = document.getElementById("next-btn");
        const finishBtn = document.getElementById("finish-btn");

        document.getElementById("prev-btn").disabled = current === 0;

        if (allAnswered) {
            nextBtn.disabled = false;
            nextBtn.classList.remove("btn-primary");
            nextBtn.classList.add("btn-success");
            nextBtn.innerHTML = `${icon("check-circle")}<span class="btn-label">${t("test.complete")}</span>`;
            finishBtn.hidden = true;
        } else {
            nextBtn.disabled = current === questions.length - 1;
            nextBtn.classList.remove("btn-success");
            nextBtn.classList.add("btn-primary");
            nextBtn.innerHTML = `<span class="btn-label">${t("test.next")}</span>${icon("arrow-right")}`;
            finishBtn.hidden = false;
        }
    }

    function goTo(index) {
        if (index < 0 || index >= questions.length) {
            return;
        }
        current = index;
        showNav();
        showQuestion();
        // Номер текущего вопроса должен быть виден, если номеров много
        const currentButton = document.querySelector(".nav-item.current");
        if (currentButton) {
            currentButton.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }

    // Ответы отправляем по очереди: если быстро нажать несколько галочек,
    // сервер получит их в том же порядке и сохранит последнее состояние
    let saving = Promise.resolve();

    // Ответ сразу отправляем на сервер — так он не потеряется, если пропадёт свет
    function selectOption(item, optionId) {
        const previous = item.selected_options.slice();
        let body;

        if (item.question.is_multiple) {
            // Несколько ответов: нажатие ставит или снимает галочку
            if (previous.includes(optionId)) {
                item.selected_options = previous.filter(function (id) {
                    return id !== optionId;
                });
            } else {
                item.selected_options = previous.concat(optionId);
            }
            body = { question: item.question.id, options: item.selected_options };
        } else {
            if (previous.length === 1 && previous[0] === optionId) {
                return; // нажали на уже выбранный вариант — ничего не меняется, запрос не нужен
            }
            item.selected_options = [optionId];
            body = { question: item.question.id, option: optionId };
        }
        showNav();
        showQuestion();

        saving = saving.then(function () {
            return sendAnswer(item, body, previous);
        });
    }

    async function sendAnswer(item, body, previous) {
        try {
            await api("POST", "/sessions/" + session.id + "/answer/", body);
        } catch (error) {
            // Ответ не сохранился — возвращаем как было
            item.selected_options = previous;
            showNav();
            showQuestion();

            if (error.status === 0) {
                showToast(t("test.not_saved"), "error");
            } else {
                // Например, время вышло — загружаем тест заново, сервер покажет результат
                stopTimer();
                removeTestKeys();
                showToast(error.message, "error");
                pageSession(session.id).catch(showError);
            }
        }
    }

    async function finish() {
        stopTimer();
        removeTestKeys();
        try {
            const result = await api("POST", "/sessions/" + session.id + "/finish/");
            renderResult(result);
        } catch (error) {
            showError(error);
        }
    }

    document.getElementById("prev-btn").addEventListener("click", function () {
        goTo(current - 1);
    });
    document.getElementById("next-btn").addEventListener("click", function () {
        if (countAnswered() === questions.length) {
            askFinish(); // кнопка сейчас «Закончить тест»
        } else {
            goTo(current + 1);
        }
    });
    document.getElementById("finish-btn").addEventListener("click", askFinish);

    async function askFinish() {
        const answered = countAnswered();
        const allAnswered = answered === questions.length;
        let text = t("test.confirm.text", { done: answered, total: questions.length });
        if (!allAnswered) {
            text += " " + t("test.confirm.unanswered", { count: questions.length - answered });
        }
        // Если ответил на всё — спокойное окно, если нет — предупреждающее (красное)
        const ok = await showConfirm({
            title: t("test.confirm.title"),
            text: text,
            confirmText: t("test.confirm.yes"),
            cancelText: t("test.confirm.no"),
            danger: !allAnswered,
            iconName: allAnswered ? "check-circle" : "flag",
        });
        if (ok) {
            finish();
        }
    }

    // Стрелки ← → на клавиатуре переключают вопросы
    removeTestKeys();
    testKeyHandler = function (event) {
        if (document.querySelector(".modal-backdrop, .lightbox")) {
            return; // открыто окно — стрелки не трогаем
        }
        if (event.key === "ArrowLeft") {
            goTo(current - 1);
        } else if (event.key === "ArrowRight") {
            goTo(current + 1);
        }
    };
    document.addEventListener("keydown", testKeyHandler);

    showNav();
    showQuestion();
    // Когда время выйдет — завершаем тест сами
    startTimer(session.deadline, finish);
}

// 3725 секунд -> "1:02:05",  305 -> "05:05"
function formatTimeLeft(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    if (hours > 0) {
        return hours + ":" + mm + ":" + ss;
    }
    return mm + ":" + ss;
}

function startTimer(deadline, onEnd) {
    stopTimer();
    const end = new Date(deadline).getTime();
    const timerBox = document.getElementById("timer");
    const timerText = document.getElementById("timer-text");

    function tick() {
        const secondsLeft = Math.max(0, Math.floor((end - Date.now()) / 1000));
        timerText.textContent = formatTimeLeft(secondsLeft);

        // Меньше 5 минут — таймер красный и слегка пульсирует
        if (secondsLeft <= 5 * 60) {
            timerBox.classList.add("timer-warning");
        }
        if (secondsLeft === 0) {
            stopTimer();
            onEnd();
        }
    }

    tick();
    currentTimer = setInterval(tick, 1000);
}

function renderResult(session) {
    const percent = Number(session.score_percent);

    // Заголовок: экзамен, тема или предмет — что есть
    let title = session.exam_title || session.topic_title || session.category_title;
    if (!session.exam_title && !session.topic_title && session.subject_title) {
        title = cleanSubjectTitle(session.subject_title);
    }

    // Цвет круга: для экзамена со «сдал / не сдал» — по итогу, иначе по проценту
    let level = "low";
    if (session.passed === true || (session.passed === null && percent >= 80)) {
        level = "high";
    } else if (session.passed === null && percent >= 50) {
        level = "mid";
    }

    // Крупная надпись «Сдал / Не сдал» (Авто) или короткий отзыв по проценту
    let verdictHtml = "";
    if (session.passed === true) {
        verdictHtml = `<div class="verdict verdict-pass">${icon("check-circle", "icon-lg")}${t("result.passed")}</div>`;
    } else if (session.passed === false) {
        verdictHtml = `<div class="verdict verdict-fail">${icon("x-circle", "icon-lg")}${t("result.failed")}</div>`;
    } else {
        verdictHtml = `<p class="result-feedback">${t("result.feedback." + level)}</p>`;
    }

    let durationHtml = "";
    if (session.finished_at) {
        const seconds = Math.max(
            0,
            Math.round((new Date(session.finished_at) - new Date(session.started_at)) / 1000)
        );
        durationHtml = `<span class="stat-chip">${icon("clock", "icon-sm")}${formatTimeLeft(seconds)}</span>`;
    }

    // Круг с процентом (SVG). Длина окружности = 2 * π * r
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const ringHtml = `
        <div class="score-ring score-${level}">
            <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle class="score-ring-track" cx="60" cy="60" r="${radius}"></circle>
                <circle class="score-ring-bar" cx="60" cy="60" r="${radius}"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"></circle>
            </svg>
            <div class="score-ring-value">
                <b>${formatNumber(percent)}%</b>
                <span>${t("result.score")}</span>
            </div>
        </div>
    `;

    // Баллы по разделам — когда разделов больше одного (экзамен ДТМ)
    let sectionsHtml = "";
    if (session.sections.length > 1) {
        let rows = "";
        for (const section of session.sections) {
            const sectionPercent = Number(section.max_score)
                ? (Number(section.score) * 100) / Number(section.max_score)
                : 0;
            rows += `
                <div class="part-row">
                    <div class="part-head">
                        <span class="part-title">${esc(section.title)}</span>
                        <span class="part-score">
                            <b>${formatNumber(Number(section.score).toFixed(2))}</b>
                            / ${formatNumber(Number(section.max_score).toFixed(2))} ${t("result.points_short")}
                        </span>
                    </div>
                    <div class="progress"><div class="progress-bar" style="width: ${sectionPercent}%"></div></div>
                    <span class="part-meta muted">${t("result.correct_of", {
                        correct: section.correct_count,
                        total: section.total_count,
                    })}</span>
                </div>
            `;
        }
        sectionsHtml = `
            <div class="card">
                <h2>${t("result.by_parts")}</h2>
                <div class="part-list">${rows}</div>
            </div>
        `;
    }

    // Для фильтров: «Неправильные» = ответил неверно + пропустил (цифры приходят с сервера)
    const correctCount = session.correct_count;
    const wrongCount = session.wrong_count + session.skipped_count;

    // Вкладки разделов для разбора — только когда разделов больше одного (экзамен ДТМ)
    let sectionTabsHtml = "";
    if (session.sections.length > 1) {
        let tabs = `<button type="button" class="section-tab active" data-section="">${t("result.all_parts")}</button>`;
        for (const section of session.sections) {
            tabs += `
                <button type="button" class="section-tab" data-section="${esc(section.title)}">
                    ${esc(section.title)}
                    <span class="section-tab-count">${section.correct_count}/${section.total_count}</span>
                </button>
            `;
        }
        sectionTabsHtml = `<div class="section-tabs" id="review-sections">${tabs}</div>`;
    }

    let mistakesHtml = "";
    if (wrongCount > 0) {
        mistakesHtml = `
            <div class="card mistakes-card">
                ${tileIcon("rotate-ccw", "amber")}
                <div class="mistakes-body">
                    <h2>${t("result.mistakes.title")}</h2>
                    <div id="mistakes-error"></div>
                </div>
                <button type="button" class="btn btn-primary" id="mistakes-btn">
                    ${icon("play")}${t("result.mistakes.button")}
                </button>
            </div>
        `;
    }

    app.innerHTML = `
        <div class="card result-hero">
            ${ringHtml}
            <div class="result-info">
                <span class="result-kicker">
                    ${icon(sessionMode(session).icon, "icon-sm")}
                    ${sessionMode(session).title}
                </span>
                <h1 class="result-title">${esc(title)}</h1>
                ${verdictHtml}
                <div class="stat-chips">
                    <span class="stat-chip">${icon("trophy", "icon-sm")}${t("result.points", {
                        score: formatNumber(session.score),
                        max: formatNumber(session.max_score),
                    })}</span>
                    ${durationHtml}
                </div>
            </div>
        </div>

        <div class="result-stats">
            <div class="result-stat result-stat-correct">
                <span class="result-stat-icon">${icon("check", "icon-sm")}</span>
                <b>${session.correct_count}</b>
                <span>${t("result.stat.correct")}</span>
            </div>
            <div class="result-stat result-stat-wrong">
                <span class="result-stat-icon">${icon("x", "icon-sm")}</span>
                <b>${session.wrong_count}</b>
                <span>${t("result.stat.wrong")}</span>
            </div>
            <div class="result-stat result-stat-skipped">
                <span class="result-stat-icon">${icon("arrow-right", "icon-sm")}</span>
                <b>${session.skipped_count}</b>
                <span>${t("result.stat.skipped")}</span>
            </div>
        </div>

        ${mistakesHtml}

        ${sectionsHtml}

        <div class="review-header">
            <h2>${t("result.review")}</h2>
            <div class="filter-tabs" id="review-filters">
                <button class="filter-tab active" data-filter="all">
                    ${t("result.filter.all")} <span class="filter-count">${session.questions.length}</span>
                </button>
                <button class="filter-tab" data-filter="correct">
                    ${t("result.filter.correct")} <span class="filter-count">${correctCount}</span>
                </button>
                <button class="filter-tab" data-filter="wrong">
                    ${t("result.filter.wrong")} <span class="filter-count">${wrongCount}</span>
                </button>
            </div>
        </div>
        ${sectionTabsHtml}
        <div class="card review-map-card">
            <div class="review-map" id="review-map"></div>
            <div class="review-legend">
                <span><i class="legend-dot correct"></i>${t("result.stat.correct")}</span>
                <span><i class="legend-dot wrong"></i>${t("result.stat.wrong")}</span>
                <span><i class="legend-dot skipped"></i>${t("result.stat.skipped")}</span>
            </div>
        </div>
        <div id="review-detail" class="review-detail"></div>

        <div class="result-actions">
            <a href="#/" class="btn btn-primary">${icon("house")}${t("result.home")}</a>
            <a href="#/history" class="btn">${icon("history")}${t("result.history")}</a>
        </div>
    `;

    const mistakesButton = document.getElementById("mistakes-btn");
    if (mistakesButton) {
        mistakesButton.addEventListener("click", async function () {
            mistakesButton.disabled = true;
            try {
                const newSession = await api("POST", "/sessions/" + session.id + "/mistakes/");
                location.hash = "#/session/" + newSession.id;
            } catch (error) {
                document.getElementById("mistakes-error").innerHTML =
                    `<div class="alert alert-error">${icon("alert-circle")}${esc(error.message)}</div>`;
                mistakesButton.disabled = false;
            }
        });
    }

    // ----- Разбор: карта номеров + один вопрос за раз -----

    let filter = "all"; // all | correct | wrong
    let sectionFilter = ""; // "" — все разделы, иначе название раздела
    let visible = []; // вопросы, которые подходят под фильтры
    let current = 0; // индекс в visible

    function itemState(item) {
        if (item.is_correct) {
            return "correct";
        }
        return isAnswered(item) ? "wrong" : "skipped";
    }

    function applyFilters() {
        const previousItem = visible[current];
        visible = [];
        for (const item of session.questions) {
            if (filter === "correct" && !item.is_correct) {
                continue;
            }
            if (filter === "wrong" && item.is_correct) {
                continue;
            }
            if (sectionFilter && item.section !== sectionFilter) {
                continue;
            }
            visible.push(item);
        }
        // Если открытый вопрос остался в списке — остаёмся на нём
        const keep = visible.indexOf(previousItem);
        current = keep >= 0 ? keep : 0;
        showMap();
        showDetail();
    }

    // Сетка номеров: зелёный — правильно, красный — неправильно, серый — пропущен
    function showMap() {
        const map = document.getElementById("review-map");
        let html = "";
        for (let i = 0; i < visible.length; i++) {
            const item = visible[i];
            const currentClass = i === current ? " current" : "";
            html += `<button type="button" class="review-dot ${itemState(item)}${currentClass}" data-index="${i}">${item.order}</button>`;
        }
        map.innerHTML = html || `<span class="muted">${t("result.filter.empty")}</span>`;
        for (const button of map.querySelectorAll(".review-dot")) {
            button.addEventListener("click", function () {
                goTo(Number(button.dataset.index), true);
            });
        }
    }

    // Один вопрос + кнопки «← / →»
    function showDetail() {
        const box = document.getElementById("review-detail");
        if (visible.length === 0) {
            box.innerHTML = "";
            return;
        }
        box.innerHTML = `
            ${renderReviewCard(visible[current])}
            <div class="review-nav">
                <button type="button" class="btn" id="review-prev"${current === 0 ? " disabled" : ""}>
                    ${icon("arrow-left")}<span class="btn-label">${t("result.prev")}</span>
                </button>
                <span class="review-position">${t("result.position", { current: current + 1, total: visible.length })}</span>
                <button type="button" class="btn btn-primary" id="review-next"${current === visible.length - 1 ? " disabled" : ""}>
                    <span class="btn-label">${t("result.next")}</span>${icon("arrow-right")}
                </button>
            </div>
        `;
        bindZoomableImages(box);

        // Кнопка «Показать решение»
        for (const button of box.querySelectorAll(".solution-toggle")) {
            button.addEventListener("click", function () {
                const solution = button.nextElementSibling;
                solution.hidden = !solution.hidden;
                button.classList.toggle("open", !solution.hidden);
                button.querySelector(".solution-toggle-text").textContent = solution.hidden
                    ? t("result.show_solution")
                    : t("result.hide_solution");
            });
        }

        document.getElementById("review-prev").addEventListener("click", function () {
            goTo(current - 1, false);
        });
        document.getElementById("review-next").addEventListener("click", function () {
            goTo(current + 1, false);
        });
    }

    function goTo(index, fromMap) {
        if (index < 0 || index >= visible.length) {
            return;
        }
        current = index;
        showMap();
        showDetail();
        // После клика по номеру прокручиваем к вопросу, если его не видно (на телефоне)
        if (fromMap) {
            document.getElementById("review-detail").scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }

    // Вкладки: Все / Правильные / Неправильные
    const filterBox = document.getElementById("review-filters");
    for (const button of filterBox.querySelectorAll(".filter-tab")) {
        button.addEventListener("click", function () {
            for (const other of filterBox.querySelectorAll(".filter-tab")) {
                other.classList.remove("active");
            }
            button.classList.add("active");
            filter = button.dataset.filter;
            applyFilters();
        });
    }

    // Вкладки разделов (только у экзамена с несколькими разделами)
    const sectionBox = document.getElementById("review-sections");
    if (sectionBox) {
        for (const button of sectionBox.querySelectorAll(".section-tab")) {
            button.addEventListener("click", function () {
                for (const other of sectionBox.querySelectorAll(".section-tab")) {
                    other.classList.remove("active");
                }
                button.classList.add("active");
                sectionFilter = button.dataset.section;
                applyFilters();
            });
        }
    }

    // Стрелки ← → на клавиатуре листают вопросы разбора
    removeTestKeys();
    testKeyHandler = function (event) {
        if (document.querySelector(".modal-backdrop, .lightbox")) {
            return;
        }
        if (event.key === "ArrowLeft") {
            goTo(current - 1, false);
        } else if (event.key === "ArrowRight") {
            goTo(current + 1, false);
        }
    };
    document.addEventListener("keydown", testKeyHandler);

    applyFilters();
    window.scrollTo(0, 0);

    // Круг плавно заполняется до нужного процента
    const ringBar = app.querySelector(".score-ring-bar");
    setTimeout(function () {
        ringBar.style.strokeDashoffset = circumference * (1 - Math.min(percent, 100) / 100);
    }, 50);
}

// Одна карточка разбора: правильный ответ — только вопрос,
// неправильный — ещё «Ваш ответ» и «Правильный ответ»
function renderReviewCard(item) {
    const question = item.question;
    const answered = isAnswered(item);

    const selectedTexts = [];
    const correctTexts = [];
    for (const option of question.options) {
        if (item.selected_options.includes(option.id)) {
            selectedTexts.push(option.text);
        }
        if (option.is_correct) {
            correctTexts.push(option.text);
        }
    }

    let statusIcon = "check-circle";
    let statusText = t("result.correct");
    let cardClass = "review-card review-correct";
    if (!item.is_correct) {
        statusIcon = "x-circle";
        statusText = answered ? t("result.wrong") : t("result.no_answer");
        cardClass = "review-card review-wrong";
    }

    let answersHtml = "";
    if (!item.is_correct) {
        if (answered) {
            answersHtml += `
                <div class="answer-row answer-row-wrong">
                    <span class="answer-icon">${icon("x", "icon-sm")}</span>
                    <span><span class="answer-label">${t("result.your_answer")}</span> ${esc(selectedTexts.join(", "))}</span>
                </div>
            `;
        } else {
            answersHtml += `
                <div class="answer-row answer-row-empty">
                    <span class="answer-icon">${icon("x", "icon-sm")}</span>
                    <span class="answer-label">${t("result.not_answered")}</span>
                </div>
            `;
        }
        answersHtml += `
            <div class="answer-row answer-row-correct">
                <span class="answer-icon">${icon("check", "icon-sm")}</span>
                <span><span class="answer-label">${correctTexts.length > 1 ? t("result.correct_answers") : t("result.correct_answer")}</span> ${esc(correctTexts.join(", "))}</span>
            </div>
        `;
    }

    let imageHtml = "";
    if (question.image) {
        imageHtml = zoomableImage(esc(question.image));
    }

    // Решение спрятано, открывается по кнопке
    let solutionHtml = "";
    if (question.explanation || question.explanation_image) {
        let solutionImage = "";
        if (question.explanation_image) {
            solutionImage = zoomableImage(esc(question.explanation_image));
        }
        solutionHtml = `
            <button type="button" class="solution-toggle">
                ${icon("book-open", "icon-sm")}
                <span class="solution-toggle-text">${t("result.show_solution")}</span>
                ${icon("chevron-right", "icon-sm solution-chevron")}
            </button>
            <div class="explanation" hidden>
                <p>${esc(question.explanation)}</p>
                ${solutionImage}
            </div>
        `;
    }

    return `
        <div class="${cardClass}">
            <div class="review-head">
                <span class="review-number">${item.order}</span>
                <span class="review-section">${esc(item.section)}</span>
                ${question.is_multiple ? `<span class="badge badge-primary">${t("test.multi")}</span>` : ""}
                <span class="review-status">${icon(statusIcon, "icon-sm")}${statusText}</span>
            </div>
            <p class="review-text">${esc(question.text)}</p>
            ${imageHtml}
            ${answersHtml ? `<div class="answer-rows">${answersHtml}</div>` : ""}
            ${solutionHtml}
        </div>
    `;
}

// ---------- История ----------

async function pageHistory() {
    const sessions = await api("GET", "/sessions/");

    // Пустое состояние: ещё ни одного теста
    if (sessions.length === 0) {
        app.innerHTML = `
            <h1>${t("history.title")}</h1>
            ${stateBlock({
                icon: "inbox",
                title: t("history.empty.title"),
                text: t("history.empty.text"),
                actionHtml: `<a href="#/" class="btn btn-primary">${icon("play")}${t("history.empty.button")}</a>`,
            })}
        `;
        return;
    }

    let examCount = 0;
    for (const session of sessions) {
        if (session.mode === "exam") {
            examCount += 1;
        }
    }

    app.innerHTML = `
        <div class="page-head">
            ${tileIcon("history", "indigo", "lg")}
            <div>
                <h1>${t("history.title")}</h1>
                <p class="muted">${tn("plural.tests", sessions.length)}</p>
            </div>
        </div>
        <div class="filter-tabs history-filters" id="history-filters">
            <button class="filter-tab active" data-filter="all">
                ${t("history.filter.all")} <span class="filter-count">${sessions.length}</span>
            </button>
            <button class="filter-tab" data-filter="exam">
                ${t("history.filter.exam")} <span class="filter-count">${examCount}</span>
            </button>
            <button class="filter-tab" data-filter="practice">
                ${t("history.filter.practice")} <span class="filter-count">${sessions.length - examCount}</span>
            </button>
        </div>
        <div class="history-list" id="history-list"></div>
    `;

    // Фильтр работает по уже загруженному списку — новых запросов нет
    function showList(filter) {
        let html = "";
        for (const session of sessions) {
            if (filter !== "all" && session.mode !== filter) {
                continue;
            }
            html += renderHistoryItem(session);
        }
        if (!html) {
            html = stateBlock({ icon: "inbox", title: t("history.filter.empty") });
        }
        document.getElementById("history-list").innerHTML = html;
    }

    const filterBox = document.getElementById("history-filters");
    for (const button of filterBox.querySelectorAll(".filter-tab")) {
        button.addEventListener("click", function () {
            for (const other of filterBox.querySelectorAll(".filter-tab")) {
                other.classList.remove("active");
            }
            button.classList.add("active");
            showList(button.dataset.filter);
        });
    }

    showList("all");
}

// Одна карточка в истории
function renderHistoryItem(session) {
    const isExam = session.mode === "exam";
    const percent = Number(session.score_percent);

    // Метка статуса: идёт / сдал / не сдал / процент (у тренировки)
    let resultHtml = "";
    if (session.status !== "finished") {
        resultHtml = `
            <span class="badge badge-warning">${icon("clock", "icon-sm")}${t("history.status.in_progress")}</span>
            <span class="history-continue">${t("home.active.button")}</span>
        `;
    } else {
        let level = "low";
        if (percent >= 80) {
            level = "high";
        } else if (percent >= 50) {
            level = "mid";
        }
        let badge = "";
        if (session.passed === true) {
            badge = `<span class="badge badge-success">${icon("check", "icon-sm")}${t("result.passed")}</span>`;
        } else if (session.passed === false) {
            badge = `<span class="badge badge-error">${icon("x", "icon-sm")}${t("result.failed")}</span>`;
        }
        resultHtml = `
            <span class="history-percent level-${level}">${formatNumber(percent)}%</span>
            <span class="history-correct">${session.correct_count} / ${session.total_count}</span>
            ${badge}
        `;
    }

    let duration = "";
    if (session.finished_at) {
        const seconds = Math.max(
            0,
            Math.round((new Date(session.finished_at) - new Date(session.started_at)) / 1000)
        );
        duration = ` · ${icon("clock", "icon-sm")}${formatTimeLeft(seconds)}`;
    }

    return `
        <a href="#/session/${session.id}" class="card card-link history-item">
            ${tileIcon(sessionMode(session).icon, isExam ? "violet" : session.retry_of ? "amber" : "indigo")}
            <span class="history-body">
                <span class="history-title">${esc(sessionTitle(session))}</span>
                <span class="history-meta">
                    ${sessionMode(session).title}
                    · ${formatDate(session.started_at)}${duration}
                </span>
            </span>
            <span class="history-result">${resultHtml}</span>
            ${icon("chevron-right", "subject-card-arrow")}
        </a>
    `;
}

// ---------- Маршруты ----------

// [шаблон адреса, функция страницы, нужен ли вход, какой скелетон показать при загрузке]
const routes = [
    [/^#\/login$/, pageLogin, false, "form"],
    [/^#\/register$/, pageRegister, false, "form"],
    [/^#\/$/, pageHome, true, "home"],
    [/^#\/dtm$/, pageDTM, true, "cards"],
    [/^#\/avto$/, pageAvto, true, "cards"],
    [/^#\/subject\/([\w-]+)$/, pageSubject, true, "form"],
    [/^#\/exam\/(\d+)$/, function (id) { return pageExam(Number(id)); }, true, "form"],
    [/^#\/session\/(\d+)$/, pageSession, true, "test"],
    [/^#\/history$/, pageHistory, true, "list"],
    [/^#\/admin$/, pageAdmin, true, "cards"],
    [/^#\/admin\/(categories|subjects|topics|questions|exams)$/, pageAdminList, true, "list"],
    [/^#\/admin\/(categories|subjects|topics|questions|exams)\/(new|\d+)$/, pageAdminForm, true, "form"],
];

async function router() {
    stopTimer();
    removeTestKeys();
    renderNav();

    const hash = location.hash || "#/";
    for (const [pattern, page, needLogin, skeletonKind] of routes) {
        const match = hash.match(pattern);
        if (match) {
            if (needLogin && !isLoggedIn()) {
                location.hash = "#/login";
                return;
            }
            showLoading(skeletonKind);
            try {
                await page(match[1], match[2]);
            } catch (error) {
                // 401 — api.js уже отправил на страницу входа, ошибку не показываем
                if (error.status !== 401) {
                    showError(error);
                }
            }
            return;
        }
    }
    app.innerHTML = stateBlock({
        icon: "signpost",
        title: t("common.not_found"),
        actionHtml: `<a href="#/" class="btn btn-primary">${icon("house")}${t("result.home")}</a>`,
    });
}

document.getElementById("logo-mark").innerHTML = icon("graduation-cap");
initThemeToggle();

window.addEventListener("hashchange", router);
router();

// Узнаём, сотрудник ли пользователь — чтобы показать ссылку «Админка»
if (isLoggedIn()) {
    loadMe().then(renderNav);
}
