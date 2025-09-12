// Ensure global Buffer exists (needed by reused code)
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// @ts-ignore
if (!(global as any).Buffer) {
  // @ts-ignore
  (global as any).Buffer = Buffer;
}
