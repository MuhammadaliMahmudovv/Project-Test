from rest_framework import serializers
from .models import (
    Category,
    Subject,
    Topic,
    Exam,
    ExamSection,
    ExamSubjectPair,
    TestSession,
    Question,
    Option,
    SessionQuestion,
)


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "title", "slug"]


class TopicSerializer(serializers.ModelSerializer):
    questions_count = serializers.IntegerField(read_only=True)
    difficulty_counts = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = ["id", "title", "questions_count", "difficulty_counts"]

    def get_difficulty_counts(self, obj):
        return {
            "easy": obj.easy_count,
            "medium": obj.medium_count,
            "hard": obj.hard_count,
        }


class SubjectTopicsSerializer(serializers.ModelSerializer):
    topics = TopicSerializer(read_only=True, many=True)
    topics_count = serializers.IntegerField(read_only=True)
    questions_count = serializers.IntegerField(read_only=True)
    difficulty_counts = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = [
            "id",
            "title",
            "slug",
            "topics_count",
            "questions_count",
            "difficulty_counts",
            "topics",
        ]

    def get_difficulty_counts(self, obj):
        return {
            "easy": obj.easy_count,
            "medium": obj.medium_count,
            "hard": obj.hard_count,
        }


class SubjectCountsSerializer(serializers.ModelSerializer):
    topics_count = serializers.IntegerField(read_only=True)
    questions_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Subject
        fields = ["id", "title", "slug", "topics_count", "questions_count"]


class CategorySubjectsSerializer(serializers.ModelSerializer):
    subjects = SubjectCountsSerializer(read_only=True, many=True)

    class Meta:
        model = Category
        fields = ["id", "title", "subjects"]


class CategorySerializer(serializers.ModelSerializer):
    subjects_count = serializers.IntegerField(read_only=True)
    topics_count = serializers.IntegerField(read_only=True)
    exams_count = serializers.IntegerField(read_only=True)
    questions_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "title",
            "slug",
            "subjects_count",
            "topics_count",
            "exams_count",
            "questions_count",
        ]


class CategoryTopicsSerializer(serializers.ModelSerializer):
    topics = TopicSerializer(read_only=True, many=True)

    class Meta:
        model = Category
        fields = ["id", "title", "topics"]


class ExamSectionSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)

    class Meta:
        model = ExamSection
        fields = ["order", "title", "subject", "is_choice", "questions_count", "points"]


class ExamSubjectPairSerializer(serializers.ModelSerializer):
    first_subject = SubjectSerializer(read_only=True)
    second_subject = SubjectSerializer(read_only=True)

    class Meta:
        model = ExamSubjectPair
        fields = ["id", "first_subject", "second_subject"]


class ExamSerializer(serializers.ModelSerializer):
    sections = ExamSectionSerializer(read_only=True, many=True)
    subject_pairs = ExamSubjectPairSerializer(read_only=True, many=True)
    questions_count = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id",
            "category",
            "title",
            "time_limit",
            "max_mistakes",
            "questions_count",
            "sections",
            "subject_pairs",
        ]

    def get_questions_count(self, obj):
        total = 0
        for section in obj.sections.all():
            total += section.questions_count
        return total


class StartPracticeSerializer(serializers.Serializer):
    subject = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), required=False
    )
    topic = serializers.PrimaryKeyRelatedField(
        queryset=Topic.objects.all(), required=False
    )
    difficulty = serializers.ChoiceField(
        choices=Question.DIFFICULTY_CHOICES, required=False
    )
    questions_count = serializers.IntegerField(
        min_value=1, max_value=100, required=False
    )
    time_limit = serializers.IntegerField(min_value=1, max_value=240, required=False)

    def validate(self, attrs):
        has_subject = "subject" in attrs
        has_topic = "topic" in attrs

        if has_subject and has_topic:
            raise serializers.ValidationError(
                "Нельзя одновременно указать и subject, и topic."
            )
        if not has_subject and not has_topic:
            raise serializers.ValidationError("Нужно указать subject или topic.")

        return attrs


class StartExamSerializer(serializers.Serializer):
    exam = serializers.PrimaryKeyRelatedField(queryset=Exam.objects.all())
    subjects = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), many=True, required=False, default=list
    )

    def validate(self, attrs):
        exam = attrs["exam"]
        subjects = attrs["subjects"]
        sections = list(exam.sections.all())

        if len(sections) == 0:
            raise serializers.ValidationError({"exam": "У этого экзамена нет разделов"})

        choice_count = 0
        fixed_subject_ids = []
        for section in sections:
            if section.is_choice:
                choice_count += 1
            if section.subject_id:
                fixed_subject_ids.append(section.subject_id)

        if len(subjects) != choice_count:
            raise serializers.ValidationError(
                {"subjects": f"Нужно выбрать предметов: {choice_count}."}
            )

        subject_ids = []
        for subject in subjects:
            if subject.id in subject_ids:
                raise serializers.ValidationError(
                    {"subjects": "Предметы не должны повторяться."}
                )
            subject_ids.append(subject.id)

        for subject in subjects:
            if (
                subject.category_id != exam.category_id
                or subject.id in fixed_subject_ids
            ):
                raise serializers.ValidationError(
                    {
                        "subjects": f"Предмет «{subject.title}» нельзя выбрать в этом экзамене."
                    }
                )

        pairs = list(exam.subject_pairs.all())
        if len(pairs) > 0:
            pair_allowed = False
            for pair in pairs:
                if subject_ids == [pair.first_subject_id, pair.second_subject_id]:
                    pair_allowed = True
            if not pair_allowed:
                raise serializers.ValidationError(
                    {"subjects": "Такая комбинация предметов не разрешена."}
                )

        attrs["sections"] = sections
        return attrs


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ["id", "text"]


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(read_only=True, many=True)

    class Meta:
        model = Question
        fields = ["id", "text", "image", "difficulty", "is_multiple", "options"]


class SessionQuestionSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    selected_options = serializers.SerializerMethodField()

    class Meta:
        model = SessionQuestion
        fields = ["order", "section", "points", "question", "selected_options"]

    def get_selected_options(self, obj):
        ids = []
        for option in obj.selected_options.all():
            ids.append(option.id)
        if obj.selected_option_id and obj.selected_option_id not in ids:
            ids.append(obj.selected_option_id)
        return ids


class TestSessionSerializer(serializers.ModelSerializer):
    questions = SessionQuestionSerializer(read_only=True, many=True)
    deadline = serializers.DateTimeField(read_only=True)

    class Meta:
        model = TestSession
        fields = [
            "id",
            "mode",
            "category",
            "exam",
            "subject",
            "topic",
            "retry_of",
            "difficulty",
            "status",
            "time_limit",
            "started_at",
            "deadline",
            "max_score",
            "questions",
        ]


class AnswerSerializer(serializers.Serializer):
    question = serializers.PrimaryKeyRelatedField(queryset=Question.objects.all())
    option = serializers.PrimaryKeyRelatedField(
        queryset=Option.objects.all(), required=False
    )
    options = serializers.PrimaryKeyRelatedField(
        queryset=Option.objects.all(), many=True, required=False
    )

    def validate(self, attrs):
        question = attrs["question"]

        if "option" in attrs:
            attrs["options"] = [attrs["option"]]

        if "options" not in attrs:
            raise serializers.ValidationError({"options": "Выберите вариант."})

        if not question.is_multiple and len(attrs["options"]) != 1:
            raise serializers.ValidationError(
                {"options": "В этом вопросе можно выбрать только один вариант."}
            )

        for option in attrs["options"]:
            if option.question_id != question.id:
                raise serializers.ValidationError(
                    {"options": "Этот вариант не относится к этому вопросу."}
                )
        return attrs


class ResultOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ["id", "text", "is_correct"]


class ResultQuestionSerializer(serializers.ModelSerializer):
    options = ResultOptionSerializer(read_only=True, many=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "text",
            "image",
            "difficulty",
            "is_multiple",
            "explanation",
            "explanation_image",
            "options",
        ]


class SessionQuestionResultSerializer(serializers.ModelSerializer):
    question = ResultQuestionSerializer(read_only=True)
    selected_options = serializers.SerializerMethodField()

    class Meta:
        model = SessionQuestion
        fields = [
            "order",
            "section",
            "points",
            "question",
            "selected_options",
            "is_correct",
        ]

    def get_selected_options(self, obj):
        ids = []
        for option in obj.selected_options.all():
            ids.append(option.id)
        if obj.selected_option_id and obj.selected_option_id not in ids:
            ids.append(obj.selected_option_id)
        return ids


class TestSessionResultSerializer(serializers.ModelSerializer):
    questions = SessionQuestionResultSerializer(read_only=True, many=True)
    score_percent = serializers.FloatField(read_only=True)
    sections = serializers.SerializerMethodField()
    wrong_count = serializers.SerializerMethodField()
    skipped_count = serializers.SerializerMethodField()
    category_title = serializers.CharField(source="category.title", read_only=True)
    exam_title = serializers.CharField(
        source="exam.title", read_only=True, allow_null=True
    )
    subject_title = serializers.CharField(
        source="subject.title", read_only=True, allow_null=True
    )
    topic_title = serializers.CharField(
        source="topic.title", read_only=True, allow_null=True
    )

    class Meta:
        model = TestSession
        fields = [
            "id",
            "mode",
            "category",
            "category_title",
            "exam",
            "exam_title",
            "subject",
            "subject_title",
            "topic",
            "topic_title",
            "retry_of",
            "difficulty",
            "status",
            "time_limit",
            "started_at",
            "finished_at",
            "correct_count",
            "wrong_count",
            "skipped_count",
            "total_count",
            "score",
            "max_score",
            "score_percent",
            "passed",
            "sections",
            "questions",
        ]

    def get_wrong_count(self, obj):
        count = 0
        for item in obj.questions.all():
            if item.answered_at is not None and not item.is_correct:
                count += 1
        return count

    def get_skipped_count(self, obj):
        count = 0
        for item in obj.questions.all():
            if item.answered_at is None:
                count += 1
        return count

    def get_sections(self, obj):
        sections = []
        for item in obj.questions.all():
            if len(sections) == 0 or sections[-1]["title"] != item.section:
                sections.append(
                    {
                        "title": item.section,
                        "correct_count": 0,
                        "total_count": 0,
                        "score": 0,
                        "max_score": 0,
                    }
                )
            section = sections[-1]
            section["total_count"] += 1
            section["max_score"] += item.points
            if item.is_correct:
                section["correct_count"] += 1
                section["score"] += item.points
        return sections


class TestSessionListSerializer(serializers.ModelSerializer):
    category_title = serializers.CharField(source="category.title", read_only=True)
    exam_title = serializers.CharField(
        source="exam.title", read_only=True, allow_null=True
    )
    subject_title = serializers.CharField(
        source="subject.title", read_only=True, allow_null=True
    )
    topic_title = serializers.CharField(
        source="topic.title", read_only=True, allow_null=True
    )
    score_percent = serializers.FloatField(read_only=True)

    class Meta:
        model = TestSession
        fields = [
            "id",
            "mode",
            "category",
            "category_title",
            "exam",
            "exam_title",
            "subject",
            "subject_title",
            "topic",
            "topic_title",
            "retry_of",
            "status",
            "started_at",
            "finished_at",
            "correct_count",
            "total_count",
            "score",
            "max_score",
            "score_percent",
            "passed",
        ]
