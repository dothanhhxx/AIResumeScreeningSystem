"""Generate 5 fictional CVs for the recruiter end-to-end flows (TC-FLOW-01, TC-FLOW-02).

Usage: python make_flow_cvs.py <output_dir>
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from make_cvs import make_docx, make_pdf  # noqa: E402

# ── TC-FLOW-01: Backend Developer (Python/FastAPI), English ────────────────

CV_STRONG = {
    "name": "HOANG DUC ANH",
    "title": "Backend Developer (Python / FastAPI)",
    "contact": "ducanh.hoang.dev@example.com  |  0900 000 401  |  Cau Giay, Hanoi  |  github.com/ducanhsample",
    "sections": [
        ("SUMMARY", [
            ("text", "Backend Developer with 5+ years of experience building REST APIs and data-heavy services in "
                     "Python. 4 years of hands-on work with FastAPI, PostgreSQL, Redis and Docker in production. "
                     "Recently integrated NLP models into an HR-tech platform."),
        ]),
        ("WORK EXPERIENCE", [
            ("role", "Backend Developer — TalentBridge Technology JSC (fictional)"),
            ("date", "06/2022 – Present"),
            ("bullet", "Designed and built 20+ RESTful API endpoints with Python 3.11 and FastAPI for a recruitment platform serving 300k users."),
            ("bullet", "Designed PostgreSQL schemas and tuned slow queries with indexes and EXPLAIN ANALYZE, cutting p95 latency by 45%."),
            ("bullet", "Integrated an NLP resume-parsing service and a text-embedding model into the backend through async workers (Celery, Redis)."),
            ("bullet", "Containerized all services with Docker and Docker Compose; set up CI/CD pipelines with GitHub Actions."),
            ("bullet", "Wrote unit and integration tests with pytest (85% coverage) and reviewed pull requests for a team of 6."),
            ("role", "Python Developer — Saigon Data Labs Co., Ltd. (fictional)"),
            ("date", "07/2021 – 05/2022"),
            ("bullet", "Built internal data APIs with Flask and SQLAlchemy on PostgreSQL."),
            ("bullet", "Used Redis for caching and rate limiting; managed source code with Git and GitLab."),
        ]),
        ("EDUCATION", [
            ("role", "Hanoi University of Science and Technology"),
            ("date", "09/2017 – 06/2021"),
            ("text", "Bachelor of Computer Science. GPA: 3.5/4"),
        ]),
        ("SKILLS", [
            ("bullet", "Languages: Python, SQL, Bash"),
            ("bullet", "Frameworks: FastAPI, Flask, SQLAlchemy, Pydantic, Celery, REST API"),
            ("bullet", "Databases: PostgreSQL, Redis, MongoDB"),
            ("bullet", "DevOps: Docker, Docker Compose, GitHub Actions, CI/CD, Linux, Git"),
            ("bullet", "Other: Microservices, Unit Testing, pytest, NLP, Agile, Scrum"),
        ]),
        ("PROJECTS", [
            ("role", "Resume Matching API"),
            ("text", "FastAPI service that ranks resumes against job descriptions using embeddings stored in "
                     "PostgreSQL (pgvector); handles 50k documents per day."),
        ]),
        ("CERTIFICATIONS", [
            ("bullet", "AWS Certified Developer – Associate (2024)"),
        ]),
        ("LANGUAGES", [
            ("text", "English – IELTS 7.5; Vietnamese – Native"),
        ]),
    ],
}

CV_MEDIUM = {
    "name": "BUI THANH TUNG",
    "title": "Python Web Developer (Django)",
    "contact": "tung.bui.web@example.com  |  0900 000 402  |  Dong Da, Hanoi",
    "sections": [
        ("SUMMARY", [
            ("text", "Python developer with about 2 years of experience building web applications with Django. "
                     "Comfortable with REST APIs and relational databases; looking to move into a dedicated backend role "
                     "and learn containerized deployment."),
        ]),
        ("WORK EXPERIENCE", [
            ("role", "Python Developer — Green Leaf Software Co., Ltd. (fictional)"),
            ("date", "09/2024 – Present"),
            ("bullet", "Developed an e-learning web application with Python, Django and Django REST Framework."),
            ("bullet", "Built REST API endpoints for course enrollment and payments consumed by a React frontend."),
            ("bullet", "Designed tables and wrote queries on MySQL; added indexes to speed up the reporting pages."),
            ("bullet", "Worked in two-week sprints and managed code with Git and Bitbucket."),
        ]),
        ("EDUCATION", [
            ("role", "Posts and Telecommunications Institute of Technology"),
            ("date", "09/2020 – 06/2024"),
            ("text", "Bachelor of Information Technology. GPA: 3.1/4"),
        ]),
        ("SKILLS", [
            ("bullet", "Languages: Python, JavaScript, SQL"),
            ("bullet", "Frameworks: Django, Django REST Framework, REST API"),
            ("bullet", "Databases: MySQL"),
            ("bullet", "Tools: Git, Postman, Jira"),
        ]),
        ("PROJECTS", [
            ("role", "Online Quiz Platform (graduation project)"),
            ("text", "Django application with timed quizzes, auto-grading and a MySQL backend."),
        ]),
        ("LANGUAGES", [
            ("text", "English – TOEIC 700"),
        ]),
    ],
}

CV_WEAK = {
    "name": "NGO PHUONG LINH",
    "title": "Digital Marketing Executive",
    "contact": "linh.ngo.mkt@example.com  |  0900 000 403  |  District 3, Ho Chi Minh City",
    "sections": [
        ("SUMMARY", [
            ("text", "Digital marketer with 3 years of experience running paid campaigns and content for consumer brands. "
                     "Data-driven, creative and used to working with tight monthly targets."),
        ]),
        ("WORK EXPERIENCE", [
            ("role", "Digital Marketing Executive — BrightMart Retail JSC (fictional)"),
            ("date", "08/2023 – Present"),
            ("bullet", "Planned and ran Google Ads and Facebook Ads campaigns with a monthly budget of $5,000."),
            ("bullet", "Improved organic traffic by 60% in 12 months through on-page and off-page SEO."),
            ("bullet", "Tracked CTR, CPA and ROAS in Google Analytics and prepared weekly performance reports."),
            ("role", "Content Marketing Intern — Sunny Media Agency (fictional)"),
            ("date", "01/2023 – 07/2023"),
            ("bullet", "Wrote social media posts and blog articles; designed visuals with Canva."),
        ]),
        ("EDUCATION", [
            ("role", "University of Economics Ho Chi Minh City"),
            ("date", "09/2019 – 06/2023"),
            ("text", "Bachelor of Marketing. GPA: 3.3/4"),
        ]),
        ("SKILLS", [
            ("bullet", "Marketing: SEO, Google Ads, Facebook Ads, Content Marketing, Email Marketing"),
            ("bullet", "Analytics: Google Analytics, Google Search Console"),
            ("bullet", "Tools: Canva, Microsoft Excel"),
            ("bullet", "Soft skills: Copywriting, Teamwork, Presentation"),
        ]),
        ("CERTIFICATIONS", [
            ("bullet", "Google Ads Search Certification (2024)"),
        ]),
        ("LANGUAGES", [
            ("text", "English – IELTS 6.5"),
        ]),
    ],
}

# ── TC-FLOW-02: Kế toán tổng hợp, tiếng Việt ───────────────────────────────

CV_KETOAN_TOT = {
    "name": "VÕ THỊ MAI ANH",
    "title": "Kế toán tổng hợp",
    "contact": "maianh.vo.ketoan@example.com  |  0900 000 501  |  Hải Châu, Đà Nẵng",
    "sections": [
        ("MỤC TIÊU NGHỀ NGHIỆP", [
            ("text", "Kế toán với hơn 7 năm kinh nghiệm, trong đó 6 năm ở vị trí kế toán tổng hợp tại doanh nghiệp sản xuất "
                     "và thương mại. Mong muốn phát triển lên vị trí kế toán trưởng trong 2–3 năm tới."),
        ]),
        ("KINH NGHIỆM LÀM VIỆC", [
            ("role", "Kế toán tổng hợp — Công ty Cổ phần Thủy sản Biển Xanh (dữ liệu giả lập)"),
            ("date", "05/2020 – nay"),
            ("bullet", "Lập báo cáo tài chính tháng, quý, năm theo chuẩn mực kế toán Việt Nam (VAS); hỗ trợ chuyển đổi báo cáo sang IFRS cho công ty mẹ."),
            ("bullet", "Kê khai và quyết toán thuế GTGT, TNDN, TNCN; làm việc trực tiếp với cơ quan thuế trong 2 đợt thanh tra."),
            ("bullet", "Kiểm soát chứng từ, đối chiếu công nợ phải thu, phải trả và sổ sách kế toán hằng tháng."),
            ("bullet", "Phối hợp với kiểm toán độc lập (Big4) trong kiểm toán báo cáo tài chính năm."),
            ("bullet", "Hướng dẫn, giám sát 3 kế toán viên junior; chuẩn hóa quy trình khóa sổ trên MISA và ERP SAP Business One."),
            ("role", "Kế toán viên — Công ty TNHH Thương mại Hòa Phát Miền Trung (dữ liệu giả lập)"),
            ("date", "07/2019 – 04/2020"),
            ("bullet", "Hạch toán nghiệp vụ mua bán hàng hóa, theo dõi kho và công nợ trên MISA."),
            ("bullet", "Lập bảng lương, kê khai thuế TNCN hằng tháng."),
        ]),
        ("HỌC VẤN", [
            ("role", "Trường Đại học Kinh tế – Đại học Đà Nẵng"),
            ("date", "09/2015 – 06/2019"),
            ("text", "Cử nhân, chuyên ngành Kế toán. GPA: 3.4/4"),
        ]),
        ("KỸ NĂNG", [
            ("bullet", "Chuyên môn: Báo cáo tài chính, VAS, IFRS, Kê khai thuế, Kế toán tổng hợp, Kiểm soát nội bộ"),
            ("bullet", "Phần mềm: MISA, ERP (SAP Business One), Excel nâng cao (Pivot, VLOOKUP, Power Query)"),
            ("bullet", "Kỹ năng mềm: Quản lý nhóm, làm việc dưới áp lực deadline, cẩn thận, trung thực"),
        ]),
        ("CHỨNG CHỈ", [
            ("bullet", "Chứng chỉ Kế toán trưởng – Bộ Tài chính (2023)"),
            ("bullet", "ACCA – đã hoàn thành 9/13 môn (đang theo học)"),
        ]),
        ("NGOẠI NGỮ", [
            ("text", "Tiếng Anh – TOEIC 750 (đọc hiểu tài liệu IFRS)"),
        ]),
    ],
}

CV_KETOAN_JUNIOR = {
    "name": "ĐẶNG VĂN PHÚC",
    "title": "Kế toán viên",
    "contact": "phuc.dang.kt@example.com  |  0900 000 502  |  Thanh Khê, Đà Nẵng",
    "sections": [
        ("MỤC TIÊU NGHỀ NGHIỆP", [
            ("text", "Kế toán viên với khoảng 1 năm kinh nghiệm, mong muốn được học hỏi thêm về kế toán tổng hợp và thuế."),
        ]),
        ("KINH NGHIỆM LÀM VIỆC", [
            ("role", "Kế toán viên — Công ty TNHH Dịch vụ Du lịch Sông Hàn (dữ liệu giả lập)"),
            ("date", "10/2025 – nay"),
            ("bullet", "Nhập liệu chứng từ thu chi, theo dõi quỹ tiền mặt hằng ngày."),
            ("bullet", "Lập bảng kê hóa đơn mua vào, bán ra trên Excel để chuyển cho kế toán tổng hợp."),
            ("bullet", "Đối chiếu sổ phụ ngân hàng cuối tháng."),
        ]),
        ("HỌC VẤN", [
            ("role", "Trường Cao đẳng Kinh tế – Kế hoạch Đà Nẵng"),
            ("date", "09/2022 – 06/2025"),
            ("text", "Cao đẳng, chuyên ngành Kế toán doanh nghiệp. GPA: 3.0/4"),
        ]),
        ("KỸ NĂNG", [
            ("bullet", "Tin học văn phòng: Excel (hàm SUM, IF, VLOOKUP), Word"),
            ("bullet", "Kỹ năng mềm: Cẩn thận, chăm chỉ, sẵn sàng học hỏi"),
        ]),
        ("NGOẠI NGỮ", [
            ("text", "Tiếng Anh – giao tiếp cơ bản"),
        ]),
    ],
}

PDFS = {
    "cv_strong.pdf": CV_STRONG,
    "cv_weak.pdf": CV_WEAK,
    "cv_ketoan_tot.pdf": CV_KETOAN_TOT,
}
DOCXS = {
    "cv_medium.docx": CV_MEDIUM,
    "cv_ketoan_junior.docx": CV_KETOAN_JUNIOR,
}

if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
    out.mkdir(parents=True, exist_ok=True)
    for fname, cv in PDFS.items():
        make_pdf(out / fname, cv)
    for fname, cv in DOCXS.items():
        make_docx(out / fname, cv)
    print("written:", *sorted([*PDFS, *DOCXS]))
