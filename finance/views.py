
from datetime import date
from decimal import Decimal, InvalidOperation

from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import JsonResponse
from django.shortcuts import render
from django.template.loader import render_to_string
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from .models import Category, Transaction, Budget


@login_required
def dashboard(request):
    today = timezone.localdate()
    month_start = today.replace(day=1)

    # Только операции текущего пользователя
    transactions = Transaction.objects.filter(
        user=request.user
    ).select_related('category')

    income_total = transactions.filter(
        transaction_type='income'
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    expense_total = transactions.filter(
        transaction_type='expense'
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    month_transactions = transactions.filter(
        date__year=today.year,
        date__month=today.month
    )

    month_income = month_transactions.filter(
        transaction_type='income'
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    month_expenses = month_transactions.filter(
        transaction_type='expense'
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    # График доходов и расходов за последние 6 месяцев
    months_labels = []
    income_values = []
    expense_values = []

    for offset in range(5, -1, -1):
        month_number = today.month - offset
        year = today.year

        while month_number <= 0:
            month_number += 12
            year -= 1

        month_date = date(year, month_number, 1)

        month_data = transactions.filter(
            date__year=year,
            date__month=month_number
        )

        income = month_data.filter(
            transaction_type='income'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        expense = month_data.filter(
            transaction_type='expense'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        months_labels.append(month_date.strftime('%m.%Y'))
        income_values.append(float(income))
        expense_values.append(float(expense))

    # Расходы по категориям за текущий месяц
    category_data = month_transactions.filter(
        transaction_type='expense'
    ).values(
        'category__name'
    ).annotate(
        total=Sum('amount')
    ).order_by('-total')

    context = {
        'balance': income_total - expense_total,
        'month_income': month_income,
        'month_expenses': month_expenses,
        'latest_transactions': transactions.order_by('-date', '-id')[:5],
        'months_labels': months_labels,
        'income_values': income_values,
        'expense_values': expense_values,
        'category_labels': [
            item['category__name'] for item in category_data
        ],
        'category_values': [
            float(item['total']) for item in category_data
        ],
    }

    return render(request, 'dashboard.html', context)


@login_required
@ensure_csrf_cookie
def transactions_page(request):
    categories = Category.objects.filter(
        user=request.user
    ).order_by('name')

    return render(request, 'transactions.html', {
        'categories': categories,
        'today': timezone.localdate(),
    })


@login_required
@require_GET
def transactions_api(request):
    transactions = Transaction.objects.filter(
        user=request.user
    ).select_related('category')

    search = request.GET.get('search', '').strip()
    transaction_type = request.GET.get('type', '')

    if search:
        transactions = transactions.filter(title__icontains=search)

    if transaction_type in ('income', 'expense'):
        transactions = transactions.filter(
            transaction_type=transaction_type
        )

    html = render_to_string(
        'includes/transaction_rows.html',
        {'transactions': transactions.order_by('-date', '-id')},
        request=request
    )

    return JsonResponse({'html': html})


@login_required
@require_POST
def transaction_create(request):
    title = request.POST.get('title', '').strip()
    amount_text = request.POST.get('amount', '').strip()
    transaction_type = request.POST.get('transaction_type', '')
    category_id = request.POST.get('category', '')
    date_text = request.POST.get('date', '')

    if not title or len(title) > 200:
        return JsonResponse({
            'error': 'Укажи название операции до 200 символов.'
        }, status=400)

    if transaction_type not in ('income', 'expense'):
        return JsonResponse({
            'error': 'Неверный тип операции.'
        }, status=400)

    try:
        amount = Decimal(amount_text)
        operation_date = date.fromisoformat(date_text)
    except (InvalidOperation, ValueError, TypeError):
        return JsonResponse({
            'error': 'Проверь сумму и дату.'
        }, status=400)

    if (
        not amount.is_finite()
        or amount <= 0
        or amount > Decimal('9999999999.99')
    ):
        return JsonResponse({
            'error': 'Сумма должна быть положительной и не превышать лимит.'
        }, status=400)

    # Нельзя выбрать чужую категорию
    category = Category.objects.filter(
        pk=category_id,
        user=request.user,
        category_type=transaction_type
    ).first()

    if category is None:
        return JsonResponse({
            'error': 'Выбери свою категорию подходящего типа.'
        }, status=400)

    transaction = Transaction.objects.create(
        title=title,
        amount=amount,
        transaction_type=transaction_type,
        category=category,
        date=operation_date,
        user=request.user
    )

    return JsonResponse({
        'success': True,
        'message': f'Операция «{transaction.title}» добавлена.'
    })


@login_required
@require_POST
def transaction_delete(request, pk):
    transaction = Transaction.objects.filter(
        pk=pk,
        user=request.user
    ).first()

    if transaction is None:
        return JsonResponse({
            'error': 'Операция не найдена.'
        }, status=404)

    transaction.delete()
    return JsonResponse({'success': True})


@login_required
def categories_page(request):
    categories = Category.objects.filter(
        user=request.user
    ).order_by('category_type', 'name')

    return render(request, 'categories.html', {
        'categories': categories
    })


@login_required
@require_http_methods(['POST'])
def category_create(request):
    name = request.POST.get('name', '').strip()
    category_type = request.POST.get('category_type', '')

    if not name or len(name) > 100:
        return JsonResponse({
            'error': 'Укажи название категории до 100 символов.'
        }, status=400)

    if category_type not in ('income', 'expense'):
        return JsonResponse({
            'error': 'Выбери тип категории.'
        }, status=400)

    if Category.objects.filter(
        name__iexact=name,
        category_type=category_type,
        user=request.user
    ).exists():
        return JsonResponse({
            'error': 'Такая категория уже существует.'
        }, status=400)

    category = Category.objects.create(
        name=name,
        category_type=category_type,
        user=request.user
    )

    return JsonResponse({
        'success': True,
        'id': category.id,
        'name': category.name,
        'category_type': category.category_type
    })


@login_required
@require_http_methods(['POST'])
def category_delete(request, pk):
    category = Category.objects.filter(
        pk=pk,
        user=request.user
    ).first()

    if category is None:
        return JsonResponse({
            'error': 'Категория не найдена.'
        }, status=404)

    if category.transactions.exists():
        return JsonResponse({
            'error': 'Нельзя удалить категорию, к которой привязаны операции.'
        }, status=400)

    category.delete()
    return JsonResponse({'success': True})


@login_required
def budgets_page(request):
    today = timezone.localdate()
    month_start = today.replace(day=1)

    categories = Category.objects.filter(
        user=request.user,
        category_type='expense'
    ).order_by('name')

    budgets = Budget.objects.filter(
        category__user=request.user,
        month=month_start
    ).select_related('category')

    budget_data = []

    for budget in budgets:
        spent = Transaction.objects.filter(
            user=request.user,
            category=budget.category,
            transaction_type='expense',
            date__year=month_start.year,
            date__month=month_start.month
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        remaining = budget.limit_amount - spent

        if budget.limit_amount > 0:
            percent = int(spent / budget.limit_amount * 100)
        else:
            percent = 0

        progress_percent = min(percent, 100)

        budget_data.append({
            'budget': budget,
            'spent': spent,
            'remaining': remaining,
            'percent': percent,
            'progress_percent': progress_percent,
        })

    return render(request, 'budgets.html', {
        'budgets': budget_data,
        'categories': categories,
        'month': month_start
    })


@login_required
@require_POST
def budget_create(request):
    category_id = request.POST.get('category', '')
    amount_text = request.POST.get('limit_amount', '').strip()
    month_text = request.POST.get('month', '').strip()

    try:
        category = Category.objects.get(
            pk=category_id,
            user=request.user,
            category_type='expense'
        )
        selected_month = date.fromisoformat(month_text + '-01')
        amount = Decimal(amount_text)

    except (Category.DoesNotExist, InvalidOperation, ValueError, TypeError):
        return JsonResponse({
            'error': 'Проверь категорию, месяц и сумму.'
        }, status=400)

    if (
        not amount.is_finite()
        or amount <= 0
        or amount > Decimal('9999999999.99')
    ):
        return JsonResponse({
            'error': 'Лимит должен быть положительным числом.'
        }, status=400)

    budget, created = Budget.objects.update_or_create(
        category=category,
        month=selected_month,
        defaults={'limit_amount': amount}
    )

    return JsonResponse({
        'success': True,
        'message': (
            'Бюджет создан.'
            if created
            else 'Лимит существующего бюджета обновлён.'
        )
    })


@login_required
@require_POST
def budget_delete(request, pk):
    budget = Budget.objects.filter(
        pk=pk,
        category__user=request.user
    ).first()

    if budget is None:
        return JsonResponse({
            'error': 'Бюджет не найден.'
        }, status=404)

    budget.delete()
    return JsonResponse({'success': True})

@login_required
def api_manager_page(request):
    return render(request, 'api_manager.html')