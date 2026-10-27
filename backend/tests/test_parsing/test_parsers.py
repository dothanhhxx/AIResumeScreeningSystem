"""
Tests for CV text parsers (PDF, DOCX, OCR, and Parsing Factory).
Owner: Person B
"""

import zipfile
from io import BytesIO

import pytest

from app.core.exceptions import FileProcessingError, UnsupportedFileTypeError
from app.services.parsing import get_parser, parse_document
from app.services.parsing.base import clean_text
from app.services.parsing.docx_parser import DOCXParser
from app.services.parsing.ocr_parser import OCRParser
from app.services.parsing.pdf_parser import PDFParser

# ── Text Cleaning Tests ──────────────────────────────────────────────────────

def test_clean_text_normalizes_whitespace():
    raw = "Nguyen  Van   A\r\n\r\n\r\nSenior   Software  Engineer\xa0\xa0"
    cleaned = clean_text(raw)
    assert "Nguyen Van A" in cleaned
    assert "Senior Software Engineer" in cleaned
    assert "\r" not in cleaned
    assert "\xa0" not in cleaned
    # At most 2 consecutive newlines
    assert "\n\n\n" not in cleaned


def test_clean_text_strips_control_characters():
    raw = "Header\x00\x07Text\x1bFooter\nNext Line"
    cleaned = clean_text(raw)
    assert "\x00" not in cleaned
    assert "\x07" not in cleaned
    assert "\x1b" not in cleaned
    assert "HeaderTextFooter" in cleaned or "Header" in cleaned


# ── Factory Tests ────────────────────────────────────────────────────────────

def test_get_parser_returns_correct_instances():
    assert isinstance(get_parser("pdf"), PDFParser)
    assert isinstance(get_parser("application/pdf"), PDFParser)
    assert isinstance(get_parser(".docx"), DOCXParser)
    assert isinstance(get_parser("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), DOCXParser)
    assert isinstance(get_parser("png"), OCRParser)
    assert isinstance(get_parser("image/jpeg"), OCRParser)


def test_get_parser_raises_unsupported_error():
    with pytest.raises(UnsupportedFileTypeError):
        get_parser("exe")

    with pytest.raises(UnsupportedFileTypeError):
        get_parser("video/mp4")


# ── DOCX Parser Tests ────────────────────────────────────────────────────────

def test_docx_parser_with_python_docx():
    import docx

    doc = docx.Document()
    doc.add_paragraph("Nguyen Van A - Senior Developer")
    doc.add_paragraph("Skills: Python, FastAPI, Docker, Celery")

    table = doc.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Company"
    table.cell(0, 1).text = "Role"
    table.cell(1, 0).text = "TechCorp"
    table.cell(1, 1).text = "Backend Lead"

    buf = BytesIO()
    doc.save(buf)
    docx_bytes = buf.getvalue()

    parser = DOCXParser()
    extracted = parser.parse(docx_bytes)

    assert "Nguyen Van A" in extracted
    assert "Python, FastAPI" in extracted
    assert "TechCorp" in extracted
    assert "Backend Lead" in extracted


def test_docx_parser_zip_xml_fallback():
    """Test standard library zipfile XML extraction fallback."""
    docx_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body>'
        '<w:p><w:r><w:t>Fallback Resume Text Content</w:t></w:r></w:p>'
        '<w:p><w:r><w:t>Education: Computer Science BS</w:t></w:r></w:p>'
        '</w:body>'
        '</w:document>'
    )
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", docx_xml)

    parser = DOCXParser()
    extracted = parser._parse_with_zip_xml(buf.getvalue())
    assert "Fallback Resume Text Content" in extracted
    assert "Education: Computer Science BS" in extracted


def test_docx_parser_empty_content_raises():
    parser = DOCXParser()
    with pytest.raises(FileProcessingError):
        parser.parse(b"")


# ── PDF Parser Tests ─────────────────────────────────────────────────────────

def test_pdf_parser_with_generated_pdf():
    import pypdf

    writer = pypdf.PdfWriter()
    # Create a simple PDF page with text content
    writer.add_blank_page(width=612, height=792)

    # We can write simple stream or use pypdf writer to output
    buf = BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    parser = PDFParser(min_text_threshold=10)
    # A blank page has no text, so enable_ocr=False should raise FileProcessingError
    with pytest.raises(FileProcessingError):
        parser.parse(pdf_bytes, enable_ocr=False)


def test_pdf_parser_empty_content_raises():
    parser = PDFParser()
    with pytest.raises(FileProcessingError):
        parser.parse(b"")


# ── parse_document Unified API Tests ─────────────────────────────────────────

def test_parse_document_dispatch():
    import docx

    doc = docx.Document()
    doc.add_paragraph("Jane Doe - Data Scientist")
    doc.add_paragraph("Machine Learning, PyTorch, SQL")

    buf = BytesIO()
    doc.save(buf)

    result = parse_document(buf.getvalue(), "docx")
    assert "Jane Doe" in result
    assert "Data Scientist" in result
    assert "Machine Learning" in result
