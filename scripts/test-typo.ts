
import { engToKor, korToEng } from '../lib/search/typo';

console.log('Running Typo Correction Tests...');

const tests = [
    // Eng -> Kor
    // rksr -> 간ㄱ (식이 되려면 rkstlr 여야 함)
    { name: 'rksr -> 간ㄱ', fn: engToKor, input: 'rksr', expected: '간ㄱ' },
    // gksrla -> 한김 (글이 되려면 gksrmf 여야 함)
    { name: 'gksrmf -> 한글', fn: engToKor, input: 'gksrmf', expected: '한글' },
    { name: 'dkssud -> 안녕', fn: engToKor, input: 'dkssud', expected: '안녕' },
    { name: 'rla -> 김', fn: engToKor, input: 'rla', expected: '김' },
    { name: 'rk -> 가', fn: engToKor, input: 'rk', expected: '가' },
    { name: 'r -> ㄱ', fn: engToKor, input: 'r', expected: 'ㄱ' },
    { name: 'rks -> 간', fn: engToKor, input: 'rks', expected: '간' },
    { name: 'rksrk -> 간가', fn: engToKor, input: 'rksrk', expected: '간가' },
    { name: 'rkskk -> 가나ㅏ', fn: engToKor, input: 'rkskk', expected: '가나ㅏ' },
    { name: 'Rk -> 까', fn: engToKor, input: 'Rk', expected: '까' },

    // Complex Batchim (Double Final Consonants)
    { name: 'rkr -> 각', fn: engToKor, input: 'rkr', expected: '각' },
    { name: 'rkt -> 갓', fn: engToKor, input: 'rkt', expected: '갓' },
    { name: 'rkrt -> 갃 (ㄱ+ㅅ)', fn: engToKor, input: 'rkrt', expected: '갃' },
    { name: 'rksw -> 갅', fn: engToKor, input: 'rksw', expected: '갅' },

    // Syllable Boundary (Jongseong -> Choseong move)
    { name: 'rkrtk -> 각사', fn: engToKor, input: 'rkrtk', expected: '각사' },

    { name: 'rksrk -> 간가', fn: engToKor, input: 'rksrk', expected: '간가' },
    { name: 'rksl -> 가니', fn: engToKor, input: 'rksl', expected: '가니' },

    // Mixed / English-only
    { name: 'React -> ㄲㄷㅁㅊㅅ', fn: engToKor, input: 'React', expected: 'ㄲㄷㅁㅊㅅ' },

    // Kor -> Eng
    { name: '간식 -> rkstlr', fn: korToEng, input: '간식', expected: 'rkstlr' },
    // ㄱ: r, ㅏ: k, ㄴ: s -> rks
    // ㅅ: t, ㅣ: l, ㄱ: r -> tlr
    // rks + tlr -> rkstlr

    { name: '한글 -> gksrmf', fn: korToEng, input: '한글', expected: 'gksrmf' },
    { name: 'ㅎ -> g', fn: korToEng, input: 'ㅎ', expected: 'g' },
    { name: 'ㅏ -> k', fn: korToEng, input: 'ㅏ', expected: 'k' },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
    const output = t.fn(t.input);
    if (output === t.expected) {
        passed++;
        console.log(`[PASS] ${t.name}`);
    } else {
        failed++;
        console.error(`[FAIL] ${t.name}`);
        console.error(`  Expected: ${t.expected}`);
        console.error(`  Actual:   ${output}`);
    }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);

