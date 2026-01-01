# "Mermaid liver editor"

erDiagram

    USERS {
        int user_id PK
        string role
        string email
        string username
        string password_hash
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    STUDENTS {
        int student_id PK
        int user_id FK
        string first_name
        string last_name
        string phone
        string timezone
        datetime created_at
    }

    TEACHERS {
        int teacher_id PK
        int user_id FK
        string first_name
        string last_name
        string qualifications
        string expertise
        decimal rating
        datetime created_at
    }

    CS_REPS {
        int csrep_id PK
        int user_id FK
        string first_name
        string last_name
        datetime created_at
    }

    ADMINS {
        int admin_id PK
        int user_id FK
        string first_name
        string last_name
        string access_level
        datetime created_at
    }

    ASSIGNMENTS {
        int assignment_id PK
        string assignment_code
        int student_id FK
        string title
        string service_type
        string status
        datetime due_date
        datetime created_at
    }

    TEACHER_ASSIGNMENTS {
        int id PK
        int assignment_id FK
        int teacher_id FK
        string status
        datetime assigned_at
        datetime created_at
    }

    ASSIGNMENT_FILES {
        int file_id PK
        int assignment_id FK
        int uploaded_by FK
        string file_url
        string mime_type
        datetime created_at
    }

    INVOICES {
        int invoice_id PK
        int assignment_id FK
        int student_id FK
        decimal total_amount
        string status
        datetime due_date
        datetime created_at
    }

    PAYMENTS {
        int payment_id PK
        int invoice_id FK
        decimal amount
        string payment_method
        string status
        datetime created_at
    }

    THREADS {
        int thread_id PK
        string subject
        string thread_type
        int assignment_id FK
        int invoice_id FK
        string status
        datetime created_at
    }

    THREAD_PARTICIPANTS {
        int id PK
        int thread_id FK
        int user_id FK
        datetime created_at
    }

    MESSAGES {
        int message_id PK
        int thread_id FK
        int sender_id FK
        text content
        datetime created_at
    }

    MESSAGE_ATTACHMENTS {
        int id PK
        int message_id FK
        string file_url
        datetime created_at
    }

    MEETINGS {
        int meeting_id PK
        int assignment_id FK
        string meeting_code
        datetime scheduled_time
        string status
        datetime created_at
    }

    MEETING_PARTICIPANTS {
        int id PK
        int meeting_id FK
        int user_id FK
        datetime created_at
    }

    WRITINGS {
        int writing_id PK
        int assignment_id FK
        int student_id FK
        int teacher_id FK
        string status
        datetime created_at
    }

    HOMEWORKS {
        int homework_id PK
        int assignment_id FK
        int teacher_id FK
        int student_id FK
        datetime due_date
        datetime created_at
    }

    EXAMS {
        int exam_id PK
        int assignment_id FK
        int teacher_id FK
        int duration_minutes
        string status
        datetime created_at
    }

    NOTIFICATIONS {
        int notification_id PK
        int user_id FK
        string title
        boolean is_read
        datetime created_at
    }

    AUDIT_LOGS {
        int audit_id PK
        int actor_id FK
        string action
        string entity_type
        int entity_id
        datetime created_at
    }

    %% =========================
    %% PRE-SIGN-IN COMMUNICATION
    %% =========================

    PRE_SIGNIN_SESSIONS {
        int session_id PK
        string visitor_name
        string visitor_email
        string visitor_phone
        string subject
        string status
        int assigned_csrep_id FK
        datetime started_at
        datetime last_activity_at
    }

    PRE_SIGNIN_MESSAGES {
        int message_id PK
        int session_id FK
        int csrep_id FK
        string sender_type
        text content
        datetime created_at
    }

    %% =========================
    %% RELATIONSHIPS
    %% =========================

    USERS ||--|| STUDENTS : has
    USERS ||--|| TEACHERS : has
    USERS ||--|| CS_REPS : has
    USERS ||--|| ADMINS : has

    STUDENTS ||--o{ ASSIGNMENTS : creates
    ASSIGNMENTS ||--o{ TEACHER_ASSIGNMENTS : assigned_to
    TEACHERS ||--o{ TEACHER_ASSIGNMENTS : works_on

    ASSIGNMENTS ||--o{ ASSIGNMENT_FILES : includes
    ASSIGNMENTS ||--o{ INVOICES : billed_by
    INVOICES ||--o{ PAYMENTS : paid_by

    THREADS ||--o{ THREAD_PARTICIPANTS : includes
    USERS ||--o{ THREAD_PARTICIPANTS : participates

    THREADS ||--o{ MESSAGES : contains
    MESSAGES ||--o{ MESSAGE_ATTACHMENTS : has

    ASSIGNMENTS ||--o{ MEETINGS : schedules
    MEETINGS ||--o{ MEETING_PARTICIPANTS : includes

    ASSIGNMENTS ||--o{ WRITINGS : produces
    ASSIGNMENTS ||--o{ HOMEWORKS : assigns
    ASSIGNMENTS ||--o{ EXAMS : evaluates

    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : triggers

    CS_REPS ||--o{ PRE_SIGNIN_SESSIONS : handles
    PRE_SIGNIN_SESSIONS ||--o{ PRE_SIGNIN_MESSAGES : contains
    CS_REPS ||--o{ PRE_SIGNIN_MESSAGES : responds

