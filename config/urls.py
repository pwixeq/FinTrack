from django.contrib import admin
from django.urls import path, include
from finance import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('finance/', include('finance.urls')),
    path('accounts/', include('accounts.urls')),
    path('api-manager/', views.api_manager_page, name='api_manager'),
    path('api/', include('finance.api_urls')),
    path('tickets/', include('tickets.urls')),
]