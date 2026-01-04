"""Minimal test - outputs to JSON file"""
import asyncio
import sys
import os
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


async def main():
    from utils.pdf_parser import PDFParser
    from config import get_settings
    # Direct import to avoid rq dependency
    from services.llm_manager import LLMManager, LLMProvider
    from schemas.resume_schema import RESUME_JSON_SCHEMA, RESUME_SCHEMA_PROMPT

    results = {"tests": []}

    docs_dir = Path(__file__).parent.parent.parent / "docs"
    pdf_files = list(docs_dir.glob("*.pdf"))

    for pdf_path in pdf_files:
        test_result = {"file": pdf_path.name, "steps": {}}

        # 1. PDF Parsing
        with open(pdf_path, "rb") as f:
            file_bytes = f.read()

        parser = PDFParser()
        parse_result = parser.parse(file_bytes)

        test_result["steps"]["pdf_parsing"] = {
            "success": parse_result.success,
            "method": parse_result.method,
            "page_count": parse_result.page_count,
            "text_length": len(parse_result.text),
            "text_preview": parse_result.text[:500] if parse_result.text else "",
            "error": parse_result.error_message
        }

        if not parse_result.success or len(parse_result.text) < 50:
            test_result["steps"]["llm_analysis"] = {"skipped": True, "reason": "No text from PDF"}
            results["tests"].append(test_result)
            continue

        # 2. LLM Analysis
        settings = get_settings()
        test_result["steps"]["env_check"] = {
            "openai_key": bool(settings.OPENAI_API_KEY),
            "gemini_key": bool(settings.GEMINI_API_KEY),
            "anthropic_key": bool(settings.ANTHROPIC_API_KEY)
        }

        llm_manager = LLMManager()
        available = llm_manager.get_available_providers()
        test_result["steps"]["llm_providers"] = [p.value for p in available]

        if not available:
            test_result["steps"]["llm_analysis"] = {"error": "No LLM providers available"}
            results["tests"].append(test_result)
            continue

        # Build prompt
        import re
        filename = pdf_path.name
        name_part = re.sub(r'\.(pdf|hwp)$', '', filename, flags=re.IGNORECASE)
        name_part = re.sub(r'[_\-]*(이력서|경력기술서)[_\-]*', '', name_part, flags=re.IGNORECASE)
        name_part = name_part.strip('_- ')

        system_prompt = f"""당신은 전문 이력서 분석가입니다.
한국 이력서는 "이름:" 같은 라벨 없이 이름이 단독으로 표시됩니다.
파일명에서 추정되는 이름: {name_part}
{RESUME_SCHEMA_PROMPT}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"다음 이력서를 분석하세요:\n{parse_result.text}"}
        ]

        llm_results = {}
        for provider in available:
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
                    llm_results[provider.value] = {
                        "success": True,
                        "model": response.model,
                        "extracted_name": response.content.get("name") if response.content else None,
                        "exp_years": response.content.get("exp_years") if response.content else None,
                        "skills_count": len(response.content.get("skills", [])) if response.content else 0,
                        "data": response.content
                    }
                else:
                    llm_results[provider.value] = {"success": False, "error": response.error}
            except Exception as e:
                llm_results[provider.value] = {"success": False, "error": str(e)}

        test_result["steps"]["llm_analysis"] = llm_results
        results["tests"].append(test_result)

    # Save results
    output_path = docs_dir / "test_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)

    print(f"Results saved to: {output_path}")

    # Print summary
    for test in results["tests"]:
        print(f"\n=== {test['file']} ===")
        parsing = test["steps"].get("pdf_parsing", {})
        print(f"  PDF Parsing: {'OK' if parsing.get('success') else 'FAIL'} ({parsing.get('text_length', 0)} chars)")

        llm = test["steps"].get("llm_analysis", {})
        if isinstance(llm, dict) and not llm.get("skipped"):
            for provider, result in llm.items():
                if isinstance(result, dict):
                    status = "OK" if result.get("success") else "FAIL"
                    name = result.get("extracted_name", "N/A")
                    print(f"  {provider}: {status} (name: {name})")


if __name__ == "__main__":
    asyncio.run(main())
