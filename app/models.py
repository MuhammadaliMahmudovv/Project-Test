from datetime import timedelta
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Category(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    practice_questions_count = models.PositiveSmallIntegerField(default=20)
    practice_time_limit = models.PositiveSmallIntegerField(
        default=30, help_text="minutes"
    )

    def __str__(self):
        return self.title


class Subject(models.Model):
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="subjects"
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return f"{self.title} ({self.category.title})"


class Topic(models.Model):
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="topics"
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="topics",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)

    def __str__(self):
        if self.subject:
            return f"{self.subject.title} - {self.title}"
        return f"{self.category.title} - {self.title}"


class Question(models.Model):
    DIFFICULTY_CHOICES = [
        ("easy", "Легкий"),
        ("medium", "Средний"),
        ("hard", "Сложный"),
    ]
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    image = models.ImageField(upload_to="questions/", null=True, blank=True)
    difficulty = models.CharField(
        max_length=8, choices=DIFFICULTY_CHOICES, default="medium"
    )
    is_multiple = models.BooleanField(
        default=False, help_text="несколько правильных ответов"
    )
    explanation = models.TextField(blank=True, default="", help_text="yechimi")
    explanation_image = models.ImageField(
        upload_to="explanations/", null=True, blank=True
    )

    def __str__(self):
        return self.text[:50]


class Option(models.Model):
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="options"
    )
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.text} ({'Correct' if self.is_correct else 'Incorrect'})"


class Exam(models.Model):
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="exams"
    )
    title = models.CharField(max_length=255)
    time_limit = models.PositiveSmallIntegerField(help_text="minutes")
    max_mistakes = models.PositiveSmallIntegerField(null=True, blank=True)

    def __str__(self):
        return self.title


class ExamSection(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="sections")
    order = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=255)
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, null=True, blank=True
    )
    is_choice = models.BooleanField(default=False)
    questions_count = models.PositiveSmallIntegerField()
    points = models.DecimalField(max_digits=4, decimal_places=2, default=1)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.exam.title}: {self.title}"

    def clean(self):
        if self.subject and self.is_choice:
            raise ValidationError("error")


class ExamSubjectPair(models.Model):
    exam = models.ForeignKey(
        Exam, on_delete=models.CASCADE, related_name="subject_pairs"
    )
    first_subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="subject1"
    )
    second_subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="subject2"
    )

    class Meta:
        unique_together = [("exam", "first_subject", "second_subject")]

    def __str__(self):
        return f"{self.first_subject.title} - {self.second_subject.title}"

    def clean(self):
        if self.first_subject_id == self.second_subject_id:
            raise ValidationError("нельзя выбрать два одинаковых предмета")


class TestSession(models.Model):
    MODE_CHOICES = [
        ("practice", "Тренировка"),
        ("exam", "Экзамен"),
    ]
    STATUS_CHOICES = [
        ("in_progress", "В процессе"),
        ("finished", "Завершён"),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="test_sessions",
    )
    mode = models.CharField(max_length=16, choices=MODE_CHOICES)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True, blank=True)
    subject = models.ForeignKey(
        Subject, on_delete=models.SET_NULL, null=True, blank=True
    )
    topic = models.ForeignKey(Topic, on_delete=models.SET_NULL, null=True, blank=True)
    retry_of = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="retries",
        help_text="работа над ошибками этого теста",
    )
    difficulty = models.CharField(
        max_length=8, choices=Question.DIFFICULTY_CHOICES, blank=True
    )
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default="in_progress"
    )
    time_limit = models.PositiveSmallIntegerField(help_text="minutes")
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    correct_count = models.PositiveSmallIntegerField(default=0)
    total_count = models.PositiveSmallIntegerField(default=0)
    score = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    max_score = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    passed = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user} - {self.category.title} ({self.get_status_display()})"

    @property
    def deadline(self):
        return self.started_at + timedelta(minutes=self.time_limit)

    @property
    def is_expired(self):
        return timezone.now() >= self.deadline

    @property
    def score_percent(self):
        if not self.max_score:
            return 0
        return round(float(self.score) * 100 / float(self.max_score), 1)

    def finish(self):
        if self.status == "finished":
            return

        correct_count = 0
        total_count = 0
        score = 0
        for item in SessionQuestion.objects.filter(session=self):
            total_count += 1
            if item.is_correct:
                correct_count += 1
                score += item.points

        self.correct_count = correct_count
        self.total_count = total_count
        self.score = score

        if self.exam and self.exam.max_mistakes is not None:
            mistakes = total_count - correct_count
            self.passed = mistakes <= self.exam.max_mistakes

        self.status = "finished"
        self.finished_at = min(timezone.now(), self.deadline)
        self.save()

    def finish_if_expired(self):
        if self.status == "in_progress" and self.is_expired:
            self.finish()


class SessionQuestion(models.Model):
    session = models.ForeignKey(
        TestSession, on_delete=models.CASCADE, related_name="questions"
    )
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    order = models.PositiveSmallIntegerField()
    section = models.CharField(max_length=255)
    points = models.DecimalField(max_digits=4, decimal_places=2, default=1)
    selected_option = models.ForeignKey(
        Option, on_delete=models.SET_NULL, null=True, blank=True
    )
    selected_options = models.ManyToManyField(Option, blank=True, related_name="+")
    is_correct = models.BooleanField(default=False)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order"]
        unique_together = [("session", "question")]

    def __str__(self):
        return f"{self.session_id} #{self.order}"
