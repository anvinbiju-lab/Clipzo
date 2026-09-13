const fs = require('fs');
let content = fs.readFileSync('components/PcView.tsx', 'utf8');

content = content.replace(
  /\{error \? \([\s\S]*? Retry Connection\s*<\/button>\s*\)\s*:\s*\(\s*<span className="text-neutral-400 text-sm font-medium animate-pulse">\s*Generating code\.\.\.\s*<\/span>\s*\)\}/,
  `<span className="text-neutral-400 text-sm font-medium animate-pulse">Generating code...</span>`
);

fs.writeFileSync('components/PcView.tsx', content);
console.log('PcView restored');
