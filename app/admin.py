from django.contrib import admin
from .models import (
    Category,
    Subject,
    Topic,
    Question,
    Option,
    Exam,
    ExamSection,
    ExamSubjectPair,
    TestSession,
    SessionQuestion,
)


class OptionInline(admin.TabularInline):
    model = Option
    extra = 4


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["__str__", "topic", "difficulty", "is_multiple"]
    list_filter = ["difficulty", "is_multiple", "topic__category"]
    inlines = [OptionInline]


class ExamSectionInline(admin.TabularInline):
    model = ExamSection
    extra = 1


class ExamSubjectPairInline(admin.TabularInline):
    model = ExamSubjectPair
    extra = 1


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "time_limit", "max_mistakes"]
    inlines = [ExamSectionInline, ExamSubjectPairInline]


class SessionQuestionInline(admin.TabularInline):
    model = SessionQuestion
    extra = 0
    readonly_fields = [
        "question",
        "order",
        "section",
        "points",
        "selected_option",
        "selected_options",
        "is_correct",
        "answered_at",
    ]


@admin.register(TestSession)
class TestSessionAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "mode",
        "category",
        "status",
        "score",
        "correct_count",
        "total_count",
        "started_at",
    ]
    list_filter = ["mode", "status", "category"]
    inlines = [SessionQuestionInline]


admin.site.register(Category)
admin.site.register(Subject)
admin.site.register(Topic)
