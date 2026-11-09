# TalentLens - AI Resume Screening System
Một nền tảng sàng lọc hồ sơ ứng viên (CV) và xếp hạng ứng viên bằng Trí tuệ Nhân tạo có khả năng giải thích (**Explainable AI**), hỗ trợ đội ngũ Nhân sự (HR), Chuyên viên Tuyển dụng (Recruiter) và Quản lý Tuyển dụng (Hiring Manager) tự động hóa quy trình bóc tách CV/JD, ẩn danh thông tin cá nhân (PII), chấm điểm đa tầng có trích dẫn bằng chứng nguyên văn và gợi ý câu hỏi phỏng vấn một cách minh bạch, công bằng và hiệu quả.

## Thành viên & Phân công nhiệm vụ
*(Phân chia theo kiến trúc 4 lát cắt dọc độc lập - chi tiết tại [`docs/team-distribution.md`](docs/team-distribution.md))*

| STT | Thành viên / Phân hệ | Nhiệm vụ đảm nhận |
|-----|----------------------|-------------------|
| 1 | **Person A — Foundation, Auth & Audit** | Quản lý Tài khoản & Phân quyền RBAC (`Admin`, `Recruiter`, `Viewer`), xác thực JWT + bcrypt, cấu hình Database (`SQLAlchemy 2.0 Async` + `Alembic`), Nhật ký kiểm toán bất biến (`Audit Log`) và Dashboard thống kê. |
| 2 | **Person B — CV Pipeline, Parsing & Storage** | Luồng tải lên CV đơn lẻ/hàng loạt (`PDF`, `DOCX`, ảnh scan), lưu trữ đối tượng (`MinIO S3` / Local), điều phối hàng đợi bất đồng bộ (`Celery` + `Redis`), bộ bóc tách văn bản đa tầng (`PyMuPDF`, `pdfplumber`, `python-docx`) kết hợp nhận diện quang học `Tesseract OCR`. |
| 3 | **Person C — AI Extraction, PII & Hybrid Scoring** | Bộ lọc ẩn danh thông tin nhạy cảm (`PII Stripper` bằng Regex trước khi gửi AI), trích xuất cấu trúc CV/JD bằng `Google Gemini API` kèm cơ chế dự phòng `Offline Heuristic Parser`, thuật toán chấm điểm lai 3 tầng (`Rule-based` + `Semantic` + `LLM`), trích xuất bằng chứng nguyên văn (`Evidence Snippets`) và sinh câu hỏi phỏng vấn. |
| 4 | **Person D — JD Management, Ranking UI & Frontend** | Giao diện `Next.js 15` (App Router, Song ngữ Anh/Việt), Quản lý vị trí tuyển dụng (JD) kèm tính năng **Upload file PDF/DOCX tự động điền form JD**, bộ **Tùy chỉnh tỷ lệ % trọng số chấm điểm linh hoạt** theo từng JD/CV, Bảng xếp hạng ứng viên (`Ranking Review`) và quy trình phê duyệt **Human-in-the-Loop**. |

## 🚀 Tính năng chính
Hệ thống cung cấp đầy đủ các tính năng chuyên sâu cho quy trình sàng lọc và đánh giá hồ sơ tuyển dụng hiện đại:

- **👤 Quản lý Tài khoản & Phân quyền (RBAC):** Đăng ký, đăng nhập, làm mới phiên làm việc (`Refresh Token`). Phân quyền chặt chẽ cho 3 vai trò: `Admin` (toàn quyền hệ thống & quản lý người dùng), `Recruiter` (quản lý JD, tải CV, chấm điểm & duyệt ứng viên), và `Viewer` (chế độ chỉ đọc kết quả xếp hạng và báo cáo).
- **📋 Quản lý Tin tuyển dụng (JD) & Bóc tách File JD tự động:** Hỗ trợ tạo, chỉnh sửa, đóng/mở các vị trí tuyển dụng. Tích hợp tính năng **Upload file JD (`PDF` / `DOCX`)** giúp hệ thống tự động đọc hiểu (qua Gemini AI hoặc Heuristic) và điền sẵn các trường *Tiêu đề, Phòng ban, Địa điểm, Mô tả, Yêu cầu, Kỹ năng, Số năm kinh nghiệm, Học vấn* để HR kiểm tra và chỉnh sửa trước khi lưu.
- **📄 Pipeline Xử lý CV Đa định dạng & OCR:** Hỗ trợ tải lên từng CV hoặc tải hàng loạt (`Batch Upload`) ở định dạng `PDF`, `DOCX`, `PNG`, `JPG`. Tự động kiểm tra định dạng thực tế (`Magic Bytes`) và kích hoạt `Tesseract OCR` đối với CV dạng ảnh chụp hoặc bản scan.
- **🛡️ Ẩn danh Thông tin Cá nhân (Privacy-First PII Masking):** Tự động phát hiện và che dấu Email, Số điện thoại, Đường dẫn mạng xã hội và Địa chỉ cá nhân (`[EMAIL_REDACTED]`, `[PHONE_REDACTED]`,...) trước khi đưa văn bản vào mô hình ngôn ngữ lớn, đảm bảo quyền riêng tư và giảm thiểu thiên kiến vô thức (*Unconscious Bias*).
- **⚖️ Chấm điểm Lai 3 Tầng (Hybrid Scoring) & Tùy chỉnh Trọng số (%):** Kết hợp 3 phương pháp: **Chấm theo quy tắc cứng (`Rule-based`)**, **Đo độ tương đồng ngữ nghĩa (`Semantic`)** và **Đánh giá chuyên sâu bằng AI (`LLM Evaluation`)**. Đặc biệt, HR có thể **tùy chỉnh linh hoạt tỷ lệ % chấm điểm** của từng hạng mục (*Kỹ năng, Kinh nghiệm, Học vấn* và *Rule, Semantic, AI*) riêng biệt cho từng vị trí JD hoặc chấm lại trực tiếp trên từng hồ sơ ứng viên.
- **🔍 Giải thích Minh bạch kèm Bằng chứng & Câu hỏi Phỏng vấn (Explainable AI):** Mỗi điểm số đều đi kèm **trích dẫn nguyên văn từ CV (`Evidence Snippets`)**, danh sách kỹ năng khớp (`Matched Skills`), kỹ năng còn thiếu (`Missing Skills`), phân tích khoảng trống năng lực và gợi ý bộ **Câu hỏi phỏng vấn cá nhân hóa** để kiểm chứng ứng viên.
- **🤝 Quyết định Tuyển dụng có Con người Kiểm soát (Human-in-the-Loop & Audit Log):** AI chỉ đóng vai trò cố vấn chấm điểm; quyền quyết định cuối cùng (`Shortlisted` — Vào vòng trong, `On Hold` — Cân nhắc, `Rejected` — Từ chối) kèm ghi chú đánh giá thuộc về HR và được ghi vết toàn bộ vào **Nhật ký kiểm toán (`Audit Log`)**.

## 🗺 Sơ đồ Use Case & Luồng Kiến trúc
Dưới đây là sơ đồ tổng quan về tương tác của người dùng và luồng xử lý dữ liệu qua các phân hệ của hệ thống:

```mermaid
flowchart LR
    subgraph Users["Người dùng (RBAC)"]
        Admin["👑 Admin"]
        Recruiter["👩‍💼 Recruiter / HR"]
        Viewer["👁️ Hiring Manager (Viewer)"]
    end

    subgraph Frontend["Frontend (Next.js 15 - Port 3000)"]
        JD_UI["Quản lý JD & Upload PDF/DOCX"]
        CV_UI["Thư viện CV & Batch Upload"]
        Weight_UI["Tùy chỉnh % Trọng số Chấm điểm"]
        Rank_UI["Bảng xếp hạng, Bằng chứng & Duyệt CV"]
        Audit_UI["Dashboard & Audit Log"]
    end

    subgraph Backend["Backend API & AI Engine (FastAPI - Port 8000)"]
        Parser["Document Parser + Tesseract OCR"]
        PII["PII Stripper (Ẩn danh dữ liệu)"]
        Extractor["Gemini 2.5 Flash + Heuristic Fallback"]
        Scorer["Hybrid Scorer (Rule + Semantic + LLM)"]
    end

    subgraph Infra["Hạ tầng Lưu trữ"]
        DB[("PostgreSQL / SQLite")]
        Storage[("MinIO S3 / Local Disk")]
    end

    Admin --> Audit_UI
    Recruiter --> JD_UI & CV_UI & Weight_UI & Rank_UI
    Viewer --> Rank_UI

    JD_UI & CV_UI --> Parser --> PII --> Extractor
    Weight_UI & Rank_UI --> Scorer
    Extractor & Scorer --> DB
    Parser --> Storage
```

## 🛠 Công nghệ sử dụng
Dự án được xây dựng theo mô hình **Client-Server hiện đại**, tách biệt hoàn toàn giữa giao diện người dùng, dịch vụ API bất đồng bộ và lõi xử lý AI:

**Frontend**
- **Framework:** `Next.js 15` (App Router), `React 19`, `TypeScript`
- **Design System:** Custom Editorial CSS Variables (`globals.css`), hỗ trợ đa ngôn ngữ tức thời (**Tiếng Việt / Tiếng Anh**)
- **Kiến trúc:** Feature-Based & Component-Driven (`jobs-manager`, `cv-library`, `ranking-review`, `scoring-weights-editor`, `audit-log`)
- **Kiểm thử:** `Vitest` & `React Testing Library`

**Backend & AI Engine**
- **Framework:** `Python 3.11+`, `FastAPI`, `Pydantic v2`, `Uvicorn`
- **Database & ORM:** `PostgreSQL 16` (hoặc `SQLite` khi chạy local nhanh) tương tác bất đồng bộ qua `SQLAlchemy 2.0 Async` và quản lý schema bằng `Alembic`
- **Hàng đợi & Lưu trữ:** `Celery` + `Redis 7` (xử lý ngầm, có cơ chế tự động chuyển sang chạy trực tiếp `In-Process BackgroundTask` khi chạy local), `MinIO` (S3-compatible Object Storage)
- **Xử lý Tài liệu & OCR:** `PyMuPDF (fitz)`, `pdfplumber`, `python-docx`, `Pillow`, `pytesseract` (`Tesseract OCR`)
- **AI / NLP:** `Google Gemini API` (`gemini-2.5-flash`) kết hợp **Offline Deterministic Heuristic Engine** (đảm bảo hệ thống luôn hoạt động 100% ngay cả khi không có API Key hoặc mất kết nối mạng)
- **Authentication:** `JWT` (`python-jose` — Access & Refresh Token) và mã hóa mật khẩu bằng `bcrypt` (`passlib`)

## 🔗 Danh sách đường dẫn truy cập
Dưới đây là các liên kết quan trọng để truy cập vào hệ thống khi triển khai hoặc chạy trên môi trường máy cá nhân (Local):

| Kênh truy cập | Đường dẫn (URL) | Mô tả |
|---------------|-----------------|-------|
| 🏠 **Website chính (Frontend)** | [http://localhost:3000](http://localhost:3000) | Giao diện làm việc chính cho Admin, HR và Hiring Manager. |
| 📘 **Swagger API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Tài liệu REST API trực quan, hỗ trợ test trực tiếp các endpoint. |
| 📕 **ReDoc API Reference** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Tài liệu đặc tả kỹ thuật chi tiết các Schema và Endpoint. |
| 🗄️ **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Giao diện quản lý kho lưu trữ file CV/JD (khi chạy với Docker). |

## 🔐 Tài khoản trải nghiệm
Hệ thống **tự động khởi tạo sẵn (Auto-Seed)** 2 tài khoản cố định ngay khi khởi chạy Backend lần đầu tiên. Bất kỳ ai clone dự án về đều có thể đăng nhập trải nghiệm ngay lập tức tại trang `/login` mà **không cần đăng ký**:

*Chú ý: Đăng nhập tại các cửa sổ trình duyệt (hoặc tab Ẩn danh) khác nhau để tránh ghi đè phiên đăng nhập khi kiểm thử nhiều vai trò (`Role`) cùng lúc.*

| Vai trò | Tên đăng nhập / Email | Mật khẩu | Ghi chú |
|:--------|:----------------------|:---------|:--------|
| **Admin** *(Mặc định có sẵn)* | `admin@talentlens.ai` | `Admin@123` | Toàn quyền quản trị hệ thống, xem Audit Log, tạo thêm tài khoản và phân quyền người dùng. |
| **Recruiter / HR** *(Mặc định có sẵn)* | `recruiter@talentlens.ai` | `Recruiter@123` | Tạo/upload JD, tải CV, tùy chỉnh % trọng số chấm điểm, chạy AI Matching và ra quyết định duyệt hồ sơ. |
| **Viewer** *(Tạo thêm trong Admin)* | `viewer@talentlens.ai` | `Viewer@123` | Dành cho Hiring Manager: chỉ xem bảng xếp hạng, bằng chứng CV và câu hỏi phỏng vấn (Admin tạo trong mục *User Management*). |

## 📚 Tài liệu tham khảo
- **Phân công & Kiến trúc Module:** [`docs/team-distribution.md`](docs/team-distribution.md)
- **Hướng dẫn Tích hợp & Kiểm thử:** [`docs/integration.md`](docs/integration.md)
- **Bộ dữ liệu JD & CV mẫu (`samples/`):**
  - JD Tiếng Anh: [`samples/jds/JD_Senior_AI_Backend_Engineer_EN.pdf`](samples/jds/JD_Senior_AI_Backend_Engineer_EN.pdf)
  - JD Tiếng Việt: [`samples/jds/JD_Senior_Data_Analyst_VI.pdf`](samples/jds/JD_Senior_Data_Analyst_VI.pdf)
  - Bộ CV kiểm thử đa ngành: [`samples/cvs/`](samples/cvs/) (Chi tiết tại [`samples/README.md`](samples/README.md))

---

## ⚙️ Hướng dẫn Cài đặt & Chạy Local

### 1. Yêu cầu (Prerequisites)
- **Python:** Phiên bản `3.11` trở lên
- **Node.js:** Phiên bản `20` trở lên (kèm `npm`)
- **Tùy chọn:** `Docker Desktop` (nếu muốn chạy đầy đủ với `PostgreSQL`, `Redis`, `MinIO`) và `Tesseract OCR` (nếu cần quét CV dạng ảnh scan).

### 2. Cài đặt Dependencies
```bash
# 1. Clone dự án
git clone https://github.com/your-org/AIResumeScreeningSystem.git
cd AIResumeScreeningSystem

# 2. Cài đặt Backend Dependencies
cd backend
python -m venv .venv
# Kích hoạt môi trường ảo trên Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# (Hoặc trên macOS/Linux: source .venv/bin/activate)
pip install -e ".[dev]"
cd ..

# 3. Cài đặt Frontend Dependencies
cd frontend
npm install
cd ..
```

### 3. Cấu hình Biến môi trường (`.env`) & Cơ sở dữ liệu
Tại thư mục gốc của dự án, sao chép tệp cấu hình mẫu:
```bash
cp .env.example .env
```
Các biến quan trọng trong tệp `.env` (hoặc cấu hình trực tiếp khi chạy):
- `DATABASE_URL`: Mặc định dùng SQLite (`sqlite+aiosqlite:///./talentlens.db`) để chạy ngay không cần cài đặt DB, hoặc dùng PostgreSQL (`postgresql+asyncpg://postgres:postgres@localhost:5432/airesume`).
- `JWT_SECRET_KEY`: Chuỗi khóa bí mật dùng để ký JWT Token.
- `LLM_API_KEY`: *(Tùy chọn)* Điền Google Gemini API Key nếu muốn dùng mô hình `gemini-2.5-flash`. Nếu để trống, hệ thống **tự động chuyển sang chế độ Offline Heuristic** mà không gây lỗi.

### 4. Khởi chạy Hệ thống

**Cách 1: Chạy nhanh trên Windows bằng Script tự động (Khuyên dùng khi phát triển)**
```powershell
.\start-dev.ps1
```
*(Script sẽ tự động khởi tạo cơ sở dữ liệu SQLite, chạy Backend tại cổng `8000` và Frontend tại cổng `3000`).*

**Cách 2: Chạy thủ công trên 2 cửa sổ Terminal**
- **Terminal 1 — Chạy Backend API (Cổng 8000):**
  ```bash
  cd backend
  uvicorn app.main:app --reload --port 8000
  ```
- **Terminal 2 — Chạy Frontend Next.js (Cổng 3000):**
  ```bash
  cd frontend
  npm run dev
  ```

**Cách 3: Chạy toàn bộ hạ tầng bằng Docker Compose**
```bash
docker compose up --build
```

---

## 🗂 Cấu trúc Dự án (Project Structure)

Hệ thống được thiết kế theo chuẩn **Enterprise Monorepo Architecture**, đảm bảo **Separation of Concerns (SoC)**, **Single Responsibility Principle (SRP)** và cấu trúc **Feature-Driven / Layered Architecture**:

```text
AIResumeScreeningSystem/
├── .github/
│   └── workflows/                  # CI/CD Pipelines (GitHub Actions cho Backend & Frontend)
├── backend/                        # ── PHÂN HỆ BACKEND API & AI ENGINE (FastAPI) ──
│   ├── alembic/                    # Quản lý phiên bản Database Migration (0001 -> 0005)
│   ├── app/
│   │   ├── api/                    # Tầng Giao tiếp REST API (Controllers, Dependencies & Router Registry)
│   │   │   ├── router.py           # Điểm đăng ký tập trung toàn bộ API v1 Endpoints (/api/v1)
│   │   │   ├── deps.py             # Dependencies dùng chung (AsyncSession, JWT User, RBAC Guard)
│   │   │   ├── auth.py             # Đăng ký, đăng nhập, lấy thông tin phiên làm việc (/me)
│   │   │   ├── users.py            # Quản trị người dùng & phân quyền RBAC (Admin)
│   │   │   ├── jobs.py             # CRUD vị trí tuyển dụng (JD) & Upload PDF/DOCX bóc tách JD
│   │   │   ├── cvs.py              # Upload CV đơn/hàng loạt, tải file gốc & theo dõi trạng thái
│   │   │   ├── matching.py         # Chấm điểm CV-JD, cập nhật % trọng số, lưu quyết định HR
│   │   │   ├── dashboard.py        # Thống kê tổng quan KPI & hoạt động tuyển dụng
│   │   │   ├── audit.py            # Truy xuất nhật ký kiểm toán bất biến (Audit Trail)
│   │   │   └── system.py           # Thông tin trạng thái AI Engine & cấu hình hệ thống
│   │   ├── core/                   # Tầng Hạ tầng Cốt lõi (Core Infrastructure)
│   │   │   ├── config.py           # Cấu hình tập trung (Pydantic Settings)
│   │   │   ├── database.py         # SQLAlchemy 2.0 Async Engine & Session Factory
│   │   │   ├── security.py         # Xác thực JWT & mã hóa mật khẩu Bcrypt
│   │   │   └── exceptions.py       # Hệ thống ngoại lệ nghiệp vụ chuẩn hóa (AppError)
│   │   ├── llm/                    # Tầng Kết nối Mô hình Ngôn ngữ Lớn (LLM Abstraction Layer)
│   │   │   ├── base.py             # Giao diện trừu tượng BaseLLM
│   │   │   ├── gemini.py           # Tích hợp Google Gemini API & Vector Embeddings
│   │   │   └── factory.py          # Khởi tạo LLM kèm cơ chế tự động chuyển đổi Offline Heuristic
│   │   ├── models/                 # Tầng Dữ liệu SQLAlchemy ORM Entities (User, Job, CV, MatchResult, Decision, AuditLog)
│   │   ├── schemas/                # Tầng Kiểm tra Hợp đồng Dữ liệu (Pydantic v2 DTO Schemas)
│   │   ├── services/               # Tầng Nghiệp vụ Cốt lõi & Lõi AI 3 Giai đoạn
│   │   │   ├── parsing/            # [Stage 1] Bóc tách PDF, DOCX & nhận diện ảnh Tesseract OCR
│   │   │   ├── extraction/         # [Stage 2] Ẩn danh PII (pii_stripper) & Bóc tách cấu trúc CV/JD (extractor, jd_extractor, heuristic)
│   │   │   ├── matching/           # [Stage 3] Chấm điểm lai 3 tầng (rule_scorer, semantic_scorer, llm_scorer, aggregator)
│   │   │   ├── auth_service.py     # Nghiệp vụ xác thực & khởi tạo tài khoản mặc định (Auto-Seed)
│   │   │   ├── user_service.py     # Nghiệp vụ quản lý tài khoản & phân quyền
│   │   │   ├── job_service.py      # Nghiệp vụ quản lý JD & cấu hình trọng số chấm điểm
│   │   │   ├── cv_service.py       # Nghiệp vụ lưu trữ, chống trùng lặp SHA-256 & điều phối CV
│   │   │   ├── matching_service.py # Điều phối luồng chấm điểm, tính lại điểm theo % & quyết định HR
│   │   │   ├── audit_service.py    # Ghi vết toàn bộ thao tác quan trọng vào Audit Log
│   │   │   └── storage_service.py  # Lưu trữ đối tượng đa môi trường (MinIO S3 / Local Disk)
│   │   ├── workers/                # Tầng Xử lý Hàng đợi Bất đồng bộ (Celery + In-Process Asyncio Runner)
│   │   │   ├── celery_app.py       # Cấu hình Celery Broker
│   │   │   ├── dispatch.py         # Bộ điều phối thông minh (Tự động fallback khi không có Redis)
│   │   │   ├── parse_task.py       # Task bóc tách văn bản CV
│   │   │   ├── extract_task.py     # Task ẩn danh PII & trích xuất thông tin ứng viên
│   │   │   └── score_task.py       # Task chấm điểm & xếp hạng tự động
│   │   └── main.py                 # Điểm khởi chạy ứng dụng FastAPI
│   └── tests/                      # Bộ Unit Test & Integration Test (Pytest — Phản chiếu cấu trúc app/)
├── frontend/                       # ── PHÂN HỆ GIAO DIỆN NGƯỜI DÙNG (Next.js App Router + React 19) ──
│   ├── src/
│   │   ├── app/                    # Tầng Định tuyến Next.js App Router (Chia theo 3 Route Groups chuẩn)
│   │   │   ├── (marketing)/        # Nhóm trang Public: Landing Page (/) & Trải nghiệm Demo (/demo)
│   │   │   ├── (auth)/             # Nhóm trang Xác thực: Đăng nhập (/login) & Đăng ký (/register)
│   │   │   ├── (workspace)/        # Nhóm trang Nghiệp vụ HR/Admin (/dashboard, /jobs, /cvs, /rankings, /history, /analytics, /audit, /users, /settings)
│   │   │   └── layout.tsx          # Root Layout & Providers
│   │   ├── components/             # Tầng Giao diện Tái sử dụng (Shared Presentation Layer)
│   │   │   ├── ui/                 # Atomic UI Primitives (BrandLogo, Charts, Dialog, Icon, MetricCard, Skeleton)
│   │   │   └── layout/             # Khung bố cục ứng dụng (AppShell, AuthLayout, LanguageSwitcher)
│   │   ├── features/               # Tầng Module Nghiệp vụ Độc lập (Feature-Driven Domain Modules)
│   │   │   ├── auth/               # Form đăng nhập, đăng ký & kiểm soát mở đăng ký (auth-form, registration-gate)
│   │   │   ├── dashboard/          # Bảng điều khiển tổng quan & KPI tuyển dụng (dashboard-overview)
│   │   │   ├── jobs/               # Quản lý JD, Upload PDF/DOCX tự động điền form & trọng số mặc định (jobs-manager)
│   │   │   ├── cvs/                # Thư viện CV, hàng đợi tải CV hàng loạt & xem dữ liệu sau ẩn danh PII (cv-upload, cv-detail, cv-upload-queue, pipeline-steps)
│   │   │   ├── rankings/           # Bảng xếp hạng ứng viên, bằng chứng nguyên văn & bộ chỉnh % trọng số (ranking-review, scoring-weights-editor, ranking-evidence-demo)
│   │   │   ├── history/            # Tra cứu lịch sử sàng lọc & quyết định tuyển dụng (screening-history)
│   │   │   ├── analytics/          # Biểu đồ phân tích phễu tuyển dụng & phân bố điểm số (analytics-dashboard)
│   │   │   ├── audit/              # Giao diện tra cứu nhật ký kiểm toán hệ thống (audit-log)
│   │   │   ├── users/              # Quản lý người dùng, khóa/mở tài khoản & gán quyền RBAC (admin-user-manager)
│   │   │   ├── settings/           # Cài đặt tài khoản, chế độ ẩn danh ứng viên & trạng thái AI Engine (settings-panel)
│   │   │   └── marketing/          # Giao diện trang chủ & không gian trải nghiệm Demo (landing-page, demo-workspace)
│   │   ├── hooks/                  # Custom React Hooks dùng chung (use-cv-upload-queue, use-flip)
│   │   ├── providers/              # React Context Providers quản lý trạng thái toàn cục (auth-session)
│   │   ├── i18n/                   # Hệ thống đa ngôn ngữ Anh - Việt tức thời (messages.ts, provider.tsx)
│   │   ├── lib/                    # Tầng HTTP API Clients & Tiện ích nghiệp vụ (api, auth-api, jobs-api, cvs-api, matching-api, audit-api, users-api, dashboard-api, insights-api)
│   │   ├── styles/                 # Hệ thống Design Tokens & Workspace CSS
│   │   └── __tests__/              # Bộ Unit & Integration Tests cho Giao diện & API Client (Vitest + RTL)
│   └── package.json
├── samples/                        # ── BỘ DỮ LIỆU MẪU KIỂM THỬ (JD & CV ĐA NGÀNH) ──
│   ├── jds/                        # Các file PDF JD mẫu tiếng Anh & tiếng Việt để test Auto-fill JD
│   └── cvs/                        # Các file CV mẫu (PDF/DOCX) phân theo nhóm năng lực để test Batch Upload & Scoring
├── scripts/                        # ── KỊCH BẢN TIỆN ÍCH & TỰ ĐỘNG HÓA ──
│   ├── seed/                       # Script sinh dữ liệu CV mẫu tự động
│   └── report/                     # Script tổng hợp tài liệu báo cáo & thuyết trình
├── docs/                           # ── TÀI LIỆU KIẾN TRÚC, PHÂN CÔNG & TÍCH HỢP HỆ THỐNG ──
├── docker-compose.yml              # Cấu hình triển khai Container (PostgreSQL 16, Redis 7, MinIO, Backend, Worker, Frontend)
├── start-dev.ps1                   # Script khởi chạy nhanh môi trường phát triển trên Windows
└── README.md                       # Tài liệu tổng quan dự án
```
