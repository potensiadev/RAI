"""
Canonical Labels - Resume Section Normalization Dictionary

Maps various section titles (Korean/English) to canonical labels.
This enables processing of diverse resume formats uniformly.
"""

from typing import Dict, List, Optional
import re

# ─────────────────────────────────────────────────────────────────────────────
# Canonical Label Definitions
# ─────────────────────────────────────────────────────────────────────────────

class CanonicalLabel:
    """Standard section labels"""
    PROFILE = "profile"           # 인적사항, 기본정보
    CAREER = "career"             # 경력사항, 이력
    EDUCATION = "education"       # 학력사항
    SKILLS = "skills"             # 기술스택, 보유기술
    PROJECTS = "projects"         # 프로젝트, 수행업무
    SUMMARY = "summary"           # 자기소개, 요약
    STRENGTHS = "strengths"       # 핵심역량, 강점
    CERTIFICATIONS = "certifications"  # 자격증
    AWARDS = "awards"             # 수상경력
    LANGUAGES = "languages"       # 외국어
    UNKNOWN = "unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Mapping Dictionary: Raw Title → Canonical Label
# ─────────────────────────────────────────────────────────────────────────────

CANONICAL_LABEL_MAP: Dict[str, List[str]] = {
    CanonicalLabel.PROFILE: [
        # Korean
        "인적사항", "기본정보", "기본 정보", "개인정보", "개인 정보",
        "이름", "성명", "성함", "연락처", "소개",
        # English
        "profile", "personal info", "personal information", "contact", "about",
        "name", "full name", "contact info", "contact information",
    ],
    CanonicalLabel.CAREER: [
        # Korean
        "경력", "경력사항", "경력 사항", "주요경력", "주요 경력", "주요경력사항",
        "경력기술", "경력기술서", "이력", "이력사항", "업무경력", "업무 경력",
        "직장경력", "재직경력", "경력상세", "경력 상세",
        # English
        "career", "experience", "work experience", "employment", "employment history",
        "work history", "professional experience", "job history",
    ],
    CanonicalLabel.EDUCATION: [
        # Korean
        "학력", "학력사항", "학력 사항", "학교", "교육", "교육사항",
        "최종학력", "최종 학력",
        # English
        "education", "educational background", "academic", "academic background",
        "school", "university", "degree",
    ],
    CanonicalLabel.SKILLS: [
        # Korean
        "기술", "기술스택", "기술 스택", "보유기술", "보유 기술",
        "스킬", "역량", "기술역량", "전문기술", "핵심기술",
        # English
        "skills", "skill", "technical skills", "tech stack", "technologies",
        "competencies", "expertise",
    ],
    CanonicalLabel.PROJECTS: [
        # Korean
        "프로젝트", "프로젝트 경험", "프로젝트경험", "수행업무", "수행 업무",
        "주요프로젝트", "주요 프로젝트", "참여프로젝트", "담당업무",
        # English
        "projects", "project", "project experience", "key projects",
    ],
    CanonicalLabel.SUMMARY: [
        # Korean
        "자기소개", "자기 소개", "소개", "요약", "한줄소개",
        "지원동기", "경력요약", "경력 요약",
        # English
        "summary", "about me", "introduction", "overview", "objective",
        "professional summary",
    ],
    CanonicalLabel.STRENGTHS: [
        # Korean
        "핵심역량", "핵심 역량", "강점", "장점", "핵심강점", "핵심 강점",
        "역량", "주요역량", "주요 역량",
        # English
        "strengths", "key strengths", "core competencies", "highlights",
    ],
    CanonicalLabel.CERTIFICATIONS: [
        # Korean
        "자격증", "자격", "자격사항", "자격 사항", "면허", "자격면허",
        "취득자격", "보유자격",
        # English
        "certifications", "certificates", "licenses", "qualifications",
    ],
    CanonicalLabel.AWARDS: [
        # Korean
        "수상", "수상경력", "수상 경력", "수상내역", "수상 내역",
        # English
        "awards", "honors", "achievements",
    ],
    CanonicalLabel.LANGUAGES: [
        # Korean
        "외국어", "어학", "어학능력", "어학 능력", "언어", "언어능력",
        # English
        "languages", "language skills", "foreign languages",
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Reverse Lookup: Create flat dictionary for O(1) lookup
# ─────────────────────────────────────────────────────────────────────────────

def _build_reverse_map() -> Dict[str, str]:
    """Build reverse map: normalized_title → canonical_label"""
    reverse_map = {}
    for label, titles in CANONICAL_LABEL_MAP.items():
        for title in titles:
            # Normalize: lowercase, remove spaces
            normalized = title.lower().strip().replace(" ", "")
            reverse_map[normalized] = label
    return reverse_map

_REVERSE_MAP = _build_reverse_map()


def normalize_section_title(raw_title: str) -> str:
    """
    Convert a raw section title to its canonical label.
    
    Args:
        raw_title: Raw title from the document (e.g., "성명", "이름", "Name")
        
    Returns:
        Canonical label (e.g., "profile") or "unknown"
    """
    if not raw_title:
        return CanonicalLabel.UNKNOWN
    
    # Normalize input
    normalized = raw_title.lower().strip().replace(" ", "")
    
    # Direct lookup
    if normalized in _REVERSE_MAP:
        return _REVERSE_MAP[normalized]
    
    # Fuzzy match: check if any keyword is contained
    for label, titles in CANONICAL_LABEL_MAP.items():
        for title in titles:
            title_normalized = title.lower().replace(" ", "")
            if title_normalized in normalized or normalized in title_normalized:
                return label
    
    return CanonicalLabel.UNKNOWN


def get_all_keywords_for_label(label: str) -> List[str]:
    """Get all keywords associated with a canonical label"""
    return CANONICAL_LABEL_MAP.get(label, [])


# ─────────────────────────────────────────────────────────────────────────────
# Field Normalization (e.g., "이름" field → "name")
# ─────────────────────────────────────────────────────────────────────────────

FIELD_ALIASES: Dict[str, List[str]] = {
    "name": ["이름", "성명", "성함", "name", "full name", "fullname"],
    "email": ["이메일", "메일", "email", "e-mail", "mail"],
    "phone": ["전화", "전화번호", "휴대폰", "연락처", "phone", "mobile", "tel", "telephone"],
    "address": ["주소", "거주지", "address", "location"],
    "birth_year": ["생년", "생년월일", "출생", "birth", "birthday", "dob", "date of birth"],
}

_FIELD_REVERSE_MAP = {}
for field, aliases in FIELD_ALIASES.items():
    for alias in aliases:
        _FIELD_REVERSE_MAP[alias.lower().strip()] = field


def normalize_field_name(raw_field: str) -> str:
    """
    Convert a raw field name to its canonical field name.
    
    Args:
        raw_field: Raw field name (e.g., "성명", "이름")
        
    Returns:
        Canonical field name (e.g., "name") or original if not found
    """
    normalized = raw_field.lower().strip()
    return _FIELD_REVERSE_MAP.get(normalized, raw_field)
