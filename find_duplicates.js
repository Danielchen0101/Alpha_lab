const fs = require('fs');
const path = require('path');

function findDuplicates(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let stack = [];
    let currentObject = null;
    let duplicates = [];
    let keysInScope = [new Set()];

    const keyRegex = /^\s*([a-zA-Z0-9_]+|'[^']+'|"[^"]+")\s*:/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Count open and close braces to manage scope
        for (let char of line) {
            if (char === '{') {
                keysInScope.push(new Set());
            } else if (char === '}') {
                keysInScope.pop();
            }
        }

        const match = line.match(keyRegex);
        if (match) {
            let key = match[1];
            // Remove quotes if present
            if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
                key = key.substring(1, key.length - 1);
            }

            const currentScope = keysInScope[keysInScope.length - 1];
            if (currentScope.has(key)) {
                duplicates.push({ key, line: i + 1, content: line.trim() });
            } else {
                currentScope.add(key);
            }
        }
    }
    return duplicates;
}

const files = [
    'frontend/src/locales/en-US.ts',
    'frontend/src/locales/zh-CN.ts'
];

files.forEach(file => {
    const absolutePath = path.resolve(process.cwd(), file);
    console.log(`Checking ${file}...`);
    const duplicates = findDuplicates(absolutePath);
    if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicates in ${file}:`);
        duplicates.forEach(d => {
            console.log(`  Line ${d.line}: key "${d.key}" -> ${d.content}`);
        });
    } else {
        console.log(`No duplicates found in ${file}.`);
    }
});
