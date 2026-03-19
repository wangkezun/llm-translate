# LLM Translate

A Chrome extension that translates selected text using any OpenAI-compatible LLM API.

## Features

- Select text on any webpage and click the translate button to get instant translations
- **Multi-model support** — configure multiple LLM providers and switch between them instantly
- Works with any OpenAI-compatible API (OpenAI, Ollama, LM Studio, etc.)
- Supports 12 target languages: Simplified Chinese, Traditional Chinese (TW/HK), English, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Arabic
- Customizable system prompt with `{targetLang}` placeholder
- Dark mode support
- Copy translation result to clipboard with one click

## Installation

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project directory

## Configuration

The extension separates quick settings from full configuration:

### Popup (click the extension icon)

Quickly switch the active model and target language — changes are saved automatically, no save button needed.

### Options page (click "⚙️ 模型与高级设置" in the popup)

Manage all models and advanced settings:

| Setting | Description | Default |
|---------|-------------|---------|
| Model Name | Display name for the model | `GPT-4o-mini` |
| API Base URL | OpenAI-compatible API endpoint | `https://api.openai.com/v1` |
| API Key | Your API key (not required for local models) | - |
| Model ID | Model identifier sent to the API | `gpt-4o-mini` |
| Target Language | Translation target language | Simplified Chinese |
| System Prompt | Custom system prompt (optional) | Built-in translation prompt |

You can add multiple models and switch between them from the popup.

### Using with local models

Set the API Base URL to your local endpoint (e.g., `http://localhost:11434/v1` for Ollama) and leave the API Key empty.

## Usage

1. Select any text on a webpage
2. Click the translate icon that appears near the selection
3. View the translation in the popup bubble
4. Click **Copy** to copy the result

## License

[MIT](LICENSE)
