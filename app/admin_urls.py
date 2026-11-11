from rest_framework.routers import DefaultRouter
from . import admin_views

router = DefaultRouter()
router.register(
    "categories", admin_views.AdminCategoryViewSet, basename="admin-categories"
)
router.register("subjects", admin_views.AdminSubjectViewSet, basename="admin-subjects")
router.register("topics", admin_views.AdminTopicViewSet, basename="admin-topics")
router.register(
    "questions", admin_views.AdminQuestionViewSet, basename="admin-questions"
)
router.register("exams", admin_views.AdminExamViewSet, basename="admin-exams")

urlpatterns = router.urls
