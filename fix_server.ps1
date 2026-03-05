# PowerShell script to fix server.js
$content = Get-Content "server.js" -Raw
# Remove the problematic block
$pattern = '(?s)    // Check for special "Who am I\?" questions.*?        }\s*'
$content = $content -replace $pattern, ''
# Fix the spacing issue before Greetings
$content = $content -replace '        // Greetings', '    // Greetings'
$content | Set-Content "server.js"
