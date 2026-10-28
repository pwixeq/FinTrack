from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),

    path('transactions/', views.transactions_page, name='transactions'),
    path('transactions/api/', views.transactions_api, name='transactions_api'),
    path('transactions/create/', views.transaction_create, name='transaction_create'),
    path(
        'transactions/<int:pk>/delete/',
        views.transaction_delete,
        name='transaction_delete',
    ),

    path('categories/', views.categories_page, name='categories'),
    path('categories/create/', views.category_create, name='category_create'),
    path(
        'categories/<int:pk>/delete/',
        views.category_delete,
        name='category_delete',
    ),
    path('budgets/', views.budgets_page, name='budgets'),
    path('budgets/create/', views.budget_create, name='budget_create'),
    path('budgets/<int:pk>/delete/', views.budget_delete, name='budget_delete'),
]