from app.services.extraction.pii_stripper import (
    DOB_TOKEN,
    EMAIL_TOKEN,
    NAME_TOKEN,
    PHONE_TOKEN,
    URL_TOKEN,
    strip_pii,
)


def test_masks_email():
    assert strip_pii("Email: nguyen.van.a+cv@gmail.com") == f"Email: {EMAIL_TOKEN}"


def test_masks_vietnamese_phone_formats():
    for phone in ["0912345678", "0912 345 678", "091.234.5678", "+84 912 345 678", "(+84) 912-345-678"]:
        assert strip_pii(f"SĐT: {phone}") == f"SĐT: {PHONE_TOKEN}", phone


def test_keeps_years_and_short_numbers():
    text = "FPT Software (2019 - 2023), GPA 3.6/4, IELTS 7.0, 5 năm kinh nghiệm"
    assert strip_pii(text) == text


def test_masks_urls_and_profile_links():
    text = "https://github.com/nguyenvana | linkedin.com/in/nguyen-van-a | www.portfolio.dev"
    assert strip_pii(text) == f"{URL_TOKEN} | {URL_TOKEN} | {URL_TOKEN}"


def test_masks_date_of_birth_but_keeps_label():
    assert strip_pii("Ngày sinh: 01/02/2000") == f"Ngày sinh: {DOB_TOKEN}"
    assert strip_pii("Date of birth - 1.2.2000") == f"Date of birth - {DOB_TOKEN}"


def test_keeps_non_birth_dates():
    text = "Thời gian: 01/02/2020 - 01/02/2022"
    assert strip_pii(text) == text


def test_masks_known_names_case_insensitive():
    text = "NGUYỄN VĂN A\nNguyễn Văn A là backend developer"
    assert strip_pii(text, known_names=["Nguyễn Văn A"]) == f"{NAME_TOKEN}\n{NAME_TOKEN} là backend developer"


def test_empty_text():
    assert strip_pii("") == ""
