"""
Parsing module — factory and unified interface for CV text extraction.
Owner: Person B (Ngày 3)

Provides:
  - get_parser: Factory function returning the appropriate BaseParser.
  - parse_document: High-level helper extracting clean text from any supported format.
  - BaseParser, PDFParser, DOCXParser, OCRParser, clean_text.
"""

from typing import IO

from app.core.exceptions import UnsupportedFileTypeError
from app.services.parsing.base import BaseParser, clean_text
from app.services.parsing.docx_parser import DOCXParser
from app.services.parsing.ocr_parser import OCRParser
from app.services.parsing.pdf_parser import PDFParser

__all__ = [
    "BaseParser",
    "DOCXParser",
    "OCRParser",
    "PDFParser",
    "clean_text",
    "get_parser",
    "parse_document",
]

# Singletons for parser reuse
_pdf_parser = PDFParser()
_docx_parser = DOCXParser()
_ocr_parser = OCRParser()


def get_parser(file_type_or_mime: str) -> BaseParser:
    """
    Factory function returning the corresponding parser instance based on
    file extension or MIME type.

    Args:
        file_type_or_mime: File extension (e.g. 'pdf', 'docx', 'png') or MIME
                           type (e.g. 'application/pdf').

    Returns:
        An instance of BaseParser capable of parsing the document.

    Raises:
        UnsupportedFileTypeError: If no parser matches the provided type.
    """
    cleaned_type = file_type_or_mime.lower().strip().lstrip(".")

    if _pdf_parser.can_handle(cleaned_type):
        return _pdf_parser

    if _docx_parser.can_handle(cleaned_type):
        return _docx_parser

    if _ocr_parser.can_handle(cleaned_type):
        return _ocr_parser

    raise UnsupportedFileTypeError(file_type_or_mime)


def parse_document(
    content: bytes | IO[bytes],
    file_type: str,
    *,
    enable_ocr: bool = True,
    **kwargs,
) -> str:
    """
    Unified entry point to parse any supported CV file into normalized plain text.

    Args:
        content: Raw file content in bytes, or an open stream.
        file_type: Extension (e.g. 'pdf', 'docx') or MIME type.
        enable_ocr: Whether to allow fallback to OCR if standard text extraction
                    yields little or no text.
        **kwargs: Additional options forwarded to the parser.

    Returns:
        Extracted, normalized plain text string.

    Raises:
        UnsupportedFileTypeError: If file_type is not supported.
        FileProcessingError: If parsing fails or the file is corrupted.
    """
    parser = get_parser(file_type)
    return parser.parse(content, enable_ocr=enable_ocr, **kwargs)
