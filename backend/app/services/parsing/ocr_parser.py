"""
OCR parser — Optical Character Recognition using Tesseract.
Owner: Person B (Ngày 3)

Features:
  - Extracts text from scanned PDFs, images (PNG, JPEG, TIFF, BMP).
  - Multi-page PDF to image rendering via pdf2image, PyMuPDF (fitz), or embedded image extraction.
  - Multi-language OCR support (default: English + Vietnamese).
  - Graceful degradation when Tesseract binary is not installed on host.
  - Normalizes whitespace and unprintable characters using clean_text.
"""

import logging
import os
import shutil
from io import BytesIO
from typing import IO

from app.core.exceptions import FileProcessingError
from app.services.parsing.base import BaseParser, clean_text

logger = logging.getLogger(__name__)


class OCRParser(BaseParser):
    """Parser using Tesseract OCR for image resumes and scanned PDFs."""

    supported_extensions = ("png", "jpg", "jpeg", "tiff", "tif", "bmp", "webp", "pdf")
    supported_mime_types = (
        "image/png",
        "image/jpeg",
        "image/tiff",
        "image/bmp",
        "image/webp",
        "application/pdf",
    )

    def __init__(self, lang: str = "eng+vie") -> None:
        """
        Args:
            lang: Tesseract language codes, e.g. 'eng+vie' or 'eng'.
        """
        self.lang = lang
        self._tesseract_available: bool | None = None

    def is_available(self) -> bool:
        """Check whether pytesseract and the tesseract executable are available."""
        if self._tesseract_available is not None:
            return self._tesseract_available

        try:
            import pytesseract

            # Also check if tesseract binary is in PATH or configured
            tesseract_cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
            if shutil.which(tesseract_cmd) or os.path.exists(tesseract_cmd):
                self._tesseract_available = True
            else:
                # Try getting version to confirm
                pytesseract.get_tesseract_version()
                self._tesseract_available = True
        except Exception as exc:
            logger.debug("[OCRParser] Tesseract not available: %s", exc)
            self._tesseract_available = False

        return self._tesseract_available

    def parse(
        self,
        content: bytes | IO[bytes],
        *,
        lang: str | None = None,
        **kwargs,
    ) -> str:
        """
        Extract text from image or scanned PDF bytes using OCR.

        Args:
            content: Raw image or PDF bytes.
            lang: Optional override for OCR language(s).

        Returns:
            Extracted and normalized plain text.

        Raises:
            FileProcessingError: If Tesseract is unavailable or OCR fails.
        """
        raw_bytes = self._to_bytes(content)
        if not raw_bytes:
            raise FileProcessingError("Empty content provided for OCR.")

        if not self.is_available():
            raise FileProcessingError(
                "Tesseract OCR is not installed or not available in the system PATH. "
                "Please install Tesseract OCR to process scanned documents and images."
            )

        from PIL import Image

        selected_lang = lang or self.lang
        extracted_parts: list[str] = []

        # Determine if content is PDF
        if raw_bytes.startswith(b"%PDF-"):
            images = self._convert_pdf_to_images(raw_bytes)
            if not images:
                raise FileProcessingError("Could not extract or render pages from scanned PDF for OCR.")

            for idx, img in enumerate(images):
                try:
                    text = self._ocr_image(img, selected_lang)
                    if text:
                        extracted_parts.append(text)
                except Exception as exc:
                    logger.warning("[OCRParser] OCR failed on PDF page %d: %s", idx + 1, exc)
        else:
            # Single image file
            try:
                img = Image.open(BytesIO(raw_bytes))
                text = self._ocr_image(img, selected_lang)
                if text:
                    extracted_parts.append(text)
            except Exception as exc:
                raise FileProcessingError(f"Failed to open image for OCR: {exc}") from exc

        full_text = "\n\n".join(extracted_parts)
        cleaned = clean_text(full_text)

        if not cleaned:
            raise FileProcessingError(
                "OCR completed but no readable text could be recognized. "
                "The image resolution may be too low or unreadable."
            )

        return cleaned

    def _ocr_image(self, img, lang: str) -> str:
        """Run pytesseract on a PIL Image with language fallback."""
        import pytesseract

        try:
            return pytesseract.image_to_string(img, lang=lang)
        except pytesseract.TesseractError as exc:
            # If specified language pack (e.g. vie) is missing, retry with eng only
            if "vie" in lang:
                logger.warning("[OCRParser] OCR failed with '%s', retrying with 'eng': %s", lang, exc)
                return pytesseract.image_to_string(img, lang="eng")
            raise

    def _convert_pdf_to_images(self, pdf_bytes: bytes) -> list:
        """Convert PDF pages to PIL Image objects."""
        from PIL import Image

        images = []

        # Strategy A: PyMuPDF (fitz) rendering
        try:
            import fitz

            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page in doc:
                pix = page.get_pixmap(dpi=200)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                images.append(img)
            doc.close()
            if images:
                return images
        except Exception as exc:
            logger.debug("[OCRParser] fitz rendering failed: %s", exc)

        # Strategy B: pdf2image
        try:
            from pdf2image import convert_from_bytes

            images = convert_from_bytes(pdf_bytes, dpi=200)
            if images:
                return images
        except Exception as exc:
            logger.debug("[OCRParser] pdf2image rendering failed: %s", exc)

        # Strategy C: pypdf embedded image extraction
        try:
            import pypdf

            reader = pypdf.PdfReader(BytesIO(pdf_bytes))
            for page in reader.pages:
                for img_obj in page.images:
                    img = Image.open(BytesIO(img_obj.data))
                    images.append(img)
        except Exception as exc:
            logger.debug("[OCRParser] pypdf embedded image extraction failed: %s", exc)

        return images
