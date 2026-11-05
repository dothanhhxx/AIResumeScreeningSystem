# Bộ dữ liệu test: JD → Upload CV → Ranking

Toàn bộ người, công ty, email và số điện thoại trong thư mục này là **hư cấu**, chỉ dùng để kiểm thử.

## 1. JD cần tạo (trang Jobs → New job)

| Trường | Giá trị |
|---|---|
| Job title | Java Backend Developer (Mid-level) |
| Department | Engineering |
| Location | Hà Nội |
| Description | Phát triển và vận hành các dịch vụ backend cho nền tảng thanh toán. Thiết kế REST API, tối ưu cơ sở dữ liệu, phối hợp với đội frontend/mobile và tham gia review code. |
| Requirements | Ưu tiên ứng viên có kinh nghiệm Docker, Redis, Microservices, AWS. Có khả năng đọc tài liệu tiếng Anh. |
| Required skills | Java, Spring Boot, MySQL, REST API, Git |
| Experience (years) | 2 |
| Education level | Bachelor's degree |
| Status | Active |

## 2. Ba ứng viên

| File | Ứng viên | Hồ sơ | Kỳ vọng |
|---|---|---|---|
| `CV_01_Nguyen_Minh_Khoa_Java_Backend.pdf` | Nguyễn Minh Khoa | ~5 năm Java/Spring Boot, đủ 5/5 kỹ năng bắt buộc, có Docker, Redis, Microservices, AWS, Kafka; Kỹ sư CNTT Bách khoa | **Hạng 1**, điểm cao (Strong fit) |
| `CV_02_Tran_Thu_Ha_Java_Developer.docx` | Trần Thu Hà | ~3 năm Java/Spring Boot, REST API, Git; dùng **PostgreSQL/Oracle, không có MySQL**; không Docker/AWS; Kỹ sư CNTT PTIT | **Hạng 2**, điểm trung bình khá |
| `CV_03_Le_Quang_Huy_PHP_Developer.pdf` | Lê Quang Huy | ~1,8 năm PHP/Laravel (gồm thực tập); có MySQL, Git; Java chỉ "đang học"; **Cao đẳng** | **Hạng 3**, điểm thấp |

## 3. Những điểm cần kiểm tra trên trang Rankings

**Khoa (CV_01)**
- 5/5 kỹ năng bắt buộc được đánh dấu là có bằng chứng, mỗi kỹ năng kèm trích dẫn từ CV.
- Kinh nghiệm vượt yêu cầu 2 năm; học vấn đạt Bachelor.

**Hà (CV_02)**
- Thiếu **MySQL**. Hệ thống nên đánh dấu mục này là thiếu hoặc cần xác minh (đã có PostgreSQL tương đương), không được tự coi là đạt.
- Mục "Gaps to verify" nên nhắc tới MySQL và Docker/AWS.
- Kinh nghiệm và học vấn đạt.

**Huy (CV_03)**
- Thiếu Spring Boot và REST API.
- **Java là bẫy kiểm thử:** CV chỉ ghi "đang học Java, chưa có dự án thực tế". Đây không nên được tính là bằng chứng mạnh.
- Kinh nghiệm dưới 2 năm *Java*: kinh nghiệm thực tế đều là PHP.
- Học vấn Cao đẳng thấp hơn Bachelor.

**Chung**
- Thứ tự xếp hạng: Khoa > Hà > Huy.
- Bật ẩn danh tính thì tên và email bị che.

## 4. Kết quả trích xuất đã kiểm tra trước (heuristic extractor của backend)

| File | Số năm KN | Học vấn | Số kỹ năng nhận diện |
|---|---|---|---|
| CV_01 (PDF) | 5.4 | Bachelor | 23 |
| CV_02 (DOCX) | 3.1 | Bachelor | 14 |
| CV_03 (PDF) | 1.8 | College | 11 |

Khi bật LLM extractor, con số có thể khác đôi chút. Ghi lại nếu chênh lệch lớn.
