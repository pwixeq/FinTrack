from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import os


class Command(BaseCommand):
    help = "Set a temporary password for an existing user"

    def handle(self, *args, **options):
        User = get_user_model()
        username = "admin_temp"
        password = os.environ.get("TEMP_ADMIN_PASSWORD")

        if not password:
            self.stderr.write("TEMP_ADMIN_PASSWORD is not set")
            return

        user = User.objects.filter(username=username).first()

        if not user:
            self.stderr.write("User not found")
            return

        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.save()

        self.stdout.write("Temporary admin password set")