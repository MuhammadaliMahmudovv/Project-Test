from rest_framework.generics import ListAPIView, RetrieveAPIView
from .models import (
    Category,
    Subject,
    Topic,
    Exam,
    Question,
    TestSession,
    SessionQuestion,
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import random
from django.shortcuts import get_object_or_404
from .serializers import (
    TestSessionListSerializer,
    StartPracticeSerializer,
    CategoryTopicsSerializer,
    StartExamSerializer,
    TestSessionResultSerializer,
    SubjectTopicsSerializer,
    AnswerSerializer,
    TestSessionSerializer,
    ExamSerializer,
    CategorySubjectsSerializer,
    CategorySerializer,
)
from rest_framework import status
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone


class CategoryListView(ListAPIView):
    serializer_class = CategorySerializer

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


class DTMSubjectsView(ListAPIView):
    serializer_class = CategorySubjectsSerializer

    def get_queryset(self):
        subjects = Subject.objects.annotate(
            topics_count=Count("topics", distinct=True),
            questions_count=Count(
                "topics__questions",
                filter=Q(topics__questions__options__is_correct=True),
                distinct=True,
            ),
        )
        return Category.objects.filter(slug="dtm").prefetch_related(
            Prefetch("subjects", queryset=subjects)
        )


class SubjectTopicsView(ListAPIView):
    serializer_class = SubjectTopicsSerializer

    def get_queryset(self):
        subject_slug = self.kwargs.get("subject_slug")

        topics = Topic.objects.annotate(
            questions_count=Count(
                "questions",
                filter=Q(questions__options__is_correct=True),
                distinct=True,
            ),
            easy_count=Count(
                "questions",
                filter=Q(questions__options__is_correct=True)
                & Q(questions__difficulty="easy"),
                distinct=True,
            ),
            medium_count=Count(
                "questions",
                filter=Q(questions__options__is_correct=True)
                & Q(questions__difficulty="medium"),
                distinct=True,
            ),
            hard_count=Count(
                "questions",
                filter=Q(questions__options__is_correct=True)
                & Q(questions__difficulty="hard"),
                distinct=True,
            ),
        )

        subjects = Subject.objects.filter(slug=subject_slug).annotate(
            topics_count=Count("topics", distinct=True),
            questions_count=Count(
                "topics__questions",
                filter=Q(topics__questions__options__is_correct=True),
                distinct=True,
            ),
            easy_count=Count(
                "topics__questions",
                filter=Q(topics__questions__options__is_correct=True)
                & Q(topics__questions__difficulty="easy"),
                distinct=True,
            ),
            medium_count=Count(
                "topics__questions",
                filter=Q(topics__questions__options__is_correct=True)
                & Q(topics__questions__difficulty="medium"),
                distinct=True,
            ),
            hard_count=Count(
                "topics__questions",
                filter=Q(topics__questions__options__is_correct=True)
                & Q(topics__questions__difficulty="hard"),
                distinct=True,
            ),
        )
        return subjects.prefetch_related(Prefetch("topics", queryset=topics))


class AVTOTopicsView(ListAPIView):
    serializer_class = CategoryTopicsSerializer

    def get_queryset(self):
        topics = Topic.objects.annotate(
            questions_count=Count(
                "questions",
                filter=Q(questions__options__is_correct=True),
                distinct=True,
            ),
            easy_count=Count(
                "questions",
                filter=Q(questions__options__is_correct=True)
                & Q(questions__difficulty="easy"),
                distinct=True,
            ),
            medium_count=Count(
                "questions",
                filter=Q(questions__options__is_correct=True)
                & Q(questions__difficulty="medium"),
                distinct=True,
            ),
            hard_count=Count(
                "questions",
                filter=Q(questions__options__is_correct=True)
                & Q(questions__difficulty="hard"),
                distinct=True,
            ),
        )
        return Category.objects.filter(slug="avto").prefetch_related(
            Prefetch("topics", queryset=topics)
        )


class ExamListView(ListAPIView):
    serializer_class = ExamSerializer

    def get_queryset(self):
        exams = Exam.objects.prefetch_related(
            "sections__subject",
            "subject_pairs__first_subject",
            "subject_pairs__second_subject",
        )

        category_slug = self.request.query_params.get("category")
        if category_slug:
            exams = exams.filter(category__slug=category_slug)

        return exams


class StartPracticeView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = StartPracticeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        topic = data.get("topic")
        if topic:
            subject = topic.subject
            category = topic.category
            questions = Question.objects.filter(topic=topic)
            section_title = topic.title
        else:
            subject = data["subject"]
            category = subject.category
            questions = Question.objects.filter(topic__subject=subject)
            section_title = subject.title

        difficulty = data.get("difficulty", "")
        if difficulty:
            questions = questions.filter(difficulty=difficulty)

        questions_count = data.get("questions_count", category.practice_questions_count)
        time_limit = data.get("time_limit", category.practice_time_limit)

        question_ids = list(
            questions.filter(options__is_correct=True)
            .values_list("id", flat=True)
            .distinct()
        )

        if len(question_ids) == 0:
            return Response(
                {"detail": "нет вопросов"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "questions_count" in data and data["questions_count"] > len(question_ids):
            return Response(
                {
                    "detail": f"Доступно вопросов в базе: {len(question_ids)}. "
                    "Больше выбрать нельзя."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        random.shuffle(question_ids)
        question_ids = question_ids[:questions_count]

        with transaction.atomic():
            session = TestSession.objects.create(
                user=request.user,
                mode="practice",
                category=category,
                subject=subject,
                topic=topic,
                difficulty=difficulty,
                time_limit=time_limit,
                total_count=len(question_ids),
                max_score=len(question_ids),
            )

            session_questions = []
            order = 1
            for question_id in question_ids:
                session_questions.append(
                    SessionQuestion(
                        session=session,
                        question_id=question_id,
                        order=order,
                        section=section_title,
                        points=1,
                    )
                )
                order += 1
            SessionQuestion.objects.bulk_create(session_questions)

        session = TestSession.objects.prefetch_related(
            "questions__question__options", "questions__selected_options"
        ).get(id=session.id)
        return Response(
            TestSessionSerializer(session).data, status=status.HTTP_201_CREATED
        )


class StartExamView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = StartExamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exam = serializer.validated_data["exam"]
        sections = serializer.validated_data["sections"]
        chosen_subjects = serializer.validated_data["subjects"]
        prepared_sections = []
        used_question_ids = []
        choice_number = 0
        for section in sections:
            if section.is_choice:
                subject = chosen_subjects[choice_number]
                choice_number += 1
                questions = Question.objects.filter(topic__subject=subject)
                section_title = f"{section.title}: {subject.title}"
            elif section.subject:
                questions = Question.objects.filter(topic__subject=section.subject)
                section_title = section.title
            else:
                questions = Question.objects.filter(topic__category=exam.category)
                section_title = section.title

            question_ids = list(
                questions.filter(options__is_correct=True)
                .exclude(id__in=used_question_ids)
                .values_list("id", flat=True)
                .distinct()
            )
            random.shuffle(question_ids)
            question_ids = question_ids[: section.questions_count]

            if len(question_ids) < section.questions_count:
                return Response(
                    {"detail": "недостаточно вопросов"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            used_question_ids += question_ids
            prepared_sections.append(
                {
                    "title": section_title,
                    "points": section.points,
                    "question_ids": question_ids,
                }
            )

        with transaction.atomic():
            session = TestSession.objects.create(
                user=request.user,
                mode="exam",
                category=exam.category,
                exam=exam,
                time_limit=exam.time_limit,
            )

            session_questions = []
            order = 1
            for prepared in prepared_sections:
                for question_id in prepared["question_ids"]:
                    session_questions.append(
                        SessionQuestion(
                            session=session,
                            question_id=question_id,
                            order=order,
                            section=prepared["title"],
                            points=prepared["points"],
                        )
                    )
                    order += 1

                    session.total_count += 1
                    session.max_score += prepared["points"]

            SessionQuestion.objects.bulk_create(session_questions)
            session.save()

        session = TestSession.objects.prefetch_related(
            "questions__question__options", "questions__selected_options"
        ).get(id=session.id)
        return Response(
            TestSessionSerializer(session).data, status=status.HTTP_201_CREATED
        )


class RetryMistakesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        old_session = get_object_or_404(TestSession, id=pk, user=request.user)

        if old_session.status != "finished":
            return Response(
                {"detail": "Сначала завершите тест"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mistakes = list(
            SessionQuestion.objects.filter(session=old_session, is_correct=False)
        )
        if len(mistakes) == 0:
            return Response(
                {"detail": "В этом тесте нет ошибок"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        random.shuffle(mistakes)

        time_limit = len(mistakes) * 2
        if time_limit > 240:
            time_limit = 240

        with transaction.atomic():
            session = TestSession.objects.create(
                user=request.user,
                mode="practice",
                category_id=old_session.category_id,
                subject_id=old_session.subject_id,
                topic_id=old_session.topic_id,
                retry_of=old_session,
                time_limit=time_limit,
                total_count=len(mistakes),
                max_score=len(mistakes),
            )

            session_questions = []
            order = 1
            for mistake in mistakes:
                session_questions.append(
                    SessionQuestion(
                        session=session,
                        question_id=mistake.question_id,
                        order=order,
                        section=mistake.section,
                        points=1,
                    )
                )
                order += 1
            SessionQuestion.objects.bulk_create(session_questions)

        session = TestSession.objects.prefetch_related(
            "questions__question__options", "questions__selected_options"
        ).get(id=session.id)
        return Response(
            TestSessionSerializer(session).data, status=status.HTTP_201_CREATED
        )


class TestSessionDetailView(RetrieveAPIView):

    permission_classes = [IsAuthenticated]
    serializer_class = TestSessionSerializer

    def get_queryset(self):
        return (
            TestSession.objects.filter(user=self.request.user)
            .select_related("category", "exam", "subject", "topic")
            .prefetch_related(
                "questions__question__options", "questions__selected_options"
            )
        )

    def get_object(self):
        session = super().get_object()

        session.finish_if_expired()

        return session

    def retrieve(self, request, *args, **kwargs):
        session = self.get_object()

        if session.status == "finished":
            return Response(TestSessionResultSerializer(session).data)
        return Response(TestSessionSerializer(session).data)


class AnswerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        session = get_object_or_404(TestSession, id=pk, user=request.user)

        session.finish_if_expired()
        if session.status == "finished":
            return Response(
                {"detail": "Тест уже завершён"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data["question"]
        options = serializer.validated_data["options"]

        session_question = SessionQuestion.objects.filter(
            session=session, question=question
        ).first()
        if session_question is None:
            return Response(
                {"detail": "Этого вопроса нет в тесте"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        selected_ids = []
        for option in options:
            selected_ids.append(option.id)

        correct_ids = []
        for option in question.options.all():
            if option.is_correct:
                correct_ids.append(option.id)

        is_correct = sorted(selected_ids) == sorted(correct_ids)

        with transaction.atomic():
            session_question.selected_options.set(options)
            session_question.selected_option = None
            session_question.is_correct = is_correct
            if len(selected_ids) > 0:
                session_question.answered_at = timezone.now()
            else:
                session_question.answered_at = None
            session_question.save()

        return Response({"question": question.id, "selected_options": selected_ids})


class FinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        session = get_object_or_404(TestSession, id=pk, user=request.user)

        session.finish()

        session = (
            TestSession.objects.select_related("category", "exam", "subject", "topic")
            .prefetch_related(
                "questions__question__options", "questions__selected_options"
            )
            .get(id=session.id)
        )
        return Response(TestSessionResultSerializer(session).data)


class TestSessionListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestSessionListSerializer

    def get_queryset(self):
        sessions = TestSession.objects.filter(user=self.request.user).select_related(
            "category", "exam", "subject", "topic"
        )

        for session in sessions.filter(status="in_progress"):
            session.finish_if_expired()

        mode = self.request.query_params.get("mode")
        if mode:
            sessions = sessions.filter(mode=mode)

        status_param = self.request.query_params.get("status")
        if status_param:
            sessions = sessions.filter(status=status_param)

        return sessions
