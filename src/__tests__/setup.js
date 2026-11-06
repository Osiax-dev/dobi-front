import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom n'a pas ResizeObserver (utilisé par les graphiques recharts).
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
