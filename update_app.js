const fs = require('fs');

// Read the app.js file
let content = fs.readFileSync('app.js', 'utf8');

// Find the exact location to insert the coding agent logic
const lines = content.split('\n');
let foundIndex = -1;

// Look for the specific line
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Check if image mode is enabled')) {
    foundIndex = i;
    break;
  }
}

if (foundIndex !== -1) {
  // Insert the coding agent logic before the image mode check
  const codingLogic = [
    '            // Check if coding agent mode is selected',
    '            if (this.settings.chatMode === \'coding\') {',
    '                // Open coding agent in a new tab/window',
    '                window.open(\'coding-agent.html\', \'_blank\');',
    '                return; // Exit early to prevent normal processing',
    '            }',
    '            '
  ];
  
  // Insert the coding logic
  lines.splice(foundIndex, 0, ...codingLogic);
  
  // Join back and write to file
  const newContent = lines.join('\n');
  fs.writeFileSync('app.js', newContent);
  console.log('Successfully updated app.js to handle coding mode');
} else {
  console.log('Could not find the target location in app.js');
}