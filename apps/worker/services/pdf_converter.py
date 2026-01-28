"""
<<<<<<< HEAD
PDF Converter Service - DOC/DOCX/HWP → PDF 변환

업로드된 파일이 PDF가 아닌 경우 LibreOffice를 사용하여
PDF로 변환하고 Supabase Storage에 저장합니다.
"""

import os
import tempfile
import logging
from typing import Optional, Tuple
from dataclasses import dataclass

from utils.subprocess_utils import run_libreoffice_convert, LIBREOFFICE_TIMEOUT
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
=======
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
>>>>>>> a6f5f5c3ae4f6e5cb3d4e2ccd6c352bd36b1018f


@dataclass
class PDFConversionResult:
    """PDF 변환 결과"""
    success: bool
    pdf_bytes: Optional[bytes] = None
    error_message: Optional[str] = None
<<<<<<< HEAD
    conversion_method: str = "libreoffice"


class PDFConverter:
    """
    PDF 변환기

    DOC, DOCX, HWP, HWPX 파일을 LibreOffice를 사용하여 PDF로 변환합니다.
    """

    # PDF 변환 대상 파일 타입
    CONVERTIBLE_TYPES = {"doc", "docx", "hwp", "hwpx"}

    def __init__(self):
        pass

    def needs_conversion(self, file_type: str) -> bool:
        """
        PDF 변환이 필요한 파일인지 확인

        Args:
            file_type: 파일 타입 (확장자)

        Returns:
            변환 필요 여부
        """
        return file_type.lower() in self.CONVERTIBLE_TYPES

    def convert_to_pdf(
        self,
        file_bytes: bytes,
        filename: str,
        timeout: int = LIBREOFFICE_TIMEOUT,
    ) -> PDFConversionResult:
=======


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
>>>>>>> a6f5f5c3ae4f6e5cb3d4e2ccd6c352bd36b1018f
        """
        파일을 PDF로 변환

        Args:
            file_bytes: 원본 파일 바이트
<<<<<<< HEAD
            filename: 파일명 (확장자 확인용)
            timeout: 변환 타임아웃 (초)
=======
            file_name: 원본 파일명 (확장자 추출용)
>>>>>>> a6f5f5c3ae4f6e5cb3d4e2ccd6c352bd36b1018f

        Returns:
            PDFConversionResult
        """
<<<<<<< HEAD
        ext = filename.lower().split('.')[-1] if '.' in filename else ''

        if ext == 'pdf':
            # 이미 PDF인 경우
            return PDFConversionResult(
                success=True,
                pdf_bytes=file_bytes,
                conversion_method="none"
            )

        if ext not in self.CONVERTIBLE_TYPES:
=======
        if not self._libreoffice_path:
            return PDFConversionResult(
                success=False,
                error_message="LibreOffice not available"
            )

        # 확장자 추출
        ext = Path(file_name).suffix.lower()
        if ext not in [".doc", ".docx", ".hwp", ".hwpx"]:
>>>>>>> a6f5f5c3ae4f6e5cb3d4e2ccd6c352bd36b1018f
            return PDFConversionResult(
                success=False,
                error_message=f"Unsupported file type for PDF conversion: {ext}"
            )

<<<<<<< HEAD
        # LibreOffice로 변환
        return self._convert_via_libreoffice(file_bytes, filename, timeout)

    def _convert_via_libreoffice(
        self,
        file_bytes: bytes,
        filename: str,
        timeout: int,
    ) -> PDFConversionResult:
        """
        LibreOffice를 사용하여 PDF로 변환

        Args:
            file_bytes: 원본 파일 바이트
            filename: 파일명
            timeout: 타임아웃 (초)

        Returns:
            PDFConversionResult
        """
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # 원본 파일 저장
                input_path = os.path.join(temp_dir, filename)
                with open(input_path, 'wb') as f:
                    f.write(file_bytes)

                # LibreOffice로 PDF 변환
                result = run_libreoffice_convert(
                    input_path=input_path,
                    output_dir=temp_dir,
                    output_format="pdf",
                    timeout=timeout
                )

                if not result.success:
                    error_msg = result.error_message or "LibreOffice conversion failed"
                    if result.timed_out:
                        error_msg = f"LibreOffice conversion timed out after {timeout}s"
                    logger.error(f"[PDFConverter] {error_msg}")
                    return PDFConversionResult(
                        success=False,
                        error_message=error_msg
                    )

                # 변환된 PDF 파일 찾기
                base_name = os.path.splitext(filename)[0]
                pdf_filename = f"{base_name}.pdf"
                pdf_path = os.path.join(temp_dir, pdf_filename)

                if not os.path.exists(pdf_path):
                    # 파일명이 다를 수 있으므로 .pdf 확장자로 검색
                    for f in os.listdir(temp_dir):
                        if f.endswith('.pdf'):
                            pdf_path = os.path.join(temp_dir, f)
                            break

                if not os.path.exists(pdf_path):
                    logger.error(f"[PDFConverter] PDF output not found after conversion")
                    return PDFConversionResult(
                        success=False,
                        error_message="PDF conversion output not found"
                    )

                # PDF 바이트 읽기
                with open(pdf_path, 'rb') as f:
                    pdf_bytes = f.read()

                logger.info(f"[PDFConverter] Successfully converted {filename} to PDF ({len(pdf_bytes)} bytes)")

                return PDFConversionResult(
                    success=True,
                    pdf_bytes=pdf_bytes,
                    conversion_method="libreoffice"
                )

            except Exception as e:
                logger.error(f"[PDFConverter] Conversion error: {e}", exc_info=True)
                return PDFConversionResult(
                    success=False,
                    error_message=str(e)
                )


# 싱글톤 인스턴스
_pdf_converter: Optional[PDFConverter] = None


def get_pdf_converter() -> PDFConverter:
    """PDF Converter 싱글톤 인스턴스 반환"""
=======
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
>>>>>>> a6f5f5c3ae4f6e5cb3d4e2ccd6c352bd36b1018f
    global _pdf_converter
    if _pdf_converter is None:
        _pdf_converter = PDFConverter()
    return _pdf_converter
