// Тексты интерфейса. Чтобы добавить узбекский язык — заполните блок "uz"
// теми же ключами. Если ключа нет в выбранном языке, берётся русский.
//
// Использование:  t("nav.home")
//                 t("test.answered", { done: 3, total: 10 })  →  "Отвечено 3 из 10"

const TRANSLATIONS = {
    ru: {
        "app.name": "TestMarkaz",

        "nav.home": "Главная",
        "nav.history": "История",
        "nav.login": "Вход",
        "nav.register": "Регистрация",
        "nav.admin": "Админка",
        "nav.logout": "Выйти",
        "logout.confirm.title": "Выйти из аккаунта?",
        "logout.confirm.text": "Чтобы снова проходить тесты, нужно будет войти заново. Незаконченный тест сохранится.",
        "logout.confirm.yes": "Выйти",
        "logout.confirm.no": "Отмена",
        "theme.to_dark": "Тёмная тема",
        "theme.to_light": "Светлая тема",

        "auth.login.title": "Вход",
        "auth.login.subtitle": "Войдите, чтобы продолжить подготовку",
        "auth.login.button": "Войти",
        "auth.register.title": "Регистрация",
        "auth.register.subtitle": "Создайте аккаунт — это займёт минуту",
        "auth.register.button": "Зарегистрироваться",
        "auth.username": "Логин",
        "auth.password": "Пароль",
        "auth.no_account": "Нет аккаунта?",
        "auth.have_account": "Уже есть аккаунт?",

        "home.hello": "Привет! 👋",
        "home.hello_name": "Привет, {name}! 👋",
        "home.title": "Готовься к экзаменам уверенно",
        "home.text": "Тренируйся по темам, сдавай пробные экзамены и смотри разбор каждой ошибки с решением.",
        "home.start_dtm": "Начать ДТМ",
        "home.start_avto": "Начать Авто",
        "home.choose": "Выберите направление",
        "home.dtm.text": "Вступительные экзамены: тренировка по предметам и пробный экзамен",
        "home.avto.text": "Экзамен на водительские права: знаки, правила, первая помощь",
        "home.active.title": "У вас есть незаконченный тест",
        "home.active.button": "Продолжить",

        "category.not_found": "Категория не найдена. Запустите python manage.py seed",
        "category.exam": "Пробный экзамен",
        "category.exam.avto": "Экзамен",
        "category.no_exams": "Экзаменов пока нет.",
        "category.mandatory": "Обязательные предметы",
        "category.mandatory.text": "Входят в экзамен у всех",
        "category.profile": "Профильные предметы",
        "category.profile.text": "Два предмета вы выбираете сами",
        "category.topics": "Тренировка по темам",
        "category.subjects": "Тренировка по предметам",

        "exam.start": "Начать",
        "exam.start_exam": "Начать экзамен",
        "exam.minutes": "{count} мин.",
        "exam.max_mistakes": "можно ошибиться {times}",
        "exam.sections": "Разделы экзамена",
        "exam.choice": "на выбор",
        "exam.points": "{points} балла за вопрос",
        "exam.choose_pair": "Выберите профильные предметы",
        "exam.choose_subject": "Предмет {number}",
        "exam.choose_placeholder": "— выберите —",
        "exam.not_found": "Экзамен не найден.",

        "subject.not_found": "Предмет не найден.",
        "practice.title": "Тренировка",
        "practice.topic": "Тема",
        "practice.all_topics": "Все темы",
        "practice.difficulty": "Сложность",
        "practice.any": "Любая",
        "practice.easy": "Лёгкий",
        "practice.medium": "Средний",
        "practice.hard": "Сложный",
        "practice.count": "Вопросов",
        "practice.time": "Минут",
        "practice.start": "Начать тренировку",
        "practice.no_topics": "В этом разделе пока нет тем.",
        "practice.none": "Для этой темы и сложности вопросов в базе нет.",
        "practice.count_invalid": "Введите целое число больше нуля.",
        "practice.too_many": "В базе только {count} по выбранной теме и сложности — больше выбрать нельзя.",
        "practice.max_100": "За один раз можно не больше 100 вопросов.",
        "practice.time_invalid": "Время — от 1 до 240 минут.",

        "test.mode.exam": "Экзамен",
        "test.mode.practice": "Тренировка",
        "test.mode.mistakes": "Работа над ошибками",
        "test.answered": "Отвечено {done} из {total}",
        "test.question_of": "Вопрос {number} из {total}",
        "test.points": "{points} балл.",
        "test.multi": "Несколько ответов",
        "test.multi_hint": "Выберите все правильные ответы — их может быть несколько.",
        "test.prev": "Назад",
        "test.next": "Далее",
        "test.finish": "Завершить тест",
        "test.complete": "Закончить тест",
        "test.not_saved": "Нет связи с сервером. Ответ не сохранён — выберите его ещё раз.",
        "test.confirm.title": "Завершить тест?",
        "test.confirm.text": "Вы ответили на {done} из {total}.",
        "test.confirm.unanswered": "Вопросы без ответа ({count}) будут засчитаны как неправильные.",
        "test.confirm.yes": "Завершить",
        "test.confirm.no": "Отмена",

        "result.score": "результат",
        "result.passed": "Сдал",
        "result.failed": "Не сдал",
        "result.feedback.high": "Отличный результат! Так держать 🎉",
        "result.feedback.mid": "Хороший результат — ещё немного практики.",
        "result.feedback.low": "Есть над чем поработать — посмотрите разбор ошибок ниже.",
        "result.points": "{score} из {max} баллов",
        "result.points_short": "балл.",
        "result.stat.correct": "Правильно",
        "result.stat.wrong": "Неправильно",
        "result.stat.skipped": "Пропущено",
        "result.by_parts": "Баллы по частям",
        "result.correct_of": "{correct} из {total} правильно",
        "result.mistakes.title": "Работа над ошибками",
        // "result.mistakes.text": "Решите заново вопросы, где вы ошиблись или не ответили — {count}.",
        "result.mistakes.button": "Решить ошибки",
        "result.home": "На главную",
        "result.history": "История",
        "result.review": "Разбор вопросов",
        "result.all_parts": "Все разделы",
        "result.prev": "Предыдущий",
        "result.next": "Следующий",
        "result.position": "{current} из {total}",
        "result.filter.all": "Все",
        "result.filter.correct": "Правильные",
        "result.filter.wrong": "Неправильные",
        "result.filter.empty": "В этом фильтре нет вопросов",
        "result.correct": "Правильно",
        "result.wrong": "Неправильно",
        "result.no_answer": "Нет ответа",
        "result.your_answer": "Ваш ответ:",
        "result.correct_answer": "Правильный ответ:",
        "result.correct_answers": "Правильные ответы:",
        "result.not_answered": "Вы не ответили на этот вопрос",
        "result.show_solution": "Показать решение",
        "result.hide_solution": "Скрыть решение",

        "common.loading": "Загрузка...",
        "common.close": "Закрыть",
        "error.title": "Не удалось загрузить страницу",
        "error.retry": "Повторить",
        "error.not_found": "Такой страницы или теста нет, либо он принадлежит другому пользователю.",

        "history.title": "История",
        "history.empty.title": "Вы ещё не проходили тесты",
        "history.empty.text": "Выберите направление и начните первую тренировку или пробный экзамен — результаты появятся здесь.",
        "history.empty.button": "Перейти к тестам",
        "history.filter.all": "Все",
        "history.filter.exam": "Экзамены",
        "history.filter.practice": "Тренировки",
        "history.filter.empty": "Здесь пока пусто",
        "history.status.in_progress": "Идёт",
        "common.back": "Назад",
        "common.not_found": "Страница не найдена.",

        "admin.title": "Админ-панель",
        "admin.subtitle": "Управление категориями, предметами, темами, вопросами и экзаменами",
        "admin.overview": "Обзор",
        "admin.categories": "Категории",
        "admin.subjects": "Предметы",
        "admin.topics": "Темы",
        "admin.questions": "Вопросы",
        "admin.exams": "Экзамены",
        "admin.no_access.title": "Нет доступа",
        "admin.no_access.text": "Админ-панель доступна только сотрудникам (is_staff).",
        "admin.problems": "Без правильного ответа: {count}. Такие вопросы не попадают в тесты.",
        "admin.add": "Добавить",
        "admin.edit": "Изменить",
        "admin.delete": "Удалить",
        "admin.save": "Сохранить",
        "admin.cancel": "Отмена",
        "admin.saved": "Сохранено",
        "admin.deleted": "Удалено",
        "admin.empty": "Здесь пока ничего нет",
        "admin.found": "Найдено: {count}",
        "admin.page": "Стр. {page} из {pages}",
        "admin.search": "Поиск",
        "admin.search.placeholder": "Текст вопроса или варианта",
        "admin.filter.all": "Все",
        "admin.filter.no_correct": "Только без правильного ответа",
        "admin.no_correct": "Нет правильного ответа",
        "admin.no_subject": "— без предмета —",
        "admin.topic.required": "Выберите категорию, предмет и тему.",
        "admin.delete.title": "Удалить «{name}»?",
        "admin.delete.yes": "Удалить",
        "admin.delete.category": "Вместе с категорией удалятся предметы ({subjects}), темы ({topics}), вопросы ({questions}), экзамены ({exams}) и вся история тестов этой категории. Отменить нельзя.",
        "admin.delete.subject": "Вместе с предметом удалятся темы ({topics}) и вопросы ({questions}). Ответы на эти вопросы пропадут из истории тестов. Отменить нельзя.",
        "admin.delete.topic": "Вместе с темой удалятся вопросы ({questions}). Ответы на них пропадут из истории тестов. Отменить нельзя.",
        "admin.delete.question": "Вопрос пропадёт и из истории тестов пользователей. Отменить нельзя.",
        "admin.delete.exam": "Разделы и пары предметов удалятся. Результаты уже пройденных экзаменов останутся в истории.",
        "admin.new.category": "Новая категория",
        "admin.new.subject": "Новый предмет",
        "admin.new.topic": "Новая тема",
        "admin.new.question": "Новый вопрос",
        "admin.new.exam": "Новый экзамен",
        "admin.edit.question": "Вопрос №{id}",
        "admin.field.title": "Название",
        "admin.field.slug": "Адрес (slug)",
        "admin.field.category": "Категория",
        "admin.field.subject": "Предмет",
        "admin.field.topic": "Тема",
        "admin.field.practice_count": "Вопросов в тренировке",
        "admin.field.practice_time": "Минут на тренировку",
        "admin.field.text": "Текст вопроса",
        "admin.field.image": "Картинка к вопросу",
        "admin.field.options": "Варианты ответа",
        "admin.field.explanation": "Решение",
        "admin.field.explanation_image": "Картинка к решению",
        "admin.field.time_limit": "Время, минут",
        "admin.field.max_mistakes": "Можно ошибиться",
        "admin.field.sections": "Разделы экзамена",
        "admin.field.pairs": "Разрешённые пары предметов",
        "admin.hint.slug": "Латиница, цифры и дефис. Заполняется из названия.",
        "admin.hint.options": "Отметьте букву правильного ответа.",
        "admin.hint.options_multi": "Отметьте буквы всех правильных ответов.",
        "admin.field.is_multiple": "Несколько правильных ответов",
        "admin.multi": "Несколько ответов",
        "admin.hint.max_mistakes": "Без ограничения",
        "admin.hint.pairs": "Для разделов «на выбор». Если пар нет — можно выбрать любые два предмета.",
        "admin.option.add": "Добавить вариант",
        "admin.option.correct": "Правильный ответ",
        "admin.option.placeholder": "Текст варианта",
        "admin.option.empty": "Заполните текст всех вариантов или удалите пустые.",
        "admin.image.pick": "Выбрать картинку",
        "admin.image.remove": "Убрать",
        "admin.section.add": "Добавить раздел",
        "admin.section.source": "Вопросы из",
        "admin.section.any": "Все темы категории",
        "admin.section.choice": "На выбор пользователя",
        "admin.section.points": "Баллов за вопрос",
        "admin.pair.add": "Добавить пару",
        "admin.pair.none": "Пар нет",
    },
    uz: {},
};

// Слова, которые меняются от числа. Формы через «|»:
// для русского три формы (1 предмет | 2 предмета | 5 предметов), для узбекского хватит одной.
const PLURALS = {
    ru: {
        "plural.subjects": "предмет|предмета|предметов",
        "plural.topics": "тема|темы|тем",
        "plural.questions": "вопрос|вопроса|вопросов",
        "plural.exams": "экзамен|экзамена|экзаменов",
        "plural.sections": "раздел|раздела|разделов",
        "plural.times": "раз|раза|раз",
        "plural.tests": "тест|теста|тестов",
    },
    uz: {},
};

let currentLang = "ru";
try {
    currentLang = localStorage.getItem("lang") || "ru";
} catch (error) {
    // localStorage недоступен — остаёмся на русском
}
if (!TRANSLATIONS[currentLang]) {
    currentLang = "ru";
}
document.documentElement.lang = currentLang;

function t(key, params) {
    let text = TRANSLATIONS[currentLang][key];
    if (text === undefined) {
        text = TRANSLATIONS.ru[key];
    }
    if (text === undefined) {
        return key; // ключ забыли добавить — показываем его, чтобы было заметно
    }
    if (params) {
        for (const name in params) {
            text = text.replaceAll("{" + name + "}", params[name]);
        }
    }
    return text;
}

// Число со словом в нужной форме: tn("plural.subjects", 8) → "8 предметов"
function tn(key, count) {
    let forms = PLURALS[currentLang][key];
    if (forms === undefined) {
        forms = PLURALS.ru[key];
    }
    if (forms === undefined) {
        return count + " " + key;
    }
    forms = forms.split("|");
    if (forms.length < 3) {
        return count + " " + forms[0];
    }
    const n10 = count % 10;
    const n100 = count % 100;
    let word = forms[2];
    if (n10 === 1 && n100 !== 11) {
        word = forms[0];
    } else if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) {
        word = forms[1];
    }
    return count + " " + word;
}
