"""
PDF parser — extracts plaintext from PDF resumes.
Owner: Person B (Ngày 2-3)

Features:
  - Multi-engine support: pypdf (primary) -> PyMuPDF (fitz) -> pdfplumber.
  - Detects scanned / image-based PDFs when extracted text is under threshold,
    with automatic OCR fallback when requested.
  - Detects and handles encrypted/password-protected PDFs.
  - Normalizes whitespace and unprintable characters using clean_text.
"""

import logging
from io import BytesIO
from typing import IO

from app.core.exceptions import FileProcessingError
from app.services.parsing.base import BaseParser, clean_text

logger = logging.getLogger(__name__)

# Minimum character count to consider a PDF text extraction valid.
# Below this, the PDF is likely a scanned document / image resume.
MIN_TEXT_THRESHOLD = 50


class PDFParser(BaseParser):
    """Parser for Portable Document Format (.pdf) files."""

    supported_extensions = ("pdf",)
    supported_mime_types = ("application/pdf",)

    def __init__(self, min_text_threshold: int = MIN_TEXT_THRESHOLD) -> None:
        self.min_text_threshold = min_text_threshold

    def parse(
        self,
        content: bytes | IO[bytes],
        *,
        enable_ocr: bool = True,
        **kwargs,
    ) -> str:
        """
        Extract text from PDF content.

        Args:
            content: Raw PDF bytes or file-like stream.
            enable_ocr: If True and the extracted text is empty or shorter than
                        threshold, attempt OCR via OCRParser.

        Returns:
            Extracted and normalized plain text.

        Raises:
            FileProcessingError: If the file is corrupt, unreadable, or encrypted.
        """
        raw_bytes = self._to_bytes(content)
        if not raw_bytes:
            raise FileProcessingError("Empty PDF content provided.")

        extracted_text = ""

        # Strategy 1: pypdf
        try:
            extracted_text = self._parse_with_pypdf(raw_bytes)
        except FileProcessingError:
            raise
        except Exception as pypdf_err:
            logger.warning("[PDFParser] pypdf extraction encountered an issue: %s", pypdf_err)

        # Strategy 2: fitz (PyMuPDF) if pypdf yielded little or no text
        if len(clean_text(extracted_text)) < self.min_text_threshold:
            try:
                fitz_text = self._parse_with_pymupdf(raw_bytes)
                if len(clean_text(fitz_text)) > len(clean_text(extracted_text)):
                    extracted_text = fitz_text
            except Exception as fitz_err:
                logger.debug("[PDFParser] PyMuPDF fallback failed or not installed: %s", fitz_err)

        # Strategy 3: pdfplumber if still empty
        if len(clean_text(extracted_text)) < self.min_text_threshold:
            try:
                plumber_text = self._parse_with_pdfplumber(raw_bytes)
                if len(clean_text(plumber_text)) > len(clean_text(extracted_text)):
                    extracted_text = plumber_text
            except Exception as plumber_err:
                logger.debug("[PDFParser] pdfplumber fallback failed or not installed: %s", plumber_err)

        cleaned = clean_text(extracted_text)

        # OCR fallback for scanned or image-based PDFs
        if len(cleaned) < self.min_text_threshold and enable_ocr:
            logger.info(
                "[PDFParser] Text length (%d chars) below threshold (%d). Attempting OCR fallback.",
                len(cleaned),
                self.min_text_threshold,
            )
            try:
                from app.services.parsing.ocr_parser import OCRParser  # deferred import

                ocr_parser = OCRParser()
                ocr_text = ocr_parser.parse(raw_bytes, **kwargs)
                cleaned_ocr = clean_text(ocr_text)
                if len(cleaned_ocr) > len(cleaned):
                    return cleaned_ocr
            except Exception as ocr_err:
                logger.warning("[PDFParser] OCR fallback failed: %s", ocr_err)
                # If we had some text, return it; otherwise re-raise or continue
                if cleaned:
                    return cleaned

        if not cleaned:
            # If still completely empty and OCR wasn't able to extract anything
            raise FileProcessingError(
                "Could not extract any readable text from the PDF file. "
                "The file may be blank, corrupted, or an unscannable image."
            )

        return cleaned

    def _parse_with_pypdf(self, raw_bytes: bytes) -> str:
        """Parse using standard pypdf library."""
        try:
            import pypdf
        except ImportError:
            logger.warning("[PDFParser] pypdf library not available.")
            return ""

        stream = BytesIO(raw_bytes)
        try:
            reader = pypdf.PdfReader(stream)
        except Exception as exc:
            raise FileProcessingError(f"Corrupted or invalid PDF file: {exc}") from exc

        if reader.is_encrypted:
            # Try decrypting with empty password
            try:
                decrypted = reader.decrypt("")
                if not decrypted:
                    raise FileProcessingError("Encrypted PDF requires a password and cannot be parsed.")
            except Exception as exc:
                raise FileProcessingError(f"Encrypted PDF cannot be read: {exc}") from exc

        pages_text: list[str] = []
        for idx, page in enumerate(reader.pages):
            try:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            except Exception as exc:
                logger.warning("[PDFParser] Failed extracting text from page %d: %s", idx + 1, exc)

        return "\n\n".join(pages_text)

    def _parse_with_pymupdf(self, raw_bytes: bytes) -> str:
        """Parse using PyMuPDF (fitz) if installed."""
        try:
            import fitz
        except ImportError:
            return ""

        doc = fitz.open(stream=raw_bytes, filetype="pdf")
        pages_text: list[str] = []
        for page in doc:
            text = page.get_text()
            if text:
                pages_text.append(text)
        doc.close()
        return "\n\n".join(pages_text)

    def _parse_with_pdfplumber(self, raw_bytes: bytes) -> str:
        """Parse using pdfplumber if installed."""
        try:
            import pdfplumber
        except ImportError:
            return ""

        pages_text: list[str] = []
        with pdfplumber.open(BytesIO(raw_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
        return "\n\n".join(pages_text)
