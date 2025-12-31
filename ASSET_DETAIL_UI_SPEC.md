# UI SPECIFICATION: Asset Detail & Intelligence View
> **Target Page:** `/assets/[id]` (or Modal Route)
> **Core Feature:** Deep Dive Analysis, Privacy Shield, Version Stacking
> **Design Theme:** "Clear Glass & Liquid Motion"

---

## 1. Interaction Strategy: The Morphing Transition
대시보드 리스트에서 클릭 시, 새 페이지로 뚝 끊겨서 이동하지 않고 **카드가 확장되어 화면을 채우는(Morphing)** 방식을 사용합니다.

* **Trigger:** 대시보드의 `<LevitatingCard>` 클릭.
* **Transition Logic (Framer Motion `layoutId`):**
    1.  클릭된 카드의 `layoutId`가 상세 뷰의 컨테이너 `layoutId`와 연결됨.
    2.  카드의 썸네일(사진) -> 상세 뷰의 프로필 이미지로 자연스럽게 이동 및 확대.
    3.  카드의 배경 -> 상세 뷰의 전체 배경(Glass Panel)으로 확장.
    4.  나머지 대시보드 요소들은 뒤로 물러나며(Scale Down) 블러 처리 (`backdrop-blur`).

---

## 2. Layout Structure: The Split Intelligence
화면을 5:5 또는 6:4 비율로 분할하여 **"원본 증거(Fact)"**와 **"AI 판단(Insight)"**을 한눈에 대조할 수 있게 합니다.

### 2.1. Left Pane: Original Document Viewer (`<DocViewer />`)
* **Visual:** 종이 질감이 아닌, 디지털 스캔된 홀로그램 느낌의 뷰어.
* **Core Feature: The Privacy Shield (Interactive Blur)**
    * **Default State:** 전화번호, 이메일, 주민번호 등 PII 영역에 `blur-lg` 필터와 함께 "빗금 패턴(Stripes)" 오버레이 적용.
    * **Interaction (The Reveal):**
        * 마우스를 해당 영역에 가져가면(`Hover`), 손전등을 비추듯 블러가 **액체처럼 서서히 걷힘 (Liquid Mask Reveal)**.
        * 마우스가 떠나면 다시 빠르게 보안 블러 처리.
    * **Security Feedback:** 텍스트 드래그/복사 시도(`Ctrl+C`) 시, 붉은색 "Copy Detected" 토스트 메시지가 뜨며 화면이 일시적으로 붉게 점멸(Red Flash).

### 2.2. Right Pane: Intelligence Panel (`<AnalysisReport />`)
AI가 분석한 데이터를 정형화하여 보여주는 패널입니다. 스크롤이 가능하며, 각 섹션은 카드로 구분됩니다.

#### A. Header Section (Profile)
* **Elements:**
    * **Name:** "김** (Backend Dev)" - 이름은 부분 마스킹.
    * **Status Badge:**
        * `Active` (초록색 펄스 점), `Blacklisted` (붉은색 해골 아이콘).
    * **Matching Score:**
        * 단순 숫자가 아닌 **원형 차트(Donut Chart)**.
        * 점수가 85점이라면, 차트의 게이지가 0에서 85까지 `spring` 애니메이션으로 차오름.

#### B. Cross-Check Grid (Verification)
AI가 문서 내용과 실제 데이터를 교차 검증한 결과.
* **UI:** 2열 그리드 카드.
* **Interaction:**
    * **True (일치):** 항목 옆에 초록색 체크 표시가 부드럽게 그려짐 (`pathLength` animation).
    * **Mismatch (불일치):** 노란색 경고 아이콘이 뜨며, 클릭 시 원본 문서의 해당 위치로 스크롤 이동(Anchor Link).

#### C. Career Timeline (Vectorized History)
* **Visual:** 수직 타임라인.
* **Nodes:** 각 경력(회사)은 타임라인 위의 '행성(Planet)'처럼 표현.
* **Hover:** 노드 호버 시, 해당 기간에 사용한 스킬 태그들이 주변에 위성처럼 떠오름 (Orbit Animation).

---

## 3. Feature: Deduplication (Version Stacking)
> **PRD Ref:** 중복 방어, Version Stacking

동일 인물의 과거 이력서가 발견된 경우, 이를 탭(Tab)이 아닌 **"물리적인 카드 스택(Card Stack)"**으로 표현합니다.

* **UI:** 메인 패널 뒤쪽에 오래된 버전의 문서들이 겹쳐서 살짝 보임 (Rotation -5deg, -10deg).
* **Interaction (Shuffle):**
    * 뒤쪽 카드의 귀퉁이를 클릭하면, 현재 카드가 아래로 내려가고 과거 카드가 앞으로 튀어 나옴 (`z-index` swap with Spring Physics).
    * 마치 포커 카드를 섞는 듯한 효과.

---

## 4. Feature: Action Bar (Floating Dock)
화면 하단 중앙에 떠 있는 맥OS 스타일의 독(Dock).

* **Position:** `fixed bottom-8 left-1/2 -translate-x-1/2`.
* **Buttons:**
    1.  **Download:** PDF 원본 다운로드 (Icon: ArrowDown).
    2.  **Share:** 팀원에게 공유 (Icon: Link).
    3.  **Chat:** 이 후보자에 대해 AI에게 질문 (Icon: Sparkles).
* **Physics:**
    * 마우스가 접근하면 아이콘들이 물결치듯 확대됨 (Magnification Effect).
    * 클릭 시 버튼이 깊게 눌리는(Press) 타격감 구현.

---

## 5. Development Guidelines (Snippet)

### A. Privacy Shield Component (Framer Motion)
```javascript
// 마우스 위치에 따라 마스킹이 벗겨지는 효과
<motion.div
  className="relative overflow-hidden"
  onMouseMove={(e) => {
    // 마우스 좌표 추적 로직 (maskPosition 업데이트)
  }}
>
  {/* 블러 레이어 (상단) */}
  <motion.div
    className="absolute inset-0 backdrop-blur-md bg-white/10 z-10"
    style={{
      maskImage: useMotionTemplate`radial-gradient(circle at ${x}px ${y}px, transparent 50px, black 100px)`
    }}
  />
  {/* 원본 텍스트 (하단) */}
  <span className="text-white">010-1234-5678</span>
</motion.div>
B. Version Stack Variant

// 카드가 뒤에 겹쳐 있을 때의 상태
const stackVariant = {
  active: { scale: 1, rotate: 0, zIndex: 10 },
  history1: { scale: 0.95, rotate: -3, zIndex: 5, y: -10 },
  history2: { scale: 0.9, rotate: -6, zIndex: 1, y: -20 }
};