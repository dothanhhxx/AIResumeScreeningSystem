"""
Base parser interface and text normalization utilities.
Owner: Person B

Provides the abstract BaseParser class that all format-specific parsers
(PDF, DOCX, OCR) inherit from, ensuring a uniform extraction contract.
"""

import re
import unicodedata
from abc import ABC, abstractmethod
from typing import IO


def clean_text(text: str) -> str:
    """
    Clean and normalize extracted resume text.

    Steps:
      1. Unicode NFKC normalization.
      2. Replace non-breaking spaces, zero-width spaces, and odd Unicode whitespace.
      3. Strip non-printable control characters (retaining standard newlines & tabs).
      4. Normalize Windows (CRLF) and legacy Mac (CR) line endings to UNIX (LF).
      5. Collapse excessive whitespace runs and limit consecutive newlines to two.
      6. Strip leading and trailing whitespace.

    Args:
        text: Raw text string from parser or OCR.

    Returns:
        Clean, standardized plain text.
    """
    if not text:
        return ""

    # Unicode NFKC normalization
    text = unicodedata.normalize("NFKC", text)

    # Normalize various whitespace characters (NBSP, em space, zero-width space, etc.)
    text = text.replace("\xa0", " ")
    text = text.replace("\u200b", "")
    text = text.replace("\ufeff", "")
    text = re.sub(r"[\u2000-\u200a\u202f\u205f\u3000]", " ", text)

    # Normalize line breaks
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove non-printable control characters, preserving \n and \t
    text = "".join(ch for ch in text if ch in ("\n", "\t") or (ord(ch) >= 32 and ord(ch) != 127))

    # Collapse horizontal spaces / tabs on the same line
    lines = text.split("\n")
    cleaned_lines = [re.sub(r"[ \t]+", " ", line).strip() for line in lines]

    # Rejoin lines
    text = "\n".join(cleaned_lines)

    # Collapse runs of 3+ consecutive newlines to at most 2 (paragraph break)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


class BaseParser(ABC):
    """
    Abstract base class for all file parsers.

    Subclasses must implement ``parse(content, **kwargs) -> str``.
    """

    supported_extensions: tuple[str, ...] = ()
    supported_mime_types: tuple[str, ...] = ()

    @abstractmethod
    def parse(self, content: bytes | IO[bytes], **kwargs) -> str:
        """
        Extract plaintext from raw file bytes or a file-like stream.

        Args:
            content: Raw file content in bytes, or an open IO stream.
            **kwargs: Parser-specific optional flags (e.g. enable_ocr).

        Returns:
            Extracted and normalized plain text string.

        Raises:
            FileProcessingError: When extraction fails or the file is corrupted.
        """
        raise NotImplementedError

    def can_handle(self, file_type_or_mime: str) -> bool:
        """
        Check whether this parser supports the given extension or MIME type.
        """
        needle = file_type_or_mime.lower().strip().lstrip(".")
        return (
            needle in self.supported_extensions
            or file_type_or_mime.lower().strip() in self.supported_mime_types
        )

    @staticmethod
    def _to_bytes(content: bytes | IO[bytes]) -> bytes:
        """Helper to convert content to raw bytes."""
        if isinstance(content, bytes):
            return content
        if hasattr(content, "read"):
            return content.read()
        raise TypeError(f"Expected bytes or IO[bytes], got {type(content).__name__}")
