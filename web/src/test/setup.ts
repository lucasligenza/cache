import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom does not implement window.scrollTo; CaptureBar uses it to cancel iOS focus-pan.
window.scrollTo = vi.fn();
