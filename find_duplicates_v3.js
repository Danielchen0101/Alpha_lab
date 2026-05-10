const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let outputLines = [];
    let scopeStack = [new Set()];
    let deletedKeys = [];
    
    // We need to handle nested objects correctly.
    // Each time we see '{', we start a new scope.
    // Each time we see '}', we end the current scope.
    
    const keyRegex = /^(\s*)([a-zA-Z0-9_]+|'[^']+'|"[^"]+")(\s*):/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        let match = line.match(keyRegex);
        let skipLine = false;
        
        if (match) {
            let key = match[2];
            if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
                key = key.substring(1, key.length - 1);
            }
            
            let currentScope = scopeStack[scopeStack.length - 1];
            if (currentScope.has(key)) {
                deletedKeys.push({ key, line: i + 1, content: trimmedLine });
                skipLine = true;
            } else {
                currentScope.add(key);
            }
        }
        
        if (!skipLine) {
            outputLines.push(line);
        }
        
        // Update scopeStack based on braces in the line
        // Note: This simple brace counting might fail on braces in strings or comments,
        // but for these translation files it should be fine.
        let braceLine = line;
        // Remove comments to avoid false positives
        braceLine = braceLine.replace(/\/\/.*$/, '');
        braceLine = braceLine.replace(/\/\*.*?\*\//g, '');
        
        for (let char of braceLine) {
            if (char === '{') {
                scopeStack.push(new Set());
            } else if (char === '}') {
                if (scopeStack.length > 1) {
                    scopeStack.pop();
                }
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
