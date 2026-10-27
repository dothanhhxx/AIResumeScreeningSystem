"""
Unit tests for Celery parse_cv_task.
Owner: Person B
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.cv import CV, CVStatus
from app.workers.parse_task import _process_cv_parsing


@pytest.mark.asyncio
async def test_process_cv_parsing_success():
    mock_cv = MagicMock(spec=CV)
    mock_cv.id = 42
    mock_cv.file_type = "docx"
    mock_cv.file_url = "resumes/test_resume.docx"
    mock_cv.status = CVStatus.UPLOADED
    mock_cv.raw_text = None

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_cv
    mock_db.execute.return_value = mock_result

    with patch("app.workers.parse_task.async_session_factory") as mock_session_factory, \
         patch("app.workers.parse_task.storage_service.download_file") as mock_download, \
         patch("app.workers.parse_task.parse_document") as mock_parse_doc, \
         patch("app.workers.parse_task._trigger_downstream_extract") as mock_trigger:

        mock_session_factory.return_value.__aenter__.return_value = mock_db
        mock_download.return_value = b"fake docx content"
        mock_parse_doc.return_value = "Candidate Name: Alice Smith\nSkills: Python, Celery"

        res = await _process_cv_parsing(42)

        assert res["status"] == "parsed"
        assert res["cv_id"] == 42
        assert mock_cv.status == CVStatus.PARSED
        assert "Alice Smith" in mock_cv.raw_text
        mock_trigger.assert_called_once_with(42)


@pytest.mark.asyncio
async def test_process_cv_parsing_not_found():
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    with patch("app.workers.parse_task.async_session_factory") as mock_session_factory:
        mock_session_factory.return_value.__aenter__.return_value = mock_db

        res = await _process_cv_parsing(999)
        assert res["status"] == "not_found"
