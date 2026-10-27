# API와 작업 처리기가 같은 이미지를 쓰고, 실행 명령만 다르다 (docker-compose.yml)
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY samples ./samples
RUN useradd -m appuser && mkdir -p /data && chown appuser /data
USER appuser
ENV STORAGE_DIR=/data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
