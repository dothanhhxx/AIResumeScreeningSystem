# TalentLens Sample Datasets (`samples/`)

Thư mục này chứa bộ dữ liệu mẫu chuẩn hóa dùng để kiểm thử luồng nghiệp vụ **End-to-End** của hệ thống **TalentLens** (Upload JD tự động điền form, Upload CV đơn/hàng loạt, Ẩn danh PII và Chấm điểm Lai 3 Tầng).

## Cấu trúc thư mục

```text
samples/
├── jds/                                                 # Bộ mô tả công việc (Job Descriptions) mẫu
│   ├── JD_Senior_AI_Backend_Engineer_EN.pdf             # Bản Tiếng Anh (Senior AI / Python Backend Engineer)
│   └── JD_Senior_Data_Analyst_VI.pdf                    # Bản Tiếng Việt (Chuyên viên Phân tích Dữ liệu Cao cấp)
└── cvs/                                                 # Bộ hồ sơ ứng viên (CV / Resume) mẫu
    ├── general/                                         # Bộ CV Kỹ thuật Phần mềm (Java, PHP, Backend)
    │   ├── CV_01_Nguyen_Minh_Khoa_Java_Backend.pdf
    │   ├── CV_02_Tran_Thu_Ha_Java_Developer.docx
    │   └── CV_03_Le_Quang_Huy_PHP_Developer.pdf
    └── recruiter-flow/                                  # Bộ CV phân tầng năng lực (Strong / Medium / Weak / Kế toán)
        ├── cv_strong.pdf
        ├── cv_medium.docx
        ├── cv_weak.pdf
        ├── cv_ketoan_tot.pdf
        └── cv_ketoan_junior.docx
```

## Tái tạo dữ liệu mẫu

Các kịch bản Python dùng để sinh tự động các file CV mẫu được đặt tại [`scripts/seed/`](../scripts/seed/):
- `scripts/seed/generate_sample_cvs.py`
- `scripts/seed/generate_recruiter_flow_cvs.py`

