# Generated manually to fix missing updated_at field in ThreadAttachment model
# The database column already exists, so we only update the model state

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('thread', '0003_threadmessage_updated_at'),
    ]

    operations = [
        # Only update the model state, don't alter the database since column already exists
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='threadattachment',
                    name='updated_at',
                    field=models.DateTimeField(auto_now=True),
                ),
            ],
        ),
    ]

