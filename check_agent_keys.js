
const fs = require('fs');

function extractKeys(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const agentMatch = content.match(/agent: \{([\s\S]*?)\n  \},/);
    if (!agentMatch) return [];
    const agentContent = agentMatch[1];
    const lines = agentContent.split('\n');
    const keys = [];
    lines.forEach((line, index) => {
        const keyMatch = line.match(/^\s+([a-zA-Z0-9]+):/);
        if (keyMatch) {
            keys.push({ key: keyMatch[1], line: index + 1, content: line.trim() });
        }
    });
    return keys;
}

function findDuplicates(filePath) {
    const keys = extractKeys(filePath);
    const seen = {};
    const duplicates = [];
    keys.forEach(k => {
        if (seen[k.key]) {
            duplicates.push({ key: k.key, first: seen[k.key], second: k });
        } else {
            seen[k.key] = k;
        }
    });
    console.log(`Duplicates in ${filePath}:`);
    duplicates.forEach(d => {
        console.log(`Key: ${d.key}`);
        console.log(`  Line ${d.first.line}: ${d.first.content}`);
        console.log(`  Line ${d.second.line}: ${d.second.content}`);
    });
}

findDuplicates('C:/Users/kexuc/project/Alpha_lab/frontend/src/locales/en-US.ts');
findDuplicates('C:/Users/kexuc/project/Alpha_lab/frontend/src/locales/zh-CN.ts');
