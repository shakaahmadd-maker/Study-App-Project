"""
Management command to create test users for Admin, Teacher, and CS-Rep roles.
Usage: python manage.py create_test_users
"""
from django.core.management.base import BaseCommand
from account.models import User, Admin, Teacher, CSRep


class Command(BaseCommand):
    help = 'Creates test users for Admin, Teacher, and CS-Rep roles'

    def handle(self, *args, **options):
        # Create Admin User
        admin_email = 'admin@nanoproblem.com'
        admin_username = 'admin'
        admin_password = 'admin123'
        
        admin_user, created = User.objects.get_or_create(
            email=admin_email,
            defaults={
                'username': admin_username,
                'role': 'ADMIN',
                'first_name': 'Admin',
                'last_name': 'User',
                'is_active': True,
                'is_staff': True,
            }
        )
        
        if created:
            admin_user.set_password(admin_password)
            admin_user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Created Admin user:\n'
                    f'  Email: {admin_email}\n'
                    f'  Username: {admin_username}\n'
                    f'  Password: {admin_password}\n'
                    f'  User ID (UUID): {admin_user.id}\n'
                )
            )
        else:
            admin_user.set_password(admin_password)
            admin_user.save()
            self.stdout.write(
                self.style.WARNING(
                    f'✓ Admin user already exists, password reset:\n'
                    f'  Email: {admin_email}\n'
                    f'  Username: {admin_username}\n'
                    f'  Password: {admin_password}\n'
                    f'  User ID (UUID): {admin_user.id}\n'
                )
            )

        # Create Teacher User
        teacher_email = 'teacher@nanoproblem.com'
        teacher_username = 'teacher'
        teacher_password = 'teacher123'
        
        teacher_user, created = User.objects.get_or_create(
            email=teacher_email,
            defaults={
                'username': teacher_username,
                'role': 'TEACHER',
                'first_name': 'John',
                'last_name': 'Teacher',
                'is_active': True,
                'is_staff': False,
            }
        )
        
        if created:
            teacher_user.set_password(teacher_password)
            teacher_user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Created Teacher user:\n'
                    f'  Email: {teacher_email}\n'
                    f'  Username: {teacher_username}\n'
                    f'  Password: {teacher_password}\n'
                    f'  User ID (UUID): {teacher_user.id}\n'
                )
            )
        else:
            teacher_user.set_password(teacher_password)
            teacher_user.save()
            self.stdout.write(
                self.style.WARNING(
                    f'✓ Teacher user already exists, password reset:\n'
                    f'  Email: {teacher_email}\n'
                    f'  Username: {teacher_username}\n'
                    f'  Password: {teacher_password}\n'
                    f'  User ID (UUID): {teacher_user.id}\n'
                )
            )

        # Create CS-Rep User
        csrep_email = 'csrep@nanoproblem.com'
        csrep_username = 'csrep'
        csrep_password = 'csrep123'
        
        csrep_user, created = User.objects.get_or_create(
            email=csrep_email,
            defaults={
                'username': csrep_username,
                'role': 'CS_REP',
                'first_name': 'Sarah',
                'last_name': 'CSRep',
                'is_active': True,
                'is_staff': False,
            }
        )
        
        if created:
            csrep_user.set_password(csrep_password)
            csrep_user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Created CS-Rep user:\n'
                    f'  Email: {csrep_email}\n'
                    f'  Username: {csrep_username}\n'
                    f'  Password: {csrep_password}\n'
                    f'  User ID (UUID): {csrep_user.id}\n'
                )
            )
        else:
            csrep_user.set_password(csrep_password)
            csrep_user.save()
            self.stdout.write(
                self.style.WARNING(
                    f'✓ CS-Rep user already exists, password reset:\n'
                    f'  Email: {csrep_email}\n'
                    f'  Username: {csrep_username}\n'
                    f'  Password: {csrep_password}\n'
                    f'  User ID (UUID): {csrep_user.id}\n'
                )
            )

        self.stdout.write(
            self.style.SUCCESS('\n✓ All test users created successfully!')
        )
        self.stdout.write(
            self.style.SUCCESS('\n📝 Login Credentials Summary:')
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'\n🔑 ADMIN:\n'
                f'   Role: Admin\n'
                f'   User ID: {admin_user.id} OR username: {admin_username}\n'
                f'   Password: {admin_password}\n'
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'\n👨‍🏫 TEACHER:\n'
                f'   Role: Teacher\n'
                f'   User ID: {teacher_user.id} OR username: {teacher_username}\n'
                f'   Password: {teacher_password}\n'
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'\n👤 CS-REP:\n'
                f'   Role: CS-Rep\n'
                f'   User ID: {csrep_user.id} OR username: {csrep_username}\n'
                f'   Password: {csrep_password}\n'
            )
        )

