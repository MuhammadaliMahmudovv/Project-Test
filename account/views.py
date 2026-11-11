from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import CreateAPIView
from .serializers import RegistrationSerializer
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User


class RegistrationView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegistrationSerializer


class HelloView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"message": f"Hello, {request.user.username}"})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {"username": request.user.username, "is_staff": request.user.is_staff}
        )
