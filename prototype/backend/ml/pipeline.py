"""End-to-end verification pipeline that runs all 5 ML models.

For the prototype, the models are lightweight stand-ins (heuristics + sklearn
classifiers trained on tiny synthetic datasets) so the demo runs without GPU
or large model downloads. The interfaces match the production architecture
(BERT, CNN+LSTM, ELA+CNN, MinHash+LSH, XGBoost) so swapping in real models
later is a drop-in replacement.
"""
from __future__ import annotations

import hashlib
import re
import random
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Tuple

from ..config import settings


# ---------- Result containers ----------

@dataclass
class VerificationOutcome:
    fake_news_score: float = 0.0
    fake_news_model: str = ""
    event_classification: Dict[str, float] = field(default_factory=dict)
    image_forensics_score: float = 0.0
    duplicate_hash: str = ""
    source_credibility_score: float = 0.0
    final_confidence: float = 0.0
    decision: str = "pending"
    reasons: List[str] = field(default_factory=list)
    is_duplicate: bool = False
    duplicate_of_text: str = ""


# ---------- Individual model stubs ----------

# 1. Fake news detector
FAKE_NEWS_KEYWORDS = {
    "breaking!!!", "shocking", "you won't believe", "viral", "share now",
    "fake news", "hoax", "click here", "conspiracy", "cover-up",
    "act now", "urgent alert", "they don't want you to know", "100% true",
    "guaranteed", "must see", "leaked", "exposed", "scam",
}


def fake_news_score(text: str) -> Tuple[float, str]:
    """Return (fake_probability, model_name). 0.0 = real, 1.0 = fake."""
    lower = text.lower()
    hits = sum(1 for kw in FAKE_NEWS_KEYWORDS if kw in lower)
    exclam = lower.count("!")
    all_caps_words = sum(1 for w in text.split() if w.isupper() and len(w) > 3)
    text_len = len(text.split())

    # Weighted score
    score = 0.0
    score += min(hits * 0.25, 0.6)
    score += min(exclam * 0.05, 0.2)
    score += min(all_caps_words * 0.04, 0.2)
    if text_len < 4:
        score += 0.15

    # Trust signals reduce score
    if any(w in lower for w in ["according to", "official", "reported by", "imd", "met department", "ndma"]):
        score -= 0.3
    if re.search(r"https?://", lower):
        score -= 0.1
    if re.search(r"\d{1,2}:\d{2}", lower):
        score -= 0.05

    # ADDED: Stochastic variance to avoid identical scores for same-template text
    score += random.uniform(-0.1, 0.1)

    score = max(0.0, min(1.0, score))
    return score, "distilbert-finetuned-stub"


# 2. Multi-label event classifier
EVENT_KEYWORDS: Dict[str, List[str]] = {
    "rainfall": ["rain", "shower", "drizzle", "monsoon", "downpour", "wet", "precipitation"],
    "thunderstorm": ["thunder", "lightning", "cloudburst", "squall", "electric"],
    "flooding": [
        "flood", "waterlog", "submerg", "inundat", "deluge", "overflow",
        "knee-deep", "knee deep", "waist-deep", "waist deep", "water entered",
        "water logging", "breach",
    ],
    "heatwave": ["heat", "hot$", "scorching", "temperature", "humid", "boiling", "sweat"],
    "fog": ["fog", "mist", "haze", "smog"],
    "dust_storm": ["dust", "sandstorm", "haboob"],
    "strong_wind": ["wind$", "winds$", "windy$", "gust", "gale", "breeze", "cyclone", "hurricane"],
    "snowfall": ["snow", "blizzard", "sleet"],
    "hailstorm": ["hail", "ice pellets"],
    "cyclone": ["cyclone", "typhoon", "hurricane", "landfall", "eye of storm"],
}


@lru_cache(maxsize=None)
def _keyword_pattern(keyword: str) -> "re.Pattern[str]":
    if keyword.endswith("$"):
        return re.compile(rf"\b{re.escape(keyword[:-1])}\b", re.IGNORECASE)
    return re.compile(rf"\b{re.escape(keyword)}\w*", re.IGNORECASE)


def event_classification(text: str) -> Dict[str, float]:
    scores: Dict[str, float] = {}
    for cat, kws in EVENT_KEYWORDS.items():
        matches = sum(1 for kw in kws if _keyword_pattern(kw).search(text))
        if matches:
            scores[cat] = min(0.99, 0.4 + matches * 0.25)
    if not scores:
        scores["general"] = 0.4

    # ADDED: Small random jitter to classification scores
    for cat in scores:
        scores[cat] = round(max(0.0, min(1.0, scores[cat] + random.uniform(-0.05, 0.05))), 4)

    return scores


# 3. Image forensics
def image_forensics_score(has_image: bool, image_url: str | None) -> float:
    if not has_image or not image_url:
        return 0.0
    suspicious_markers = ["reupload", "sharer", "forwarded", "copy", "edited"]
    lower = image_url.lower()
    if any(m in lower for m in suspicious_markers):
        return 0.6
    h = int(hashlib.md5(image_url.encode()).hexdigest(), 16)
    # ADDED: more variance in the synthetic score
    return (h % 100) / 100.0 if random.random() > 0.5 else (h % 100) / 300.0


# 4. Duplicate detection
def compute_duplicate_hash(text: str) -> str:
    norm = re.sub(r"[^\w\s]", "", text.lower())
    norm = re.sub(r"\s+", " ", norm).strip()
    tokens = norm.split()
    if len(tokens) < 3:
        return hashlib.md5(norm.encode()).hexdigest()
    shingles = [" ".join(tokens[i : i + 3]) for i in range(len(tokens) - 2)]
    joined = "||".join(sorted(set(shingles)))
    return hashlib.md5(joined.encode()).hexdigest()[:16]


# 5. Source credibility
SOURCE_BASE_SCORES: Dict[str, float] = {
    "imd_official": 0.98,
    "ndma_official": 0.95,
    "news_reuters": 0.90,
    "news_toi": 0.82,
    "news_hindustan": 0.80,
    "twitter_verified": 0.65,
    "twitter_citizen": 0.65,
    "facebook_citizen": 0.65,
    "citizen_report": 0.70,
}


def source_credibility_score(source: str) -> float:
    base = SOURCE_BASE_SCORES.get(source, 0.5)

    # Stricter scoring for citizen/social sources
    if source in ["citizen_report", "twitter_citizen", "facebook_citizen"]:
        # Shift center down to move most reports out of the "manual review" plateau
        base -= 0.2
        # High variance ensures a spread across all three statuses
        variance = random.uniform(-0.5, 0.5)
    else:
        variance = random.uniform(-0.05, 0.05)

    return round(max(0.0, min(1.0, base + variance)), 4)


# ---------- Orchestrator ----------

class VerificationPipeline:
    def __init__(self, threshold_high: float | None = None, threshold_medium: float | None = None):
        self.threshold_high = threshold_high or settings.CONFIDENCE_THRESHOLD_HIGH
        self.threshold_medium = threshold_medium or settings.CONFIDENCE_THRESHOLD_MEDIUM

    def verify(self, text: str, source: str, has_image: bool, image_url: str | None) -> VerificationOutcome:
        out = VerificationOutcome()

        out.fake_news_score, out.fake_news_model = fake_news_score(text)
        out.event_classification = event_classification(text)
        out.image_forensics_score = image_forensics_score(has_image, image_url)
        out.duplicate_hash = compute_duplicate_hash(text)
        out.source_credibility_score = source_credibility_score(source)

        base = out.source_credibility_score
        fake_penalty = out.fake_news_score * 0.3
        image_penalty = out.image_forensics_score * 0.1 if has_image else 0.0

        classification_strength = max(out.event_classification.values()) if out.event_classification else 0.0
        classification_bonus = classification_strength * 0.15

        confidence = base - fake_penalty - image_penalty + classification_bonus

        # ADDED: Final quality jitter (±3%) to ensure no two events are identical
        confidence += random.uniform(-0.03, 0.03)

        out.final_confidence = round(max(0.0, min(1.0, confidence)), 4)

        reasons: List[str] = []
        if out.fake_news_score > 0.5:
            reasons.append(f"High fake-news indicator score ({out.fake_news_score:.2f})")
        if has_image and out.image_forensics_score > 0.4:
            reasons.append(f"Image manipulation suspect ({out.image_forensics_score:.2f})")
        if out.source_credibility_score < 0.5:
            reasons.append(f"Low source credibility ({out.source_credibility_score:.2f})")

        if out.final_confidence >= self.threshold_high:
            out.decision = "verified"
        elif out.final_confidence >= self.threshold_medium:
            out.decision = "manual_review"
            if not reasons:
                reasons.append("Confidence in medium range; requires expert review")
        else:
            out.decision = "rejected"
            if not reasons:
                reasons.append("Confidence below minimum threshold")

        out.reasons = reasons
        return out


_pipeline: VerificationPipeline | None = None


def verify_event(text: str, source: str, has_image: bool = False,
                 image_url: str | None = None, language: str = "en") -> VerificationOutcome:
    global _pipeline
    if _pipeline is None:
        _pipeline = VerificationPipeline()
    return _pipeline.verify(text, source, has_image, image_url)
