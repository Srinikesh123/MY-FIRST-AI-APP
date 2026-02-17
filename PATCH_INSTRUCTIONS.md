# Patch Instructions for App.js

To complete the mode system integration, you need to manually update the following line in app.js:

## Location
File: `app.js`
Line: ~1891
Current code:
```javascript
                        mode: this.settings.chatMode || 'fast',
```

Change to:
```javascript
                        mode: this.currentMode || this.settings.chatMode || 'fast',
```

## Why This Change Is Needed
The mode system sets `this.currentMode` when a mode is selected, but the chat API call was still using `this.settings.chatMode`. This change ensures that when a user selects a mode from the dropdown, that mode is properly sent to the backend API.

## How to Apply
1. Open `app.js` in a text editor
2. Find line 1891 (the line with `mode: this.settings.chatMode || 'fast',`)
3. Replace it with `mode: this.currentMode || this.settings.chatMode || 'fast',`
4. Save the file

This completes the integration between the frontend mode system and the backend API.