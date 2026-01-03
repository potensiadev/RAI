"""
Validation Agent - Cross-Check 및 데이터 검증 에이전트

AnalystAgent의 결과를 추가 검증하고 신뢰도를 보정합니다.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """검증 결과"""
    success: bool
    validated_data: Dict[str, Any]
    confidence_adjustments: Dict[str, float] = field(default_factory=dict)
    validations: List[Dict[str, Any]] = field(default_factory=list)
    corrections: List[Dict[str, Any]] = field(default_factory=list)


class ValidationAgent:
    """
    데이터 검증 에이전트

    Features:
    - 파일명과 추출된 이름 교차 검증
    - 한국어 이름 패턴 검증
    - 연락처/이메일 형식 검증
    - 경력 연수 일관성 검증
    - 신뢰도 점수 보정
    """

    # 한국 이름 패턴 (2~4자 한글)
    KOREAN_NAME_PATTERN = re.compile(r'^[가-힣]{2,4}$')

    # 영문 이름 패턴
    ENGLISH_NAME_PATTERN = re.compile(r'^[A-Za-z\s\-\.]+$')

    # 전화번호 패턴 (한국)
    PHONE_PATTERN = re.compile(r'01[0-9][-\s]?\d{3,4}[-\s]?\d{4}')

    # 이메일 패턴
    EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')

    def __init__(self):
        pass

    def validate(
        self,
        analyzed_data: Dict[str, Any],
        original_text: str,
        filename: Optional[str] = None
    ) -> ValidationResult:
        """
        분석 결과 검증 및 보정

        Args:
            analyzed_data: AnalystAgent에서 추출한 데이터
            original_text: 원본 이력서 텍스트
            filename: 원본 파일명

        Returns:
            ValidationResult with validated data and confidence adjustments
        """
        logger.info("[ValidationAgent] 검증 시작")

        validated_data = analyzed_data.copy()
        confidence_adjustments = {}
        validations = []
        corrections = []

        # 1. 이름 검증 및 보정
        name_result = self._validate_name(
            analyzed_data.get("name"),
            original_text,
            filename
        )
        validations.append({"field": "name", "result": name_result})

        if name_result.get("corrected"):
            validated_data["name"] = name_result["value"]
            corrections.append({
                "field": "name",
                "original": analyzed_data.get("name"),
                "corrected": name_result["value"],
                "reason": name_result["reason"]
            })
        confidence_adjustments["name"] = name_result.get("confidence_boost", 0)

        # 2. 연락처 검증
        phone_result = self._validate_phone(
            analyzed_data.get("phone"),
            original_text
        )
        validations.append({"field": "phone", "result": phone_result})

        if phone_result.get("corrected"):
            validated_data["phone"] = phone_result["value"]
            corrections.append({
                "field": "phone",
                "original": analyzed_data.get("phone"),
                "corrected": phone_result["value"],
                "reason": "원본 텍스트에서 재추출"
            })
        confidence_adjustments["phone"] = phone_result.get("confidence_boost", 0)

        # 3. 이메일 검증
        email_result = self._validate_email(
            analyzed_data.get("email"),
            original_text
        )
        validations.append({"field": "email", "result": email_result})

        if email_result.get("corrected"):
            validated_data["email"] = email_result["value"]
            corrections.append({
                "field": "email",
                "original": analyzed_data.get("email"),
                "corrected": email_result["value"],
                "reason": "원본 텍스트에서 재추출"
            })
        confidence_adjustments["email"] = email_result.get("confidence_boost", 0)

        # 4. 경력 연수 일관성 검증
        exp_result = self._validate_experience(
            analyzed_data.get("exp_years"),
            analyzed_data.get("careers", [])
        )
        validations.append({"field": "exp_years", "result": exp_result})
        confidence_adjustments["exp_years"] = exp_result.get("confidence_boost", 0)

        # 5. 스킬 검증 (빈 배열 체크)
        skills_result = self._validate_skills(
            analyzed_data.get("skills", []),
            original_text
        )
        validations.append({"field": "skills", "result": skills_result})

        if skills_result.get("extracted_skills"):
            validated_data["skills"] = skills_result["extracted_skills"]
            corrections.append({
                "field": "skills",
                "original": analyzed_data.get("skills", []),
                "corrected": skills_result["extracted_skills"],
                "reason": "원본 텍스트에서 기술 스택 재추출"
            })

        logger.info(f"[ValidationAgent] 검증 완료 - 보정 {len(corrections)}건")

        return ValidationResult(
            success=True,
            validated_data=validated_data,
            confidence_adjustments=confidence_adjustments,
            validations=validations,
            corrections=corrections
        )

    def _validate_name(
        self,
        extracted_name: Optional[str],
        text: str,
        filename: Optional[str]
    ) -> Dict[str, Any]:
        """이름 검증 및 파일명 교차 확인"""
        result = {"valid": False, "confidence_boost": 0}

        # 파일명에서 이름 추출
        filename_name = None
        if filename:
            # 확장자 및 일반 키워드 제거
            name_part = re.sub(r'\.(pdf|hwp|hwpx|doc|docx)$', '', filename, flags=re.IGNORECASE)
            name_part = re.sub(r'[_\-\s]*(이력서|경력기술서|resume|cv|자기소개서|지원서).*', '', name_part, flags=re.IGNORECASE)
            name_part = re.sub(r'_\d{6,}.*$', '', name_part)  # 날짜 형식 제거
            name_part = name_part.strip('_- ')

            # 한글 이름 패턴 확인
            if self.KOREAN_NAME_PATTERN.match(name_part):
                filename_name = name_part
                logger.info(f"[ValidationAgent] 파일명에서 이름 추출: {filename_name}")

        # 추출된 이름 검증
        if extracted_name:
            # 한국어 이름 패턴 체크
            if self.KOREAN_NAME_PATTERN.match(extracted_name):
                result["valid"] = True
                result["value"] = extracted_name

                # 파일명과 일치하면 신뢰도 상승
                if filename_name and extracted_name == filename_name:
                    result["confidence_boost"] = 0.2
                    result["reason"] = "파일명과 일치"
                    logger.info(f"[ValidationAgent] ✅ 이름 확인 (파일명 일치): {extracted_name}")
                else:
                    result["confidence_boost"] = 0.1
                    result["reason"] = "유효한 한국어 이름"

            # 영문 이름 체크
            elif self.ENGLISH_NAME_PATTERN.match(extracted_name):
                result["valid"] = True
                result["value"] = extracted_name
                result["confidence_boost"] = 0.05
                result["reason"] = "유효한 영문 이름"

        # 추출 실패했지만 파일명에서 발견된 경우
        if not result.get("valid") and filename_name:
            result["valid"] = True
            result["corrected"] = True
            result["value"] = filename_name
            result["confidence_boost"] = 0.15
            result["reason"] = "파일명에서 이름 추출"
            logger.info(f"[ValidationAgent] 📝 파일명에서 이름 보정: {filename_name}")

        # 여전히 이름이 없으면 텍스트에서 첫 번째 한글 이름 패턴 찾기
        if not result.get("valid"):
            # 문서 처음 100자에서 이름 패턴 찾기
            first_part = text[:200]
            korean_names = re.findall(r'[가-힣]{2,4}', first_part)

            for name in korean_names:
                # 일반 단어 제외 (이력서, 경력 등)
                if name not in ['이력서', '경력서', '자기소', '개서', '성명', '이름', '생년월', '휴대폰', '이메일', '주소']:
                    result["valid"] = True
                    result["corrected"] = True
                    result["value"] = name
                    result["confidence_boost"] = 0.05
                    result["reason"] = "텍스트 상단에서 추출"
                    logger.info(f"[ValidationAgent] 📝 텍스트에서 이름 추출: {name}")
                    break

        return result

    def _validate_phone(self, extracted_phone: Optional[str], text: str) -> Dict[str, Any]:
        """전화번호 검증"""
        result = {"valid": False, "confidence_boost": 0}

        if extracted_phone:
            # 숫자만 추출
            digits = re.sub(r'\D', '', extracted_phone)
            if len(digits) >= 10 and len(digits) <= 11:
                result["valid"] = True
                result["value"] = extracted_phone
                result["confidence_boost"] = 0.1

        # 추출 실패 시 텍스트에서 재추출
        if not result.get("valid"):
            phones = self.PHONE_PATTERN.findall(text)
            if phones:
                result["valid"] = True
                result["corrected"] = True
                result["value"] = phones[0]
                result["confidence_boost"] = 0.05

        return result

    def _validate_email(self, extracted_email: Optional[str], text: str) -> Dict[str, Any]:
        """이메일 검증"""
        result = {"valid": False, "confidence_boost": 0}

        if extracted_email:
            if self.EMAIL_PATTERN.match(extracted_email):
                result["valid"] = True
                result["value"] = extracted_email
                result["confidence_boost"] = 0.1

        # 추출 실패 시 텍스트에서 재추출
        if not result.get("valid"):
            emails = self.EMAIL_PATTERN.findall(text)
            if emails:
                result["valid"] = True
                result["corrected"] = True
                result["value"] = emails[0]
                result["confidence_boost"] = 0.05

        return result

    def _validate_experience(
        self,
        exp_years: Optional[float],
        careers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """경력 연수 일관성 검증"""
        result = {"valid": True, "confidence_boost": 0}

        if not careers:
            if exp_years and exp_years > 0:
                result["valid"] = False
                result["warning"] = "경력 연수가 있지만 경력 목록이 비어있음"
            return result

        # 경력 목록에서 연수 계산
        calculated_years = 0
        current_year = 2026  # 현재 연도

        for career in careers:
            start = career.get("start_date")
            end = career.get("end_date")

            if start:
                try:
                    start_year = int(start.split("-")[0]) if "-" in str(start) else int(str(start)[:4])

                    if career.get("is_current") or end is None:
                        end_year = current_year
                    else:
                        end_year = int(end.split("-")[0]) if "-" in str(end) else int(str(end)[:4])

                    years = end_year - start_year
                    if years > 0:
                        calculated_years += years
                except (ValueError, IndexError):
                    pass

        # 비교
        if exp_years and calculated_years > 0:
            diff = abs(exp_years - calculated_years)
            if diff <= 1:
                result["confidence_boost"] = 0.1
            elif diff <= 3:
                result["confidence_boost"] = 0.05
            else:
                result["valid"] = False
                result["warning"] = f"경력 연수 불일치: 입력 {exp_years}년, 계산 {calculated_years}년"

        return result

    def _validate_skills(
        self,
        extracted_skills: List[str],
        text: str
    ) -> Dict[str, Any]:
        """스킬 검증 및 보완"""
        result = {"valid": True}

        # 일반적인 기술 스택 키워드
        tech_keywords = [
            # 언어
            "Python", "Java", "JavaScript", "TypeScript", "Go", "Rust", "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin",
            # 프레임워크
            "React", "Vue", "Angular", "Next.js", "Django", "Flask", "Spring", "Node.js", "Express",
            # 데이터베이스
            "MySQL", "PostgreSQL", "MongoDB", "Redis", "Oracle", "SQL Server",
            # 클라우드/인프라
            "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform",
            # 도구
            "Git", "Jira", "Confluence", "Slack", "Figma", "Notion",
            # 한국어 표기
            "파이썬", "자바", "리액트", "뷰", "노드",
        ]

        # 스킬이 비어있거나 너무 적은 경우 텍스트에서 추출
        if len(extracted_skills) < 3:
            found_skills = set(extracted_skills)

            for keyword in tech_keywords:
                if re.search(rf'\b{re.escape(keyword)}\b', text, re.IGNORECASE):
                    found_skills.add(keyword)

            if len(found_skills) > len(extracted_skills):
                result["extracted_skills"] = list(found_skills)
                result["confidence_boost"] = 0.05

        return result


# 싱글톤 인스턴스
_validation_agent: Optional[ValidationAgent] = None


def get_validation_agent() -> ValidationAgent:
    """ValidationAgent 싱글톤 인스턴스 반환"""
    global _validation_agent
    if _validation_agent is None:
        _validation_agent = ValidationAgent()
    return _validation_agent
