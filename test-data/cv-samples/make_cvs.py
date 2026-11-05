"""Generate 3 fictional test CVs (2 PDF, 1 DOCX) for the Java Backend JD."""
import sys
from pathlib import Path

import fitz  # PyMuPDF
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

FONT_REG = "C:/Windows/Fonts/arial.ttf"
FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf"

# Each CV: header + list of (heading, [blocks]); block = (kind, text)
# kinds: "role" (bold line), "date" (muted line), "bullet", "text"
CANDIDATES = {
    "CV_01_Nguyen_Minh_Khoa_Java_Backend.pdf": {
        "name": "NGUYỄN MINH KHOA",
        "title": "Senior Java Backend Developer",
        "contact": "khoa.nguyen.dev@example.com  |  0900 000 101  |  Cầu Giấy, Hà Nội  |  github.com/khoadevsample",
        "sections": [
            ("MỤC TIÊU NGHỀ NGHIỆP", [
                ("text", "Backend Developer với hơn 5 năm kinh nghiệm xây dựng hệ thống thanh toán và thương mại điện tử "
                         "bằng Java và Spring Boot. Mong muốn đảm nhận vai trò backend chính trong các hệ thống "
                         "microservices có lưu lượng lớn."),
            ]),
            ("KINH NGHIỆM LÀM VIỆC", [
                ("role", "Backend Developer — Công ty Cổ phần FinPay Việt Nam (dữ liệu giả lập)"),
                ("date", "03/2023 – nay"),
                ("bullet", "Thiết kế và phát triển 6 microservices bằng Java 17, Spring Boot 3 cho cổng thanh toán, xử lý trung bình 200.000 giao dịch/ngày."),
                ("bullet", "Xây dựng REST API cho ví điện tử; viết tài liệu OpenAPI/Swagger cho đội mobile."),
                ("bullet", "Tối ưu truy vấn MySQL (index, partition), giảm 40% thời gian phản hồi API báo cáo."),
                ("bullet", "Dùng Redis làm cache và distributed lock, giảm tải database giờ cao điểm."),
                ("bullet", "Đóng gói dịch vụ bằng Docker, triển khai CI/CD với GitHub Actions lên AWS (ECS, RDS, S3)."),
                ("role", "Java Developer — Công ty TNHH ShopNow Tech (dữ liệu giả lập)"),
                ("date", "07/2021 – 02/2023"),
                ("bullet", "Phát triển module đơn hàng và kho cho sàn thương mại điện tử bằng Spring Boot, Hibernate, MySQL."),
                ("bullet", "Tích hợp Kafka để đồng bộ trạng thái đơn hàng giữa các dịch vụ."),
                ("bullet", "Viết unit test với JUnit, Mockito; duy trì độ phủ test trên 80%. Quản lý mã nguồn bằng Git."),
            ]),
            ("HỌC VẤN", [
                ("role", "Đại học Bách khoa Hà Nội"),
                ("date", "09/2017 – 06/2021"),
                ("text", "Kỹ sư, chuyên ngành Công nghệ thông tin. GPA: 3.4/4"),
            ]),
            ("KỸ NĂNG", [
                ("bullet", "Ngôn ngữ: Java, SQL, Bash"),
                ("bullet", "Framework: Spring Boot, Spring Security, Hibernate, REST API, Microservices"),
                ("bullet", "Cơ sở dữ liệu: MySQL, PostgreSQL, Redis"),
                ("bullet", "DevOps: Docker, Kubernetes (cơ bản), GitHub Actions, CI/CD, AWS, Linux, Git"),
                ("bullet", "Khác: Kafka, Unit Testing, OOP, System Design, Agile, Scrum"),
            ]),
            ("DỰ ÁN", [
                ("role", "Payment Gateway Reconciliation Service"),
                ("text", "Dịch vụ đối soát giao dịch tự động hằng ngày với 3 ngân hàng đối tác bằng Spring Batch và MySQL; "
                         "phát hiện sai lệch trong vòng 15 phút thay vì 1 ngày."),
            ]),
            ("CHỨNG CHỈ", [
                ("bullet", "AWS Certified Developer – Associate (2024)"),
                ("bullet", "Oracle Certified Professional: Java SE 11 Developer (OCP, 2022)"),
            ]),
            ("NGOẠI NGỮ", [
                ("text", "Tiếng Anh – IELTS 7.0"),
            ]),
        ],
    },
    "CV_03_Le_Quang_Huy_PHP_Developer.pdf": {
        "name": "LÊ QUANG HUY",
        "title": "PHP Web Developer",
        "contact": "huy.le.web@example.com  |  0900 000 303  |  Thanh Xuân, Hà Nội",
        "sections": [
            ("MỤC TIÊU NGHỀ NGHIỆP", [
                ("text", "Lập trình viên web với hơn 1 năm kinh nghiệm PHP. Đang tự học Java và mong muốn chuyển hướng "
                         "sang phát triển backend trong môi trường doanh nghiệp."),
            ]),
            ("KINH NGHIỆM LÀM VIỆC", [
                ("role", "PHP Developer — Công ty TNHH Web Sáng Tạo (dữ liệu giả lập)"),
                ("date", "09/2025 – nay"),
                ("bullet", "Phát triển website bán hàng cho khách hàng nhỏ bằng PHP và Laravel."),
                ("bullet", "Thiết kế bảng dữ liệu và viết truy vấn MySQL cho module sản phẩm, đơn hàng."),
                ("bullet", "Cắt giao diện từ Figma bằng HTML, CSS, Bootstrap, jQuery."),
                ("role", "Thực tập sinh Web — Công ty Cổ phần Truyền thông ABC (dữ liệu giả lập)"),
                ("date", "03/2025 – 08/2025"),
                ("bullet", "Hỗ trợ bảo trì website WordPress, chỉnh sửa giao diện và nội dung."),
            ]),
            ("HỌC VẤN", [
                ("role", "Cao đẳng FPT Polytechnic Hà Nội"),
                ("date", "09/2022 – 06/2025"),
                ("text", "Cao đẳng, chuyên ngành Ứng dụng phần mềm. GPA: 3.0/4"),
            ]),
            ("KỸ NĂNG", [
                ("bullet", "Ngôn ngữ: PHP, JavaScript, HTML, CSS"),
                ("bullet", "Framework: Laravel, Bootstrap, jQuery"),
                ("bullet", "Cơ sở dữ liệu: MySQL"),
                ("bullet", "Công cụ: Git, Figma"),
                ("bullet", "Đang học: Java cơ bản (khóa học online, chưa có dự án thực tế)"),
            ]),
            ("DỰ ÁN", [
                ("role", "Website quản lý thư viện (đồ án tốt nghiệp)"),
                ("text", "Xây dựng bằng Laravel và MySQL, có chức năng mượn/trả sách và thống kê."),
            ]),
            ("NGOẠI NGỮ", [
                ("text", "Tiếng Anh – TOEIC 550"),
            ]),
        ],
    },
}

DOCX_CANDIDATE = {
    "file": "CV_02_Tran_Thu_Ha_Java_Developer.docx",
    "name": "TRẦN THU HÀ",
    "title": "Java Developer",
    "contact": "ha.tran.java@example.com  |  0900 000 202  |  Hà Đông, Hà Nội",
    "sections": [
        ("MỤC TIÊU NGHỀ NGHIỆP", [
            ("text", "Java Developer với gần 3 năm kinh nghiệm phát triển ứng dụng nội bộ cho doanh nghiệp. "
                     "Muốn nâng cao kỹ năng về hệ thống phân tán và triển khai cloud."),
        ]),
        ("KINH NGHIỆM LÀM VIỆC", [
            ("role", "Java Developer — Công ty Cổ phần Giải pháp Phần mềm Hưng Thịnh (dữ liệu giả lập)"),
            ("date", "10/2024 – nay"),
            ("bullet", "Phát triển hệ thống quản lý nhân sự nội bộ bằng Java 11 và Spring Boot."),
            ("bullet", "Xây dựng REST API cho module chấm công và tính lương; làm việc cùng đội frontend React."),
            ("bullet", "Thiết kế schema và viết truy vấn trên PostgreSQL; viết migration bằng Flyway."),
            ("role", "Junior Java Developer (Outsourcing) — Công ty TNHH Phần mềm Sao Mai (dữ liệu giả lập)"),
            ("date", "11/2023 – 09/2024"),
            ("bullet", "Bảo trì và sửa lỗi ứng dụng quản lý kho cho khách hàng Nhật Bản, dùng Spring MVC và Oracle."),
            ("bullet", "Viết unit test với JUnit; quản lý mã nguồn bằng Git, theo quy trình Scrum."),
        ]),
        ("HỌC VẤN", [
            ("role", "Học viện Công nghệ Bưu chính Viễn thông (PTIT)"),
            ("date", "09/2019 – 06/2023"),
            ("text", "Kỹ sư, chuyên ngành Công nghệ thông tin. GPA: 3.1/4"),
        ]),
        ("KỸ NĂNG", [
            ("bullet", "Ngôn ngữ: Java, SQL, JavaScript"),
            ("bullet", "Framework: Spring Boot, Spring MVC, REST API"),
            ("bullet", "Cơ sở dữ liệu: PostgreSQL, Oracle"),
            ("bullet", "Công cụ: Git, Jira, Postman"),
            ("bullet", "Khác: OOP, Unit Testing, Scrum"),
        ]),
        ("DỰ ÁN", [
            ("role", "HRM Timesheet API"),
            ("text", "API chấm công cho 800 nhân viên, tích hợp máy chấm công vân tay; xuất báo cáo Excel hằng tháng."),
        ]),
        ("NGOẠI NGỮ", [
            ("text", "Tiếng Anh – TOEIC 750; Tiếng Nhật – JLPT N4"),
        ]),
    ],
}

FOREST = (0.05, 0.20, 0.15)
BRASS = (0.66, 0.48, 0.15)
MUTED = (0.35, 0.40, 0.38)
INK = (0.08, 0.10, 0.09)


class PdfWriter:
    W, H = fitz.paper_size("a4")
    MARGIN = 48

    def __init__(self):
        self.doc = fitz.open()
        self.reg = fitz.Font(fontfile=FONT_REG)
        self.bold = fitz.Font(fontfile=FONT_BOLD)
        self.new_page()

    def new_page(self):
        self.page = self.doc.new_page(width=self.W, height=self.H)
        self.page.insert_font(fontname="AR", fontfile=FONT_REG)
        self.page.insert_font(fontname="ARB", fontfile=FONT_BOLD)
        self.y = self.MARGIN

    def ensure(self, needed):
        if self.y + needed > self.H - self.MARGIN:
            self.new_page()

    def wrap(self, text, font, size, width):
        words, lines, cur = text.split(" "), [], ""
        for w in words:
            trial = f"{cur} {w}".strip()
            if font.text_length(trial, fontsize=size) <= width:
                cur = trial
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    def line(self, text, size=10, bold=False, color=INK, indent=0, gap=1.45):
        font = self.bold if bold else self.reg
        width = self.W - 2 * self.MARGIN - indent
        for ln in self.wrap(text, font, size, width):
            self.ensure(size * gap)
            self.y += size
            self.page.insert_text((self.MARGIN + indent, self.y), ln, fontname="ARB" if bold else "AR",
                                  fontsize=size, color=color)
            self.y += size * (gap - 1)

    def bullet(self, text):
        self.ensure(14)
        self.page.insert_text((self.MARGIN + 6, self.y + 10), "•", fontname="AR", fontsize=10, color=BRASS)
        self.line(text, indent=18)

    def heading(self, text):
        self.y += 10
        self.ensure(30)
        self.line(text, size=11.5, bold=True, color=FOREST)
        self.page.draw_line((self.MARGIN, self.y), (self.W - self.MARGIN, self.y), color=BRASS, width=0.8)
        self.y += 6

    def header(self, name, title, contact):
        self.page.draw_rect(fitz.Rect(0, 0, self.W, 6), color=None, fill=FOREST)
        self.y = 58
        self.page.insert_text((self.MARGIN, self.y), name, fontname="ARB", fontsize=22, color=FOREST)
        self.y += 20
        self.line(title, size=12, bold=True, color=BRASS)
        self.line(contact, size=9, color=MUTED)
        self.y += 2


def make_pdf(path, cv):
    w = PdfWriter()
    w.header(cv["name"], cv["title"], cv["contact"])
    for heading, blocks in cv["sections"]:
        w.heading(heading)
        for kind, text in blocks:
            if kind == "role":
                w.y += 3
                w.line(text, size=10.5, bold=True)
            elif kind == "date":
                w.line(text, size=9, color=MUTED)
            elif kind == "bullet":
                w.bullet(text)
            else:
                w.line(text)
    w.doc.set_metadata({"title": f"CV - {cv['name']}", "author": "Synthetic test data"})
    w.doc.subset_fonts()
    w.doc.save(path, garbage=3, deflate=True)


def make_docx(path, cv):
    d = Document()
    style = d.styles["Normal"]
    style.font.name = "Arial"
    style.font.size = Pt(10.5)
    p = d.add_paragraph()
    r = p.add_run(cv["name"])
    r.bold, r.font.size, r.font.color.rgb = True, Pt(22), RGBColor(0x0D, 0x33, 0x26)
    p = d.add_paragraph()
    r = p.add_run(cv["title"])
    r.bold, r.font.size, r.font.color.rgb = True, Pt(12), RGBColor(0xA8, 0x7A, 0x26)
    p = d.add_paragraph()
    r = p.add_run(cv["contact"])
    r.font.size, r.font.color.rgb = Pt(9), RGBColor(0x5A, 0x66, 0x61)
    for heading, blocks in cv["sections"]:
        h = d.add_paragraph()
        h.paragraph_format.space_before = Pt(10)
        r = h.add_run(heading)
        r.bold, r.font.size, r.font.color.rgb = True, Pt(12), RGBColor(0x0D, 0x33, 0x26)
        for kind, text in blocks:
            if kind == "role":
                para = d.add_paragraph()
                para.add_run(text).bold = True
            elif kind == "date":
                para = d.add_paragraph()
                rr = para.add_run(text)
                rr.font.size, rr.font.color.rgb = Pt(9), RGBColor(0x5A, 0x66, 0x61)
            elif kind == "bullet":
                d.add_paragraph(text, style="List Bullet")
            else:
                d.add_paragraph(text)
    d.core_properties.title = f"CV - {cv['name']}"
    d.core_properties.author = "Synthetic test data"
    d.save(path)


for fname, cv in CANDIDATES.items():
    make_pdf(OUT / fname, cv)
make_docx(OUT / DOCX_CANDIDATE["file"], DOCX_CANDIDATE)
print("written:", *sorted(p.name for p in OUT.iterdir()))
