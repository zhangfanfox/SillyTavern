import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { AVGCanvasProps } from '../../src/types/avg';

interface CanvasMessage {
  type: 'ready' | 'error' | 'imageLoaded' | 'imageError' | 'resize' | 'networkError' | 'retrySuccess';
  data?: any;
}

interface AVGCanvasPropsExtended extends AVGCanvasProps {
  onImageError?: (error: { type: string; path: string; message: string }) => void;
  onImageLoaded?: (info: { type: string; path: string; isPlaceholder?: boolean }) => void;
}

const AVGCanvas = forwardRef<WebView, AVGCanvasPropsExtended>(({
  backgroundImage,
  characterImage,
  characterPosition,
  onCanvasReady,
  onImageError,
  onImageLoaded,
  style,
}, ref) => {
  const webViewRef = useRef<WebView>(null);

  // Expose WebView ref to parent
  useImperativeHandle(ref, () => webViewRef.current!, []);
  const [canvasReady, setCanvasReady] = useState(false);
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height: height * 0.6 }; // Canvas takes 60% of screen height
  });

  // Handle screen dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const newDimensions = { width: window.width, height: window.height * 0.6 };
      setDimensions(newDimensions);

      if (canvasReady) {
        sendMessageToCanvas('resize', newDimensions);
      }
    });

    return () => subscription?.remove();
  }, [canvasReady, sendMessageToCanvas]);

  // Send message to Canvas WebView
  const sendMessageToCanvas = useCallback((type: string, data?: any) => {
    if (webViewRef.current) {
      const message = JSON.stringify({ type, data });
      webViewRef.current.postMessage(message);
    }
  }, []);

  // Handle messages from Canvas WebView
  const handleMessage = useCallback((event: any) => {
    try {
      const message: CanvasMessage = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'ready':
          setCanvasReady(true);
          onCanvasReady();
          break;
        case 'error':
          console.error('Canvas error:', message.data);
          if (onImageError) {
            onImageError({
              type: 'canvas',
              path: message.data?.path || 'unknown',
              message: message.data?.message || 'Canvas error',
            });
          }
          break;
        case 'imageLoaded':
          console.log('Image loaded:', message.data);
          if (onImageLoaded) {
            onImageLoaded({
              type: message.data?.type || 'unknown',
              path: message.data?.path || 'unknown',
              isPlaceholder: message.data?.isPlaceholder,
            });
          }
          break;
        case 'imageError':
          console.warn('Image load error:', message.data);
          if (onImageError) {
            onImageError({
              type: message.data?.type || 'unknown',
              path: message.data?.path || 'unknown',
              message: message.data?.error || 'Image load error',
            });
          }
          break;
        case 'networkError':
          console.warn('Network error:', message.data);
          if (onImageError) {
            onImageError({
              type: 'network',
              path: message.data?.path || 'unknown',
              message: 'Network connection failed',
            });
          }
          break;
        case 'retrySuccess':
          console.log('Retry successful:', message.data);
          if (onImageLoaded) {
            onImageLoaded({
              type: message.data?.type || 'unknown',
              path: message.data?.path || 'unknown',
              isPlaceholder: false,
            });
          }
          break;
      }
    } catch (error) {
      console.error('Failed to parse canvas message:', error);
    }
  }, [onCanvasReady, onImageError, onImageLoaded]);

  // Update background image when prop changes
  useEffect(() => {
    if (canvasReady && backgroundImage) {
      sendMessageToCanvas('loadBackground', { imagePath: backgroundImage });
    }
  }, [canvasReady, backgroundImage, sendMessageToCanvas]);

  // Update character image and position when props change
  useEffect(() => {
    if (canvasReady && characterImage) {
      sendMessageToCanvas('loadCharacter', {
        imagePath: characterImage,
        position: characterPosition || { x: 0.5, y: 0.5, scale: 1.0 },
      });
    }
  }, [canvasReady, characterImage, characterPosition, sendMessageToCanvas]);

  // HTML content for the Canvas WebView
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        body {
          margin: 0;
          padding: 0;
          background: #000;
          overflow: hidden;
          touch-action: none;
        }
        canvas {
          display: block;
          width: 100%;
          height: 100%;
          touch-action: none;
        }
      </style>
    </head>
    <body>
      <canvas id="avgCanvas"></canvas>
      <script>
        class AVGCanvasRenderer {
          constructor() {
            this.canvas = document.getElementById('avgCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.backgroundImage = null;
            this.characterImage = null;
            this.characterPosition = { x: 0.5, y: 0.5, scale: 1.0 };
            this.characterOpacity = 1.0;
            this.characterExpression = 'neutral';
            this.imageCache = new Map();
            this.animationFrame = null;
            
            // Performance optimization properties
            this.isDirty = true;
            this.dirtyRegions = [];
            this.lastRenderTime = 0;
            this.targetFPS = 60;
            this.frameInterval = 1000 / this.targetFPS;
            this.isRendering = false;
            
            // Memory management
            this.maxCacheSize = 20;
            this.cacheAccessTimes = new Map();
            
            // Offscreen canvas for complex operations
            this.offscreenCanvas = null;
            this.offscreenCtx = null;
            
            // Performance monitoring
            this.frameCount = 0;
            this.fpsStartTime = performance.now();
            this.currentFPS = 0;
            
            this.addCanvasPolyfills();
            this.setupCanvas();
            this.setupEventListeners();
            this.setupPerformanceMonitoring();
            
            // Start render loop
            this.startRenderLoop();
            
            // Notify React Native that canvas is ready
            this.postMessage('ready');
          }
          
          addCanvasPolyfills() {
            // Add roundRect polyfill if not available
            if (!this.ctx.roundRect) {
              this.ctx.roundRect = function(x, y, width, height, radius) {
                this.beginPath();
                this.moveTo(x + radius, y);
                this.lineTo(x + width - radius, y);
                this.quadraticCurveTo(x + width, y, x + width, y + radius);
                this.lineTo(x + width, y + height - radius);
                this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                this.lineTo(x + radius, y + height);
                this.quadraticCurveTo(x, y + height, x, y + height - radius);
                this.lineTo(x, y + radius);
                this.quadraticCurveTo(x, y, x + radius, y);
                this.closePath();
              };
            }
          }
          
          setupCanvas() {
            const updateCanvasSize = () => {
              const dpr = window.devicePixelRatio || 1;
              const rect = this.canvas.getBoundingClientRect();
              
              this.canvas.width = rect.width * dpr;
              this.canvas.height = rect.height * dpr;
              
              this.ctx.scale(dpr, dpr);
              this.canvas.style.width = rect.width + 'px';
              this.canvas.style.height = rect.height + 'px';
              
              this.render();
            };
            
            updateCanvasSize();
            window.addEventListener('resize', updateCanvasSize);
          }
          
          setupEventListeners() {
            // Handle touch events for future interaction
            this.canvas.addEventListener('touchstart', (e) => {
              e.preventDefault();
              const touch = e.touches[0];
              const rect = this.canvas.getBoundingClientRect();
              const x = (touch.clientX - rect.left) / rect.width;
              const y = (touch.clientY - rect.top) / rect.height;
              
              this.postMessage('touch', { x, y, type: 'start' });
            });
            
            this.canvas.addEventListener('touchend', (e) => {
              e.preventDefault();
              this.postMessage('touch', { type: 'end' });
            });
            
            // Handle visibility changes for performance
            document.addEventListener('visibilitychange', () => {
              if (document.hidden) {
                this.pauseRenderLoop();
              } else {
                this.resumeRenderLoop();
              }
            });
          }
          
          setupPerformanceMonitoring() {
            // Monitor FPS every second
            setInterval(() => {
              const now = performance.now();
              const elapsed = now - this.fpsStartTime;
              
              if (elapsed >= 1000) {
                this.currentFPS = Math.round((this.frameCount * 1000) / elapsed);
                this.frameCount = 0;
                this.fpsStartTime = now;
                
                // Report performance issues
                if (this.currentFPS < 30) {
                  console.warn(\`Low FPS detected: \${this.currentFPS}\`);
                  this.postMessage('performance', { fps: this.currentFPS, warning: 'low_fps' });
                }
              }
            }, 1000);
            
            // Memory cleanup every 30 seconds
            setInterval(() => {
              this.cleanupImageCache();
            }, 30000);
          }
          
          startRenderLoop() {
            const renderFrame = (currentTime) => {
              if (!this.isRendering) return;
              
              // Throttle to target FPS
              if (currentTime - this.lastRenderTime >= this.frameInterval) {
                if (this.isDirty) {
                  this.performRender();
                  this.isDirty = false;
                  this.frameCount++;
                }
                this.lastRenderTime = currentTime;
              }
              
              this.animationFrame = requestAnimationFrame(renderFrame);
            };
            
            this.isRendering = true;
            this.animationFrame = requestAnimationFrame(renderFrame);
          }
          
          pauseRenderLoop() {
            this.isRendering = false;
            if (this.animationFrame) {
              cancelAnimationFrame(this.animationFrame);
              this.animationFrame = null;
            }
          }
          
          resumeRenderLoop() {
            if (!this.isRendering) {
              this.startRenderLoop();
            }
          }
          
          markDirty(region = null) {
            this.isDirty = true;
            if (region) {
              this.dirtyRegions.push(region);
            }
          }
          
          cleanupImageCache() {
            if (this.imageCache.size <= this.maxCacheSize) return;
            
            // Sort by access time and remove oldest entries
            const entries = Array.from(this.cacheAccessTimes.entries())
              .sort((a, b) => a[1] - b[1]);
            
            const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
            
            toRemove.forEach(([key]) => {
              this.imageCache.delete(key);
              this.cacheAccessTimes.delete(key);
            });
            
            console.log(\`Cleaned up \${toRemove.length} cached images\`);
          }
          
          createOffscreenCanvas(width, height) {
            if (!this.offscreenCanvas || 
                this.offscreenCanvas.width !== width || 
                this.offscreenCanvas.height !== height) {
              
              this.offscreenCanvas = document.createElement('canvas');
              this.offscreenCanvas.width = width;
              this.offscreenCanvas.height = height;
              this.offscreenCtx = this.offscreenCanvas.getContext('2d');
              
              // Enable image smoothing for better quality
              this.offscreenCtx.imageSmoothingEnabled = true;
              this.offscreenCtx.imageSmoothingQuality = 'high';
            }
            
            return { canvas: this.offscreenCanvas, ctx: this.offscreenCtx };
          }
          
          postMessage(type, data = null) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
            }
          }
          
          async loadImage(src, retries = 3, isRetry = false) {
            if (this.imageCache.has(src) && !isRetry) {
              // Update access time for LRU cache
              this.cacheAccessTimes.set(src, performance.now());
              return this.imageCache.get(src);
            }
            
            for (let attempt = 0; attempt < retries; attempt++) {
              try {
                const img = await this.loadImageAttempt(src);
                
                // Cache management
                this.imageCache.set(src, img);
                this.cacheAccessTimes.set(src, performance.now());
                
                // Trigger cleanup if cache is getting full
                if (this.imageCache.size > this.maxCacheSize) {
                  this.cleanupImageCache();
                }
                
                return img;
              } catch (error) {
                console.warn(\`Image load attempt \${attempt + 1} failed for: \${src}\`, error);
                
                // Report network errors specifically
                if (error.message.includes('network') || error.message.includes('fetch')) {
                  this.postMessage('networkError', { path: src, attempt: attempt + 1 });
                }
                
                if (attempt === retries - 1) {
                  throw error;
                }
                
                // Exponential backoff for retries
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }
          
          loadImageAttempt(src) {
            return new Promise((resolve, reject) => {
              const img = new Image();
              
              // Set timeout for loading (longer for network resources)
              const isNetworkResource = src.startsWith('http');
              const timeoutMs = isNetworkResource ? 15000 : 10000;
              
              const timeout = setTimeout(() => {
                reject(new Error(\`Image load timeout after \${timeoutMs}ms: \${src}\`));
              }, timeoutMs);
              
              img.onload = () => {
                clearTimeout(timeout);
                
                // Validate image dimensions
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                  reject(new Error(\`Invalid image dimensions: \${src}\`));
                  return;
                }
                
                resolve(img);
              };
              
              img.onerror = (event) => {
                clearTimeout(timeout);
                
                // Provide more specific error messages
                let errorMessage = \`Failed to load image: \${src}\`;
                if (isNetworkResource) {
                  errorMessage = \`Network error loading image: \${src}\`;
                }
                
                reject(new Error(errorMessage));
              };
              
              // Handle different image sources
              if (src.startsWith('data:')) {
                // Data URI - no CORS needed
                img.src = src;
              } else if (src.startsWith('http')) {
                // External URL - set CORS and check network
                img.crossOrigin = 'anonymous';
                
                // Check if we're online before attempting network load
                if (!navigator.onLine) {
                  reject(new Error(\`No network connection available for: \${src}\`));
                  return;
                }
                
                img.src = src;
              } else {
                // Local file or asset
                img.src = src;
              }
            });
          }
          
          async loadBackground(imagePath, isPlaceholder = false, originalPath = null) {
            try {
              // Clear previous background
              this.backgroundImage = null;
              this.markDirty();
              
              // Load new background
              this.backgroundImage = await this.loadImage(imagePath, 3, originalPath !== null);
              this.markDirty();
              
              if (originalPath && originalPath !== imagePath) {
                // This was a retry that succeeded
                this.postMessage('retrySuccess', { 
                  type: 'background', 
                  path: originalPath,
                  actualPath: imagePath 
                });
              } else {
                this.postMessage('imageLoaded', { 
                  type: 'background', 
                  path: imagePath,
                  isPlaceholder: isPlaceholder 
                });
              }
            } catch (error) {
              console.error('Failed to load background:', error);
              this.postMessage('imageError', { 
                type: 'background', 
                path: originalPath || imagePath, 
                error: error.message 
              });
              
              // Create placeholder background only if this wasn't already a placeholder
              if (!isPlaceholder) {
                this.createPlaceholderBackground();
                this.markDirty();
              }
            }
          }
          
          async loadCharacter(imagePath, position, isPlaceholder = false, originalPath = null) {
            try {
              // Store previous character for potential fade transition
              const previousCharacter = this.characterImage;
              
              // Calculate dirty region for character area
              const rect = this.canvas.getBoundingClientRect();
              const charRegion = this.getCharacterBounds(rect, position);
              
              // Load new character
              const newCharacter = await this.loadImage(imagePath, 3, originalPath !== null);
              
              // Update character data
              this.characterImage = newCharacter;
              this.characterPosition = position;
              this.characterOpacity = 1.0;
              
              // Mark character area as dirty
              this.markDirty(charRegion);
              
              if (originalPath && originalPath !== imagePath) {
                // This was a retry that succeeded
                this.postMessage('retrySuccess', { 
                  type: 'character', 
                  path: originalPath,
                  actualPath: imagePath 
                });
              } else {
                this.postMessage('imageLoaded', { 
                  type: 'character', 
                  path: imagePath,
                  isPlaceholder: isPlaceholder 
                });
              }
            } catch (error) {
              console.error('Failed to load character:', error);
              this.postMessage('imageError', { 
                type: 'character', 
                path: originalPath || imagePath, 
                error: error.message 
              });
              
              // Create placeholder character only if this wasn't already a placeholder
              if (!isPlaceholder) {
                this.createPlaceholderCharacter();
                this.characterPosition = position;
                this.characterOpacity = 1.0;
                this.markDirty();
              }
            }
          }
          
          getCharacterBounds(rect, position) {
            if (!this.characterImage) return null;
            
            const char = this.characterImage;
            const pos = position;
            const scale = pos.scale || 1.0;
            const charWidth = char.width * scale;
            const charHeight = char.height * scale;
            
            const x = (pos.x * rect.width) - (charWidth / 2);
            const y = (pos.y * rect.height) - charHeight;
            
            return {
              x: Math.max(0, x),
              y: Math.max(0, y),
              width: Math.min(charWidth, rect.width - x),
              height: Math.min(charHeight, rect.height - y),
            };
          }
          
          createPlaceholderBackground() {
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d');
            
            // Create gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, 1080);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(0.5, '#98FB98');
            gradient.addColorStop(1, '#90EE90');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1920, 1080);
            
            // Add decorative clouds/circles
            const decorations = [
              { x: 300, y: 200, radius: 80, opacity: 0.3 },
              { x: 1620, y: 300, radius: 120, opacity: 0.2 },
              { x: 960, y: 800, radius: 100, opacity: 0.25 },
              { x: 600, y: 900, radius: 60, opacity: 0.3 },
              { x: 1400, y: 700, radius: 90, opacity: 0.2 },
              { x: 200, y: 600, radius: 70, opacity: 0.25 },
              { x: 1700, y: 150, radius: 50, opacity: 0.35 },
            ];
            
            decorations.forEach(({ x, y, radius, opacity }) => {
              ctx.fillStyle = \`rgba(255, 255, 255, \${opacity})\`;
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fill();
            });
            
            // Add title text
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = 'bold 72px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('默认背景', 960, 540);
            
            // Add subtitle
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '36px Arial, sans-serif';
            ctx.fillText('AVG Story Mode', 960, 600);
            
            this.backgroundImage = canvas;
          }
          
          createPlaceholderCharacter() {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            
            // Clear with transparent background
            ctx.clearRect(0, 0, 512, 1024);
            
            // Character silhouette with gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
            gradient.addColorStop(0, 'rgba(120, 120, 120, 0.9)');
            gradient.addColorStop(1, 'rgba(80, 80, 80, 0.9)');
            
            ctx.fillStyle = gradient;
            
            // Head
            ctx.beginPath();
            ctx.arc(256, 200, 80, 0, Math.PI * 2);
            ctx.fill();
            
            // Body (rounded rectangle)
            ctx.beginPath();
            ctx.roundRect(206, 280, 100, 240, 20);
            ctx.fill();
            
            // Arms (rounded rectangles)
            ctx.beginPath();
            ctx.roundRect(156, 300, 50, 160, 25);
            ctx.fill();
            
            ctx.beginPath();
            ctx.roundRect(306, 300, 50, 160, 25);
            ctx.fill();
            
            // Legs (rounded rectangles)
            ctx.beginPath();
            ctx.roundRect(216, 520, 40, 200, 20);
            ctx.fill();
            
            ctx.beginPath();
            ctx.roundRect(256, 520, 40, 200, 20);
            ctx.fill();
            
            // Add some details
            // Eyes
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(236, 180, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(276, 180, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupils
            ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            ctx.beginPath();
            ctx.arc(236, 180, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(276, 180, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Simple smile
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(256, 200, 25, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = 'rgba(120, 120, 120, 0.8)';
            ctx.font = 'bold 32px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('默认角色', 256, 800);
            
            this.characterImage = canvas;
          }
          
          updateCharacter(position, expression) {
            const oldPosition = { ...this.characterPosition };
            const newPosition = position;
            
            // Calculate dirty regions for both old and new positions
            const rect = this.canvas.getBoundingClientRect();
            const oldBounds = this.getCharacterBounds(rect, oldPosition);
            const newBounds = this.getCharacterBounds(rect, newPosition);
            
            // Update position
            this.characterPosition = newPosition;
            
            // Update expression if provided
            if (expression) {
              this.characterExpression = expression;
            }
            
            // Check if we need to animate position change
            const positionChanged = (
              Math.abs(oldPosition.x - newPosition.x) > 0.01 ||
              Math.abs(oldPosition.y - newPosition.y) > 0.01 ||
              Math.abs((oldPosition.scale || 1.0) - (newPosition.scale || 1.0)) > 0.01
            );
            
            if (positionChanged) {
              this.animateCharacterMove(oldPosition, newPosition);
            } else {
              // Mark character areas as dirty
              if (oldBounds) this.markDirty(oldBounds);
              if (newBounds) this.markDirty(newBounds);
            }
          }
          
          animateCharacterMove(fromPos, toPos, duration = 500) {
            const startTime = performance.now();
            let animationId = null;
            
            const animate = (currentTime) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Easing function (ease-out)
              const easeOut = 1 - Math.pow(1 - progress, 3);
              
              // Calculate current position
              const currentPos = {
                x: fromPos.x + (toPos.x - fromPos.x) * easeOut,
                y: fromPos.y + (toPos.y - fromPos.y) * easeOut,
                scale: (fromPos.scale || 1.0) + ((toPos.scale || 1.0) - (fromPos.scale || 1.0)) * easeOut,
              };
              
              // Mark character area as dirty
              const rect = this.canvas.getBoundingClientRect();
              const bounds = this.getCharacterBounds(rect, currentPos);
              if (bounds) this.markDirty(bounds);
              
              // Update position
              this.characterPosition = currentPos;
              
              if (progress < 1) {
                animationId = requestAnimationFrame(animate);
              } else {
                this.characterPosition = toPos; // Ensure final position is exact
                const finalBounds = this.getCharacterBounds(rect, toPos);
                if (finalBounds) this.markDirty(finalBounds);
                animationId = null;
              }
            };
            
            // Cancel any existing animation
            if (this.animationFrame) {
              cancelAnimationFrame(this.animationFrame);
            }
            
            animationId = requestAnimationFrame(animate);
            this.animationFrame = animationId;
          }
          
          fadeCharacter(targetOpacity, duration = 300) {
            const startOpacity = this.characterOpacity;
            const startTime = performance.now();
            
            const animate = (currentTime) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Linear interpolation for opacity
              this.characterOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
              
              // Mark character area as dirty
              const rect = this.canvas.getBoundingClientRect();
              const bounds = this.getCharacterBounds(rect, this.characterPosition);
              if (bounds) this.markDirty(bounds);
              
              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };
            
            requestAnimationFrame(animate);
          }
          
          clearCanvas() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.markDirty();
          }
          
          render() {
            // Legacy method for compatibility - delegates to performRender
            this.markDirty();
          }
          
          performRender() {
            const rect = this.canvas.getBoundingClientRect();
            
            // Use offscreen canvas for complex rendering
            const { canvas: offscreen, ctx: offscreenCtx } = this.createOffscreenCanvas(
              this.canvas.width, 
              this.canvas.height
            );
            
            // Clear offscreen canvas
            offscreenCtx.clearRect(0, 0, offscreen.width, offscreen.height);
            
            // Render background with proper scaling
            if (this.backgroundImage) {
              this.renderBackgroundToContext(offscreenCtx, rect);
            }
            
            // Render character
            if (this.characterImage && this.characterPosition) {
              this.renderCharacterToContext(offscreenCtx, rect);
            }
            
            // Copy offscreen canvas to main canvas in one operation
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(offscreen, 0, 0);
            
            // Clear dirty regions
            this.dirtyRegions = [];
          }
          
          renderBackground(rect) {
            this.renderBackgroundToContext(this.ctx, rect);
          }
          
          renderBackgroundToContext(ctx, rect) {
            const bg = this.backgroundImage;
            if (!bg) return;
            
            const canvasAspect = rect.width / rect.height;
            const imageAspect = bg.width / bg.height;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            if (canvasAspect > imageAspect) {
              // Canvas is wider than image - fit to width
              drawWidth = rect.width;
              drawHeight = rect.width / imageAspect;
              drawX = 0;
              drawY = (rect.height - drawHeight) / 2;
            } else {
              // Canvas is taller than image - fit to height
              drawWidth = rect.height * imageAspect;
              drawHeight = rect.height;
              drawX = (rect.width - drawWidth) / 2;
              drawY = 0;
            }
            
            // Apply smooth scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(bg, drawX, drawY, drawWidth, drawHeight);
          }
          
          renderCharacter(rect) {
            this.renderCharacterToContext(this.ctx, rect);
          }
          
          renderCharacterToContext(ctx, rect) {
            if (!this.characterImage) return;
            
            const char = this.characterImage;
            const pos = this.characterPosition;
            
            // Calculate character dimensions
            const scale = pos.scale || 1.0;
            const charWidth = char.width * scale;
            const charHeight = char.height * scale;
            
            // Calculate position (0,0 is top-left, 1,1 is bottom-right)
            const x = (pos.x * rect.width) - (charWidth / 2);
            const y = (pos.y * rect.height) - charHeight; // Align to bottom for character sprites
            
            // Save current context state
            ctx.save();
            
            // Apply opacity for fade effects
            ctx.globalAlpha = this.characterOpacity || 1.0;
            
            // Apply smooth scaling for character
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Handle character positioning with bounds checking
            const clampedX = Math.max(-charWidth * 0.5, Math.min(rect.width - charWidth * 0.5, x));
            const clampedY = Math.max(-charHeight * 0.5, Math.min(rect.height, y));
            
            // Draw character with proper transparency handling
            ctx.drawImage(char, clampedX, clampedY, charWidth, charHeight);
            
            // Restore context state
            ctx.restore();
          }
          
          resize(dimensions) {
            // Canvas will auto-resize via CSS, just need to re-render
            setTimeout(() => {
              this.setupCanvas();
              this.markDirty();
            }, 100);
          }
        }
        
        // Initialize renderer
        const renderer = new AVGCanvasRenderer();
        
        // Handle messages from React Native
        document.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
              case 'loadBackground':
                renderer.loadBackground(
                  message.data.imagePath, 
                  message.data.isPlaceholder,
                  message.data.originalPath
                );
                break;
              case 'loadCharacter':
                renderer.loadCharacter(
                  message.data.imagePath, 
                  message.data.position,
                  message.data.isPlaceholder,
                  message.data.originalPath
                );
                break;
              case 'updateCharacter':
                renderer.updateCharacter(message.data.position, message.data.expression);
                break;
              case 'fadeCharacter':
                renderer.fadeCharacter(message.data.opacity, message.data.duration);
                break;
              case 'clearCanvas':
                renderer.clearCanvas();
                break;
              case 'resize':
                renderer.resize(message.data);
                break;
            }
          } catch (error) {
            console.error('Failed to handle message:', error);
          }
        });
        
        // Handle messages for Android
        if (window.ReactNativeWebView) {
          window.addEventListener('message', (event) => {
            document.dispatchEvent(new MessageEvent('message', { data: event.data }));
          });
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { height: dimensions.height }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
});

AVGCanvas.displayName = 'AVGCanvas';

export default AVGCanvas;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
