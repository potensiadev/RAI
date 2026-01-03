"""
Resume JSON Schemas for Structured Outputs

Multi-Agent Architecture:
- Profile Schema: Basic info (ProfileAgent)
- Career Schema: Work experience (CareerAgent)
- Spec Schema: Education, Skills, Projects (SpecAgent)
- Summary Schema: Analysis & Summary (SummaryAgent)
"""

from typing import Dict, Any

# ─────────────────────────────────────────────────────────────────────────────
# 1. Profile Schema (Basic Info)
# ─────────────────────────────────────────────────────────────────────────────
PROFILE_SCHEMA: Dict[str, Any] = {
    "name": "profile_extraction",
    "description": "Extract candidate's personal profile information",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "name": {"type": ["string", "null"], "description": "후보자 이름"},
            "birth_year": {"type": ["integer", "null"], "description": "출생 연도 (4자리)"},
            "gender": {"type": ["string", "null"], "description": "성별 (male/female)"},
            "phone": {"type": ["string", "null"], "description": "휴대폰 번호"},
            "email": {"type": ["string", "null"], "description": "이메일 주소"},
            "address": {"type": ["string", "null"], "description": "거주지 주소"},
            "location_city": {"type": ["string", "null"], "description": "거주 도시"},
        },
        "required": ["name", "birth_year", "gender", "phone", "email", "address", "location_city"],
        "additionalProperties": False
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. Career Schema (Work Experience)
# ─────────────────────────────────────────────────────────────────────────────
CAREER_SCHEMA: Dict[str, Any] = {
    "name": "career_extraction",
    "description": "Extract candidate's work experience and career history",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "exp_years": {"type": "number", "description": "총 경력 연수"},
            "last_company": {"type": ["string", "null"], "description": "최근 직장명"},
            "last_position": {"type": ["string", "null"], "description": "최근 직책"},
            "careers": {
                "type": "array",
                "description": "경력 목록",
                "items": {
                    "type": "object",
                    "properties": {
                        "company": {"type": "string", "description": "회사명"},
                        "position": {"type": ["string", "null"], "description": "직책"},
                        "department": {"type": ["string", "null"], "description": "부서"},
                        "start_date": {"type": ["string", "null"], "description": "입사일 (YYYY-MM)"},
                        "end_date": {"type": ["string", "null"], "description": "퇴사일 (YYYY-MM)"},
                        "is_current": {"type": "boolean", "description": "현재 재직 여부"},
                        "description": {"type": ["string", "null"], "description": "업무 내용"}
                    },
                    "required": ["company", "position", "department", "start_date", "end_date", "is_current", "description"],
                    "additionalProperties": False
                }
            }
        },
        "required": ["exp_years", "last_company", "last_position", "careers"],
        "additionalProperties": False
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Spec Schema (Education, Skills, Projects)
# ─────────────────────────────────────────────────────────────────────────────
SPEC_SCHEMA: Dict[str, Any] = {
    "name": "spec_extraction",
    "description": "Extract candidate's education, skills, and projects",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "education_level": {"type": ["string", "null"], "description": "최종 학력"},
            "education_school": {"type": ["string", "null"], "description": "최종 학교명"},
            "education_major": {"type": ["string", "null"], "description": "전공"},
            "educations": {
                "type": "array",
                "description": "학력 목록",
                "items": {
                    "type": "object",
                    "properties": {
                        "school": {"type": "string", "description": "학교명"},
                        "degree": {"type": ["string", "null"], "description": "학위"},
                        "major": {"type": ["string", "null"], "description": "전공"},
                        "graduation_year": {"type": ["integer", "null"], "description": "졸업 연도"},
                        "is_graduated": {"type": "boolean", "description": "졸업 여부"}
                    },
                    "required": ["school", "degree", "major", "graduation_year", "is_graduated"],
                    "additionalProperties": False
                }
            },
            "skills": {"type": "array", "description": "기술 스택 목록", "items": {"type": "string"}},
            "projects": {
                "type": "array",
                "description": "프로젝트 목록",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "프로젝트명"},
                        "role": {"type": ["string", "null"], "description": "역할"},
                        "period": {"type": ["string", "null"], "description": "기간"},
                        "description": {"type": ["string", "null"], "description": "설명"},
                        "technologies": {"type": "array", "items": {"type": "string"}, "description": "사용 기술"}
                    },
                    "required": ["name", "role", "period", "description", "technologies"],
                    "additionalProperties": False
                }
            },
            "portfolio_url": {"type": ["string", "null"], "description": "포트폴리오 URL"},
            "github_url": {"type": ["string", "null"], "description": "GitHub URL"},
            "linkedin_url": {"type": ["string", "null"], "description": "LinkedIn URL"}
        },
        "required": [
            "education_level", "education_school", "education_major", "educations",
            "skills", "projects", "portfolio_url", "github_url", "linkedin_url"
        ],
        "additionalProperties": False
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. Summary Schema
# ─────────────────────────────────────────────────────────────────────────────
SUMMARY_SCHEMA: Dict[str, Any] = {
    "name": "summary_generation",
    "description": "Generate summary and analysis of the candidate",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "후보자 요약 (300자 이내)"},
            "strengths": {"type": "array", "description": "주요 강점 3~5가지", "items": {"type": "string"}}
        },
        "required": ["summary", "strengths"],
        "additionalProperties": False
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Common Prompt
# ─────────────────────────────────────────────────────────────────────────────
RESUME_SCHEMA_PROMPT = """
## 한국 이력서/경력기술서 추출 가이드

### 중요: 한국 이력서의 특성
- 이름: "이름:" 라벨 없이 "김경민" 처럼 단독으로 표시됨 (문서 상단/헤더)
- 파일명에서 이름 추론 가능 (예: "김경민_이력서.pdf")
- 경력: 최신순으로 정렬되어 있을 수 있음
- 날짜: YYYY.MM 또는 YYYY-MM 형식 준수

### 추출 원칙
- 명시적 라벨이 없어도 문맥을 통해 추론하세요.
- 정보가 없으면 명시적으로 null을 반환하세요.
- 반드시 JSON 포맷을 준수하세요.
"""
