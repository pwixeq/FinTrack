from django.db import models
from django.contrib.auth.models import User

class Category(models.Model):
    TYPE_CHOICES = [
        ('income', 'Доход'),
        ('expense', 'Расход'),
    ]

    name = models.CharField(
        max_length=100,
        verbose_name='Название'
    )

    category_type = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        verbose_name='Тип категории'
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Пользователь'
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Категория'
        verbose_name_plural = 'Категории'


class Transaction(models.Model):
    TYPE_CHOICES = [
        ('income', 'Доход'),
        ('expense', 'Расход'),
    ]

    title = models.CharField(
        max_length=200,
        verbose_name='Название операции'
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Сумма'
    )

    transaction_type = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        verbose_name='Тип операции'
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='transactions',
        verbose_name='Категория'
    )

    date = models.DateField(
        verbose_name='Дата операции'
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Пользователь'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = 'Операция'
        verbose_name_plural = 'Операции'
        ordering = ['-date', '-id']
class Budget(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='budgets',
        verbose_name='Категория'
    )
    month = models.DateField(verbose_name='Месяц бюджета')
    limit_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Лимит расходов'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.category.name} — {self.month.strftime("%m.%Y")}'

    class Meta:
        verbose_name = 'Бюджет'
        verbose_name_plural = 'Бюджеты'
        ordering = ['-month', 'category__name']
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'month'],
                name='unique_budget_category_month'
            )
        ]