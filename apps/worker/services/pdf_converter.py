"""
PDF Converter Service - LibreOffice 기반 문서 변환

DOC/DOCX/HWP 파일을 PDF로 변환하여 PDF Viewer에서 표시할 수 있도록 함
"""

import logging
import subprocess
import tempfile
import os
from dataclasses import dataclass
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# 싱글톤 인스턴스
_pdf_converter: Optional["PDFConverter"] = None


@dataclass
class PDFConversionResult:
    """PDF 변환 결과"""
    success: bool
    pdf_bytes: Optional[bytes] = None
    error_message: Optional[str] = None


class PDFConverter:
    """LibreOffice 기반 PDF 변환기"""

    def __init__(self):
        self._libreoffice_path = self._find_libreoffice()
        if self._libreoffice_path:
            logger.info(f"[PDFConverter] LibreOffice found: {self._libreoffice_path}")
        else:
            logger.warning("[PDFConverter] LibreOffice not found, PDF conversion will be disabled")

    def _find_libreoffice(self) -> Optional[str]:
        """LibreOffice 실행 파일 경로 찾기"""
        possible_paths = [
            "/usr/bin/soffice",
            "/usr/bin/libreoffice",
            "/opt/libreoffice/program/soffice",
            "soffice",  # PATH에서 찾기
        ]

        for path in possible_paths:
            try:
                result = subprocess.run(
                    [path, "--version"],
                    capture_output=True,
                    timeout=5
                )
                if result.returncode == 0:
                    return path
            except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
                continue

        return None

    def convert_to_pdf(self, file_bytes: bytes, file_name: str) -> PDFConversionResult:
        """
        파일을 PDF로 변환

        Args:
            file_bytes: 원본 파일 바이트
            file_name: 원본 파일명 (확장자 추출용)

        Returns:
            PDFConversionResult
        """
        if not self._libreoffice_path:
            return PDFConversionResult(
                success=False,
                error_message="LibreOffice not available"
            )

        # 확장자 추출
        ext = Path(file_name).suffix.lower()
        if ext not in [".doc", ".docx", ".hwp", ".hwpx"]:
            return PDFConversionResult(
                success=False,
                error_message=f"Unsupported file type for PDF conversion: {ext}"
            )

        try:
            # 임시 디렉토리에서 작업
            with tempfile.TemporaryDirectory() as temp_dir:
                # 원본 파일 저장
                input_path = os.path.join(temp_dir, f"input{ext}")
                with open(input_path, "wb") as f:
                    f.write(file_bytes)

                # LibreOffice로 PDF 변환
                # --headless: GUI 없이 실행
                # --convert-to pdf: PDF로 변환
                # --outdir: 출력 디렉토리
                result = subprocess.run(
                    [
                        self._libreoffice_path,
                        "--headless",
                        "--convert-to", "pdf",
                        "--outdir", temp_dir,
                        input_path
                    ],
                    capture_output=True,
                    timeout=120,  # 2분 타임아웃
                    env={**os.environ, "HOME": temp_dir}  # LibreOffice 프로필 격리
                )

                if result.returncode != 0:
                    error_msg = result.stderr.decode("utf-8", errors="ignore")
                    logger.error(f"[PDFConverter] LibreOffice error: {error_msg}")
                    return PDFConversionResult(
                        success=False,
                        error_message=f"LibreOffice conversion failed: {error_msg[:200]}"
                    )

                # 변환된 PDF 파일 읽기
                pdf_path = os.path.join(temp_dir, "input.pdf")
                if not os.path.exists(pdf_path):
                    # 파일명이 다를 수 있으므로 .pdf 파일 찾기
                    pdf_files = [f for f in os.listdir(temp_dir) if f.endswith(".pdf")]
                    if pdf_files:
                        pdf_path = os.path.join(temp_dir, pdf_files[0])
                    else:
                        return PDFConversionResult(
                            success=False,
                            error_message="PDF file not created after conversion"
                        )

                with open(pdf_path, "rb") as f:
                    pdf_bytes = f.read()

                logger.info(f"[PDFConverter] Successfully converted {file_name} to PDF ({len(pdf_bytes)} bytes)")
                return PDFConversionResult(
                    success=True,
                    pdf_bytes=pdf_bytes
                )

        except subprocess.TimeoutExpired:
            logger.error(f"[PDFConverter] Conversion timeout for {file_name}")
            return PDFConversionResult(
                success=False,
                error_message="PDF conversion timed out (>120s)"
            )
        except Exception as e:
            logger.error(f"[PDFConverter] Conversion error: {e}")
            return PDFConversionResult(
                success=False,
                error_message=str(e)
            )


def get_pdf_converter() -> PDFConverter:
    """PDFConverter 싱글톤 인스턴스 반환"""
    global _pdf_converter
    if _pdf_converter is None:
        _pdf_converter = PDFConverter()
    return _pdf_converter
