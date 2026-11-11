from django.urls import include, path
from . import views

urlpatterns = [
    path("categories/", views.CategoryListView.as_view(), name="categories"),
    path("tests/", views.DTMSubjectsView.as_view(), name="dtm-subjects"),
    path(
        "subjects/<slug:subject_slug>/topics/",
        views.SubjectTopicsView.as_view(),
        name="subject-topics",
    ),
    path("avto/", views.AVTOTopicsView.as_view(), name="avto-topics"),
    path("exams/", views.ExamListView.as_view(), name="exams"),
    path(
        "sessions/practice/",
        views.StartPracticeView.as_view(),
        name="start-practice",
    ),
    path("sessions/exam/", views.StartExamView.as_view(), name="start-exam"),
    path("sessions/", views.TestSessionListView.as_view(), name="sessions"),
    path(
        "sessions/<int:pk>/",
        views.TestSessionDetailView.as_view(),
        name="session-detail",
    ),
    path(
        "sessions/<int:pk>/answer/",
        views.AnswerView.as_view(),
        name="session-answer",
    ),
    path(
        "sessions/<int:pk>/finish/",
        views.FinishView.as_view(),
        name="session-finish",
    ),
    path(
        "sessions/<int:pk>/mistakes/",
        views.RetryMistakesView.as_view(),
        name="session-mistakes",
    ),
    path("admin/", include("app.admin_urls")),
]
