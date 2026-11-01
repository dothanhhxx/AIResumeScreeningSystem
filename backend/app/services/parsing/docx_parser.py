"""
DOCX parser — extracts plaintext from Word documents (.docx, .doc).
Owner: Person B (Ngày 2-3)

Features:
  - Extracts text from paragraphs, tables (multi-column CV layouts), and headers/footers.
  - Primary engine: python-docx.
  - Zero-dependency fallback: standard-library zipfile + xml.etree parser.
  - Normalizes whitespace and unprintable characters using clean_text.
"""

import logging
import re
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO
from typing import IO

from app.core.exceptions import FileProcessingError
from app.services.parsing.base import BaseParser, clean_text

logger = logging.getLogger(__name__)

# OpenXML namespace for WordprocessingML
XML_NAMESPACES = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}


class DOCXParser(BaseParser):
    """Parser for Microsoft Word (.docx, .doc) resume documents."""

    supported_extensions = ("docx", "doc")
    supported_mime_types = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    )

    def parse(self, content: bytes | IO[bytes], **kwargs) -> str:
        """
        Extract text from DOCX (or legacy DOC) bytes.

        Args:
            content: Raw document bytes or file-like stream.

        Returns:
            Extracted and normalized plain text.

        Raises:
            FileProcessingError: If the document is corrupted or unreadable.
        """
        raw_bytes = self._to_bytes(content)
        if not raw_bytes:
            raise FileProcessingError("Empty document content provided.")

        extracted_text = ""

        # Strategy 1: python-docx
        try:
            extracted_text = self._parse_with_docx(raw_bytes)
        except FileProcessingError:
            raise
        except Exception as docx_err:
            logger.warning("[DOCXParser] python-docx parsing failed, trying XML fallback: %s", docx_err)

        # Strategy 2: Standard library zipfile + XML fallback
        if not extracted_text:
            try:
                extracted_text = self._parse_with_zip_xml(raw_bytes)
            except Exception as zip_err:
                logger.warning("[DOCXParser] zipfile XML fallback failed: %s", zip_err)

        # Strategy 3: If it's a legacy .doc file or binary stream, attempt basic text extraction
        if not extracted_text:
            extracted_text = self._parse_legacy_doc(raw_bytes)

        cleaned = clean_text(extracted_text)
        if not cleaned:
            raise FileProcessingError(
                "Could not extract readable text from Word document. "
                "The file may be corrupt or an unsupported legacy format."
            )

        return cleaned

    def _parse_with_docx(self, raw_bytes: bytes) -> str:
        """Parse using the python-docx library."""
        try:
            import docx
        except ImportError:
            logger.info("[DOCXParser] python-docx not installed, using built-in XML parser.")
            return ""

        try:
            doc = docx.Document(BytesIO(raw_bytes))
        except Exception as exc:
            # Check if this might be a legacy .doc or corrupt zip
            if not zipfile.is_zipfile(BytesIO(raw_bytes)):
                return ""  # Fallback to legacy parser
            raise FileProcessingError(f"Invalid or corrupted DOCX file: {exc}") from exc

        content_parts: list[str] = []

        # 1. Headers from sections
        for section in doc.sections:
            try:
                header = section.header
                for p in header.paragraphs:
                    text = p.text.strip()
                    if text:
                        content_parts.append(text)
            except Exception:
                pass

        # 2. Body paragraphs
        for p in doc.paragraphs:
            text = p.text.strip()
            if text:
                content_parts.append(text)

        # 3. Tables (crucial for resume work history / skill grids)
        for table in doc.tables:
            for row in table.rows:
                # Deduplicate merged cells in row
                row_texts: list[str] = []
                for cell in row.cells:
                    cell_text = cell.text.strip()
                    if cell_text and (not row_texts or cell_text != row_texts[-1]):
                        row_texts.append(cell_text)
                if row_texts:
                    content_parts.append(" | ".join(row_texts))

        # 4. Footers from sections
        for section in doc.sections:
            try:
                footer = section.footer
                for p in footer.paragraphs:
                    text = p.text.strip()
                    if text:
                        content_parts.append(text)
            except Exception:
                pass

        return "\n\n".join(content_parts)

    def _parse_with_zip_xml(self, raw_bytes: bytes) -> str:
        """
        Pure Python fallback extracting text from word/document.xml in the DOCX zip archive.
        """
        if not zipfile.is_zipfile(BytesIO(raw_bytes)):
            return ""

        content_parts: list[str] = []

        with zipfile.ZipFile(BytesIO(raw_bytes)) as zf:
            # Files to search inside DOCX zip: document, headers, footers
            xml_files = [name for name in zf.namelist() if name.startswith("word/") and name.endswith(".xml")]

            # Ensure document.xml is processed in main order
            priority_files = [f for f in xml_files if "document.xml" in f]
            other_files = [f for f in xml_files if "document.xml" not in f]

            for xml_file in priority_files + other_files:
                try:
                    xml_data = zf.read(xml_file)
                    root = ET.fromstring(xml_data)

                    # Find all paragraph tags <w:p>
                    for p in root.iter(f"{{{XML_NAMESPACES['w']}}}p"):
                        p_texts = []
                        for t in p.iter(f"{{{XML_NAMESPACES['w']}}}t"):
                            if t.text:
                                p_texts.append(t.text)
                        full_p = "".join(p_texts).strip()
                        if full_p:
                            content_parts.append(full_p)
                except Exception as exc:
                    logger.debug("[DOCXParser] Error parsing XML part '%s': %s", xml_file, exc)

        return "\n\n".join(content_parts)

    def _parse_legacy_doc(self, raw_bytes: bytes) -> str:
        """
        Extract readable plain text strings from legacy binary .doc files.
        """
        try:
            # Find runs of ASCII or UTF-8 text strings of length >= 4
            text = raw_bytes.decode("utf-8", errors="ignore")
            # Filter sequences that look like words/sentences
            matches = re.findall(r"[\w\s.,;:()/@-]{4,}", text)
            filtered = [m.strip() for m in matches if len(m.strip()) > 3]
            return "\n".join(filtered)
        except Exception:
            return ""
