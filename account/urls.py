from django.urls import path
from . import views
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenBlacklistView,
)

urlpatterns = [
    path("login/", TokenObtainPairView.as_view()),
    path("refresh/", TokenRefreshView.as_view()),
    path("register/", views.RegistrationView.as_view()),
    path("logout/", TokenBlacklistView.as_view()),
    path("hello/", views.HelloView.as_view()),
    path("me/", views.MeView.as_view()),
]
