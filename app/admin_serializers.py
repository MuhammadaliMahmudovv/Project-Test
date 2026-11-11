from django.db import transaction
from rest_framework import serializers
from .models import (
    Category,
    Subject,
    Topic,
    Question,
    Option,
    Exam,
    ExamSection,
    ExamSubjectPair,
)


class AdminCategorySerializer(serializers.ModelSerializer):
    subjects_count = serializers.IntegerField(read_only=True)
    topics_count = serializers.IntegerField(read_only=True)
    questions_count = serializers.IntegerField(read_only=True)
    exams_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "title",
            "slug",
            "practice_questions_count",
            "practice_time_limit",
            "subjects_count",
            "topics_count",
            "questions_count",
            "exams_count",
        ]


class AdminSubjectSerializer(serializers.ModelSerializer):
    category_title = serializers.CharField(source="category.title", read_only=True)
    topics_count = serializers.IntegerField(read_only=True)
    questions_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Subject
        fields = [
            "id",
            "category",
            "category_title",
            "title",
            "slug",
            "topics_count",
            "questions_count",
        ]


class AdminTopicSerializer(serializers.ModelSerializer):
    category_title = serializers.CharField(source="category.title", read_only=True)
    subject_title = serializers.CharField(
        source="subject.title", read_only=True, allow_null=True
    )
    questions_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Topic
        fields = [
            "id",
            "category",
            "category_title",
            "subject",
            "subject_title",
            "title",
            "slug",
            "questions_count",
        ]

    def validate(self, attrs):
        category = None
        if "category" in attrs:
            category = attrs["category"]
        elif self.instance:
            category = self.instance.category

        subject = None
        if "subject" in attrs:
            subject = attrs["subject"]
        elif self.instance:
            subject = self.instance.subject

        if subject and category and subject.category_id != category.id:
            raise serializers.ValidationError(
                {"subject": "Предмет должен быть из той же категории."}
            )
        return attrs


class AdminOptionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Option
        fields = ["id", "text", "is_correct"]


class AdminQuestionSerializer(serializers.ModelSerializer):
    options = AdminOptionSerializer(many=True, required=False)
    topic_title = serializers.CharField(source="topic.title", read_only=True)
    subject_title = serializers.CharField(
        source="topic.subject.title", read_only=True, allow_null=True, default=None
    )
    category_title = serializers.CharField(
        source="topic.category.title", read_only=True
    )

    class Meta:
        model = Question
        fields = [
            "id",
            "topic",
            "topic_title",
            "subject_title",
            "category_title",
            "text",
            "image",
            "difficulty",
            "is_multiple",
            "explanation",
            "explanation_image",
            "options",
        ]

    def validate_options(self, options):
        if len(options) < 2:
            raise serializers.ValidationError("Нужно минимум 2 варианта ответа.")
        return options

    def validate(self, attrs):
        if self.instance is None and "options" not in attrs:
            raise serializers.ValidationError({"options": "Добавьте варианты ответа."})

        options = attrs.get("options")
        if options is not None:
            if "is_multiple" in attrs:
                is_multiple = attrs["is_multiple"]
            elif self.instance:
                is_multiple = self.instance.is_multiple
            else:
                is_multiple = False

            correct = 0
            for option in options:
                if option["is_correct"]:
                    correct += 1

            if is_multiple and correct < 1:
                raise serializers.ValidationError(
                    {"options": "Отметьте хотя бы один правильный вариант."}
                )
            if not is_multiple and correct != 1:
                raise serializers.ValidationError(
                    {"options": "Правильным должен быть ровно один вариант."}
                )
        return attrs

    def create(self, validated_data):
        options = validated_data.pop("options")
        with transaction.atomic():
            question = Question.objects.create(**validated_data)
            self.save_options(question, options)
        return question

    def update(self, instance, validated_data):
        options = validated_data.pop("options", None)
        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()

            if options is not None:
                self.save_options(instance, options)
        return instance

    def save_options(self, question, options):
        existing = {}
        for option in question.options.all():
            existing[option.id] = option

        keep_ids = []
        changed = []
        new_options = []
        for data in options:
            option_id = data.get("id")
            if option_id in existing:
                option = existing[option_id]
                option.text = data["text"]
                option.is_correct = data["is_correct"]
                changed.append(option)
                keep_ids.append(option_id)
            else:
                new_options.append(
                    Option(
                        question=question,
                        text=data["text"],
                        is_correct=data["is_correct"],
                    )
                )

        Option.objects.filter(question=question).exclude(id__in=keep_ids).delete()
        Option.objects.bulk_update(changed, ["text", "is_correct"])
        Option.objects.bulk_create(new_options)


class AdminExamSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSection
        fields = ["order", "title", "subject", "is_choice", "questions_count", "points"]


class AdminExamPairSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSubjectPair
        fields = ["first_subject", "second_subject"]


class AdminExamSerializer(serializers.ModelSerializer):
    category_title = serializers.CharField(source="category.title", read_only=True)
    sections = AdminExamSectionSerializer(many=True)
    subject_pairs = AdminExamPairSerializer(many=True, required=False)
    questions_count = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id",
            "category",
            "category_title",
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

    def validate(self, attrs):
        category = None
        if "category" in attrs:
            category = attrs["category"]
        elif self.instance:
            category = self.instance.category
        sections = attrs.get("sections")
        pairs = attrs.get("subject_pairs")

        if sections is not None:
            if len(sections) == 0:
                raise serializers.ValidationError(
                    {"sections": "Добавьте хотя бы один раздел."}
                )
            for section in sections:
                if section.get("subject") and section.get("is_choice"):
                    raise serializers.ValidationError(
                        {
                            "sections": f"«{section['title']}»: раздел либо с предметом, либо «на выбор»."
                        }
                    )
                subject = section.get("subject")
                if subject and subject.category_id != category.id:
                    raise serializers.ValidationError(
                        {
                            "sections": f"«{section['title']}»: предмет из другой категории."
                        }
                    )

        if pairs is not None:
            for pair in pairs:
                if pair["first_subject"].id == pair["second_subject"].id:
                    raise serializers.ValidationError(
                        {
                            "subject_pairs": "В паре нельзя выбрать два одинаковых предмета."
                        }
                    )
        return attrs

    def create(self, validated_data):
        sections = validated_data.pop("sections")
        pairs = validated_data.pop("subject_pairs", [])
        with transaction.atomic():
            exam = Exam.objects.create(**validated_data)
            self.save_children(exam, sections, pairs)
        return exam

    def update(self, instance, validated_data):
        sections = validated_data.pop("sections", None)
        pairs = validated_data.pop("subject_pairs", None)
        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()
            self.save_children(instance, sections, pairs)
        return instance

    def save_children(self, exam, sections, pairs):
        if sections is not None:
            ExamSection.objects.filter(exam=exam).delete()
            new_sections = []
            for section in sections:
                new_sections.append(
                    ExamSection(
                        exam=exam,
                        order=section["order"],
                        title=section["title"],
                        subject=section.get("subject"),
                        is_choice=section.get("is_choice", False),
                        questions_count=section["questions_count"],
                        points=section.get("points", 1),
                    )
                )
            ExamSection.objects.bulk_create(new_sections)

        if pairs is not None:
            ExamSubjectPair.objects.filter(exam=exam).delete()
            new_pairs = []
            used = []
            for pair in pairs:
                key = [pair["first_subject"].id, pair["second_subject"].id]
                if key in used:
                    continue
                used.append(key)
                new_pairs.append(
                    ExamSubjectPair(
                        exam=exam,
                        first_subject=pair["first_subject"],
                        second_subject=pair["second_subject"],
                    )
                )
            ExamSubjectPair.objects.bulk_create(new_pairs)
