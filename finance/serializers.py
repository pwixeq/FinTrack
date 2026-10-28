from rest_framework import serializers
from .models import Category, Transaction, Budget

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'category_type', 'user']
        read_only_fields = ['id', 'user']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source='category.name',
        read_only=True
    )

    class Meta:
        model = Transaction
        fields = [
            'id',
            'title',
            'amount',
            'transaction_type',
            'category',
            'category_name',
            'date',
            'user',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'created_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Сумма операции должна быть больше нуля.'
            )
        return value

    def validate(self, data):
        request = self.context.get('request')
        category = data.get(
            'category',
            self.instance.category if self.instance else None
        )
        transaction_type = data.get(
            'transaction_type',
            self.instance.transaction_type if self.instance else None
        )

        if category and request:
            if category.user_id not in (None, request.user.id):
                raise serializers.ValidationError({
                    'category': 'Эта категория вам недоступна.'
                })

        if category and transaction_type:
            if category.category_type != transaction_type:
                raise serializers.ValidationError({
                    'category': (
                        'Тип категории должен совпадать '
                        'с типом операции.'
                    )
                })

        return data

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source='category.name',
        read_only=True
    )

    class Meta:
        model = Budget
        fields = [
            'id',
            'category',
            'category_name',
            'month',
            'limit_amount',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_limit_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Лимит бюджета должен быть больше нуля.'
            )
        return value

    def validate_category(self, category):
        request = self.context.get('request')

        if request and category.user_id not in (None, request.user.id):
            raise serializers.ValidationError(
                'Эта категория вам недоступна.'
            )

        if category.category_type != 'expense':
            raise serializers.ValidationError(
                'Бюджет можно создать только для категории расходов.'
            )

        return category
