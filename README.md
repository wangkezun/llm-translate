# LLM Translate

A Chrome extension that translates selected text using any OpenAI-compatible LLM API. Features an Apple-style glassmorphism popover with page-adaptive theming.

## Features

- Select text on any webpage and click the translate button to get instant translations
- Works with any OpenAI-compatible API (OpenAI, Ollama, LM Studio, etc.)
- Supports 12 target languages: Simplified Chinese, Traditional Chinese (TW/HK), English, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Arabic
- Customizable system prompt with `{targetLang}` placeholder
- Original/translated text side-by-side comparison with language badges
- Page-adaptive theming — automatically detects page background and adjusts between light/dark styles
- Text-to-speech (TTS) — read translated text aloud with auto language detection
- Copy translation to clipboard with one click
- Cancel in-flight translations
- Dynamic model list fetching from API provider
- API Key encrypted at rest (AES-GCM)

## Installation

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project directory

## Configuration

Click the extension icon to open the settings popup:

| Setting | Description | Default |
|---------|-------------|---------|
| API Base URL | OpenAI-compatible API endpoint | `https://api.openai.com/v1` |
| API Key | Your API key (encrypted locally, not required for local models) | - |
| Model | Select from dropdown after fetching model list | `gpt-4o-mini` |
| Target Language | Translation target language | Simplified Chinese |
| System Prompt | Custom system prompt (optional) | Built-in translation prompt |

Click the refresh button (⟳) next to the model dropdown to fetch available models from your API provider.

### Using with local models

Set the API Base URL to your local endpoint (e.g., `http://localhost:11434/v1` for Ollama) and leave the API Key empty.

## Usage

1. Select any text on a webpage
2. Click the translate icon that appears near the selection
3. View the original text and translation in the popover
4. Click the **copy icon** to copy the translation
5. Click the **speaker icon** to hear the translation read aloud
6. Click **×** to close (also cancels in-progress translations)

## License

[MIT](LICENSE)
