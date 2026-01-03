"""
Local Pipeline Test Script

PDF 파일을 로컬에서 테스트하여 파싱 및 분석 문제 진단
"""

import asyncio
import sys
import os
import json
from pathlib import Path

# 프로젝트 루트 설정
sys.path.insert(0, str(Path(__file__).parent))

from utils.pdf_parser import PDFParser
from agents.analyst_agent import get_analyst_agent, AnalysisResult
from services.llm_manager import get_llm_manager


def test_pdf_parsing(pdf_path: str) -> dict:
    """PDF 파싱 테스트"""
    print(f"\n{'='*60}")
    print(f"[1단계] PDF 파싱 테스트: {pdf_path}")
    print(f"{'='*60}")

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    parser = PDFParser()
    result = parser.parse(file_bytes)

    print(f"\n[결과]")
    print(f"  - 성공: {result.success}")
    print(f"  - 메서드: {result.method}")
    print(f"  - 페이지 수: {result.page_count}")
    print(f"  - 암호화 여부: {result.is_encrypted}")
    print(f"  - 텍스트 길이: {len(result.text)} chars")

    if result.error_message:
        print(f"  - 오류: {result.error_message}")

    if result.text:
        print(f"\n[추출된 텍스트 미리보기 (첫 500자)]")
        print("-" * 40)
        print(result.text[:500])
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
    print(f"\n{'='*60}")
    print(f"[2단계] LLM 분석 테스트")
    print(f"{'='*60}")

    # LLM Manager 상태 확인
    llm_manager = get_llm_manager()
    available = llm_manager.get_available_providers()

    print(f"\n[LLM 상태]")
    print(f"  - 사용 가능한 프로바이더: {[p.value for p in available]}")
    print(f"  - OpenAI 클라이언트: {'OK' if llm_manager.openai_client else 'MISSING'}")
    print(f"  - Gemini 클라이언트: {'OK' if llm_manager.gemini_client else 'MISSING'}")
    print(f"  - Claude 클라이언트: {'OK' if llm_manager.anthropic_client else 'MISSING'}")

    if not available:
        print(f"\n[오류] 사용 가능한 LLM 프로바이더가 없습니다!")
        print("  → .env 파일에 API 키를 설정하세요:")
        print("    OPENAI_API_KEY=sk-xxx")
        print("    GEMINI_API_KEY=xxx")
        return {"success": False, "error": "No LLM providers available"}

    # AnalystAgent 테스트
    print(f"\n[분석 시작]")
    print(f"  - 입력 텍스트 길이: {len(text)} chars")
    print(f"  - 파일명: {filename}")

    analyst = get_analyst_agent()
    result: AnalysisResult = await analyst.analyze(
        resume_text=text,
        filename=filename
    )

    print(f"\n[분석 결과]")
    print(f"  - 성공: {result.success}")
    print(f"  - 신뢰도: {result.confidence_score:.2%}")
    print(f"  - 처리 시간: {result.processing_time_ms}ms")

    if result.error:
        print(f"  - 오류: {result.error}")

    if result.warnings:
        print(f"\n[경고]")
        for w in result.warnings:
            print(f"  - [{w.severity}] {w.field}: {w.message}")

    if result.data:
        print(f"\n[추출된 데이터]")
        print("-" * 40)
        # 주요 필드만 출력
        important_fields = ["name", "phone", "email", "exp_years", "last_company", "last_position", "skills"]
        for field in important_fields:
            value = result.data.get(field)
            if value is not None:
                if isinstance(value, list):
                    value_str = f"[{len(value)}개] " + ", ".join(str(v) for v in value[:5])
                    if len(value) > 5:
                        value_str += "..."
                else:
                    value_str = str(value)[:50]
                print(f"  {field}: {value_str}")
        print("-" * 40)

        # 전체 데이터 JSON 출력
        print(f"\n[전체 JSON 데이터]")
        print(json.dumps(result.data, ensure_ascii=False, indent=2)[:2000])

    # 필드별 신뢰도
    if result.field_confidence:
        print(f"\n[필드별 신뢰도]")
        for field, conf in sorted(result.field_confidence.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {field}: {conf:.2%}")

    return result.to_dict()


async def run_full_test(pdf_path: str):
    """전체 테스트 실행"""
    filename = os.path.basename(pdf_path)
    print(f"\n{'#'*60}")
    print(f"# 파이프라인 테스트 시작: {filename}")
    print(f"{'#'*60}")

    # 1. PDF 파싱
    parse_result = test_pdf_parsing(pdf_path)

    if not parse_result["success"]:
        print(f"\n[실패] PDF 파싱 실패 - 분석 중단")
        return

    if len(parse_result["text"].strip()) < 100:
        print(f"\n[경고] 추출된 텍스트가 너무 짧음 ({len(parse_result['text'])} chars)")
        print("  → PDF에서 텍스트 추출에 문제가 있을 수 있습니다")

    # 2. LLM 분석
    analysis_result = await test_llm_analysis(parse_result["text"], filename)

    print(f"\n{'#'*60}")
    print(f"# 테스트 완료: {filename}")
    print(f"{'#'*60}")

    # 최종 결과 요약
    print(f"\n[요약]")
    print(f"  - PDF 파싱: {'성공' if parse_result['success'] else '실패'}")
    print(f"  - LLM 분석: {'성공' if analysis_result.get('success') else '실패'}")
    print(f"  - 추출된 이름: {analysis_result.get('data', {}).get('name', 'N/A')}")
    print(f"  - 신뢰도: {analysis_result.get('confidence_score', 0):.2%}")

    return {
        "parse": parse_result,
        "analysis": analysis_result
    }


async def main():
    """메인 테스트 함수"""
    # docs 폴더의 PDF 파일들
    docs_dir = Path(__file__).parent.parent.parent / "docs"
    pdf_files = list(docs_dir.glob("*.pdf"))

    print(f"\n발견된 PDF 파일: {len(pdf_files)}개")
    for pdf in pdf_files:
        print(f"  - {pdf.name}")

    if not pdf_files:
        print("PDF 파일이 없습니다!")
        return

    # 모든 PDF 테스트
    results = {}
    for pdf_path in pdf_files:
        try:
            result = await run_full_test(str(pdf_path))
            results[pdf_path.name] = result
        except Exception as e:
            print(f"\n[에러] {pdf_path.name} 테스트 중 오류: {e}")
            import traceback
            traceback.print_exc()

    # 최종 결과 저장
    output_path = docs_dir / "test_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n결과 저장: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
