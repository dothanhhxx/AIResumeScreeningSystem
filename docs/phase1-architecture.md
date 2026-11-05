# Phase 1 — Kiến trúc tổng thể (100% FREE)

## 1. Kiến trúc hệ thống

```mermaid
graph TB
    subgraph Client["🖥️ Frontend (Next.js - port 3000)"]
        UI["Recruiter Dashboard"]
    end

    subgraph Backend["⚙️ Backend (FastAPI - port 8000)"]
        API["REST API"]
        AuthJWT["JWT Auth"]
    end

    subgraph Workers["👷 Celery Workers"]
        W1["parse_cv_task"]
        W2["extract_info_task"]
        W3["score_candidate_task"]
    end

    subgraph Infra["🐳 Docker Compose (tất cả local, FREE)"]
        PG["PostgreSQL 16\n+ pgvector"]
        Redis["Redis 7\n(Queue + Cache)"]
        MinIO["MinIO\n(File Storage)"]
    end

    subgraph Free["🆓 Free External APIs"]
        Gemini["Google Gemini 2.0 Flash\n(Free Tier)"]
        GemEmbed["Gemini Embedding\n(Free Tier)"]
        Tesseract["Tesseract OCR\n(Local)"]
    end

    UI -->|HTTP| API
    API --> AuthJWT
    API -->|enqueue| Redis
    Redis --> W1 & W2 & W3
    W1 -->|save file| MinIO
    W1 -->|OCR| Tesseract
    W2 -->|extract| Gemini
    W3 -->|score| Gemini
    W3 -->|embed| GemEmbed
    W1 & W2 & W3 -->|read/write| PG
    API -->|query| PG
    API -->|get file| MinIO
```

## 2. Luồng xử lý CV (Pipeline)

```mermaid
sequenceDiagram
    actor R as Recruiter
    participant API as FastAPI
    participant Q as Redis Queue
    participant W as Celery Worker
    participant S3 as MinIO
    participant OCR as Tesseract
    participant LLM as Gemini API
    participant DB as PostgreSQL

    R->>API: Upload CV (PDF/DOCX)
    API->>API: Validate file, check duplicate (SHA256)
    API->>S3: Lưu file gốc
    API->>DB: Tạo record CV (status=PENDING)
    API->>Q: Enqueue parse_cv_task
    API-->>R: 202 Accepted {cv_id, status}

    Q->>W: Dequeue task
    
    rect rgb(240, 248, 255)
        Note over W: Step 1: Parse
        W->>S3: Download file
        W->>W: Extract text (PyMuPDF/python-docx)
        alt Text rỗng hoặc quá ngắn
            W->>OCR: Tesseract OCR
        end
        W->>DB: Save raw_text, update status=PARSED
    end

    rect rgb(240, 255, 240)
        Note over W: Step 2: Extract Info
        W->>W: Strip PII (tên, tuổi, giới tính, ảnh)
        W->>LLM: Prompt: extract structured info
        W->>W: Validate with Pydantic schema
        W->>DB: Save structured_data (JSON), status=EXTRACTED
    end

    rect rgb(255, 248, 240)
        Note over W: Step 3: Embed
        W->>LLM: Generate embedding vector
        W->>DB: Save embedding (pgvector)
        W->>DB: status=READY
    end

    R->>API: GET /cvs/{id}/status
    API-->>R: {status: READY, structured_data: {...}}
```

### Scoring Flow (khi recruiter chọn JD để match)

```mermaid
sequenceDiagram
    actor R as Recruiter
    participant API as FastAPI
    participant Q as Redis Queue
    participant W as Celery Worker
    participant LLM as Gemini API
    participant DB as PostgreSQL

    R->>API: POST /jobs/{jd_id}/match (chọn các CV để match)
    API->>Q: Enqueue score_task cho mỗi CV

    loop Mỗi CV
        Q->>W: Dequeue score_task
        W->>DB: Lấy CV structured_data + JD criteria
        
        Note over W: Rule-based scoring
        W->>W: Check must-have criteria
        W->>W: Check years of experience
        W->>W: Check education requirements
        
        Note over W: Semantic scoring
        W->>DB: Vector similarity search (pgvector)
        
        Note over W: LLM scoring
        W->>LLM: Rubric prompt + CV + JD → scores + evidence
        W->>W: Validate output (Pydantic)
        
        W->>DB: Save MatchResult (scores, evidence, explanation)
    end

    R->>API: GET /jobs/{jd_id}/rankings
    API-->>R: Sorted candidates with scores & explanations
```

## 3. Database ERD

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string full_name
        string hashed_password
        string role "admin | recruiter | viewer"
        timestamp created_at
        timestamp updated_at
        boolean is_active
    }

    cvs {
        uuid id PK
        uuid uploaded_by FK
        string file_name
        string file_path "S3 key"
        string content_hash UK "SHA256 - chống trùng"
        string file_type "pdf | docx | image"
        string status "PENDING | PARSING | PARSED | EXTRACTING | EXTRACTED | READY | ERROR"
        text raw_text
        jsonb structured_data "Pydantic validated JSON"
        jsonb extraction_confidence "confidence score per field"
        vector embedding "pgvector 768d"
        text error_message
        timestamp created_at
        timestamp updated_at
    }

    jobs {
        uuid id PK
        uuid created_by FK
        string title
        text description
        jsonb criteria "must_have, nice_to_have, weights"
        string status "DRAFT | ACTIVE | CLOSED"
        timestamp created_at
        timestamp updated_at
    }

    match_results {
        uuid id PK
        uuid cv_id FK
        uuid job_id FK
        float total_score "0-100"
        jsonb criteria_scores "điểm từng tiêu chí"
        jsonb evidence "trích dẫn từ CV"
        jsonb strengths "điểm mạnh"
        jsonb gaps "điểm thiếu"
        jsonb interview_questions "câu hỏi gợi ý"
        float rule_score
        float semantic_score
        float llm_score
        string model_version "gemini-2.0-flash"
        text prompt_version "hash của prompt template"
        timestamp scored_at
    }

    recruiter_decisions {
        uuid id PK
        uuid match_result_id FK
        uuid decided_by FK
        string decision "SHORTLIST | REJECT | HOLD | INTERVIEW"
        float override_score "null nếu không override"
        text reason
        timestamp decided_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        string action "UPLOAD | SCORE | OVERRIDE | DELETE | LOGIN"
        string entity_type "cv | job | match_result"
        uuid entity_id
        jsonb old_value
        jsonb new_value
        string ip_address
        timestamp created_at
    }

    users ||--o{ cvs : uploads
    users ||--o{ jobs : creates
    cvs ||--o{ match_results : has
    jobs ||--o{ match_results : has
    match_results ||--o{ recruiter_decisions : has
    users ||--o{ recruiter_decisions : makes
    users ||--o{ audit_logs : generates
```

## 4. API Contract (chính)

### Auth
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/api/v1/auth/register` | Đăng ký (chỉ admin tạo) |
| POST | `/api/v1/auth/login` | Đăng nhập → JWT token |
| GET | `/api/v1/auth/me` | Thông tin user hiện tại |

### CV Management
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/api/v1/cvs/upload` | Upload 1 CV (multipart) |
| POST | `/api/v1/cvs/upload-batch` | Upload nhiều CV (ZIP) |
| GET | `/api/v1/cvs` | List CVs (pagination, filter by status) |
| GET | `/api/v1/cvs/{id}` | Chi tiết CV + structured data |
| GET | `/api/v1/cvs/{id}/status` | Trạng thái xử lý |
| GET | `/api/v1/cvs/{id}/file` | Download file gốc |
| DELETE | `/api/v1/cvs/{id}` | Xóa CV |

### Job Description
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/api/v1/jobs` | Tạo JD mới |
| GET | `/api/v1/jobs` | List JDs |
| GET | `/api/v1/jobs/{id}` | Chi tiết JD |
| PUT | `/api/v1/jobs/{id}` | Cập nhật JD |
| DELETE | `/api/v1/jobs/{id}` | Xóa JD |

### Matching & Scoring
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/api/v1/jobs/{id}/match` | Trigger scoring cho các CV đã chọn |
| GET | `/api/v1/jobs/{id}/rankings` | Bảng xếp hạng ứng viên |
| GET | `/api/v1/match-results/{id}` | Chi tiết kết quả matching |

### Recruiter Decisions
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/api/v1/match-results/{id}/decide` | Quyết định (shortlist/reject/hold) |
| PUT | `/api/v1/match-results/{id}/override` | Override điểm + lý do |

### Audit
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/v1/audit-logs` | Xem audit logs (admin only) |

## 5. Cấu trúc thư mục

```
AIResumeScreeningSystem/
├── docker-compose.yml          # PostgreSQL, Redis, MinIO
├── .env.example                # Template biến môi trường
├── .gitignore
├── README.md
│
├── backend/                    # Python FastAPI
│   ├── Dockerfile
│   ├── pyproject.toml          # Dependencies (poetry/pip)
│   ├── alembic.ini             # DB migrations config
│   ├── alembic/
│   │   └── versions/           # Migration files
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app entry
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   │
│   │   ├── api/                # Route handlers
│   │   │   ├── __init__.py
│   │   │   ├── deps.py         # Dependencies (get_db, get_current_user)
│   │   │   ├── auth.py
│   │   │   ├── cvs.py
│   │   │   ├── jobs.py
│   │   │   ├── matching.py
│   │   │   └── audit.py
│   │   │
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── cv.py
│   │   │   ├── job.py
│   │   │   ├── match_result.py
│   │   │   ├── decision.py
│   │   │   └── audit_log.py
│   │   │
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── cv.py
│   │   │   ├── job.py
│   │   │   ├── matching.py
│   │   │   └── common.py
│   │   │
│   │   ├── services/           # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── cv_service.py
│   │   │   ├── parsing/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── pdf_parser.py
│   │   │   │   ├── docx_parser.py
│   │   │   │   └── ocr_parser.py
│   │   │   ├── extraction/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── extractor.py      # LLM-based extraction
│   │   │   │   ├── pii_stripper.py   # Ẩn thông tin nhạy cảm
│   │   │   │   └── prompts.py        # Prompt templates
│   │   │   ├── matching/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── rule_scorer.py    # Rule-based scoring
│   │   │   │   ├── semantic_scorer.py # Vector similarity
│   │   │   │   ├── llm_scorer.py     # LLM rubric scoring
│   │   │   │   ├── aggregator.py     # Combine scores
│   │   │   │   └── prompts.py
│   │   │   └── storage_service.py    # MinIO/S3 wrapper
│   │   │
│   │   ├── llm/                # LLM Abstraction Layer
│   │   │   ├── __init__.py
│   │   │   ├── base.py         # Abstract interface
│   │   │   ├── gemini.py       # Google Gemini implementation
│   │   │   └── factory.py      # Factory pattern
│   │   │
│   │   ├── core/               # Shared utilities
│   │   │   ├── __init__.py
│   │   │   ├── database.py     # DB session
│   │   │   ├── security.py     # JWT, password hashing
│   │   │   └── exceptions.py   # Custom exceptions
│   │   │
│   │   └── workers/            # Celery tasks
│   │       ├── __init__.py
│   │       ├── celery_app.py
│   │       ├── parse_task.py
│   │       ├── extract_task.py
│   │       └── score_task.py
│   │
│   └── tests/
│       ├── conftest.py
│       ├── test_parsing/
│       ├── test_extraction/
│       ├── test_matching/
│       └── test_api/
│
├── frontend/                   # Next.js (Phase 5)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
└── docs/                       # Tài liệu
    ├── architecture.md
    └── api.md
```

## 6. Quyết định thiết kế chính

### 6.1 LLM Abstraction Layer
```python
# Thiết kế interface để dễ switch provider sau
class BaseLLM(ABC):
    async def generate(self, prompt: str, schema: Type[BaseModel]) -> BaseModel: ...
    async def embed(self, text: str) -> list[float]: ...

class GeminiLLM(BaseLLM):    # Free tier implementation
class OpenAILLM(BaseLLM):    # Thêm sau nếu cần
```
**Lý do:** Gemini free tier có thể hết quota → dễ switch sang provider khác.

### 6.2 Pipeline Design: Chain vs Separate Tasks
**Chọn: Separate Celery tasks** (parse → extract → score riêng biệt)
- ✅ Retry từng step độc lập
- ✅ Dễ debug (biết step nào fail)
- ✅ Parse xong có thể dùng lại, không cần re-parse khi re-score
- ❌ Phức tạp hơn chain đơn giản

### 6.3 Multi-tenant: HOÃN
**MVP: single-tenant** — thêm `tenant_id` vào schema sau.
Giảm ~25% complexity cho MVP.

### 6.4 Auth: JWT đơn giản
- Không cần SSO cho MVP free
- `bcrypt` hash password, `python-jose` JWT
- RBAC: 3 roles hardcode (admin, recruiter, viewer)

## 7. Roadmap Step-by-step

| Step | Nội dung | Thời gian ước tính |
|------|----------|-------------------|
| **Phase 2** | Docker Compose + project skeleton + config | 30 phút |
| **Phase 3a** | Database models + migrations | 30 phút |
| **Phase 3b** | Auth API (register, login, JWT) | 30 phút |
| **Phase 3c** | CV upload + storage (MinIO) | 30 phút |
| **Phase 3d** | Parsing pipeline (PDF, DOCX, OCR) | 45 phút |
| **Phase 3e** | LLM abstraction + info extraction | 45 phút |
| **Phase 4a** | JD management API | 30 phút |
| **Phase 4b** | Matching & scoring engine | 1 giờ |
| **Phase 4c** | Explainability + ranking API | 30 phút |
| **Phase 5** | Frontend (Next.js dashboard) | 2-3 giờ |
| **Phase 6** | Testing + evaluation | 1 giờ |
| **Phase 7** | Deploy + documentation | 1 giờ |

> [!NOTE]
> **Tổng ước tính: ~10-12 giờ coding** nếu đi theo hướng dẫn step-by-step.
> Mỗi step tôi sẽ viết code cụ thể, bạn copy → chạy → test → sang step tiếp.

---

> [!IMPORTANT]
> **Xác nhận trước khi bắt đầu code (Phase 2):**
> 1. Kiến trúc trên có OK không?
> 2. Bạn đã cài sẵn **Docker Desktop** và **Python 3.11+** chưa?
> 3. Bạn đã có **Google Gemini API key** chưa? (Lấy free tại https://aistudio.google.com/apikey)
> 4. Bạn muốn tôi code toàn bộ mỗi phase, hay giải thích từng đoạn để bạn hiểu và tự code?
