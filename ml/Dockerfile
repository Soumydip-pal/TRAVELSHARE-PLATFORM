FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Train model on first build if models don't exist
RUN mkdir -p models data
RUN python generate_dataset.py

EXPOSE 5001

CMD ["python", "api/app.py"]
