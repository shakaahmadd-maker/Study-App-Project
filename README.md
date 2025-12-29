# StudyApp (Django + Channels)

StudyApp is a multi-role learning/support platform built with **Django** and **Django Channels**. It includes role-based dashboards (Student / Teacher / Admin / CS-Rep), real-time communication (WebSockets), and workflows for assignments, homework, exams, meetings, notifications, and announcements.

---

### Quick links

- **Run on another computer (ZIP sharing guide)**: `docs/SHARING_ZIP_SETUP.md`
- **Test users**: `studyapp/TEST_USERS.md`

---

### Tech stack

- **Backend**: Django
- **Real-time/WebSockets**: Channels + Daphne (ASGI)
- **API**: Django REST Framework (used by meeting APIs)
- **Database**: PostgreSQL (configured in `studyapp/studyapp/settings.py`)
- **Optional realtime infra**: Redis (`channels-redis`, used when `REDIS_URL` is set)
- **Images**: Pillow (required for user profile pictures via `ImageField`)

---

### Major features (by module)

#### Accounts & roles (`account`)
- Registration + login/logout APIs
- Role dashboards:
  - Student dashboard: `/account/student/dashboard/`
  - Teacher dashboard: `/account/teacher-dashboard/`
  - Admin dashboard: `/account/admin-dashboard/`
  - CS-Rep dashboard: `/account/cs-rep-dashboard/`
- Admin user management APIs (toggle active, reset password, list teachers/students)
- Profile pages and profile picture upload support

#### Assignments workflow (`assingment`)
- Student creates/cancels assignment requests, views assignment list, submits feedback
- Admin assigns teachers, reviews content, submits admin feedback
- Teacher starts processing, marks complete, downloads assignment ZIP

#### Homework (`homework`)
- Teacher creates homework, lists, grades, sees assigned students
- Student lists homework and submits homework

#### Online exams (`exam`)
- Teacher: create/update/delete exams, list exams, grade attempts
- Student: list exams, start exam, attempt + submit, view results

#### Meetings + recordings (`meeting`)
- Schedule meetings, list meetings, details, start/end meeting
- Upload/download meeting recordings
- Meeting pages:
  - `/meeting/prejoin/`
  - `/meeting/room/`

#### Messages (direct conversations) (`messages`)
- Allowed users list for “Start New Conversation”
- Thread CRUD-like endpoints (list/create/send/mark-read/delete)

#### Threads (another chat system) (`thread`)
- Thread list/create, fetch messages, send message, update thread status

#### Notifications (`notifications`)
- Notifications list
- Mark one / mark all read
- Delete one / delete all
- Unread count

#### Announcements (`announcement`)
- Create/list/delete announcements
- Recipient list API

#### Pre-signin CS-Rep chat (`preSigninMessages`)
- List sessions, view messages, send CS-Rep messages, close sessions
- Search closed sessions (backup)

#### Realtime dashboard updates (`realtime`)
- WebSocket consumer used for “dashboard” realtime updates (badges/counters)

---

### WebSocket endpoints (Channels)

These routes are configured in `studyapp/studyapp/asgi.py` by combining routing from multiple apps:

- Messages: `ws/messages/`
- Meeting: `ws/meeting/<room_name>/`
- Pre-signin: `ws/presignin/` and `ws/presignin/<session_id>/`
- Threads: `ws/threads/<thread_id>/` and `ws/thread-list/`
- Dashboard: `ws/dashboard/`

---

### Local development (Windows / PowerShell)

#### 1) Create & activate a venv
From the project root (where `requirements.txt` exists):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

#### 2) Install dependencies

```powershell
pip install -r requirements.txt
```

#### 3) Database setup

This project is configured for **PostgreSQL** in `studyapp/studyapp/settings.py`.

Make sure Postgres is running and the credentials in `DATABASES` match your environment.

#### 4) Run migrations

```powershell
cd .\studyapp\
python manage.py migrate
```

#### 5) (Optional) Create test users
See `studyapp/TEST_USERS.md`:

```powershell
python manage.py create_test_users
```

#### 6) Run the server

```powershell
python manage.py runserver
```

Open:
- `http://127.0.0.1:8000/study/home/`
- `http://127.0.0.1:8000/account/login/`

---

### Configuration notes

- **Redis / Channels layer**:
  - `REDIS_URL` environment variable enables Redis-backed channel layer
  - If not set, the project uses an in-memory channel layer (fine for local dev)
- **Static + media**:
  - Static files: `studyapp/public/static/`
  - Media uploads: `studyapp/public/media/`

---

### Repo notes / status

- The `todo` and `writing` Django apps currently contain placeholder `models.py`/`views.py`, but dashboard templates still reference “writings”, “payment history”, etc. That means some UI sections may be present even if the backend logic is minimal/incomplete.


