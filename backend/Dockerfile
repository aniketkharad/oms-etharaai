# ---- Production-ready backend image -------------------------------------
FROM python:3.12-slim

# Don't write .pyc files; stream logs straight to stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /code

# Install dependencies first so this layer is cached between code changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Run as a non-root user (security best practice)
RUN addgroup --system appuser && adduser --system --ingroup appuser appuser
USER appuser

EXPOSE 8000

# $PORT lets hosting platforms (Render) inject their own port; defaults to 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
