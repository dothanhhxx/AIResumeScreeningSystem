"""
Text embeddings for the semantic scorer.
Owner: Person C

Vectors are stored as JSON `{"model": "<source>", "v": [...]}` on cvs.embedding /
jobs.embedding. Two vectors are only compared when they come from the same model.

Offline fallback: a hashed bag-of-words vector (feature hashing over unigrams +
bigrams). Much weaker than Gemini embeddings, but deterministic and free.
"""

import hashlib
import json
import logging
import math
import re

from app.core.exceptions import AIServiceError
from app.llm import BaseLLM

logger = logging.getLogger(__name__)

HASHING_MODEL = "hashing-bow-v1"
HASHING_DIM = 512
MAX_EMBED_CHARS = 8_000

_TOKEN_RE = re.compile(r"[a-zA-ZÀ-ỹ0-9+#.]{2,}")
_STOPWORDS = {
    "the", "and", "for", "with", "you", "our", "are", "will", "have", "has", "from", "this", "that", "your",
    "can", "able", "work", "team", "years", "year", "experience", "skills", "using", "use", "good", "strong",
    "của", "và", "các", "cho", "với", "trong", "được", "những", "là", "có", "một", "năm", "kinh", "nghiệm",
}


def _hash_index(token: str) -> tuple[int, float]:
    digest = hashlib.md5(token.encode("utf-8")).digest()  # noqa: S324 — not used for security
    index = int.from_bytes(digest[:4], "little") % HASHING_DIM
    sign = 1.0 if digest[4] % 2 == 0 else -1.0
    return index, sign


def hashing_embedding(text: str) -> list[float]:
    tokens = [t.lower().strip(".") for t in _TOKEN_RE.findall(text or "")]
    tokens = [t for t in tokens if t and t not in _STOPWORDS]
    vector = [0.0] * HASHING_DIM
    features = tokens + [f"{a} {b}" for a, b in zip(tokens, tokens[1:])]
    for feature in features:
        index, sign = _hash_index(feature)
        vector[index] += sign
    norm = math.sqrt(sum(v * v for v in vector))
    return [v / norm for v in vector] if norm else vector


async def embed_text(text: str, llm: BaseLLM | None) -> tuple[list[float], str]:
    """Return (vector, model). Uses the LLM's embedding model, falling back to feature hashing."""
    text = (text or "")[:MAX_EMBED_CHARS]
    if llm is not None:
        try:
            return await llm.embed(text), llm.embedding_model
        except AIServiceError as exc:
            logger.warning("LLM embedding failed, using hashing embedding: %s", exc)
    return hashing_embedding(text), HASHING_MODEL


def dump_embedding(vector: list[float], model: str) -> str:
    return json.dumps({"model": model, "v": [round(x, 6) for x in vector]})


def load_embedding(stored: str | None) -> tuple[list[float], str] | None:
    if not stored:
        return None
    try:
        data = json.loads(stored)
        return [float(x) for x in data["v"]], str(data["model"])
    except (ValueError, KeyError, TypeError):
        return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0
