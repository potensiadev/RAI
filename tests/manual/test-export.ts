
import { generateBlindResumeHTML } from "@/lib/pdf/blind-export-generator";

const mockCandidate = {
    name: "Hong Gil Dong",
    last_position: "Senior Engineer",
    last_company: "Global Tech",
    exp_years: 7,
    summary: "Experienced developer...",
    skills: ["React", "Node.js", "Python"],
    careers: [
        {
            company: "Company A",
            position: "Lead",
            start_date: "2020.01",
            is_current: true,
            description: "Led team...",
        }
    ],
    education: [
        {
            school: "Seoul Univ",
            major: "CS",
            graduation_year: 2018
        }
    ],
    phone: "010-1234-5678", // Should not appear
};

const html = generateBlindResumeHTML(mockCandidate, {
    includePhoto: false,
    includePortfolio: false
});

console.log("Generated HTML Length:", html.length);
console.log("Contains Name:", html.includes("Hong Gil Dong"));
console.log("Contains Phone:", html.includes("010-1234-5678")); // Should be false
console.log("Contains Masked Label:", html.includes("[블라인드 처리됨]")); // Should be true
