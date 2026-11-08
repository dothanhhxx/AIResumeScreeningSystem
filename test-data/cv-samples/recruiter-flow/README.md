# Bộ CV cho luồng recruiter end-to-end (TC-FLOW-01, TC-FLOW-02)

Toàn bộ người, công ty, email và số điện thoại trong thư mục này là **hư cấu**, chỉ dùng để kiểm thử.

Sinh lại file: `python make_flow_cvs.py` (mặc định ghi vào chính thư mục này). Script dùng lại `make_pdf` và `make_docx` từ `../make_cvs.py`.

## TC-FLOW-01 — JD "Backend Developer (Python/FastAPI)" (tiếng Anh)

Skill bắt buộc: Python, FastAPI, PostgreSQL, Docker, REST API, Git, Redis · 3 năm · Bachelor's degree in Computer Science

| File | Ứng viên | Hồ sơ | Kỳ vọng |
|---|---|---|---|
| `cv_strong.pdf` | Hoang Duc Anh | ~5,4 năm Python, 4 năm FastAPI; đủ 7/7 skill; Bachelor of Computer Science | **Hạng 1** |
| `cv_medium.docx` | Bui Thanh Tung | ~2,2 năm Python/Django, MySQL; **thiếu** FastAPI, PostgreSQL, Docker, Redis | **Hạng 2** |
| `cv_weak.pdf` | Ngo Phuong Linh | Digital Marketing ~3,9 năm, không có kỹ năng lập trình | **Hạng 3** |

## TC-FLOW-02 — JD "Kế toán tổng hợp (Senior)" (tiếng Việt)

Skill bắt buộc: Báo cáo tài chính, VAS, IFRS, Kê khai thuế, MISA, Excel, ERP · 5 năm · Cử nhân Kế toán

| File | Ứng viên | Hồ sơ | Kỳ vọng |
|---|---|---|---|
| `cv_ketoan_tot.pdf` | Võ Thị Mai Anh | ~7,4 năm, 6 năm kế toán tổng hợp; đủ 7/7 skill; Cử nhân Kế toán; chứng chỉ Kế toán trưởng | **Hạng 1** |
| `cv_ketoan_junior.docx` | Đặng Văn Phúc | ~1,2 năm kế toán viên, chỉ có Excel; **Cao đẳng** | **Hạng 2**, điểm thấp |

Hai file lỗi dùng ở bước 4 của TC-FLOW-02 (`anh_the.png`, `cv_qua_lon.pdf` > 10 MB) **không** có trong repo. Tự chuẩn bị khi test.

## Kết quả đã kiểm tra trước (heuristic extractor + rule scorer, ngày 05/11/2026)

| File | Số năm KN | Học vấn | Skill khớp | Rule score |
|---|---|---|---|---|
| cv_strong.pdf | 5.4 | Bachelor | 7/7 | 100.0 |
| cv_medium.docx | 2.2 | Bachelor | 3/7 (Python, REST API, Git) | 58.0 |
| cv_weak.pdf | 3.9 | Bachelor | 0/7 | 40.0 |
| cv_ketoan_tot.pdf | 7.4 | Bachelor | 7/7 | 100.0 |
| cv_ketoan_junior.docx | 1.2 | College | 1/7 (Excel) | 22.1 |

Điểm cuối trên giao diện còn cộng phần semantic và LLM (nếu bật), nên có thể khác bảng trên. Thứ tự xếp hạng thì phải giữ nguyên.

**Lưu ý khi review `cv_weak.pdf`:** experience score đạt 100 vì rule scorer đếm tổng số năm đi làm mà không xét có đúng ngành hay không. Đây là hành vi hiện tại của hệ thống, không phải lỗi dữ liệu test.
