"""
Resume JSON Schema for Structured Outputs

이력서 분석 결과를 위한 JSON 스키마 정의
OpenAI Structured Outputs와 호환
"""

from typing import Dict, Any

# OpenAI Structured Outputs용 JSON 스키마
# strict: true일 때 모든 properties가 required에 포함되어야 함
RESUME_JSON_SCHEMA: Dict[str, Any] = {
    "name": "resume_extraction",
    "description": "Extract structured information from a resume",
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
                        "start_date": {"type": ["string", "null"], "description": "입사일"},
                        "end_date": {"type": ["string", "null"], "description": "퇴사일"},
                        "is_current": {"type": "boolean", "description": "현재 재직 여부"},
                        "description": {"type": ["string", "null"], "description": "업무 내용"}
                    },
                    "required": ["company", "position", "department", "start_date", "end_date", "is_current", "description"],
                    "additionalProperties": False
                }
            },
            "skills": {"type": "array", "description": "기술 스택 목록", "items": {"type": "string"}},
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
            "summary": {"type": ["string", "null"], "description": "후보자 요약 (300자 이내)"},
            "strengths": {"type": "array", "description": "강점 목록", "items": {"type": "string"}},
            "portfolio_url": {"type": ["string", "null"], "description": "포트폴리오 URL"},
            "github_url": {"type": ["string", "null"], "description": "GitHub URL"},
            "linkedin_url": {"type": ["string", "null"], "description": "LinkedIn URL"}
        },
        "required": [
            "name", "birth_year", "gender", "phone", "email", "address", "location_city",
            "exp_years", "last_company", "last_position", "careers", "skills",
            "education_level", "education_school", "education_major", "educations",
            "projects", "summary", "strengths", "portfolio_url", "github_url", "linkedin_url"
        ],
        "additionalProperties": False
    }
}

RESUME_SCHEMA_PROMPT = """
## 한국 이력서/경력기술서 추출 가이드

### 중요: 한국 이력서의 특성
- 이름: "이름:" 라벨 없이 "김경민" 처럼 단독으로 표시됨
- 문서 최상단/헤더에 이름 위치
- 이름은 2~4글자 한글 또는 영문

### 이름 추출 우선순위
1. 문서 최상단의 한글 이름 (2~4글자)
2. "성명", "이름" 라벨 옆의 값
3. 파일명에서 추출 (예: "김경민_이력서.pdf" → "김경민")

### 추출 규칙
- 명시적 라벨 없어도 문맥에서 추론
- 정보 없으면 null 반환
- 경력연수는 경력 기간 합산

반드시 유효한 JSON만 출력하세요.
"""
