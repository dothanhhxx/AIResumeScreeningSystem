FROM python:3.11-slim

WORKDIR /app

# Tesseract (eng + vie) for OCR of scanned CVs
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev tesseract-ocr tesseract-ocr-vie \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
# Install dependencies first (cached layer), then the app itself
RUN mkdir -p app && touch app/__init__.py && pip install --no-cache-dir -e ".[dev]"

COPY . .

EXPOSE 8000

# Apply migrations, then start the API. The worker service overrides this command.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
