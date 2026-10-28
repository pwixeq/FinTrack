from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.shortcuts import render, redirect
from django.views.decorators.http import require_POST

from finance.models import Category, Transaction, Budget


def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)

        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('dashboard')
    else:
        form = UserCreationForm()

    return render(request, 'accounts/register.html', {
        'form': form,
    })


def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)

        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('dashboard')
    else:
        form = AuthenticationForm()

    return render(request, 'accounts/login.html', {
        'form': form,
    })


@login_required
def profile(request):
    user = request.user

    transactions = Transaction.objects.filter(user=user)
    categories = Category.objects.filter(user=user)
    budgets = Budget.objects.filter(category__user=user)

    income_total = sum(
        transaction.amount
        for transaction in transactions.filter(transaction_type='income')
    )

    expense_total = sum(
        transaction.amount
        for transaction in transactions.filter(transaction_type='expense')
    )

    return render(request, 'accounts/profile.html', {
        'profile_user': user,
        'transactions_count': transactions.count(),
        'categories_count': categories.count(),
        'budgets_count': budgets.count(),
        'income_total': income_total,
        'expense_total': expense_total,
    })


@require_POST
def logout_view(request):
    logout(request)
    return redirect('login')