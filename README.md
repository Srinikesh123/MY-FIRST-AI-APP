# AI Assistant with ChatGPT Integration

A modern web-based AI assistant that connects to ChatGPT/OpenAI API to provide intelligent responses.

## Features

- ✅ Real ChatGPT/OpenAI integration
- ✅ Conversation context memory
- ✅ Simple language mode toggle
- ✅ Fast response times
- ✅ Modern, beautiful UI
- ✅ Error handling with clear messages
- ✅ Session-based conversation history
- ✅ **NEW: Advanced Mode System** - Switch between different AI behaviors
  - **Normal Mode** - Standard chat experience
  - **Detailed Mode** - Long, comprehensive responses
  - **Picture Mode** - Image-focused responses
  - **Code Mode** - GPT Codex for coding assistance

## Mode System Usage

The application includes an advanced mode system that allows you to switch between different AI behaviors:

1. Type `/` in the chat input field
2. A dropdown menu will appear with mode options
3. Select a mode using mouse click or arrow keys + Enter
4. The AI will adjust its responses based on the selected mode

Available commands:
- `/normal` - Standard chat mode
- `/detailed` - Long, detailed responses  
- `/picture` - Image-focused responses
- `/code` - GPT Codex for coding help

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy your API key

### 3. Configure Environment

Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
PORT=3000
```

Or copy the example file:
```bash
cp .env.example .env
```

Then edit `.env` and add your API key.

### 4. Start the Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 5. Open the Frontend

Open `index.html` in your web browser, or serve it through the server.

## Usage

1. Make sure the backend server is running
2. Open `index.html` in your browser
3. Type your message and press Enter or click Send
4. Toggle "Simple Language" for easier-to-understand responses
5. Use the mode system by typing `/` to switch between different AI behaviors
6. The AI will respond with the exact answer from ChatGPT

## API Endpoints

- `POST /api/chat` - Send a message to the AI
  - Body: `{ message: string, history: array, simpleLanguage: boolean, mode: string, mood: string, errorFreeMode: boolean }`
  - Returns: `{ response: string }`

- `POST /api/image` - Generate an image
  - Body: `{ prompt: string, userId: string, mode: string }`
  - Returns: `{ imageUrl: string }`

- `GET /api/health` - Check if server is running
  - Returns: `{ status: string, message: string }`

## Configuration

You can change the OpenAI model in `.env`:
- `gpt-3.5-turbo` (default, faster, cheaper)
- `gpt-4` (more capable, slower, more expensive)
- `gpt-4-turbo-preview` (latest GPT-4)

## Troubleshooting

**Server won't start:**
- Make sure port 3000 is not in use
- Check that all dependencies are installed (`npm install`)

**API errors:**
- Verify your OpenAI API key is correct in `.env`
- Check your OpenAI account has credits
- Ensure the API key has proper permissions

**Frontend can't connect:**
- Make sure the backend server is running
- Check the server URL in `app.js` matches your server port
- Check browser console for CORS errors

**Mode system not working:**
- Make sure you've applied the patch instruction in PATCH_INSTRUCTIONS.md
- The mode system requires the `this.currentMode` integration in app.js

## License

MIT