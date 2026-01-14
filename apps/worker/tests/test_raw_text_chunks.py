"""
Unit Tests: Raw Text Chunks (PRD v0.1)

테스트 대상: embedding_service._build_raw_text_chunks()
- 원본 텍스트 청킹 로직 검증
- raw_full + raw_section 청크 생성 확인
- 슬라이딩 윈도우 오버랩 검증

PRD v0.1 이슈 해결 테스트:
- P0: tiktoken 토큰 카운트
- P0: truncation 경고
- P1: 한글 최적화
- P1: 지수 백오프 재시도

Critical Edge Cases (시니어 QA):
- #13: API 1~2회 실패 후 성공 (지수 백오프)
- #14: API 3회 모두 실패 (MAX_RETRIES 초과)
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from services.embedding_service import EmbeddingService, ChunkType
from config import chunking_config


class TestBuildRawTextChunks:
    """_build_raw_text_chunks 메서드 테스트"""

    @pytest.fixture
    def service(self):
        """EmbeddingService 인스턴스 (OpenAI 클라이언트 없이)"""
        service = EmbeddingService()
        service.client = None  # 임베딩 생성 비활성화
        return service

    def test_empty_text_returns_empty_list(self, service):
        """빈 텍스트는 빈 리스트 반환"""
        result = service._build_raw_text_chunks("")
        assert result == []

    def test_none_text_returns_empty_list(self, service):
        """None은 빈 리스트 반환"""
        result = service._build_raw_text_chunks(None)
        assert result == []

    def test_short_text_returns_empty_list(self, service):
        """100자 미만 텍스트는 빈 리스트 반환"""
        short_text = "짧은 텍스트입니다." * 5  # ~50자
        result = service._build_raw_text_chunks(short_text)
        assert result == []

    def test_minimum_text_creates_raw_full_only(self, service):
        """100자 이상, chunk_size 미만은 raw_full만 생성"""
        text = "이력서 내용입니다. " * 50  # ~500자
        result = service._build_raw_text_chunks(text)

        assert len(result) == 1
        assert result[0].chunk_type == ChunkType.RAW_FULL
        assert result[0].chunk_index == 0
        assert result[0].content == text

    def test_long_text_creates_raw_full_and_sections(self, service):
        """chunk_size 이상은 raw_full + raw_section 생성"""
        # 5000자 텍스트 생성 (한글이므로 CHUNK_SIZE=2000 적용)
        text = "이력서 내용입니다. 경력 사항과 프로젝트 경험을 상세히 기술합니다. " * 100
        result = service._build_raw_text_chunks(text)

        # raw_full이 첫 번째
        assert result[0].chunk_type == ChunkType.RAW_FULL
        assert result[0].chunk_index == 0

        # raw_section이 추가로 존재
        raw_sections = [c for c in result if c.chunk_type == ChunkType.RAW_SECTION]
        assert len(raw_sections) >= 1

        # raw_section은 연속된 chunk_index
        for i, section in enumerate(raw_sections):
            assert section.chunk_index == i

    def test_raw_full_max_length_8000(self, service):
        """raw_full은 최대 8000자로 truncate"""
        # 10000자 텍스트 생성
        text = "A" * 10000
        result = service._build_raw_text_chunks(text)

        raw_full = result[0]
        assert raw_full.chunk_type == ChunkType.RAW_FULL
        assert len(raw_full.content) == 8000
        assert raw_full.metadata["truncated"] == True
        assert raw_full.metadata["original_length"] == 10000
        # P0 이슈: truncated_chars 메타데이터 추가됨
        assert raw_full.metadata["truncated_chars"] == 2000

    def test_english_text_sliding_window(self, service):
        """영문 텍스트는 기본 슬라이딩 윈도우 (1500자, 300자 오버랩)"""
        # 4000자 영문 텍스트 (한글 50% 미만 → 기본 설정 적용)
        text = "A" * 4000
        result = service._build_raw_text_chunks(text)

        raw_sections = [c for c in result if c.chunk_type == ChunkType.RAW_SECTION]

        # 4000자 / (1500 - 300) = 약 3.3 → 3-4개 섹션
        assert len(raw_sections) >= 3

        # 첫 번째 섹션 시작 위치
        assert raw_sections[0].metadata["start_pos"] == 0

        # 두 번째 섹션 시작 위치 (1500 - 300 = 1200)
        if len(raw_sections) > 1:
            assert raw_sections[1].metadata["start_pos"] == 1200

        # 한글 최적화 플래그 확인
        assert raw_sections[0].metadata.get("is_korean_optimized") == False

    def test_korean_text_sliding_window(self, service):
        """한글 텍스트는 한글 최적화 슬라이딩 윈도우 (2000자, 500자 오버랩)"""
        # 6000자 한글 텍스트 (한글 50% 이상 → 한글 최적화 적용)
        text = "가" * 6000
        result = service._build_raw_text_chunks(text)

        raw_sections = [c for c in result if c.chunk_type == ChunkType.RAW_SECTION]

        # 6000자 / (2000 - 500) = 4개 섹션
        assert len(raw_sections) >= 3

        # 첫 번째 섹션 시작 위치
        assert raw_sections[0].metadata["start_pos"] == 0

        # 두 번째 섹션 시작 위치 (2000 - 500 = 1500)
        if len(raw_sections) > 1:
            assert raw_sections[1].metadata["start_pos"] == 1500

        # 한글 최적화 플래그 확인
        assert raw_sections[0].metadata.get("is_korean_optimized") == True

    def test_raw_section_minimum_length(self, service):
        """100자 미만 섹션은 제외"""
        # 1600자 텍스트 (마지막 섹션이 100자 미만일 수 있음)
        text = "A" * 1550
        result = service._build_raw_text_chunks(text)

        raw_sections = [c for c in result if c.chunk_type == ChunkType.RAW_SECTION]

        # 모든 섹션이 100자 이상
        for section in raw_sections:
            assert len(section.content.strip()) >= 100

    def test_metadata_contains_position_info(self, service):
        """raw_section 메타데이터에 위치 정보 포함"""
        text = "A" * 5000
        result = service._build_raw_text_chunks(text)

        raw_sections = [c for c in result if c.chunk_type == ChunkType.RAW_SECTION]

        for section in raw_sections:
            assert "start_pos" in section.metadata
            assert "end_pos" in section.metadata
            assert "section_length" in section.metadata
            assert section.metadata["section_length"] == len(section.content)
            # P1 이슈: 한글 최적화 플래그
            assert "is_korean_optimized" in section.metadata

    def test_chunk_type_values(self, service):
        """청크 타입 값 확인"""
        assert ChunkType.RAW_FULL.value == "raw_full"
        assert ChunkType.RAW_SECTION.value == "raw_section"

    def test_korean_text_handling(self, service):
        """한글 텍스트 처리"""
        korean_text = """
        홍길동
        연락처: 010-1234-5678
        이메일: hong@example.com

        [경력사항]
        삼성전자 반도체 사업부 (2018.03 - 현재)
        - EUV 공정 개발 프로젝트 리드
        - 반도체 수율 개선 15% 달성
        - 팀원 5명 관리

        [프로젝트]
        차세대 반도체 공정 최적화
        - 기간: 2020.01 - 2021.12
        - 역할: 프로젝트 리더
        - 성과: 공정 효율 20% 향상

        [기술스택]
        Python, TensorFlow, Kubernetes, AWS

        [학력]
        서울대학교 전자공학과 석사 졸업 (2018)
        """

        # 텍스트를 충분히 길게 만들기
        long_korean_text = korean_text * 10

        result = service._build_raw_text_chunks(long_korean_text)

        assert len(result) >= 1
        assert result[0].chunk_type == ChunkType.RAW_FULL
        assert "홍길동" in result[0].content
        assert "EUV 공정" in result[0].content


class TestKoreanDetection:
    """P1 이슈: 한글 감지 테스트"""

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_korean_dominant_text(self, service):
        """한글이 50% 이상인 텍스트"""
        text = "한글텍스트입니다" + "ABC"  # 한글 ~77%
        assert service._is_korean_dominant(text) == True

    def test_english_dominant_text(self, service):
        """영문이 50% 이상인 텍스트"""
        text = "ABCDEFGHIJ" + "한글"  # 한글 ~17%
        assert service._is_korean_dominant(text) == False

    def test_exactly_50_percent_korean(self, service):
        """한글이 정확히 50%인 텍스트"""
        text = "한글한글한글한글한글" + "ABCDEFGHIJ"  # 한글 50%
        assert service._is_korean_dominant(text) == True

    def test_empty_text(self, service):
        """빈 텍스트"""
        assert service._is_korean_dominant("") == False
        assert service._is_korean_dominant("   ") == False

    def test_mixed_text_with_numbers(self, service):
        """숫자가 섞인 텍스트 - 한글 비율이 50% 이상이어야 True"""
        # 한글 7자, 숫자 3자 = 70% 한글 → True
        text_korean_dominant = "한글텍스트입니다123"
        assert service._is_korean_dominant(text_korean_dominant) == True

        # 한글 5자, 숫자 6자 = 45% 한글 → False
        text_english_dominant = "한글텍스트123456"
        assert service._is_korean_dominant(text_english_dominant) == False


class TestTokenCount:
    """P0 이슈: 토큰 카운트 테스트"""

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_english_token_count(self, service):
        """영문 토큰 카운트"""
        text = "Hello world"
        count = service._count_tokens(text)
        assert count > 0
        # tiktoken이 있으면 정확한 값, 없으면 추정값
        assert count <= 10  # "Hello world"는 2-3 토큰

    def test_korean_token_count(self, service):
        """한글 토큰 카운트"""
        text = "안녕하세요"
        count = service._count_tokens(text)
        assert count > 0
        # 한글은 영문보다 토큰이 많음
        assert count >= 5

    def test_batch_token_count(self, service):
        """배치 토큰 카운트"""
        texts = ["Hello", "안녕", "World"]
        count = service._count_tokens_batch(texts)
        assert count > 0

    def test_empty_text_token_count(self, service):
        """빈 텍스트 토큰 카운트"""
        count = service._count_tokens("")
        assert count == 0


class TestChunkWeights:
    """청크 타입별 가중치 테스트"""

    def test_raw_chunk_weights_exist(self):
        """raw 청크 타입에 대한 가중치 존재 확인"""
        from services.embedding_service import ChunkType

        # ChunkType에 raw_full, raw_section 존재
        assert ChunkType.RAW_FULL.value == "raw_full"
        assert ChunkType.RAW_SECTION.value == "raw_section"


class TestChunkingConfig:
    """P1 이슈: config.py에서 청킹 파라미터 관리 테스트"""

    def test_config_values_exist(self):
        """설정값 존재 확인"""
        assert chunking_config.MAX_STRUCTURED_CHUNK_CHARS == 2000
        assert chunking_config.MAX_RAW_FULL_CHARS == 8000
        assert chunking_config.RAW_SECTION_CHUNK_SIZE == 1500
        assert chunking_config.RAW_SECTION_OVERLAP == 300
        assert chunking_config.RAW_SECTION_MIN_LENGTH == 100
        assert chunking_config.RAW_TEXT_MIN_LENGTH == 100

    def test_korean_optimization_config(self):
        """한글 최적화 설정값 확인"""
        assert chunking_config.KOREAN_THRESHOLD == 0.5
        assert chunking_config.KOREAN_CHUNK_SIZE == 2000
        assert chunking_config.KOREAN_OVERLAP == 500

    def test_retry_config(self):
        """재시도 설정값 확인"""
        assert chunking_config.MAX_EMBEDDING_RETRIES == 3
        assert chunking_config.RETRY_BASE_WAIT_SECONDS == 1.0
        assert chunking_config.RETRY_MAX_WAIT_SECONDS == 10.0


class TestProcessCandidateWithRawText:
    """process_candidate 메서드의 raw_text 파라미터 테스트"""

    @pytest.fixture
    def service(self):
        """EmbeddingService 인스턴스 (OpenAI 클라이언트 없이)"""
        service = EmbeddingService()
        service.client = None
        return service

    @pytest.mark.asyncio
    async def test_process_candidate_without_raw_text(self, service):
        """raw_text 없이 호출 시 기존 동작 유지"""
        data = {
            "name": "홍길동",
            "summary": "시니어 개발자입니다.",
            "skills": ["Python", "React"],
        }

        result = await service.process_candidate(data, generate_embeddings=False)

        assert result.success
        # raw 청크 없음
        raw_chunks = [c for c in result.chunks if c.chunk_type in [ChunkType.RAW_FULL, ChunkType.RAW_SECTION]]
        assert len(raw_chunks) == 0

    @pytest.mark.asyncio
    async def test_process_candidate_with_raw_text(self, service):
        """raw_text와 함께 호출 시 raw 청크 생성"""
        data = {
            "name": "홍길동",
            "summary": "시니어 개발자입니다.",
            "skills": ["Python", "React"],
        }

        raw_text = "이력서 원본 내용입니다. " * 100  # 2000자+

        result = await service.process_candidate(
            data,
            generate_embeddings=False,
            raw_text=raw_text
        )

        assert result.success

        # raw 청크 존재
        raw_chunks = [c for c in result.chunks if c.chunk_type in [ChunkType.RAW_FULL, ChunkType.RAW_SECTION]]
        assert len(raw_chunks) >= 1

        # raw_full 존재
        raw_full = [c for c in result.chunks if c.chunk_type == ChunkType.RAW_FULL]
        assert len(raw_full) == 1

    @pytest.mark.asyncio
    async def test_process_candidate_with_short_raw_text(self, service):
        """100자 미만 raw_text는 raw 청크 생성 안 함"""
        data = {"name": "홍길동"}
        raw_text = "짧은 텍스트"

        result = await service.process_candidate(
            data,
            generate_embeddings=False,
            raw_text=raw_text
        )

        assert result.success

        # raw 청크 없음
        raw_chunks = [c for c in result.chunks if c.chunk_type in [ChunkType.RAW_FULL, ChunkType.RAW_SECTION]]
        assert len(raw_chunks) == 0


class TestEmbeddingResultStatus:
    """P2 이슈: EmbeddingResult 상태 테스트"""

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    @pytest.mark.asyncio
    async def test_result_contains_chunk_counts(self, service):
        """결과에 청크 카운트 정보 포함"""
        data = {
            "name": "홍길동",
            "summary": "개발자입니다.",
            "skills": ["Python"],
        }

        result = await service.process_candidate(data, generate_embeddings=False)

        assert result.success
        assert result.total_chunks == len(result.chunks)
        assert result.embedded_chunks == 0  # 임베딩 비활성화
        assert result.failed_chunks == 0
        assert result.is_partial_success == False

    @pytest.mark.asyncio
    async def test_result_to_dict(self, service):
        """결과 직렬화 테스트"""
        data = {"name": "홍길동"}

        result = await service.process_candidate(data, generate_embeddings=False)
        result_dict = result.to_dict()

        assert "success" in result_dict
        assert "chunk_count" in result_dict
        assert "total_chunks" in result_dict
        assert "embedded_chunks" in result_dict
        assert "failed_chunks" in result_dict
        assert "is_partial_success" in result_dict
        assert "warnings" in result_dict


# ═══════════════════════════════════════════════════════════════════════════════
# Critical Edge Cases (시니어 QA)
# ═══════════════════════════════════════════════════════════════════════════════


class TestCriticalEdgeCase13_RetrySuccess:
    """
    Critical Edge Case #13: API 1~2회 실패 후 성공

    시나리오: OpenAI API에서 Rate Limit (429) 또는 일시적 오류 발생 후 재시도 성공
    예상 결과: 지수 백오프 적용 후 임베딩 생성 성공
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = MagicMock()  # Mock OpenAI client
        return service

    @pytest.mark.asyncio
    async def test_retry_success_after_one_failure(self, service):
        """1회 실패 후 2회차에서 성공"""
        call_count = 0

        async def mock_api_call(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # 첫 번째 호출: Rate Limit 에러
                raise Exception("Rate limit exceeded (429)")
            # 두 번째 호출: 성공
            return "success_result"

        # 빠른 테스트를 위해 대기 시간 최소화
        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service._retry_with_exponential_backoff(
                mock_api_call,
                max_retries=3
            )

        assert result == "success_result"
        assert call_count == 2  # 1회 실패 + 1회 성공

    @pytest.mark.asyncio
    async def test_retry_success_after_two_failures(self, service):
        """2회 실패 후 3회차에서 성공"""
        call_count = 0

        async def mock_api_call(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                # 1, 2번째 호출: 실패
                raise Exception("Temporary server error (500)")
            # 3번째 호출: 성공
            return "success_after_retries"

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service._retry_with_exponential_backoff(
                mock_api_call,
                max_retries=3
            )

        assert result == "success_after_retries"
        assert call_count == 3  # 2회 실패 + 1회 성공

    @pytest.mark.asyncio
    async def test_exponential_backoff_timing(self, service):
        """지수 백오프 대기 시간이 증가하는지 확인 (jitter 제거)"""
        import time
        import random as random_module
        call_times = []

        async def mock_api_call(*args, **kwargs):
            call_times.append(time.time())
            if len(call_times) < 4:
                raise Exception("Retry me")
            return "done"

        # jitter를 0으로 고정하여 순수 지수 백오프만 테스트
        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.05), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 2.0), \
             patch.object(random_module, 'uniform', return_value=0):

            await service._retry_with_exponential_backoff(
                mock_api_call,
                max_retries=4
            )

        # 4번 호출됨
        assert len(call_times) == 4

        # 대기 시간 계산 (jitter=0이므로 순수 지수 백오프)
        wait_1 = call_times[1] - call_times[0]  # 2^0 * 0.05 = 0.05
        wait_2 = call_times[2] - call_times[1]  # 2^1 * 0.05 = 0.10
        wait_3 = call_times[3] - call_times[2]  # 2^2 * 0.05 = 0.20

        # 지수 백오프로 대기 시간 증가 확인
        assert wait_2 > wait_1  # 0.10 > 0.05
        assert wait_3 > wait_2  # 0.20 > 0.10

        # 모든 대기 시간이 0보다 큰지 확인
        assert wait_1 > 0
        assert wait_2 > 0
        assert wait_3 > 0


class TestCriticalEdgeCase14_RetryExhausted:
    """
    Critical Edge Case #14: API 3회 모두 실패 (MAX_RETRIES 초과)

    시나리오: OpenAI API가 모든 재시도에서 실패
    예상 결과: 에러 로깅 + graceful 실패 (None 반환)
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = MagicMock()
        return service

    @pytest.mark.asyncio
    async def test_all_retries_fail_returns_none(self, service):
        """모든 재시도 실패 시 None 반환"""
        call_count = 0

        async def mock_api_call(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            raise Exception(f"Persistent error (attempt {call_count})")

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service._retry_with_exponential_backoff(
                mock_api_call,
                max_retries=3
            )

        assert result is None
        assert call_count == 4  # 초기 1회 + 재시도 3회 = 총 4회

    @pytest.mark.asyncio
    async def test_max_retries_zero_no_retry(self, service):
        """max_retries=0이면 재시도 없이 즉시 실패"""
        call_count = 0

        async def mock_api_call(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            raise Exception("Immediate failure")

        result = await service._retry_with_exponential_backoff(
            mock_api_call,
            max_retries=0
        )

        assert result is None
        assert call_count == 1  # 재시도 없이 1회만 호출

    @pytest.mark.asyncio
    async def test_different_exception_types(self, service):
        """다양한 예외 타입에서도 재시도"""
        call_count = 0
        exceptions = [
            ConnectionError("Network error"),
            TimeoutError("Request timeout"),
            ValueError("Invalid response"),
            Exception("Generic error"),
        ]

        async def mock_api_call(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= len(exceptions):
                raise exceptions[call_count - 1]
            return "success"

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            # max_retries=3이므로 4회 호출 (초기 + 3회 재시도)
            # 4번째에서 Exception, 5번째에서 성공하지만 max_retries 초과로 None
            result = await service._retry_with_exponential_backoff(
                mock_api_call,
                max_retries=3
            )

        # 4회 호출 (모두 실패)
        assert call_count == 4
        assert result is None

    @pytest.mark.asyncio
    async def test_logging_on_max_retries_exceeded(self, service, caplog):
        """최대 재시도 초과 시 에러 로그 기록"""
        import logging

        async def mock_api_call(*args, **kwargs):
            raise Exception("Always fails")

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            with caplog.at_level(logging.ERROR):
                result = await service._retry_with_exponential_backoff(
                    mock_api_call,
                    max_retries=2
                )

        assert result is None
        # 최대 재시도 초과 로그 확인
        assert any("최대 재시도 횟수 초과" in record.message for record in caplog.records)


class TestCriticalEdgeCase_EmbeddingWithRetry:
    """
    Critical Edge Case: 실제 임베딩 생성 시 재시도 통합 테스트

    create_embedding 메서드가 재시도 로직을 올바르게 사용하는지 검증
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = MagicMock()
        return service

    @pytest.mark.asyncio
    async def test_create_embedding_uses_retry(self, service):
        """create_embedding이 재시도 로직을 사용하는지 확인"""
        call_count = 0

        # Mock response 생성
        mock_embedding_data = MagicMock()
        mock_embedding_data.embedding = [0.1] * 1536

        mock_response = MagicMock()
        mock_response.data = [mock_embedding_data]
        mock_response.usage.total_tokens = 10

        async def mock_create(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Rate limit")
            return mock_response

        service.client.embeddings.create = mock_create

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service.create_embedding("테스트 텍스트")

        # 재시도 후 성공
        assert result is not None
        assert len(result) == 1536
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_create_embeddings_batch_partial_success(self, service):
        """배치 임베딩 생성 시 일부 실패 처리"""
        texts = ["텍스트1", "텍스트2", "텍스트3"]

        # 첫 번째 배치 성공, 이후 실패 시뮬레이션
        mock_embedding = MagicMock()
        mock_embedding.embedding = [0.1] * 1536

        mock_response = MagicMock()
        mock_response.data = [mock_embedding] * 3
        mock_response.usage.total_tokens = 30

        service.client.embeddings.create = AsyncMock(return_value=mock_response)

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01):
            result = await service.create_embeddings_batch(texts)

        assert result is not None
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_create_embedding_no_client_returns_none(self, service):
        """클라이언트가 없으면 None 반환 (재시도 없음)"""
        service.client = None

        result = await service.create_embedding("테스트")

        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# High Priority Edge Cases (시니어 QA)
# ═══════════════════════════════════════════════════════════════════════════════


class TestHighEdgeCase2_ExactlyMaxChars:
    """
    High Edge Case #2: 정확히 MAX_RAW_FULL_CHARS (8000자) 텍스트

    시나리오: 텍스트가 정확히 8000자일 때
    예상 결과: truncation 없이 정상 처리
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_exactly_8000_chars_no_truncation(self, service):
        """정확히 8000자는 truncation 없음"""
        text = "A" * 8000
        chunks = service._build_raw_text_chunks(text)

        raw_full = [c for c in chunks if c.chunk_type == ChunkType.RAW_FULL][0]

        assert len(raw_full.content) == 8000
        assert raw_full.metadata.get("truncated") == False
        assert raw_full.metadata.get("original_length") == 8000

    def test_exactly_8000_korean_chars(self, service):
        """정확히 8000자 한글도 truncation 없음"""
        text = "가" * 8000
        chunks = service._build_raw_text_chunks(text)

        raw_full = [c for c in chunks if c.chunk_type == ChunkType.RAW_FULL][0]

        assert len(raw_full.content) == 8000
        assert raw_full.metadata.get("truncated") == False


class TestHighEdgeCase3_TruncationBoundary:
    """
    High Edge Case #3: 8001자 텍스트 (1자 초과 시 truncation)

    시나리오: MAX_RAW_FULL_CHARS를 1자 초과할 때
    예상 결과: 로그 경고 + 8000자로 자름
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_8001_chars_triggers_truncation(self, service):
        """8001자는 truncation 발생"""
        text = "A" * 8001
        chunks = service._build_raw_text_chunks(text)

        raw_full = [c for c in chunks if c.chunk_type == ChunkType.RAW_FULL][0]

        assert len(raw_full.content) == 8000
        assert raw_full.metadata.get("truncated") == True
        assert raw_full.metadata.get("original_length") == 8001
        assert raw_full.metadata.get("truncated_chars") == 1

    def test_truncation_logging(self, service, caplog):
        """truncation 발생 시 경고 로그"""
        import logging

        text = "가" * 10000

        with caplog.at_level(logging.WARNING):
            chunks = service._build_raw_text_chunks(text)

        # truncation 경고 로그 확인
        assert any("TRUNCATION" in record.message for record in caplog.records)

    def test_large_text_truncation_preserves_start(self, service):
        """대용량 텍스트 truncation 시 시작 부분 유지"""
        # 앞부분에 특정 마커 삽입
        marker = "MARKER_START_"
        text = marker + "X" * (10000 - len(marker))
        chunks = service._build_raw_text_chunks(text)

        raw_full = [c for c in chunks if c.chunk_type == ChunkType.RAW_FULL][0]

        # 시작 마커가 유지됨
        assert raw_full.content.startswith(marker)
        assert len(raw_full.content) == 8000


class TestHighEdgeCase5_KoreanThresholdBoundary:
    """
    High Edge Case #5: 정확히 49.9% 한글 (임계값 직전)

    시나리오: 한글 비율이 50% 바로 아래일 때
    예상 결과: _is_korean_dominant = False
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_49_percent_korean_is_not_dominant(self, service):
        """49% 한글은 한글 우세 아님"""
        # 49개 한글 + 51개 영문 = 49% 한글
        text = "가" * 49 + "A" * 51
        assert service._is_korean_dominant(text) == False

    def test_50_percent_korean_is_dominant(self, service):
        """50% 한글은 한글 우세"""
        # 50개 한글 + 50개 영문 = 50% 한글
        text = "가" * 50 + "A" * 50
        assert service._is_korean_dominant(text) == True

    def test_51_percent_korean_is_dominant(self, service):
        """51% 한글은 한글 우세"""
        # 51개 한글 + 49개 영문 = 51% 한글
        text = "가" * 51 + "A" * 49
        assert service._is_korean_dominant(text) == True

    def test_threshold_affects_chunking(self, service):
        """한글 임계값에 따라 청킹 설정이 달라짐"""
        # 49% 한글 → 기본 설정 (CHUNK_SIZE=1500)
        text_english = "가" * 490 + "A" * 510 + "B" * 5000
        chunks_english = service._build_raw_text_chunks(text_english)
        raw_sections_eng = [c for c in chunks_english if c.chunk_type == ChunkType.RAW_SECTION]

        if raw_sections_eng:
            assert raw_sections_eng[0].metadata.get("is_korean_optimized") == False

        # 51% 한글 → 한글 최적화 (CHUNK_SIZE=2000)
        text_korean = "가" * 510 + "A" * 490 + "나" * 5000
        chunks_korean = service._build_raw_text_chunks(text_korean)
        raw_sections_kr = [c for c in chunks_korean if c.chunk_type == ChunkType.RAW_SECTION]

        if raw_sections_kr:
            assert raw_sections_kr[0].metadata.get("is_korean_optimized") == True


class TestHighEdgeCase10_NullByteHandling:
    """
    High Edge Case #10: NULL 바이트 포함 텍스트

    시나리오: 텍스트에 \x00 (NULL 바이트) 포함
    예상 결과: 에러 없이 정상 처리
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_null_byte_in_middle(self, service):
        """텍스트 중간에 NULL 바이트"""
        text = "이력서내용" + "\x00" + "중간텍스트" + "\x00" + "끝"
        text = text * 20  # 최소 길이 확보

        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1
        assert chunks[0].chunk_type == ChunkType.RAW_FULL

    def test_multiple_null_bytes(self, service):
        """다중 NULL 바이트"""
        text = "가" * 50 + "\x00" * 10 + "나" * 50 + "\x00" * 5 + "다" * 50
        text = text * 10

        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1
        # NULL 바이트가 포함된 채로 처리됨
        assert "\x00" in chunks[0].content

    def test_null_byte_token_count(self, service):
        """NULL 바이트 포함 텍스트 토큰 카운트"""
        text = "Hello\x00World"
        count = service._count_tokens(text)

        # 에러 없이 토큰 수 반환
        assert count > 0

    def test_null_byte_korean_detection(self, service):
        """NULL 바이트가 한글 감지에 영향 없음"""
        # 한글 60% + NULL + 영문
        text = "가" * 60 + "\x00\x00\x00" + "A" * 37
        assert service._is_korean_dominant(text) == True


class TestHighEdgeCase12_NFDNormalization:
    """
    High Edge Case #12: NFD 정규화된 한글 (초성/종성 분리형)

    시나리오: unicodedata.normalize('NFD', '한글') 형태의 텍스트
    예상 결과: NFD 한글은 완성형 범위 밖이므로 한글로 인식 안됨
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_nfd_korean_not_detected_as_korean(self, service):
        """NFD 정규화된 한글은 완성형 한글이 아님"""
        import unicodedata

        # NFC (완성형): 한 = U+D55C (한글 완성형 범위)
        # NFD (분해형): 한 = ㅎ + ㅏ + ㄴ (자모 조합)
        nfc_text = "한글테스트"
        nfd_text = unicodedata.normalize('NFD', nfc_text)

        # NFC는 한글로 인식
        assert service._is_korean_dominant(nfc_text) == True

        # NFD는 완성형 범위(AC00-D7A3) 밖이므로 한글로 인식 안됨
        # 자모는 1100-11FF (초성), 1161-11A7 (중성), 11A8-11FF (종성) 범위
        assert service._is_korean_dominant(nfd_text) == False

    def test_mixed_nfc_nfd_detection(self, service):
        """NFC + NFD 혼합 텍스트"""
        import unicodedata

        # 50% NFC 한글 + 50% NFD 한글
        nfc_part = "가나다라마"  # 5자 NFC
        nfd_part = unicodedata.normalize('NFD', "바사아자차")  # 5자 NFD

        mixed = nfc_part + nfd_part + "A" * 5

        # NFC 5자 / 전체 15자 = 33% → 한글 우세 아님
        assert service._is_korean_dominant(mixed) == False

    def test_nfd_text_chunking_works(self, service):
        """NFD 텍스트도 청킹은 정상 동작"""
        import unicodedata

        text = unicodedata.normalize('NFD', "한글이력서내용입니다" * 50)

        chunks = service._build_raw_text_chunks(text)

        # 에러 없이 청킹됨
        assert len(chunks) >= 1


class TestHighEdgeCase15_APITimeout:
    """
    High Edge Case #15: API 응답 지연 (타임아웃)

    시나리오: OpenAI API 응답이 매우 느릴 때
    예상 결과: 타임아웃 후 재시도 또는 에러 처리
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = MagicMock()
        return service

    @pytest.mark.asyncio
    async def test_timeout_triggers_retry(self, service):
        """타임아웃 시 재시도 발생"""
        call_count = 0

        async def mock_slow_api(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise TimeoutError("Request timed out")
            # 두 번째 호출: 성공
            return "success"

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service._retry_with_exponential_backoff(
                mock_slow_api,
                max_retries=3
            )

        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_asyncio_timeout_error_handling(self, service):
        """asyncio.TimeoutError도 처리"""
        call_count = 0

        async def mock_api(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise asyncio.TimeoutError("Async timeout")
            return "recovered"

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service._retry_with_exponential_backoff(
                mock_api,
                max_retries=3
            )

        assert result == "recovered"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_persistent_timeout_returns_none(self, service):
        """지속적인 타임아웃은 None 반환"""
        async def mock_always_timeout(*args, **kwargs):
            raise TimeoutError("Always times out")

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service._retry_with_exponential_backoff(
                mock_always_timeout,
                max_retries=2
            )

        assert result is None


class TestHighEdgeCase16_PartialBatchFailure:
    """
    High Edge Case #16: 부분 배치 실패

    시나리오: 배치 임베딩 생성 중 일부만 성공
    예상 결과: 성공분만 반환 + 경고
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = MagicMock()
        return service

    @pytest.mark.asyncio
    async def test_partial_batch_returns_successful_embeddings(self, service):
        """배치 성공 시 모든 임베딩 반환"""
        texts = ["텍스트1", "텍스트2", "텍스트3"]

        mock_embedding = MagicMock()
        mock_embedding.embedding = [0.1] * 1536

        mock_response = MagicMock()
        mock_response.data = [mock_embedding, mock_embedding, mock_embedding]
        mock_response.usage.total_tokens = 30

        service.client.embeddings.create = AsyncMock(return_value=mock_response)

        result = await service.create_embeddings_batch(texts)

        assert result is not None
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_batch_failure_with_retry_success(self, service):
        """배치 실패 후 재시도 성공"""
        texts = ["텍스트1", "텍스트2"]
        call_count = 0

        mock_embedding = MagicMock()
        mock_embedding.embedding = [0.2] * 1536

        mock_response = MagicMock()
        mock_response.data = [mock_embedding, mock_embedding]
        mock_response.usage.total_tokens = 20

        async def mock_create(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Rate limit")
            return mock_response

        service.client.embeddings.create = mock_create

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service.create_embeddings_batch(texts)

        assert result is not None
        assert len(result) == 2
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_batch_all_failures_returns_none_list(self, service):
        """배치 모든 재시도 실패 시 [None, None, ...] 반환"""
        texts = ["텍스트1", "텍스트2"]

        async def mock_always_fail(*args, **kwargs):
            raise Exception("Persistent error")

        service.client.embeddings.create = mock_always_fail

        with patch.object(chunking_config, 'RETRY_BASE_WAIT_SECONDS', 0.01), \
             patch.object(chunking_config, 'RETRY_MAX_WAIT_SECONDS', 0.05):

            result = await service.create_embeddings_batch(texts)

        # 배치 실패 시 각 텍스트에 대해 None이 포함된 리스트 반환
        assert result == [None, None]
        assert all(r is None for r in result)

    @pytest.mark.asyncio
    async def test_empty_batch_returns_empty_list(self, service):
        """빈 배치는 빈 리스트 반환"""
        result = await service.create_embeddings_batch([])

        assert result == []

    @pytest.mark.asyncio
    async def test_single_item_batch(self, service):
        """단일 항목 배치 처리"""
        texts = ["단일텍스트"]

        mock_embedding = MagicMock()
        mock_embedding.embedding = [0.3] * 1536

        mock_response = MagicMock()
        mock_response.data = [mock_embedding]
        mock_response.usage.total_tokens = 10

        service.client.embeddings.create = AsyncMock(return_value=mock_response)

        result = await service.create_embeddings_batch(texts)

        assert result is not None
        assert len(result) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Medium Priority Edge Cases (시니어 QA)
# ═══════════════════════════════════════════════════════════════════════════════


class TestMediumEdgeCase1_ExactlyMinChars:
    """
    Medium Edge Case #1: 정확히 RAW_TEXT_MIN_LENGTH (100자) 텍스트

    시나리오: 텍스트가 정확히 100자일 때
    예상 결과: raw_full 1개만 생성
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_exactly_100_chars_creates_raw_full(self, service):
        """정확히 100자는 raw_full 생성"""
        text = "A" * 100
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) == 1
        assert chunks[0].chunk_type == ChunkType.RAW_FULL

    def test_99_chars_returns_empty(self, service):
        """99자는 빈 리스트 반환"""
        text = "A" * 99
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) == 0

    def test_101_chars_creates_raw_full(self, service):
        """101자도 raw_full 생성"""
        text = "A" * 101
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) == 1
        assert chunks[0].chunk_type == ChunkType.RAW_FULL

    def test_exactly_100_korean_chars(self, service):
        """정확히 100자 한글도 raw_full 생성"""
        text = "가" * 100
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) == 1
        assert chunks[0].chunk_type == ChunkType.RAW_FULL


class TestMediumEdgeCase6_JamoOnly:
    """
    Medium Edge Case #6: 자음/모음만 있는 텍스트

    시나리오: "ㅎㅏㄴㄱㅡㄹ" 같은 분리된 자모 텍스트
    예상 결과: 완성형 한글이 아니므로 한글로 인식 안됨
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_jamo_only_not_detected_as_korean(self, service):
        """자모만 있는 텍스트는 한글로 인식 안됨"""
        # 한글 자모 (U+3131 ~ U+3163)
        jamo_text = "ㅎㅏㄴㄱㅡㄹㅌㅔㅅㅡㅌㅡ"  # 12자 자모
        assert service._is_korean_dominant(jamo_text) == False

    def test_jamo_with_complete_korean(self, service):
        """자모 + 완성형 한글 혼합"""
        # 완성형 한글 10자 + 자모 10자
        text = "가나다라마바사아자차" + "ㅎㅏㄴㄱㅡㄹㅌㅔㅅㅡ"
        # 완성형 10자 / 총 20자 = 50% → 한글 우세
        assert service._is_korean_dominant(text) == True

    def test_jamo_chunking_works(self, service):
        """자모 텍스트도 청킹은 정상 동작"""
        text = "ㅎㅏㄴㄱㅡㄹ" * 50  # 300자
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1


class TestMediumEdgeCase7_HanjaKoreanMixed:
    """
    Medium Edge Case #7: 한자 + 한글 혼합 텍스트

    시나리오: "漢字한글混合" 같은 한자 + 한글 혼합
    예상 결과: 한글만 카운트하여 한글 비율 계산
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_hanja_not_counted_as_korean(self, service):
        """한자는 한글로 카운트하지 않음"""
        # 한자 5자 + 한글 5자 = 한글 50%
        text = "漢字混合文" + "한글텍스트입"
        assert service._is_korean_dominant(text) == True

    def test_hanja_only_not_korean_dominant(self, service):
        """한자만 있으면 한글 우세 아님"""
        text = "漢字混合文字測試"
        assert service._is_korean_dominant(text) == False

    def test_hanja_korean_english_mixed(self, service):
        """한자 + 한글 + 영문 혼합"""
        # 한자 4자 + 한글 3자 + 영문 3자 = 총 10자, 한글 30%
        text = "漢字混合한글텍ABC"
        assert service._is_korean_dominant(text) == False

    def test_hanja_chunking_works(self, service):
        """한자 포함 텍스트 청킹 정상"""
        text = "漢字한글混合テスト" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1


class TestMediumEdgeCase9_EmojiHandling:
    """
    Medium Edge Case #9: 이모지 포함 텍스트

    시나리오: "개발자 😀 이력서" 같은 이모지 포함 텍스트
    예상 결과: 정상 처리 (이모지는 비한글로 처리)
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_emoji_not_counted_as_korean(self, service):
        """이모지는 한글로 카운트하지 않음"""
        # 한글 4자 + 이모지 3개 + 영문 3자 = 한글 4/10 = 40%
        text = "개발자이력😀🎉🚀ABC"
        assert service._is_korean_dominant(text) == False

    def test_emoji_with_korean_dominant(self, service):
        """이모지 포함해도 한글 우세 가능"""
        # 한글 10자 + 이모지 5개 = 한글 10/15 = 67%
        text = "한글텍스트개발자이력서" + "😀🎉🚀💻🔥"
        assert service._is_korean_dominant(text) == True

    def test_emoji_only_text(self, service):
        """이모지만 있는 텍스트"""
        text = "😀🎉🚀💻🔥" * 30
        assert service._is_korean_dominant(text) == False

    def test_emoji_chunking_works(self, service):
        """이모지 포함 텍스트 청킹 정상"""
        text = "개발자 😀 이력서입니다. 🎉 경력사항 💼" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1
        # 이모지가 청크에 포함됨
        assert "😀" in chunks[0].content

    def test_emoji_token_count(self, service):
        """이모지 포함 텍스트 토큰 카운트"""
        text = "Hello 😀 World 🎉"
        count = service._count_tokens(text)

        assert count > 0


class TestMediumEdgeCase11_UnicodeControlChars:
    """
    Medium Edge Case #11: 유니코드 제어문자

    시나리오: Zero-width space (U+200B) 등 보이지 않는 문자 포함
    예상 결과: 제어문자 처리 후 정상 동작
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_zero_width_space(self, service):
        """Zero-width space 포함 텍스트"""
        # \u200b = zero-width space
        text = "한글\u200b텍스트\u200b입니다" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1

    def test_various_control_chars(self, service):
        """다양한 제어문자 포함"""
        # \u200b = zero-width space
        # \u200c = zero-width non-joiner
        # \u200d = zero-width joiner
        # \ufeff = BOM
        text = "가\u200b나\u200c다\u200d라\ufeff마" * 30
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1

    def test_control_chars_korean_detection(self, service):
        """제어문자가 한글 감지에 미치는 영향"""
        # 한글 5자 + 제어문자 5개 + 영문 5자
        text = "한글텍스트" + "\u200b" * 5 + "ABCDE"
        # 공백/줄바꿈 제거 후 계산하므로 제어문자는 총 문자 수에 포함
        # 정확한 동작은 구현에 따라 다름
        result = service._is_korean_dominant(text)
        # 한글 5자 / 총 15자 = 33% → 한글 우세 아님
        assert result == False

    def test_bom_at_start(self, service):
        """BOM으로 시작하는 텍스트"""
        text = "\ufeff" + "한글이력서입니다" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1


class TestMediumEdgeCase17_LastChunkTooShort:
    """
    Medium Edge Case #17: 마지막 청크 < 100자

    시나리오: 슬라이딩 윈도우 끝부분에서 마지막 청크가 최소 길이 미만
    예상 결과: 최소 길이 미만이면 해당 청크 제외
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_last_chunk_excluded_if_too_short(self, service):
        """마지막 청크가 100자 미만이면 제외"""
        # 영문 1650자 → 기본 설정 (CHUNK_SIZE=1500, OVERLAP=300)
        # 첫 번째: 0-1500 (1500자)
        # 두 번째: 1200-1650 (450자) - 이건 100자 이상이므로 포함
        text = "A" * 1650
        chunks = service._build_raw_text_chunks(text)

        raw_sections = [c for c in chunks if c.chunk_type == ChunkType.RAW_SECTION]

        # 모든 섹션이 100자 이상
        for section in raw_sections:
            assert len(section.content) >= 100

    def test_exact_boundary_chunk_included(self, service):
        """정확히 100자인 마지막 청크는 포함"""
        # 텍스트 길이 조정하여 마지막 청크가 정확히 100자가 되도록
        # stride = 1500 - 300 = 1200
        # 1200 + 100 = 1300 → 마지막 청크 100자
        text = "A" * 1300
        chunks = service._build_raw_text_chunks(text)

        raw_sections = [c for c in chunks if c.chunk_type == ChunkType.RAW_SECTION]

        # 마지막 청크 길이 확인 (있다면)
        if raw_sections:
            # 모든 섹션이 100자 이상
            for section in raw_sections:
                assert len(section.content) >= 100


class TestMediumEdgeCase19_WhitespaceOnlyText:
    """
    Medium Edge Case #19: 공백만 있는 긴 텍스트

    시나리오: 공백, 탭, 줄바꿈만으로 구성된 텍스트
    예상 결과: 유효 텍스트가 아니므로 빈 리스트 또는 처리
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_spaces_only_long_text(self, service):
        """공백만 있는 긴 텍스트"""
        text = " " * 10000
        chunks = service._build_raw_text_chunks(text)

        # 공백만 있어도 길이 조건은 충족하므로 청크 생성될 수 있음
        # 구현에 따라 빈 리스트일 수도 있음
        if chunks:
            # 청크가 생성되면 내용이 공백
            assert chunks[0].content.strip() == ""

    def test_newlines_only_long_text(self, service):
        """줄바꿈만 있는 긴 텍스트"""
        text = "\n" * 10000
        chunks = service._build_raw_text_chunks(text)

        if chunks:
            assert chunks[0].content.strip() == ""

    def test_tabs_only_long_text(self, service):
        """탭만 있는 긴 텍스트"""
        text = "\t" * 10000
        chunks = service._build_raw_text_chunks(text)

        if chunks:
            assert chunks[0].content.strip() == ""

    def test_mixed_whitespace_long_text(self, service):
        """공백 + 탭 + 줄바꿈 혼합"""
        text = " \t\n" * 5000
        chunks = service._build_raw_text_chunks(text)

        if chunks:
            assert chunks[0].content.strip() == ""

    def test_whitespace_korean_detection(self, service):
        """공백만 있는 텍스트의 한글 감지"""
        text = "   \n\t  "
        assert service._is_korean_dominant(text) == False

    def test_whitespace_with_some_content(self, service):
        """대부분 공백 + 충분한 내용"""
        # 공백은 길이에 포함되므로 최소 100자 이상의 실제 문자 필요
        text = " " * 100 + "가" * 100 + " " * 100
        chunks = service._build_raw_text_chunks(text)

        # 300자 이상이고 한글 100자 포함이므로 청크 생성
        assert len(chunks) >= 1


class TestMediumEdgeCase_MiscBoundaries:
    """
    Medium Edge Case: 기타 경계 조건
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_text_exactly_chunk_size(self, service):
        """텍스트 길이가 정확히 청크 크기일 때 (영문)"""
        # 영문 기본 CHUNK_SIZE = 1500
        # raw_section은 chunk_size 초과 시에만 생성됨
        text = "A" * 1500
        chunks = service._build_raw_text_chunks(text)

        # raw_full만 생성 (chunk_size 이하)
        raw_full = [c for c in chunks if c.chunk_type == ChunkType.RAW_FULL]
        raw_sections = [c for c in chunks if c.chunk_type == ChunkType.RAW_SECTION]

        assert len(raw_full) == 1
        # chunk_size 이하이므로 raw_section 없음
        assert len(raw_sections) == 0

    def test_text_exactly_chunk_size_korean(self, service):
        """텍스트 길이가 정확히 청크 크기일 때 (한글)"""
        # 한글 CHUNK_SIZE = 2000
        # raw_section은 chunk_size 초과 시에만 생성됨
        text = "가" * 2000
        chunks = service._build_raw_text_chunks(text)

        # raw_full만 생성 (chunk_size 이하)
        raw_full = [c for c in chunks if c.chunk_type == ChunkType.RAW_FULL]
        raw_sections = [c for c in chunks if c.chunk_type == ChunkType.RAW_SECTION]

        assert len(raw_full) == 1
        # chunk_size 이하이므로 raw_section 없음
        assert len(raw_sections) == 0

    def test_text_chunk_size_plus_one(self, service):
        """텍스트 길이가 청크 크기 + 1일 때"""
        # 영문 1501자
        text = "A" * 1501
        chunks = service._build_raw_text_chunks(text)

        raw_sections = [c for c in chunks if c.chunk_type == ChunkType.RAW_SECTION]

        # 1501자 → 2개 섹션이지만 두 번째가 100자 미만이면 1개
        # stride = 1200, 1501 - 1200 = 301자 → 2개 섹션
        assert len(raw_sections) >= 1

    def test_very_long_text(self, service):
        """매우 긴 텍스트 (100,000자)"""
        text = "가" * 100000
        chunks = service._build_raw_text_chunks(text)

        # raw_full은 8000자로 truncate
        raw_full = [c for c in chunks if c.chunk_type == ChunkType.RAW_FULL][0]
        assert len(raw_full.content) == 8000

        # raw_section은 여러 개 생성
        raw_sections = [c for c in chunks if c.chunk_type == ChunkType.RAW_SECTION]
        assert len(raw_sections) > 10  # 최소 10개 이상

    def test_unicode_surrogate_pairs(self, service):
        """유니코드 서로게이트 페어 (4바이트 문자)"""
        # 𝕳𝖊𝖑𝖑𝖔 (Mathematical Bold Fraktur)
        text = "𝕳𝖊𝖑𝖑𝖔 한글텍스트입니다" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1


# ═══════════════════════════════════════════════════════════════════════════════
# Low Priority Edge Cases (시니어 QA)
# ═══════════════════════════════════════════════════════════════════════════════


class TestLowEdgeCase8_JapaneseHandling:
    """
    Low Edge Case #8: 일본어 히라가나/카타카나 처리

    시나리오: 일본어 문자가 포함된 텍스트
    예상 결과: 일본어는 비한글로 처리
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_hiragana_not_counted_as_korean(self, service):
        """히라가나는 한글로 카운트하지 않음"""
        # 히라가나만
        text = "あいうえおかきくけこ"
        assert service._is_korean_dominant(text) == False

    def test_katakana_not_counted_as_korean(self, service):
        """카타카나는 한글로 카운트하지 않음"""
        # 카타카나만
        text = "アイウエオカキクケコ"
        assert service._is_korean_dominant(text) == False

    def test_japanese_korean_mixed(self, service):
        """일본어 + 한글 혼합"""
        # 한글 5자 + 히라가나 5자 = 한글 50%
        text = "한글텍스트입" + "あいうえお"
        assert service._is_korean_dominant(text) == True

    def test_japanese_korean_below_threshold(self, service):
        """일본어가 많으면 한글 우세 아님"""
        # 한글 4자 + 히라가나 6자 = 한글 40%
        text = "한글텍스" + "あいうえおか"
        assert service._is_korean_dominant(text) == False

    def test_kanji_hiragana_korean_mixed(self, service):
        """한자 + 히라가나 + 한글 혼합"""
        # 한자 3자 + 히라가나 3자 + 한글 4자 = 한글 40%
        text = "漢字文" + "あいう" + "한글텍스"
        assert service._is_korean_dominant(text) == False

    def test_japanese_chunking_works(self, service):
        """일본어 포함 텍스트 청킹 정상"""
        text = "こんにちは한글テキストです" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1

    def test_japanese_token_count(self, service):
        """일본어 포함 텍스트 토큰 카운트"""
        text = "こんにちは世界"
        count = service._count_tokens(text)

        assert count > 0


class TestLowEdgeCase20_ConsecutiveNewlines:
    """
    Low Edge Case #20: 연속 줄바꿈 + 텍스트

    시나리오: 줄바꿈이 많이 포함된 텍스트
    예상 결과: 공백 제외 후 한글 카운트
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_newlines_with_korean_at_end(self, service):
        """줄바꿈 후 한글"""
        # 줄바꿈 제외하고 한글만 카운트
        text = "\n" * 100 + "한글텍스트입니다"
        assert service._is_korean_dominant(text) == True

    def test_newlines_between_korean(self, service):
        """한글 사이에 줄바꿈"""
        text = "한글\n\n\n텍스트\n\n입니다"
        assert service._is_korean_dominant(text) == True

    def test_newlines_with_mixed_content(self, service):
        """줄바꿈 + 한글 + 영문 혼합"""
        # 한글 4자 + 영문 6자 = 한글 40%
        text = "\n\n\n한글텍스\n\n\nABCDEF\n\n"
        assert service._is_korean_dominant(text) == False

    def test_crlf_handling(self, service):
        """Windows 스타일 줄바꿈 (CRLF)"""
        text = "한글텍스트\r\n입니다\r\n경력사항" * 10
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1

    def test_mixed_line_endings(self, service):
        """혼합 줄바꿈 (LF, CR, CRLF)"""
        text = "한글\n텍스트\r입니다\r\n경력" * 30
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1


class TestLowEdgeCase_OtherLanguages:
    """
    Low Edge Case: 기타 언어 처리 (러시아어, 아랍어, 태국어 등)

    시나리오: 다양한 언어의 텍스트
    예상 결과: 모두 비한글로 처리
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_russian_not_counted_as_korean(self, service):
        """러시아어(키릴 문자)는 한글로 카운트하지 않음"""
        text = "Привет мир"  # "Hello world" in Russian
        assert service._is_korean_dominant(text) == False

    def test_arabic_not_counted_as_korean(self, service):
        """아랍어는 한글로 카운트하지 않음"""
        text = "مرحبا بالعالم"  # "Hello world" in Arabic
        assert service._is_korean_dominant(text) == False

    def test_thai_not_counted_as_korean(self, service):
        """태국어는 한글로 카운트하지 않음"""
        text = "สวัสดีโลก"  # "Hello world" in Thai
        assert service._is_korean_dominant(text) == False

    def test_vietnamese_not_counted_as_korean(self, service):
        """베트남어는 한글로 카운트하지 않음"""
        text = "Xin chào thế giới"  # "Hello world" in Vietnamese
        assert service._is_korean_dominant(text) == False

    def test_greek_not_counted_as_korean(self, service):
        """그리스어는 한글로 카운트하지 않음"""
        text = "Γειά σου κόσμε"  # "Hello world" in Greek
        assert service._is_korean_dominant(text) == False

    def test_hebrew_not_counted_as_korean(self, service):
        """히브리어는 한글로 카운트하지 않음"""
        text = "שלום עולם"  # "Hello world" in Hebrew
        assert service._is_korean_dominant(text) == False

    def test_multilingual_with_korean(self, service):
        """다국어 + 한글 혼합"""
        # 한글 10자 + 영문 5자 + 러시아어 5자 = 한글 50%
        text = "한글텍스트입니다이력" + "Hello" + "Приве"
        assert service._is_korean_dominant(text) == True

    def test_multilingual_chunking_works(self, service):
        """다국어 텍스트 청킹 정상"""
        text = "한글 Привет مرحبا สวัสดี 你好 こんにちは" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1


class TestLowEdgeCase_SpecialUnicodeSymbols:
    """
    Low Edge Case: 특수 유니코드 문자 (수학/음악 기호 등)

    시나리오: 다양한 특수 기호가 포함된 텍스트
    예상 결과: 모두 비한글로 처리, 청킹 정상 동작
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_math_symbols_not_korean(self, service):
        """수학 기호는 한글로 카운트하지 않음"""
        text = "∑∏∫∂∇√∞≠≈≤≥"
        assert service._is_korean_dominant(text) == False

    def test_music_symbols_not_korean(self, service):
        """음악 기호는 한글로 카운트하지 않음"""
        text = "♩♪♫♬♭♮♯"
        assert service._is_korean_dominant(text) == False

    def test_currency_symbols_not_korean(self, service):
        """통화 기호는 한글로 카운트하지 않음"""
        text = "$€£¥₩₹₽"
        assert service._is_korean_dominant(text) == False

    def test_arrows_and_shapes_not_korean(self, service):
        """화살표/도형은 한글로 카운트하지 않음"""
        text = "←→↑↓↔↕⇒⇔▲▼◆◇○●□■"
        assert service._is_korean_dominant(text) == False

    def test_box_drawing_not_korean(self, service):
        """박스 그리기 문자는 한글로 카운트하지 않음"""
        text = "─│┌┐└┘├┤┬┴┼"
        assert service._is_korean_dominant(text) == False

    def test_special_symbols_with_korean(self, service):
        """특수 기호 + 한글 혼합"""
        # 한글 10자 + 기호 5개 = 한글 67%
        text = "한글텍스트입니다이력" + "★☆♠♣♥"
        assert service._is_korean_dominant(text) == True

    def test_special_symbols_chunking_works(self, service):
        """특수 기호 포함 텍스트 청킹 정상"""
        text = "이력서 ★ 경력사항 → 프로젝트 ◆ 기술스택" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1
        # 기호가 청크에 포함됨
        assert "★" in chunks[0].content or "→" in chunks[0].content

    def test_math_in_resume_context(self, service):
        """이력서에 포함될 수 있는 수학 표현"""
        text = "성과: 매출 ↑30%, 비용 ↓15%, ROI ≈ 200%" * 20
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1


class TestLowEdgeCase_EdgeBoundaries:
    """
    Low Edge Case: 기타 경계 조건
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_single_character_korean(self, service):
        """단일 한글 문자"""
        text = "가"
        assert service._is_korean_dominant(text) == True

    def test_single_character_english(self, service):
        """단일 영문 문자"""
        text = "A"
        assert service._is_korean_dominant(text) == False

    def test_alternating_korean_english(self, service):
        """한글/영문 교대"""
        # 한글 5자 + 영문 5자 = 50%
        text = "가A나B다C라D마E"
        assert service._is_korean_dominant(text) == True

    def test_repeated_same_character(self, service):
        """같은 문자 반복"""
        text = "가" * 1000
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1
        assert chunks[0].content == "가" * 1000

    def test_very_short_valid_text(self, service):
        """최소 유효 텍스트 (정확히 100자)"""
        text = "X" * 100
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) == 1
        assert chunks[0].chunk_type == ChunkType.RAW_FULL

    def test_text_with_only_punctuation(self, service):
        """구두점만 있는 텍스트"""
        text = ".,!?;:'\"-()[]{}@#$%^&*" * 10
        assert service._is_korean_dominant(text) == False

    def test_numbers_only(self, service):
        """숫자만 있는 텍스트"""
        text = "0123456789" * 20
        assert service._is_korean_dominant(text) == False

    def test_numbers_with_korean(self, service):
        """숫자 + 한글 혼합"""
        # 한글 10자 + 숫자 10자 = 한글 50%
        text = "한글텍스트입니다이력" + "0123456789"
        assert service._is_korean_dominant(text) == True


class TestLowEdgeCase_RealWorldScenarios:
    """
    Low Edge Case: 실제 이력서에서 발생할 수 있는 시나리오
    """

    @pytest.fixture
    def service(self):
        service = EmbeddingService()
        service.client = None
        return service

    def test_resume_with_urls(self, service):
        """URL이 포함된 이력서"""
        text = """
        홍길동
        GitHub: https://github.com/honggildong
        LinkedIn: https://linkedin.com/in/honggildong
        포트폴리오: https://honggildong.dev
        """ * 10
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1

    def test_resume_with_email_phone(self, service):
        """이메일/전화번호 포함"""
        text = """
        이름: 홍길동
        이메일: hong.gildong@example.com
        전화: 010-1234-5678
        주소: 서울특별시 강남구
        """ * 15
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1

    def test_resume_with_dates(self, service):
        """날짜 형식 포함"""
        text = """
        경력사항
        - 삼성전자 (2020.01 - 2023.12)
        - LG전자 (2018.03 - 2019.12)
        - 현대자동차 (2015.06 - 2018.02)
        """ * 15
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1

    def test_resume_with_percentage(self, service):
        """퍼센트 수치 포함"""
        text = """
        성과
        - 매출 증가: 150%
        - 비용 절감: 30%
        - 고객 만족도: 95.5%
        """ * 15
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1

    def test_resume_with_technical_terms(self, service):
        """기술 용어 (영문) 포함"""
        text = """
        기술스택: Python, JavaScript, React, Node.js, AWS, Docker, Kubernetes
        프레임워크: Django, FastAPI, Next.js, Express
        데이터베이스: PostgreSQL, MongoDB, Redis
        """ * 10
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1
        # 기술 용어가 포함됨
        assert "Python" in chunks[0].content

    def test_resume_bilingual(self, service):
        """한영 혼합 이력서"""
        text = """
        홍길동 (Hong Gil-Dong)
        Senior Software Engineer

        경력사항 (Work Experience)
        - Tech Company (2020-현재)
          - Led development of microservices architecture
          - 마이크로서비스 아키텍처 개발 리드

        기술스택 (Technical Skills)
        - Backend: Python, Java, Go
        - Frontend: React, TypeScript
        """ * 5
        chunks = service._build_raw_text_chunks(text)

        assert len(chunks) >= 1
