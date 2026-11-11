from django.db.models import Count, Prefetch, Q
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.viewsets import ModelViewSet
from .models import Category, Subject, Topic, Question, Exam, ExamSection
from .admin_serializers import (
    AdminCategorySerializer,
    AdminSubjectSerializer,
    AdminTopicSerializer,
    AdminQuestionSerializer,
    AdminExamSerializer,
)


class AdminCategoryViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminCategorySerializer

    def get_queryset(self):
        return Category.objects.annotate(
            subjects_count=Count("subjects", distinct=True),
            topics_count=Count("topics", distinct=True),
            exams_count=Count("exams", distinct=True),
            questions_count=Count(
                "topics__questions",
                filter=Q(topics__questions__options__is_correct=True),
                distinct=True,
            ),
        ).order_by("id")


class AdminSubjectViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminSubjectSerializer

    def get_queryset(self):
        subjects = (
            Subject.objects.select_related("category")
            .annotate(
                topics_count=Count("topics", distinct=True),
                questions_count=Count("topics__questions", distinct=True),
            )
            .order_by("category_id", "id")
        )

        category = self.request.query_params.get("category")
        if category:
            subjects = subjects.filter(category_id=category)
        return subjects


class AdminTopicViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminTopicSerializer

    def get_queryset(self):
        topics = (
            Topic.objects.select_related("category", "subject")
            .annotate(questions_count=Count("questions"))
            .order_by("category_id", "subject_id", "id")
        )

        category = self.request.query_params.get("category")
        if category:
            topics = topics.filter(category_id=category)

        subject = self.request.query_params.get("subject")
        if subject:
            topics = topics.filter(subject_id=subject)
        return topics


class QuestionPagination(PageNumberPagination):
    page_size = 20


class AdminQuestionViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminQuestionSerializer
    pagination_class = QuestionPagination
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        questions = (
            Question.objects.select_related(
                "topic", "topic__subject", "topic__category"
            )
            .prefetch_related("options")
            .order_by("-id")
        )

        params = self.request.query_params

        if params.get("category"):
            questions = questions.filter(topic__category_id=params["category"])
        if params.get("subject"):
            questions = questions.filter(topic__subject_id=params["subject"])
        if params.get("topic"):
            questions = questions.filter(topic_id=params["topic"])
        if params.get("difficulty"):
            questions = questions.filter(difficulty=params["difficulty"])

        search = params.get("search", "").strip()
        if search:
            questions = questions.filter(
                Q(text__icontains=search) | Q(options__text__icontains=search)
            ).distinct()

        if params.get("problem") == "no_correct":
            questions = questions.exclude(options__is_correct=True)

        return questions


class AdminExamViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminExamSerializer

    def get_queryset(self):
        exams = (
            Exam.objects.select_related("category")
            .prefetch_related(
                Prefetch("sections", queryset=ExamSection.objects.order_by("order")),
                "subject_pairs",
            )
            .order_by("category_id", "id")
        )

        category = self.request.query_params.get("category")
        if category:
            exams = exams.filter(category_id=category)
        return exams
