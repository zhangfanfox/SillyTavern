// Polyfills for React Native
import 'react-native-get-random-values';

// Comprehensive patch for reanimated logger issues
if (typeof global !== 'undefined') {
  // Patch the global object to prevent reanimated logger crashes
  const originalFatalError = global.ErrorUtils?.reportFatalError;
  if (originalFatalError) {
    global.ErrorUtils.reportFatalError = (error: any) => {
      if (error?.message?.includes('Cannot read property \'level\' of undefined')) {
        // Completely suppress this error - don't even log it
        return;
      }
      originalFatalError(error);
    };
  }

  // Patch console methods to completely suppress reanimated warnings
  const originalWarn = console.warn;
  const originalConsoleError = console.error;

  console.warn = (...args: any[]) => {
    const message = String(args[0] || '');
    if (message.includes('Cannot read property \'level\' of undefined') ||
        message.includes('Suppressed reanimated logger error') ||
        message.includes('Route "./_layout.tsx" is missing the required default export')) {
      return; // Completely suppress these warnings
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    const message = String(args[0] || '');
    if (message.includes('Cannot read property \'level\' of undefined')) {
      return; // Completely suppress this error
    }
    originalConsoleError.apply(console, args);
  };
}

// Fix for react-native-reanimated logger issue
if (typeof global !== 'undefined') {
  // Ensure console methods exist
  if (!global.console) {
    global.console = {} as any;
  }

  // Ensure all console methods exist
  const consoleMethods = ['log', 'warn', 'error', 'info', 'debug'];
  consoleMethods.forEach(method => {
    if (!global.console[method]) {
      global.console[method] = () => {};
    }
  });

  // Fix for reanimated logger level issue
  if (!global.__reanimatedLoggerConfig) {
    global.__reanimatedLoggerConfig = {
      level: 'warn',
      strict: false
    };
  }
}

// Buffer polyfill
import { Buffer } from 'buffer';
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}
