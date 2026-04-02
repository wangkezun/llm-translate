// Constants for LLM Translate extension

// Timeouts
export const DEFAULT_TIMEOUT = 30000; // 30 seconds timeout for API calls

// UI constants
export const PADDING = 8; // UI padding constant
export const MAX_BUBBLE_WIDTH = 420;
export const MIN_BUBBLE_WIDTH = 200;
export const MAX_BUBBLE_HEIGHT = 300;

// Storage
export const ENCRYPTION_KEY_NAME = "llmt-encryption-key";

// Port name for service worker communication
export const PORT_NAME = "llmt-translate";

// System prompt template
export const DEFAULT_SYSTEM_PROMPT =
  "You are a professional translator. Translate the following text to {targetLang}. Only return the translated text without any explanation or extra content.";
