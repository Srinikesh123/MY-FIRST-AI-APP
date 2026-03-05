$content = Get-Content "server.js" -Raw
# Remove orphaned brackets
$content = $content -replace '\);\s*}\s*}\s*', ''
$content | Set-Content "server.js"
