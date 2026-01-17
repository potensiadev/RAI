const fs = require('fs');
const path = 'd:/RAI/supabase/migrations';

const files = fs.readdirSync(path);

files.forEach(file => {
    if (file.endsWith('.sql')) {
        const filePath = path + '/' + file;
        let content = fs.readFileSync(filePath, 'utf8');

        // Replace the problematic separator
        content = content.replace(/━/g, '-');

        // Remove any BOM if present (0xFEFF)
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        fs.writeFileSync(filePath, content, { encoding: 'utf8' }); // Node defaults to UTF-8 without BOM usually, but good to be explicit
        console.log(`Sanitized: ${file}`);
    }
});
