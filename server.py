import json
import math
import re
from pathlib import Path
from typing import List, Dict

from sentence_transformers import SentenceTransformer
from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
MEMORY_DIR = BASE_DIR / "data" / "memories"
MODEL_NAME = "all-MiniLM-L6-v2"

app = FastAPI(title="Memory Atlas API")
model = SentenceTransformer(MODEL_NAME)


def split_sentences(text: str, limit: int = 10) -> List[str]:
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    return sentences[:limit]


def load_memories() -> List[Dict[str, str]]:
    index_path = MEMORY_DIR / "index.json"
    if not index_path.exists():
        return []

    try:
        files = json.loads(index_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    memories: List[Dict[str, str]] = []
    for file_name in files:
        file_path = MEMORY_DIR / file_name
        if not file_path.exists():
            continue
        text = file_path.read_text(encoding="utf-8")
        source_name = file_name.replace(".txt", "").replace("-", " ").replace("_", " ")
        for index, sentence in enumerate(split_sentences(text)):
            memories.append({
                "id": f"{file_name}-{index}",
                "sourceName": source_name,
                "file": file_name,
                "text": sentence,
            })
    return memories


MEMORY_STORE = load_memories()


def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


@app.get("/api/search")
def search_memories(q: str = Query(..., min_length=1)):
    if not MEMORY_STORE:
        return {"matches": []}

    query_vector = model.encode(q, convert_to_numpy=True)
    scored = []
    for memory in MEMORY_STORE:
        sentence_vector = model.encode(memory["text"], convert_to_numpy=True)
        score = float(cosine_similarity(query_vector, sentence_vector))
        scored.append({**memory, "score": score})

    matches = sorted(scored, key=lambda item: item["score"], reverse=True)[:4]
    return {"matches": [{
        "id": item["id"],
        "sourceName": item["sourceName"],
        "file": item["file"],
        "text": item["text"],
        "score": round(item["score"], 4),
    } for item in matches]}


app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
