# Visual Diagrams

These diagrams visualize the platform aligned with `ERD.md` (single source of truth). Copy any block into a PlantUML/Mermaid renderer (e.g., VS Code plugins, Kroki, Mermaid Live, PlantUML server) to view.

**Note:** All diagrams reflect the ERD defined in `ERD.md`, including pre-sign-in communication entities (PRE_SIGNIN_SESSIONS, PRE_SIGNIN_MESSAGES) and the Visitor actor, which are fully separated from authenticated user entities (USERS, THREADS, MESSAGES).

---

## Use Case Diagram (UML)

```plantuml
@startuml
left to right direction
actor Student
actor Teacher
actor "CS Rep" as CSRep
actor Admin
actor Visitor

rectangle System {
  usecase "Register / Login" as UC1
  usecase "Request Assignment" as UC2
  usecase "Track Assignments" as UC3
  usecase "Schedule / Join Meeting" as UC4
  usecase "View/Pay Invoice" as UC5
  usecase "Initiate Pre-Sign-in Chat" as UC6
  usecase "Send Pre-Sign-in Message" as UC7
  usecase "Create Invoice Request" as UC8
  usecase "Approve Invoice" as UC9
  usecase "Assign Teacher" as UC10
  usecase "Send Announcements" as UC11
  usecase "Manage Roles/Users" as UC12
  usecase "Respond to Pre-Sign-in Chat" as UC13
  usecase "Close Pre-Sign-in Session" as UC14
}

Student -- UC1
Student -- UC2
Student -- UC3
Student -- UC4
Student -- UC5

Teacher -- UC3
Teacher -- UC4

Visitor -- UC6
Visitor -- UC7

CSRep -- UC6
CSRep -- UC7
CSRep -- UC8
CSRep -- UC10
CSRep -- UC13
CSRep -- UC14

Admin -- UC9
Admin -- UC11
Admin -- UC12
@enduml
```

---

## System Context Diagram (C4-Context)

```plantuml
@startuml
!include <C4/C4_Context>
Person(student, "Student")
Person(teacher, "Teacher")
Person(csrep, "CS Rep")
Person(admin, "Admin")
Person(visitor, "Visitor", "Unauthenticated user")
System(system, "Nano Problems Platform", "Assignments, meetings, invoicing, pre-sign-in chat")
System_Ext(email, "Email/SMS Provider")
System_Ext(pg, "PostgreSQL DB")
System_Ext(files, "Object Storage (S3)")
System_Ext(pay, "Payment Gateway (Stripe/PayPal)")
System_Ext(webrtc, "WebRTC/Turn Servers")

Rel(student, system, "Uses via Web UI")
Rel(teacher, system, "Uses via Web UI")
Rel(csrep, system, "Uses via Web UI")
Rel(admin, system, "Uses via Web UI")
Rel(visitor, system, "Pre-sign-in chat via Web UI")
Rel(system, pg, "Read/Write")
Rel(system, files, "Upload/Download files")
Rel(system, pay, "Create/Confirm payments")
Rel(system, email, "Notifications")
Rel(system, webrtc, "Audio/Video signaling/media")
@enduml
```

---

## Architectural Diagram (C4-Container)

```plantuml
@startuml
!include <C4/C4_Container>
Person(user, "Users", "Students/Teachers/CS Reps/Admins")
System_Boundary(sb, "Nano Problems Platform") {
  Container(web, "Web Frontend", "HTML/CSS/JS", "Dashboards & UI")
  Container(api, "Django API", "Python/Django", "REST + WebSockets")
  ContainerDb(db, "PostgreSQL", "RDBMS", "Core data: users, assignments, meetings, invoices")
  Container(files, "Object Storage", "S3-compatible", "Attachments, recordings")
  Container(extpay, "Payment Gateway", "Stripe/PayPal", "Payments")
  Container(realtime, "Channels/Redis", "WS layer", "Real-time signaling/events")
}
Rel(user, web, "Browses")
Rel(web, api, "HTTPS")
Rel(api, db, "SQL")
Rel(api, files, "Upload/Download")
Rel(api, extpay, "Create charges/webhooks")
Rel(api, realtime, "WS publish/subscribe")
@enduml
```

---

## Component Diagram (UML)

```plantuml
@startuml
package "Django API" {
  [Auth & Users]
  [Assignments Service]
  [Meetings Service]
  [Invoices Service]
  [Pre-Sign-In Messaging Module]
  [Authenticated Messaging Service]
  [Announcements & Notifications]
  [Files Service]
}

[Web Frontend] --> [Auth & Users]
[Web Frontend] --> [Assignments Service]
[Web Frontend] --> [Meetings Service]
[Web Frontend] --> [Invoices Service]
[Web Frontend] --> [Pre-Sign-In Messaging Module]
[Web Frontend] --> [Authenticated Messaging Service]
[Web Frontend] --> [Announcements & Notifications]

[Assignments Service] --> [Files Service]
[Meetings Service] --> [Files Service]
[Invoices Service] ..> PaymentGateway : webhooks
[Meetings Service] ..> WebRTC : signaling
[Pre-Sign-In Messaging Module] ..> [Auth & Users] : CS-REP lookup only
note right of [Pre-Sign-In Messaging Module]
  Independent module for
  unauthenticated visitors.
  No dependency on authenticated
  messaging components.
end note
@enduml
```

---

## Deployment Diagram (UML)

```plantuml
@startuml
node "Client Browser" as client
node "CDN" as cdn
node "Kubernetes Cluster" as k8s {
  node "Ingress / Nginx" as ingress
  node "Django App Pod" as appPod {
    component "Django API" as api
    component "Channels/ASGI" as channels
  }
  node "Redis Pod" as redis
}
node "PostgreSQL" as pg
node "Object Storage (S3)" as s3
node "Payment Gateway" as stripe

client --> cdn : static assets
client --> ingress : HTTPS
ingress --> api : HTTP
api --> pg : SQL
api --> s3 : S3 API
api --> channels : WS
channels --> redis : pub/sub
api --> stripe : HTTPS
stripe --> api : Webhooks
@enduml
```

---

## Domain Model Diagram

```mermaid
classDiagram
    class Visitor {
        +string visitor_name
        +string visitor_email
        +string visitor_phone
    }
    
    class USERS {
        +int user_id PK
        +string role
        +string email
        +string username
        +boolean is_active
    }
    
    class STUDENTS {
        +int student_id PK
        +int user_id FK
        +string first_name
        +string last_name
    }
    
    class TEACHERS {
        +int teacher_id PK
        +int user_id FK
        +string first_name
        +string last_name
    }
    
    class CS_REPS {
        +int csrep_id PK
        +int user_id FK
        +string first_name
        +string last_name
    }
    
    class PRE_SIGNIN_SESSIONS {
        +int session_id PK
        +string visitor_name
        +string visitor_email
        +string visitor_phone
        +string subject
        +string status
        +int assigned_csrep_id FK
        +datetime started_at
        +datetime last_activity_at
    }
    
    class PRE_SIGNIN_MESSAGES {
        +int message_id PK
        +int session_id FK
        +int csrep_id FK
        +string sender_type
        +text content
        +datetime created_at
    }
    
    class THREADS {
        +int thread_id PK
        +string subject
        +string thread_type
        +string status
    }
    
    class MESSAGES {
        +int message_id PK
        +int thread_id FK
        +int sender_id FK
        +text content
    }
    
    Visitor --> PRE_SIGNIN_SESSIONS : initiates
    PRE_SIGNIN_SESSIONS --> PRE_SIGNIN_MESSAGES : contains
    CS_REPS --> PRE_SIGNIN_SESSIONS : handles
    CS_REPS --> PRE_SIGNIN_MESSAGES : responds
    
    USERS ||--|| STUDENTS : has
    USERS ||--|| TEACHERS : has
    USERS ||--|| CS_REPS : has
    
    USERS --> THREADS : participates via
    THREADS --> MESSAGES : contains
    
    note for Visitor "External entity - not part of USERS table"
    note for PRE_SIGNIN_SESSIONS "Separate from authenticated THREADS/MESSAGES"
```

---

## Sequence Diagram: CS Rep Creates Invoice → Admin Approves → Student Pays

```plantuml
@startuml
actor CSRep
participant Frontend
participant API
database DB
participant Payment

CSRep -> Frontend: Open Create Invoice modal
Frontend -> API: POST /api/invoices/create {assignment_id, amount}
API -> DB: insert invoice (status=Pending Admin)
API --> Frontend: 201 {invoice_id, invoice_number}

actor Admin
Admin -> Frontend: View pending invoices
Frontend -> API: GET /api/invoices/pending
API --> Frontend: invoices[]
Admin -> Frontend: Approve invoice
Frontend -> API: POST /api/invoices/{id}/approve
API -> DB: update status=Pending Payment, set sent_to_student_at
API --> Frontend: ok

actor Student
Student -> Frontend: Open invoice
Frontend -> API: GET /api/invoices/{id}
API --> Frontend: invoice details
Frontend -> Payment: Create checkout session
Payment --> Frontend: success
Frontend -> API: webhook/confirm
API -> DB: update invoice status=Paid, paid_at
@enduml
```

---

## Sequence Diagram: Pre-Sign-In Chat Flow

```mermaid
sequenceDiagram
    participant Visitor
    participant Frontend
    participant API
    participant PreSignInModule
    participant DB
    participant CSRep
    
    Visitor->>Frontend: Initiate chat (no login)
    Frontend->>API: POST /api/pre-signin/sessions
    API->>PreSignInModule: Create session
    PreSignInModule->>DB: Insert PRE_SIGNIN_SESSIONS
    DB-->>PreSignInModule: session_id
    PreSignInModule-->>API: session_id
    API-->>Frontend: session_id, status
    Frontend-->>Visitor: Chat interface opened
    
    Visitor->>Frontend: Send message
    Frontend->>API: POST /api/pre-signin/messages {session_id, content}
    API->>PreSignInModule: Process message
    PreSignInModule->>DB: Insert PRE_SIGNIN_MESSAGES (sender_type='visitor')
    PreSignInModule->>DB: Update PRE_SIGNIN_SESSIONS (last_activity_at)
    PreSignInModule->>CSRep: Notify new message
    PreSignInModule-->>API: Message saved
    API-->>Frontend: Message confirmed
    
    CSRep->>Frontend: View session
    Frontend->>API: GET /api/pre-signin/sessions/{id}
    API->>PreSignInModule: Retrieve session
    PreSignInModule->>DB: Query PRE_SIGNIN_SESSIONS + PRE_SIGNIN_MESSAGES
    DB-->>PreSignInModule: Session data
    PreSignInModule-->>API: Session with messages
    API-->>Frontend: Session data
    Frontend-->>CSRep: Display chat
    
    CSRep->>Frontend: Respond to visitor
    Frontend->>API: POST /api/pre-signin/messages {session_id, content, csrep_id}
    API->>PreSignInModule: Process CS-REP response
    PreSignInModule->>DB: Insert PRE_SIGNIN_MESSAGES (sender_type='csrep')
    PreSignInModule->>DB: Update PRE_SIGNIN_SESSIONS (assigned_csrep_id, last_activity_at)
    PreSignInModule-->>API: Message saved
    API-->>Frontend: Message confirmed
    Frontend-->>Visitor: New message displayed
    
    CSRep->>Frontend: Close session
    Frontend->>API: POST /api/pre-signin/sessions/{id}/close
    API->>PreSignInModule: Close session
    PreSignInModule->>DB: Update PRE_SIGNIN_SESSIONS (status='closed')
    PreSignInModule-->>API: Session closed
    API-->>Frontend: Confirmation
    Frontend-->>CSRep: Session closed
```

---

## Activity Diagram: Request New Assignment

```plantuml
@startuml
start
if (User logged in?) then (yes)
  :Student fills request form;
  if (Valid?) then (yes)
    :Create assignment (status=Pending);
    :Optional features linked;
    :Notify CS Rep;
  else (no)
    :Show validation errors;
  endif
  :Student views tracker;
else (no - Visitor)
  :Visitor initiates pre-sign-in chat;
  :CS Rep responds via PRE_SIGNIN_SESSIONS;
  :Visitor provides assignment details;
  :CS Rep creates assignment after registration;
endif
stop
@enduml
```

---

## State Machine: Assignment Lifecycle

```plantuml
@startuml
[*] --> Pending
Pending --> InProcess : teacher assigned
InProcess --> Complete : deliverable approved
InProcess --> OnHold : paused
OnHold --> InProcess : resumed
Pending --> Cancelled : user cancel
InProcess --> Cancelled : admin cancel
Complete --> [*]
Cancelled --> [*]
@enduml
```

---

## API Design (OpenAPI excerpt)

```yaml
openapi: 3.0.3
info:
  title: Nano Problems API
  version: 1.0.0
servers:
  - url: https://api.nanoproblems.com
paths:
  /api/assignments/:
    get:
      summary: List assignments
      responses: { '200': { description: OK } }
    post:
      summary: Create assignment
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title, description]
              properties:
                title: { type: string, maxLength: 200 }
                description: { type: string }
                subject: { type: string }
      responses: { '201': { description: Created } }
  /api/invoices/create/:
    post:
      summary: Create invoice request (CS Rep)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [assignment_id, amount]
              properties:
                assignment_id: { type: string, format: uuid }
                amount: { type: number, format: float, minimum: 0.01 }
      responses: { '201': { description: Created } }
  /api/invoices/{id}/approve/:
    post:
      summary: Approve invoice (Admin)
      parameters:
        - in: path
          name: id
          schema: { type: string }
          required: true
      responses: { '200': { description: OK } }
```

---

## UI/UX Interaction Flow (Mermaid User Journey)

```mermaid
journey
  title Student Journey: Request → Track → Pay
  section Onboarding
    Visit Home Page: 3: Student
    Register/Login: 3: Student
  section Assignment
    Submit Request Form: 4: Student
    View Assignment Tracker: 3: Student
  section Meeting
    Schedule/Join Meeting: 3: Student
  section Billing
    Receive Invoice: 2: Student
    Pay Invoice: 4: Student
```

---

## UI/UX Interaction Flow – Visitor Pre-Sign-In Journey

```mermaid
journey
  title Visitor Pre-Sign-In Journey: Chat → Register → Request
  section Pre-Sign-In
    Visit Home Page: 3: Visitor
    Initiate Pre-Sign-In Chat: 4: Visitor
    Send Message: 4: Visitor
    Receive CS Rep Response: 3: Visitor
  section Conversion
    Register Account: 4: Visitor
    Login: 3: Visitor
  section Post-Sign-In
    Submit Assignment Request: 4: Student
    View Assignment Tracker: 3: Student
```

---

## Data Flow / Integration Diagram

```mermaid
flowchart LR
  subgraph Frontend
    UI[Dashboards]
  end
  API[(Django API)]
  DB[(PostgreSQL)]
  Files[(S3 Storage)]
  Pay[(Payment Gateway)]
  RTC[(WebRTC/Channels)]

  UI -- REST/WS --> API
  API -- SQL --> DB
  API -- Upload/Download --> Files
  API -- Charges/Webhooks --> Pay
  API -- Signaling --> RTC
```

---

## Data Provenance / Lineage

```mermaid
flowchart TB
  A1[Visitor Pre-Sign-In Chat] -->|PRE_SIGNIN_SESSIONS| A2[PRE_SIGNIN_MESSAGES]
  A2 -->|CS Rep processes| B[Assignment]
  
  A3[Authenticated Form Input] -->|validated| B
  B -->|status field| B1[Assignment Status]
  B --> C[Invoice]
  C -->|status field| C1[Invoice Status]
  C --> D[Payment]
  B --> E[Meeting]
  E --> E1[Meeting Participants]
  B --> F[Assignment Files]
  B --> G[THREADS]
  G --> G1[MESSAGES]
  G1 --> G2[MESSAGE_ATTACHMENTS]
  B --> H[Teacher Assignments]
  B --> I[Writings]
  B --> J[Homeworks]
  B --> K[Exams]
  
  note1["Pre-Sign-In flows (A1, A2)<br/>are separate from<br/>authenticated flows (G, G1)"]
  A2 -.-> note1
  G -.-> note1
```

---

## ERD (Mermaid)

```mermaid
erDiagram

    USERS {
        int user_id PK
        string email
        string username
        string password_hash
        string role
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
```

---

## System Architecture Diagram (Mermaid)

```mermaid
flowchart TB
  User[Authenticated Users<br/>Students / Teachers / CS Reps / Admins]
  Visitor[Visitor<br/>Unauthenticated User]
  subgraph Frontend
    WebUI[Web Dashboard<br/>HTML · CSS · JS]
  end
  subgraph Backend
    API[Django Backend<br/>REST + Channels]
    PreSignInModule[Pre-Sign-In Messaging Module]
    AuthModule[Auth & Users Module]
    Redis[(Redis<br/>WebSockets)]
    DB[(PostgreSQL<br/>Primary DB)]
    Storage[(Object Storage<br/>Files)]
  end
  subgraph External
    Pay[Payment Gateway]
    RTC[WebRTC Servers]
    Mail[Email / Notifications]
  end
  User --> WebUI
  Visitor --> WebUI
  WebUI --> API
  API --> PreSignInModule
  API --> AuthModule
  API --> DB
  API --> Redis
  API --> Storage
  API --> Pay
  API --> RTC
  API --> Mail
  PreSignInModule --> DB
  PreSignInModule -.->|CS-REP lookup only| AuthModule
  note1["Pre-Sign-In Module handles<br/>PRE_SIGNIN_SESSIONS and<br/>PRE_SIGNIN_MESSAGES<br/>(separate from authenticated flows)"]
  PreSignInModule -.-> note1
```

---

## Use Case Diagram (Mermaid)

```mermaid
flowchart LR
  Student -->|Request Assignment| System
  Student -->|Upload Files| System
  Student -->|Join Meeting| System
  Student -->|Pay Invoice| System
  Teacher -->|View Assignments| System
  Teacher -->|Upload Work| System
  Teacher -->|Join Meeting| System
  Visitor -->|Initiate Pre-Sign-in Chat| System
  Visitor -->|Send Pre-Sign-in Message| System
  CSRep -->|Assign Teacher| System
  CSRep -->|Create Invoice| System
  CSRep -->|Respond to Pre-Sign-in Chat| System
  CSRep -->|Close Pre-Sign-in Session| System
  Admin -->|Approve Invoice| System
  Admin -->|Manage Users| System
  Admin -->|Send Announcements| System
  System[Platform System]
```

---

## Component Diagram (Mermaid)

```mermaid
flowchart TB
  subgraph Django Backend
    Auth[Auth & Users]
    Assignments[Assignments Module]
    Meetings[Meetings Module]
    PreSignInMessaging[Pre-Sign-In Messaging Module]
    AuthenticatedMessaging[Authenticated Messaging Module]
    Billing[Invoices & Payments]
    Files[File Service]
    Notify[Notifications]
  end
  Frontend --> Auth
  Frontend --> Assignments
  Frontend --> Meetings
  Frontend --> PreSignInMessaging
  Frontend --> AuthenticatedMessaging
  Frontend --> Billing
  Frontend --> Notify
  Assignments --> Files
  Meetings --> Files
  AuthenticatedMessaging --> Files
  Billing --> ExternalPayment
  PreSignInMessaging -.->|CS-REP lookup only| Auth
  note1["Pre-Sign-In Messaging Module<br/>Independent module for unauthenticated visitors.<br/>No dependency on authenticated messaging components."]
  PreSignInMessaging -.-> note1
```

---

## Sequence Diagram – Assignment Lifecycle

```mermaid
sequenceDiagram
  participant Student
  participant Frontend
  participant Backend
  participant CSRep
  participant Teacher
  Student->>Frontend: Submit Assignment Request
  Frontend->>Backend: POST /assignments
  Backend->>CSRep: Notify new request
  CSRep->>Backend: Assign teacher
  Backend->>Teacher: Assignment assigned
  Teacher->>Backend: Upload work
  Backend->>Student: Assignment completed
```

---

## Activity Diagram – Invoice Flow

```mermaid
flowchart TD
  Start --> CSRepCreatesInvoice
  CSRepCreatesInvoice --> AdminApproval
  AdminApproval -->|Approved| StudentNotified
  StudentNotified --> StudentPays
  StudentPays --> PaymentConfirmed
  PaymentConfirmed --> End
```

---

## Activity Diagram – User Entry Flow

```mermaid
flowchart TD
  Start([User arrives at platform])
  Start --> CheckAuth{User logged in?}
  CheckAuth -->|Yes| AuthenticatedFlow[Authenticated User Portal]
  CheckAuth -->|No| VisitorFlow[Visitor Pre-Sign-In Chat]
  
  AuthenticatedFlow --> StudentActions[Student: Request Assignment, Track, Pay]
  AuthenticatedFlow --> TeacherActions[Teacher: View Assignments, Upload Work]
  AuthenticatedFlow --> CSRepActions[CS Rep: Assign Teachers, Create Invoices]
  AuthenticatedFlow --> AdminActions[Admin: Approve Invoices, Manage Users]
  
  VisitorFlow --> InitiateChat[Visitor initiates PRE_SIGNIN_SESSIONS]
  InitiateChat --> SendMessage[Visitor sends PRE_SIGNIN_MESSAGES]
  SendMessage --> CSRepResponds[CS Rep responds via PRE_SIGNIN_MESSAGES]
  CSRepResponds --> CSRepCloses[CS Rep closes PRE_SIGNIN_SESSIONS]
  CSRepCloses --> End([End])
  
  StudentActions --> End
  TeacherActions --> End
  CSRepActions --> End
  AdminActions --> End
  
  note1["Pre-Sign-In flows use<br/>PRE_SIGNIN_SESSIONS and<br/>PRE_SIGNIN_MESSAGES<br/>(separate from authenticated<br/>THREADS and MESSAGES)"]
  VisitorFlow -.-> note1
```

---

## State Diagram – Assignment Status

```mermaid
stateDiagram-v2
  [*] --> Pending
  Pending --> InProgress : Teacher Assigned
  InProgress --> Completed : Work Delivered
  InProgress --> OnHold
  OnHold --> InProgress
  Pending --> Cancelled
  InProgress --> Cancelled
  Completed --> [*]
```

---

## Deployment Diagram (Mermaid)

```mermaid
flowchart LR
  Browser --> CDN
  CDN --> Nginx
  Nginx --> DjangoASGI
  DjangoASGI --> PostgreSQL
  DjangoASGI --> Redis
  DjangoASGI --> Storage
  DjangoASGI --> PaymentGateway
```

---

## Data Flow Diagram (DFD – Level 1)

```mermaid
flowchart LR
  User --> UI
  UI --> API
  API --> DB
  API --> Files
  API --> Payments
  API --> Notifications
```

---

Notes:
- All diagrams are aligned with `ERD.md` as the single source of truth.
- Pre-sign-in communication entities (PRE_SIGNIN_SESSIONS, PRE_SIGNIN_MESSAGES) and Visitor actor are included throughout.
- Pre-sign-in flows are fully separated from authenticated user entities (USERS, THREADS, MESSAGES).
- Replace external services with your actual providers as needed.

