# Gunakan Python 3.10
FROM python:3.10

# Atur folder kerja di dalam server
WORKDIR /code

# Salin file requirements.txt (Langsung dari root, tanpa folder backend)
COPY requirements.txt /code/requirements.txt

# Install library yang dibutuhkan
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Salin folder app (Otak Linda)
COPY app /code/app

# Bikin file database kosong & kasih izin akses penuh (Supaya gak error permission)
RUN touch /code/memory.db
RUN chmod 777 /code/memory.db
RUN chmod -R 777 /code

# Buka port standar Hugging Face
EXPOSE 7860

# Nyalakan Server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]