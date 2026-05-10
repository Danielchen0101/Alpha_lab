const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let outputLines = [];
    let keysInScope = [new Set()];
    let deletedKeys = [];

    const keyRegex = /^(\s*)([a-zA-Z0-9_]+|'[^']+'|"[^"]+")(\s*):/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        let skipLine = false;
        const match = line.match(keyRegex);
        if (match) {
            let key = match[2];
            // Remove quotes if present
            if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
                key = key.substring(1, key.length - 1);
            }

            const currentScope = keysInScope[keysInScope.length - 1];
            if (currentScope.has(key)) {
                deletedKeys.push({ key, line: i + 1, content: line.trim() });
                skipLine = true;
            } else {
                currentScope.add(key);
            }
        }

        if (!skipLine) {
            outputLines.push(line);
        }

        // Count open and close braces to manage scope AFTER processing the key
        // This is a bit simplistic but works for this file structure
        for (let char of line) {
            if (char === '{') {
                keysInScope.push(new Set());
            } else if (char === '}') {
                keysInScope.pop();
            }
        }
    }
    
    if (deletedKeys.length > 0) {
        fs.writeFileSync(filePath, outputLines.join('\n'), 'utf8');
    }
    
    return deletedKeys;
}

const files = [
    'frontend/src/locales/en-US.ts',
    'frontend/src/locales/zh-CN.ts'
];

files.forEach(file => {
    const absolutePath = path.resolve(process.cwd(), file);
    console.log(`Processing ${file}...`);
    const deleted = processFile(absolutePath);
    if (deleted.length > 0) {
        console.log(`Deleted ${deleted.length} duplicates from ${file}:`);
        deleted.forEach(d => {
            console.log(`  Line ${d.line}: key "${d.key}" -> ${d.content}`);
        });
    } else {
        console.log(`No duplicates found in ${file}.`);
    }
});
