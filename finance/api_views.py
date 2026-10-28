from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from .models import Category, Transaction, Budget
from .serializers import (
    CategorySerializer,
    TransactionSerializer,
    BudgetSerializer,
)

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Category.objects.filter(
            Q(user=self.request.user) | Q(user__isnull=True)
        )
        if self.action in ['update', 'partial_update', 'destroy']:
            queryset = queryset.filter(user=self.request.user)

        return queryset.order_by('name')

class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields = ['title', 'category__name']
    ordering_fields = ['date', 'amount', 'title']
    ordering = ['-date', '-id']

    def get_queryset(self):
        queryset = Transaction.objects.filter(
            user=self.request.user
        ).select_related('category')

        category = self.request.query_params.get('category')
        transaction_type = self.request.query_params.get('type')
        date = self.request.query_params.get('date')

        if category:
            queryset = queryset.filter(category_id=category)
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        if date:
            queryset = queryset.filter(date=date)

        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)



class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Budget.objects.filter(
            Q(category__user=self.request.user) |
            Q(category__user__isnull=True)
        ).select_related('category')


