# Generated manually for EmailVerificationToken model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0007_usernotificationsettings'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailVerificationToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('is_used', models.BooleanField(default=False)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='email_verification_token', to='account.user')),
            ],
            options={
                'db_table': 'email_verification_tokens',
                'verbose_name': 'Email Verification Token',
                'verbose_name_plural': 'Email Verification Tokens',
                'ordering': ['-created_at'],
            },
        ),
    ]
