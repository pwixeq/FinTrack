from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from finance import views

urlpatterns = [
    path('', RedirectView.as_view(url='/finance/', permanent=False)),
    path('admin/', admin.site.urls),
    path('finance/', include('finance.urls')),
    path('accounts/', include('accounts.urls')),
    path('api-manager/', views.api_manager_page, name='api_manager'),
    path('api/', include('finance.api_urls')),
    path('tickets/', include('tickets.urls')),
]