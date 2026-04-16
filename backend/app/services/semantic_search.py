"""
Semantic search layer — pluggable embedding backend.

The Master Plan calls for pgvector + BAAI/bge-large-en-v1.5 fine-tuned on
the IEC 62304 corpus. Provisioning Cloud SQL + fine-tuning a model are
multi-day projects; this module defines the API surface and ships with
two ready backends:

1) `sentence_transformers` (if installed and small model loaded) —
   true semantic embeddings, in-memory ANN over the live REQ/test set.
2) `jaccard_token` — the existing jaccard fallback so the API never
   degrades to "not available".

Future: swap backend "pgvector" in by replacing `_load_backend`. The
calling code (Missing Trace Link Predictor) doesn't change.
"""

import logging
import os
import re
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _tokenize(text: str) -> set:
    return {w.lower() for w in re.findall(r"[A-Za-z][A-Za-z0-9_]{2,}", text or "")
            if len(w) > 2}


@lru_cache(maxsize=1)
def _load_backend() -> str:
    """Pick the best available embedding backend."""
    if os.environ.get("QMS_DISABLE_EMBEDDINGS"):
        return "jaccard_token"
    try:
        # Importing inside function so test envs without sentence-transformers
        # don't take the import-time cost.
        from sentence_transformers import SentenceTransformer  # noqa: F401
        return "sentence_transformers"
    except ImportError:
        return "jaccard_token"


@lru_cache(maxsize=1)
def _get_st_model():
    from sentence_transformers import SentenceTransformer
    # Smallest viable model — runs in <2s startup on a Cloud Run cold start.
    # When BGE fine-tuned on IEC 62304 is available, swap the model name here.
    name = os.environ.get("QMS_EMBED_MODEL", "all-MiniLM-L6-v2")
    return SentenceTransformer(name)


def embed_texts(texts: List[str]) -> Optional["object"]:
    """Embed a list of strings. Returns numpy array or None if fallback used."""
    if _load_backend() != "sentence_transformers":
        return None
    try:
        import numpy as np  # noqa: F401
        model = _get_st_model()
        return model.encode(texts, normalize_embeddings=True)
    except Exception as e:
        logger.warning(f"Embedding failed, falling back to jaccard: {e}")
        return None


def similarity_pairs(
    left: List[Dict], right: List[Dict],
    left_text_key: str = "text", right_text_key: str = "text",
    min_score: float = 0.18, top_k: int = 25,
) -> List[Dict]:
    """Return high-similarity (left, right) pairs.

    Each input is a list of dicts with at least an `id` key and a text-bearing
    key (configurable). Returns sorted list of {left_id, right_id, similarity,
    method}.
    """
    backend = _load_backend()
    out: List[Dict] = []

    if backend == "sentence_transformers":
        try:
            import numpy as np
            l_texts = [str(item.get(left_text_key, "") or "") for item in left]
            r_texts = [str(item.get(right_text_key, "") or "") for item in right]
            l_emb = embed_texts(l_texts)
            r_emb = embed_texts(r_texts)
            if l_emb is None or r_emb is None:
                raise RuntimeError("embed_texts returned None")
            # Cosine similarity = dot product when vectors are normalized
            sim = np.dot(l_emb, r_emb.T)
            for i, l_item in enumerate(left):
                for j, r_item in enumerate(right):
                    s = float(sim[i, j])
                    if s < min_score:
                        continue
                    out.append({
                        "left_id": l_item["id"],
                        "right_id": r_item["id"],
                        "similarity": round(s, 3),
                        "method": "bge_or_minilm_cosine",
                    })
        except Exception as e:
            logger.warning(f"ST similarity failed, fallback: {e}")
            return _jaccard_pairs(left, right, left_text_key, right_text_key,
                                    min_score, top_k)
    else:
        out = _jaccard_pairs(left, right, left_text_key, right_text_key,
                              min_score, top_k)

    out.sort(key=lambda c: c["similarity"], reverse=True)
    return out[:top_k]


def _jaccard_pairs(left: List[Dict], right: List[Dict],
                    left_text_key: str, right_text_key: str,
                    min_score: float, top_k: int) -> List[Dict]:
    l_toks = {item["id"]: _tokenize(str(item.get(left_text_key, "") or ""))
                for item in left}
    r_toks = {item["id"]: _tokenize(str(item.get(right_text_key, "") or ""))
                for item in right}
    out = []
    for l_id, l_set in l_toks.items():
        for r_id, r_set in r_toks.items():
            if not l_set or not r_set:
                continue
            inter = len(l_set & r_set)
            union = len(l_set | r_set)
            s = inter / union if union else 0.0
            if s < min_score:
                continue
            out.append({"left_id": l_id, "right_id": r_id,
                         "similarity": round(s, 3),
                         "method": "jaccard_token_fallback"})
    return out


def get_active_backend() -> str:
    """Public accessor — surfaces which backend is currently active."""
    return _load_backend()
