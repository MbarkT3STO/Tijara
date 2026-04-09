const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, 'src', 'styles');

function processCSSFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace text-align
    content = content.replace(/text-align:\s*left;/g, 'text-align: start;');
    content = content.replace(/text-align:\s*right;/g, 'text-align: end;');

    // Replace padding
    content = content.replace(/padding-left:/g, 'padding-inline-start:');
    content = content.replace(/padding-right:/g, 'padding-inline-end:');

    // Replace margin
    content = content.replace(/margin-left:/g, 'margin-inline-start:');
    content = content.replace(/margin-right:/g, 'margin-inline-end:');

    // Replace border
    content = content.replace(/border-left:/g, 'border-inline-start:');
    content = content.replace(/border-right:/g, 'border-inline-end:');
    content = content.replace(/border-left-color:/g, 'border-inline-start-color:');
    content = content.replace(/border-right-color:/g, 'border-inline-end-color:');

    // Replace positioning
    content = content.replace(/left:\s*0\s*;/g, 'inset-inline-start: 0;');
    content = content.replace(/right:\s*0\s*;/g, 'inset-inline-end: 0;');
    content = content.replace(/left:\s*var\(([^)]+)\)\s*;/g, 'inset-inline-start: var($1);');
    content = content.replace(/right:\s*var\(([^)]+)\)\s*;/g, 'inset-inline-end: var($1);');

    // Specifically for Sidebar Translate
    content = content.replace(/transform:\s*translateX\(-100\%\);/g, 'transform: translateX(var(--sidebar-translate));');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed ${path.basename(filePath)}`);
}

['layout.css', 'components.css'].forEach(file => {
    processCSSFile(path.join(cssDir, file));
});

console.log('CSS RTL adjustments done.');
