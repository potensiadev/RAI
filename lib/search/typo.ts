/**
 * 한글/영문 오타 보정 및 변환 유틸리티
 * 
 * 기능:
 * 1. engToKor: 영문 타자로 입력된 한글 복원 (예: "rksr" -> "간식")
 * 2. korToEng: 한글 타자로 입력된 영문 복원 (예: "ㅎ" -> "g")
 */

// ─────────────────────────────────────────────────
// 상수 및 매핑 테이블
// ─────────────────────────────────────────────────

// 초성 (Initial)
const CHO = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 중성 (Medial)
const JUNG = [
    'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
];

// 종성 (Final) - 0번째는 없음(null)
const JONG = [
    '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 영문 -> 한글 자모 매핑
const KEY_MAP: Record<string, string> = {
    'a': 'ㅁ', 'b': 'ㅠ', 'c': 'ㅊ', 'd': 'ㅇ', 'e': 'ㄷ', 'f': 'ㄹ', 'g': 'ㅎ',
    'h': 'ㅗ', 'i': 'ㅑ', 'j': 'ㅓ', 'k': 'ㅏ', 'l': 'ㅣ', 'm': 'ㅡ', 'n': 'ㅜ',
    'o': 'ㅐ', 'p': 'ㅔ', 'q': 'ㅂ', 'r': 'ㄱ', 's': 'ㄴ', 't': 'ㅅ', 'u': 'ㅕ',
    'v': 'ㅍ', 'w': 'ㅈ', 'x': 'ㅌ', 'y': 'ㅛ', 'z': 'ㅋ',
    'A': 'ㅁ', 'B': 'ㅠ', 'C': 'ㅊ', 'D': 'ㅇ', 'E': 'ㄸ', 'F': 'ㄹ', 'G': 'ㅎ',
    'H': 'ㅗ', 'I': 'ㅑ', 'J': 'ㅓ', 'K': 'ㅏ', 'L': 'ㅣ', 'M': 'ㅡ', 'N': 'ㅜ',
    'O': 'ㅒ', 'P': 'ㅖ', 'Q': 'ㅃ', 'R': 'ㄲ', 'S': 'ㄴ', 'T': 'ㅆ', 'U': 'ㅕ',
    'V': 'ㅍ', 'W': 'ㅉ', 'X': 'ㅌ', 'Y': 'ㅛ', 'Z': 'ㅋ'
};

// 한글 자모 -> 영문 매핑 (역방향)
const REVERSE_KEY_MAP: Record<string, string> = {};
// 소문자 우선 매핑하기 위해 정렬 혹은 순서 조정
// 대문자 먼저 넣고 소문자 넣으면 덮어씌워져서 소문자가 됨
Object.entries(KEY_MAP).forEach(([eng, kor]) => {
    // 이미 있으면 (대문자가 먼저 들어갔거나 등등), 소문자인 경우 덮어쓰기
    if (!REVERSE_KEY_MAP[kor] || (eng === eng.toLowerCase())) {
        REVERSE_KEY_MAP[kor] = eng;
    }
});

// 복합 자음 분해 (종성용)
const COMPOUND_CONSONANTS: Record<string, [string, string]> = {
    'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'],
    'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'],
    'ls': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'],
    'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ']
};

// 복합 모음 분해
const COMPOUND_VOWELS: Record<string, [string, string]> = {
    'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ'], 'ㅚ': ['ㅗ', 'ㅣ'],
    'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ'], 'ㅟ': ['ㅜ', 'ㅣ'],
    'ㅢ': ['ㅡ', 'ㅣ']
};


// ─────────────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────────────

function isConsonant(char: string): boolean {
    return /[ㄱ-ㅎ]/.test(char);
}

function isVowel(char: string): boolean {
    return /[ㅏ-ㅣ]/.test(char);
}

// ─────────────────────────────────────────────────
// 한글 조합 (Automaton)
// ─────────────────────────────────────────────────

/**
 * 영타 -> 한글 변환
 */
export function engToKor(text: string): string {
    let result = '';
    // 상태: 0=초성대기, 1=중성대기, 2=종성대기, 3=완료/종성확장
    let state = 0;
    let cho = '';
    let jung = '';
    let jong = '';

    // 현재 조합 중인 글자 버퍼
    function flush() {
        if (cho) {
            if (jung) {
                // 한글 음절 생성: 0xAC00 + (초성idx * 21 * 28) + (중성idx * 28) + 종성idx
                const choIdx = CHO.indexOf(cho);
                const jungIdx = JUNG.indexOf(jung);
                const jongIdx = jong ? JONG.indexOf(jong) : 0;

                if (choIdx >= 0 && jungIdx >= 0) {
                    result += String.fromCharCode(0xAC00 + (choIdx * 588) + (jungIdx * 28) + jongIdx);
                } else {
                    // 조합 실패 시 자모 그대로 출력
                    result += cho + jung + jong;
                }
            } else {
                result += cho; // 초성만 있는 경우
            }
        } else if (jung) {
            result += jung; // 중성만 있는 경우 (특수한 오타)
        }
        cho = '';
        jung = '';
        jong = '';
        state = 0;
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const korData = KEY_MAP[char];

        if (!korData) {
            flush();
            result += char;
            continue;
        }

        // 오토마타 로직
        if (state === 0) {
            // 초성 입력 대기
            if (isConsonant(korData)) {
                cho = korData;
                state = 1; // 중성 대기 상태로 이행
            } else {
                // 모음이 먼저 오면 이전 글자 끝에 붙거나 독립 출력
                // 여기서는 독립 출력 처리
                result += korData;
            }
        }
        else if (state === 1) {
            // 중성 입력 대기 (초성 있음)
            if (isVowel(korData)) {
                jung = korData;
                state = 2; // 종성 혹은 다음 글자 대기
            } else { // 자음이 또 오면? (ㄲ 같은 경우 처리하거나 앞글자 완료)
                // 여기서는 앞글자 완료하고 새로 시작 (예: 'r'->ㄱ, 'r'->ㄱ ==> ㄱㄱ)
                // 단, 겹자음 가능한 초성(ㄸ, ㅃ 등)은 매핑테이블에서 처리됨(Shift+key). 
                // 입력 키가 Shift 없는 상태에서 연속 자음은 보통 분리됨.
                flush();
                cho = korData;
                state = 1;
            }
        }
        else if (state === 2) {
            // 종성 입력 대기 (초성+중성 있음)
            if (isConsonant(korData)) {
                // 종성으로 가능한지 확인
                const jongIdx = JONG.indexOf(korData);
                if (jongIdx > 0) {
                    jong = korData;
                    state = 3;
                } else {
                    // 종성으로 불가능한 자음(ㄸ, ㅃ, ㅉ) -> 앞글자 완료, 새 글자 초성
                    flush();
                    cho = korData;
                    state = 1;
                }
            } else if (isVowel(korData)) {
                // 복합 모음 확인 (예: ㅗ + ㅏ = ㅘ)
                const combined = Object.entries(COMPOUND_VOWELS).find(([, parts]) => parts[0] === jung && parts[1] === korData);
                if (combined) {
                    jung = combined[0];
                    // 상태 유지 (여전히 종성 대기)
                } else {
                    // 새로운 모음 -> 앞글자 완료, 새 글자 시작 (모음만 시작되는 케이스, 혹은 앞글자 초성+중성 완료처리)
                    flush();
                    result += korData;
                    state = 0;
                }
            }
        }
        else if (state === 3) {
            // 종성 확장 or 다음 글자 (현재 초+중+종)
            if (isConsonant(korData)) {
                // 복합 종성 확인 (예: ㄱ + ㅅ = ㄳ)
                const combined = Object.entries(COMPOUND_CONSONANTS).find(([, parts]) => parts[0] === jong && parts[1] === korData);
                if (combined) {
                    jong = combined[0];
                    // 상태 유지 (더 이상의 복합 종성은 없음, 하지만 입력 계속 받을 수 있음)
                } else {
                    // 다음 글자 초성으로
                    flush();
                    cho = korData;
                    state = 1;
                }
            } else if (isVowel(korData)) {
                // 종성이 다음 글자의 초성으로 넘어가는 경우 (이동!!)
                // 예: '각' + 'ㅏ' -> '가' + '가' (rkr + k -> rk rk -> 가가) 
                // 실제: ㄱㅏㄱ + ㅏ -> ㄱㅏ + ㄱㅏ

                // 현재 종성이 복합 종성인 경우 분해
                let prevJong = jong;
                let movedCho = jong;

                // 복합 종성 분해 (ㄺ -> ㄹ + ㄱ)
                // 맵에서 찾기
                const decomposed = COMPOUND_CONSONANTS[jong];
                if (decomposed) {
                    prevJong = decomposed[0];
                    movedCho = decomposed[1];
                } else {
                    prevJong = ''; // 단모음 종성은 전부 넘어감
                    movedCho = jong;
                }

                // 앞글자 재조립
                const tempCho = cho;
                const tempJung = jung;

                // 현재 상태 초기화 후 앞글자 완료
                cho = tempCho;
                jung = tempJung;
                jong = prevJong;
                flush(); // 앞글자 (ㄱㅏ 혹은 ㄱㅏㄹ) 출력

                // 뒷글자 세팅
                cho = movedCho;
                jung = korData;
                state = 2; // 종성 대기
            }
        }
    }

    flush();
    return result;
}

// ─────────────────────────────────────────────────
// 한타 -> 영문 변환
// ─────────────────────────────────────────────────

/**
 * 한글 자소 분리
 */
function decomposeHangul(char: string): string[] {
    const code = char.charCodeAt(0);

    // 한글 음절 구간
    if (code >= 0xAC00 && code <= 0xD7A3) {
        const offset = code - 0xAC00;
        const jongIdx = offset % 28;
        const jungIdx = Math.floor((offset / 28) % 21);
        const choIdx = Math.floor((offset / 28) / 21);

        const result = [CHO[choIdx], JUNG[jungIdx]];
        if (jongIdx > 0) {
            // 복합 종성 분해?? 여기서 키 매핑할 때 분해된 걸 써야 하나?
            // REVERSE_KEY_MAP이 단일 자모 기준이므로 복합 자모도 분해 필요할 수 있음
            // 하지만 영타에서 복합 자음키(Shift 등)가 아닌 순차 입력이면 분해해야 함
            // 예: ㄳ -> r+t (ㄱ+ㅅ)
            // COMPOUND_CONSONANTS 사용
            const j = JONG[jongIdx];
            if (COMPOUND_CONSONANTS[j]) {
                result.push(COMPOUND_CONSONANTS[j][0]);
                result.push(COMPOUND_CONSONANTS[j][1]);
            } else {
                result.push(j);
            }
        }

        // 복합 모음 분해 (ㅘ -> ㅗ + ㅏ)
        // 영문 키 매핑 시 ㅘ(hk/ho?) -> hk (h:ㅗ, k:ㅏ)
        const v = result[1];
        if (COMPOUND_VOWELS[v]) {
            result[1] = COMPOUND_VOWELS[v][0];
            result.splice(2, 0, COMPOUND_VOWELS[v][1]);
        }

        return result;
    }

    // 자음/모음 단독
    // 복합 자모 분해 필요
    if (COMPOUND_CONSONANTS[char]) {
        return [...COMPOUND_CONSONANTS[char]];
    }
    if (COMPOUND_VOWELS[char]) {
        return [...COMPOUND_VOWELS[char]];
    }

    return [char];
}


/**
 * 한타 -> 영문 변환
 */
export function korToEng(text: string): string {
    let result = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        // 한글이면 분해
        if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(char)) {
            const jamos = decomposeHangul(char);
            for (const jamo of jamos) {
                result += REVERSE_KEY_MAP[jamo] || jamo;
            }
        } else {
            result += char;
        }
    }

    return result;
}
