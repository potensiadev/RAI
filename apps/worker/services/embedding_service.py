"""
Embedding Service - 청킹 + Vector Embedding

이력서 데이터를 의미 단위로 청킹하고 임베딩 생성
OpenAI text-embedding-3-small 사용
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

from openai import AsyncOpenAI

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ChunkType(str, Enum):
    """청크 유형"""
    SUMMARY = "summary"       # 전체 요약
    CAREER = "career"         # 개별 경력
    PROJECT = "project"       # 개별 프로젝트
    SKILL = "skill"           # 기술 스택
    EDUCATION = "education"   # 학력


@dataclass
class Chunk:
    """청크 데이터"""
    chunk_type: ChunkType
    chunk_index: int          # 같은 타입 내 순서
    content: str              # 청크 내용
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_type": self.chunk_type.value,
            "chunk_index": self.chunk_index,
            "content": self.content,
            "metadata": self.metadata,
            "has_embedding": self.embedding is not None
        }


@dataclass
class EmbeddingResult:
    """임베딩 결과"""
    success: bool
    chunks: List[Chunk] = field(default_factory=list)
    total_tokens: int = 0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "chunk_count": len(self.chunks),
            "chunks": [c.to_dict() for c in self.chunks],
            "total_tokens": self.total_tokens,
            "error": self.error
        }


class EmbeddingService:
    """
    임베딩 서비스

    청킹 전략:
    1. Summary: 전체 요약 + 핵심 정보 (1개)
    2. Career: 각 경력별 개별 청크 (N개)
    3. Project: 각 프로젝트별 개별 청크 (N개)
    4. Skill: 기술 스택 그룹핑 (1개)
    5. Education: 학력 정보 (1개)

    → 검색 시 청크 타입별 가중치 적용 가능
    """

    # 임베딩 모델
    EMBEDDING_MODEL = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS = 1536

    # 청크 최대 길이 (토큰 기준, 대략 문자 수로 환산)
    MAX_CHUNK_CHARS = 2000

    def __init__(self):
        self.client = None
        if settings.OPENAI_API_KEY:
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def create_embedding(self, text: str) -> Optional[List[float]]:
        """단일 텍스트 임베딩 생성"""
        if not self.client:
            logger.error("OpenAI client not initialized")
            return None

        try:
            response = await self.client.embeddings.create(
                model=self.EMBEDDING_MODEL,
                input=text[:8000]  # 토큰 제한
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Embedding creation failed: {e}")
            return None

    async def create_embeddings_batch(
        self,
        texts: List[str]
    ) -> List[Optional[List[float]]]:
        """배치 임베딩 생성"""
        if not self.client:
            return [None] * len(texts)

        try:
            # 텍스트 길이 제한
            truncated = [t[:8000] for t in texts]

            response = await self.client.embeddings.create(
                model=self.EMBEDDING_MODEL,
                input=truncated
            )

            # 인덱스 순서대로 정렬
            embeddings = [None] * len(texts)
            for item in response.data:
                embeddings[item.index] = item.embedding

            return embeddings

        except Exception as e:
            logger.error(f"Batch embedding failed: {e}")
            return [None] * len(texts)

    async def process_candidate(
        self,
        data: Dict[str, Any],
        generate_embeddings: bool = True
    ) -> EmbeddingResult:
        """
        후보자 데이터를 청킹하고 임베딩 생성

        Args:
            data: 분석된 이력서 데이터
            generate_embeddings: 임베딩 생성 여부

        Returns:
            EmbeddingResult with chunks and embeddings
        """
        try:
            # 1. 청크 생성
            chunks = self._create_chunks(data)

            if not chunks:
                return EmbeddingResult(
                    success=False,
                    error="No chunks created"
                )

            # 2. 임베딩 생성 (옵션)
            total_tokens = 0

            if generate_embeddings and self.client:
                texts = [c.content for c in chunks]
                embeddings = await self.create_embeddings_batch(texts)

                for i, embedding in enumerate(embeddings):
                    chunks[i].embedding = embedding

                # 토큰 수 추정 (대략 4 문자 = 1 토큰)
                total_tokens = sum(len(t) // 4 for t in texts)

            return EmbeddingResult(
                success=True,
                chunks=chunks,
                total_tokens=total_tokens
            )

        except Exception as e:
            logger.error(f"Candidate processing failed: {e}")
            return EmbeddingResult(
                success=False,
                error=str(e)
            )

    def _create_chunks(self, data: Dict[str, Any]) -> List[Chunk]:
        """후보자 데이터에서 청크 생성"""
        chunks = []

        # 1. Summary 청크 (전체 요약)
        summary_chunk = self._build_summary_chunk(data)
        if summary_chunk:
            chunks.append(summary_chunk)

        # 2. Career 청크 (각 경력별)
        career_chunks = self._build_career_chunks(data)
        chunks.extend(career_chunks)

        # 3. Project 청크 (각 프로젝트별)
        project_chunks = self._build_project_chunks(data)
        chunks.extend(project_chunks)

        # 4. Skill 청크 (기술 스택)
        skill_chunk = self._build_skill_chunk(data)
        if skill_chunk:
            chunks.append(skill_chunk)

        # 5. Education 청크 (학력)
        education_chunk = self._build_education_chunk(data)
        if education_chunk:
            chunks.append(education_chunk)

        return chunks

    def _build_summary_chunk(self, data: Dict[str, Any]) -> Optional[Chunk]:
        """Summary 청크 생성"""
        parts = []

        # 이름과 경력
        if data.get("name"):
            parts.append(f"이름: {data['name']}")

        if data.get("exp_years"):
            parts.append(f"총 경력: {data['exp_years']}년")

        if data.get("last_company"):
            parts.append(f"최근 직장: {data['last_company']}")

        if data.get("last_position"):
            parts.append(f"최근 직책: {data['last_position']}")

        # 요약
        if data.get("summary"):
            parts.append(f"\n요약: {data['summary']}")

        # 강점
        if data.get("strengths"):
            strengths = data["strengths"]
            if isinstance(strengths, list):
                parts.append(f"\n강점: {', '.join(strengths)}")

        # 핵심 스킬 (상위 5개)
        if data.get("skills"):
            skills = data["skills"][:5] if isinstance(data["skills"], list) else []
            if skills:
                parts.append(f"\n핵심 기술: {', '.join(skills)}")

        content = "\n".join(parts)

        if not content.strip():
            return None

        return Chunk(
            chunk_type=ChunkType.SUMMARY,
            chunk_index=0,
            content=content[:self.MAX_CHUNK_CHARS],
            metadata={
                "name": data.get("name"),
                "exp_years": data.get("exp_years"),
                "last_company": data.get("last_company"),
            }
        )

    def _build_career_chunks(self, data: Dict[str, Any]) -> List[Chunk]:
        """Career 청크들 생성 (각 경력별)"""
        chunks = []
        careers = data.get("careers", [])

        if not isinstance(careers, list):
            return chunks

        for i, career in enumerate(careers):
            if not isinstance(career, dict):
                continue

            parts = []

            company = career.get("company", "")
            if company:
                parts.append(f"회사: {company}")

            position = career.get("position")
            if position:
                parts.append(f"직책: {position}")

            department = career.get("department")
            if department:
                parts.append(f"부서: {department}")

            # 기간
            start = career.get("start_date", "")
            end = career.get("end_date", "현재" if career.get("is_current") else "")
            if start or end:
                parts.append(f"기간: {start} ~ {end}")

            # 업무 내용
            description = career.get("description")
            if description:
                parts.append(f"\n업무 내용:\n{description}")

            content = "\n".join(parts)

            if content.strip():
                chunks.append(Chunk(
                    chunk_type=ChunkType.CAREER,
                    chunk_index=i,
                    content=content[:self.MAX_CHUNK_CHARS],
                    metadata={
                        "company": company,
                        "position": position,
                        "is_current": career.get("is_current", False),
                        "start_date": start,
                        "end_date": end if end != "현재" else None,
                    }
                ))

        return chunks

    def _build_project_chunks(self, data: Dict[str, Any]) -> List[Chunk]:
        """Project 청크들 생성 (각 프로젝트별)"""
        chunks = []
        projects = data.get("projects", [])

        if not isinstance(projects, list):
            return chunks

        for i, project in enumerate(projects):
            if not isinstance(project, dict):
                continue

            parts = []

            name = project.get("name", "")
            if name:
                parts.append(f"프로젝트: {name}")

            role = project.get("role")
            if role:
                parts.append(f"역할: {role}")

            period = project.get("period")
            if period:
                parts.append(f"기간: {period}")

            # 사용 기술
            technologies = project.get("technologies", [])
            if technologies and isinstance(technologies, list):
                parts.append(f"기술: {', '.join(technologies)}")

            # 설명
            description = project.get("description")
            if description:
                parts.append(f"\n설명:\n{description}")

            content = "\n".join(parts)

            if content.strip():
                chunks.append(Chunk(
                    chunk_type=ChunkType.PROJECT,
                    chunk_index=i,
                    content=content[:self.MAX_CHUNK_CHARS],
                    metadata={
                        "project_name": name,
                        "role": role,
                        "technologies": technologies,
                    }
                ))

        return chunks

    def _build_skill_chunk(self, data: Dict[str, Any]) -> Optional[Chunk]:
        """Skill 청크 생성"""
        skills = data.get("skills", [])

        if not skills or not isinstance(skills, list):
            return None

        # 스킬 카테고리화 (간단한 분류)
        categorized = self._categorize_skills(skills)

        parts = ["기술 스택"]

        for category, category_skills in categorized.items():
            if category_skills:
                parts.append(f"\n{category}: {', '.join(category_skills)}")

        content = "\n".join(parts)

        return Chunk(
            chunk_type=ChunkType.SKILL,
            chunk_index=0,
            content=content[:self.MAX_CHUNK_CHARS],
            metadata={
                "skill_count": len(skills),
                "skills": skills[:20],  # 상위 20개만 메타데이터에
            }
        )

    def _categorize_skills(self, skills: List[str]) -> Dict[str, List[str]]:
        """스킬 카테고리화"""
        categories = {
            "프로그래밍": [],
            "프레임워크": [],
            "데이터베이스": [],
            "클라우드/인프라": [],
            "기타": [],
        }

        programming = {"python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "kotlin", "swift", "php", "ruby"}
        frameworks = {"react", "vue", "angular", "next.js", "spring", "django", "flask", "fastapi", "express", "node.js"}
        databases = {"mysql", "postgresql", "mongodb", "redis", "oracle", "sqlite", "elasticsearch"}
        cloud = {"aws", "gcp", "azure", "docker", "kubernetes", "terraform", "jenkins", "ci/cd"}

        for skill in skills:
            skill_lower = skill.lower()

            if any(p in skill_lower for p in programming):
                categories["프로그래밍"].append(skill)
            elif any(f in skill_lower for f in frameworks):
                categories["프레임워크"].append(skill)
            elif any(d in skill_lower for d in databases):
                categories["데이터베이스"].append(skill)
            elif any(c in skill_lower for c in cloud):
                categories["클라우드/인프라"].append(skill)
            else:
                categories["기타"].append(skill)

        # 빈 카테고리 제거
        return {k: v for k, v in categories.items() if v}

    def _build_education_chunk(self, data: Dict[str, Any]) -> Optional[Chunk]:
        """Education 청크 생성"""
        parts = []

        # 최종 학력
        if data.get("education_level"):
            level_map = {
                "high_school": "고졸",
                "associate": "전문학사",
                "bachelor": "학사",
                "master": "석사",
                "doctor": "박사"
            }
            level = level_map.get(data["education_level"], data["education_level"])
            parts.append(f"최종 학력: {level}")

        if data.get("education_school"):
            parts.append(f"학교: {data['education_school']}")

        if data.get("education_major"):
            parts.append(f"전공: {data['education_major']}")

        # 상세 학력
        educations = data.get("educations", [])
        if educations and isinstance(educations, list):
            parts.append("\n학력 상세:")
            for edu in educations:
                if isinstance(edu, dict):
                    edu_line = []
                    if edu.get("school"):
                        edu_line.append(edu["school"])
                    if edu.get("major"):
                        edu_line.append(edu["major"])
                    if edu.get("degree"):
                        edu_line.append(edu["degree"])
                    if edu.get("graduation_year"):
                        edu_line.append(f"({edu['graduation_year']})")

                    if edu_line:
                        parts.append(f"- {' / '.join(edu_line)}")

        content = "\n".join(parts)

        if not content.strip():
            return None

        return Chunk(
            chunk_type=ChunkType.EDUCATION,
            chunk_index=0,
            content=content[:self.MAX_CHUNK_CHARS],
            metadata={
                "education_level": data.get("education_level"),
                "school": data.get("education_school"),
                "major": data.get("education_major"),
            }
        )


# 싱글톤 인스턴스
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Embedding Service 싱글톤 인스턴스 반환"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
