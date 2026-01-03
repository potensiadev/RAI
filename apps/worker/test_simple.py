"""
Simple Local Test Script

PDF 파일 파싱 및 LLM 분석 테스트 (최소 의존성)
"""

import asyncio
import sys
import os
import json
from pathlib import Path

# 프로젝트 루트 설정
sys.path.insert(0, str(Path(__file__).parent))

# 환경 변수 로드 (dotenv 있으면)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def test_pdf_parsing(pdf_path: str) -> dict:
    """PDF 파싱 테스트"""
    from utils.pdf_parser import PDFParser

    print(f"\n{'='*60}")
    print(f"[1단계] PDF 파싱 테스트: {os.path.basename(pdf_path)}")
    print(f"{'='*60}")

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    parser = PDFParser()
    result = parser.parse(file_bytes)

    print(f"\n[결과]")
    print(f"  - 성공: {result.success}")
    print(f"  - 메서드: {result.method}")
    print(f"  - 페이지 수: {result.page_count}")
    print(f"  - 텍스트 길이: {len(result.text)} chars")

    if result.error_message:
        print(f"  - 오류: {result.error_message}")

    if result.text:
        print(f"\n[추출된 텍스트 미리보기 (첫 800자)]")
        print("-" * 40)
        # Unicode 안전 출력
        safe_text = result.text[:800].encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        try:
            print(safe_text)
        except UnicodeEncodeError:
            print(safe_text.encode('ascii', errors='replace').decode('ascii'))
        print("-" * 40)

    return {
        "success": result.success,
        "text": result.text,
        "method": result.method,
        "page_count": result.page_count,
        "error": result.error_message
    }


async def test_llm_analysis(text: str, filename: str) -> dict:
    """LLM 분석 테스트"""
    from config import get_settings
    from services.llm_manager import LLMManager, LLMProvider
    from schemas.resume_schema import RESUME_JSON_SCHEMA, RESUME_SCHEMA_PROMPT

    print(f"\n{'='*60}")
    print(f"[2단계] LLM 분석 테스트")
    print(f"{'='*60}")

    settings = get_settings()

    # 환경 변수 체크
    print(f"\n[환경 변수 상태]")
    print(f"  - OPENAI_API_KEY: {'설정됨' if settings.OPENAI_API_KEY else '없음'}")
    print(f"  - GEMINI_API_KEY: {'설정됨' if settings.GEMINI_API_KEY else '없음'}")
    print(f"  - ANTHROPIC_API_KEY: {'설정됨' if settings.ANTHROPIC_API_KEY else '없음'}")

    # LLM Manager 초기화
    llm_manager = LLMManager()
    available = llm_manager.get_available_providers()

    print(f"\n[LLM 상태]")
    print(f"  - 사용 가능한 프로바이더: {[p.value for p in available]}")

    if not available:
        print(f"\n[오류] 사용 가능한 LLM 프로바이더가 없습니다!")
        print("  → .env 파일에 API 키를 설정하세요:")
        print("    OPENAI_API_KEY=sk-xxx")
        print("    GEMINI_API_KEY=xxx")
        return {"success": False, "error": "No LLM providers available"}

    # 프롬프트 생성
    import re
    name_part = re.sub(r'\.(pdf|hwp|hwpx|doc|docx)$', '', filename, flags=re.IGNORECASE)
    name_part = re.sub(r'[_\-\s]*(이력서|경력기술서|resume|cv|자기소개서)[_\-\s]*', '', name_part, flags=re.IGNORECASE)
    name_part = name_part.strip('_- ')

    filename_hint = f"""
### 파일명 정보
원본 파일명: {filename}
파일명에서 추정되는 이름: {name_part}
"""

    system_prompt = """당신은 전문 이력서 분석가입니다.
주어진 이력서에서 구조화된 정보를 정확하게 추출해주세요.

중요: 한국 이력서는 "이름:" 같은 라벨 없이 이름이 단독으로 표시됩니다.
- 문서 상단에 2~4글자 한글 이름이 있으면 그것이 이름입니다
- 파일명에 이름이 포함된 경우가 많습니다
- 라벨이 없어도 문맥에서 정보를 추론하세요

""" + RESUME_SCHEMA_PROMPT

    user_prompt = f"""다음 이력서를 분석하고 JSON 형식으로 정보를 추출해주세요:
{filename_hint}
---
{text}
---

위 이력서에서 정보를 추출하여 JSON으로 반환하세요."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    # 각 프로바이더별 테스트
    results = {}

    for provider in available:
        print(f"\n[{provider.value} 테스트]")
        try:
            if provider == LLMProvider.OPENAI:
                response = await llm_manager.call_with_structured_output(
                    provider=provider,
                    messages=messages,
                    json_schema=RESUME_JSON_SCHEMA,
                    temperature=0.1
                )
            else:
                response = await llm_manager.call_json(
                    provider=provider,
                    messages=messages,
                    json_schema=RESUME_JSON_SCHEMA,
                    temperature=0.1
                )

            if response.success:
                print(f"  ✅ 성공!")
                print(f"  - 모델: {response.model}")
                if isinstance(response.content, dict):
                    print(f"  - 추출된 이름: {response.content.get('name', 'N/A')}")
                    print(f"  - 경력 연수: {response.content.get('exp_years', 'N/A')}")
                    print(f"  - 스킬 수: {len(response.content.get('skills', []))}개")
                results[provider.value] = {"success": True, "data": response.content}
            else:
                print(f"  ❌ 실패: {response.error}")
                results[provider.value] = {"success": False, "error": response.error}

        except Exception as e:
            print(f"  ❌ 예외: {e}")
            import traceback
            traceback.print_exc()
            results[provider.value] = {"success": False, "error": str(e)}

    return results


async def main():
    """메인 함수"""
    # docs 폴더 경로
    docs_dir = Path(__file__).parent.parent.parent / "docs"
    pdf_files = list(docs_dir.glob("*.pdf"))

    print(f"\n{'#'*60}")
    print(f"# 로컬 파이프라인 테스트")
    print(f"{'#'*60}")
    print(f"\n발견된 PDF 파일: {len(pdf_files)}개")
    for pdf in pdf_files:
        print(f"  - {pdf.name}")

    if not pdf_files:
        print("PDF 파일이 없습니다!")
        return

    # 첫 번째 PDF로 테스트
    pdf_path = pdf_files[0]
    filename = pdf_path.name

    print(f"\n테스트 대상: {filename}")

    # 1. PDF 파싱
    parse_result = test_pdf_parsing(str(pdf_path))

    if not parse_result["success"]:
        print(f"\n[실패] PDF 파싱 실패")
        return

    # 2. LLM 분석
    if len(parse_result["text"].strip()) < 50:
        print(f"\n[경고] 추출된 텍스트가 너무 짧음: {len(parse_result['text'])} chars")
        print("PDF가 이미지 기반일 수 있습니다.")
    else:
        llm_results = await test_llm_analysis(parse_result["text"], filename)

        print(f"\n{'#'*60}")
        print(f"# 최종 결과")
        print(f"{'#'*60}")
        for provider, result in llm_results.items():
            status = "✅ 성공" if result.get("success") else "❌ 실패"
            print(f"  - {provider}: {status}")
            if result.get("data"):
                data = result["data"]
                print(f"    이름: {data.get('name')}")


if __name__ == "__main__":
    asyncio.run(main())
