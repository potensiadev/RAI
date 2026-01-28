const pptxgen = require('pptxgenjs');
const html2pptx = require('C:/Users/USER/.claude/plugins/cache/anthropic-agent-skills/example-skills/00756142ab04/skills/pptx/scripts/html2pptx.js');
const path = require('path');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Searched';
    pptx.title = '서치드 - 헤드헌터를 위한 AI 솔루션';
    pptx.subject = '헤드헌터를 위한 AI 기반 이력서 관리 및 후보자 매칭 솔루션';
    pptx.company = 'Searched';

    const slidesDir = path.join(__dirname, 'slides');
    const slides = [
        'slide1.html',  // Title
        'slide2.html',  // Pain Points
        'slide3.html',  // Solution Overview
        'slide4.html',  // Feature 1: AI Resume Analysis
        'slide5.html',  // Feature 2: JD Smart Matching
        'slide6.html',  // Feature 3: Natural Language Search
        'slide7.html',  // ROI / Results
        'slide8.html',  // Pricing
        'slide9.html',  // CTA / Contact
    ];

    for (const slideFile of slides) {
        const htmlPath = path.join(slidesDir, slideFile);
        console.log(`Processing: ${slideFile}`);
        try {
            await html2pptx(htmlPath, pptx);
            console.log(`  ✓ ${slideFile} converted successfully`);
        } catch (err) {
            console.error(`  ✗ Error processing ${slideFile}:`, err.message);
        }
    }

    const outputPath = path.join(__dirname, 'searched-presentation.pptx');
    await pptx.writeFile({ fileName: outputPath });
    console.log(`\nPresentation saved: ${outputPath}`);
}

createPresentation().catch(console.error);
