import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { AVGCanvasProps } from '../../src/types/avg';

interface CanvasMessage {
  type: 'ready' | 'error' | 'imageLoaded' | 'imageError' | 'resize';
  data?: any;
}

const AVGCanvas = forwardRef<WebView, AVGCanvasProps>(({
  backgroundImage,
  characterImage,
  characterPosition,
  onCanvasReady,
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
          break;
        case 'imageLoaded':
          console.log('Image loaded:', message.data);
          break;
        case 'imageError':
          console.warn('Image load error:', message.data);
          break;
      }
    } catch (error) {
      console.error('Failed to parse canvas message:', error);
    }
  }, [onCanvasReady]);

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
            
            this.addCanvasPolyfills();
            this.setupCanvas();
            this.setupEventListeners();
            
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
          }
          
          postMessage(type, data = null) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
            }
          }
          
          async loadImage(src, retries = 3) {
            if (this.imageCache.has(src)) {
              return this.imageCache.get(src);
            }
            
            for (let attempt = 0; attempt < retries; attempt++) {
              try {
                const img = await this.loadImageAttempt(src);
                this.imageCache.set(src, img);
                return img;
              } catch (error) {
                console.warn(\`Image load attempt \${attempt + 1} failed for: \${src}\`, error);
                if (attempt === retries - 1) {
                  throw error;
                }
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              }
            }
          }
          
          loadImageAttempt(src) {
            return new Promise((resolve, reject) => {
              const img = new Image();
              
              // Set timeout for loading
              const timeout = setTimeout(() => {
                reject(new Error(\`Image load timeout: \${src}\`));
              }, 10000);
              
              img.onload = () => {
                clearTimeout(timeout);
                resolve(img);
              };
              
              img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(\`Failed to load image: \${src}\`));
              };
              
              // Handle different image sources
              if (src.startsWith('data:')) {
                // Data URI - no CORS needed
                img.src = src;
              } else if (src.startsWith('http')) {
                // External URL - set CORS
                img.crossOrigin = 'anonymous';
                img.src = src;
              } else {
                // Local file or asset
                img.src = src;
              }
            });
          }
          
          async loadBackground(imagePath) {
            try {
              // Clear previous background
              this.backgroundImage = null;
              this.render();
              
              // Load new background
              this.backgroundImage = await this.loadImage(imagePath);
              this.render();
              this.postMessage('imageLoaded', { type: 'background', path: imagePath });
            } catch (error) {
              console.error('Failed to load background:', error);
              this.postMessage('imageError', { type: 'background', path: imagePath, error: error.message });
              // Create placeholder background
              this.createPlaceholderBackground();
              this.render();
            }
          }
          
          async loadCharacter(imagePath, position) {
            try {
              // Store previous character for potential fade transition
              const previousCharacter = this.characterImage;
              
              // Load new character
              const newCharacter = await this.loadImage(imagePath);
              
              // Update character data
              this.characterImage = newCharacter;
              this.characterPosition = position;
              this.characterOpacity = 1.0;
              
              // If we had a previous character, we could add a fade transition here
              // For now, just render immediately
              this.render();
              
              this.postMessage('imageLoaded', { type: 'character', path: imagePath });
            } catch (error) {
              console.error('Failed to load character:', error);
              this.postMessage('imageError', { type: 'character', path: imagePath, error: error.message });
              // Create placeholder character
              this.createPlaceholderCharacter();
              this.characterPosition = position;
              this.characterOpacity = 1.0;
              this.render();
            }
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
              this.render();
            }
          }
          
          animateCharacterMove(fromPos, toPos, duration = 500) {
            const startTime = performance.now();
            
            const animate = (currentTime) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Easing function (ease-out)
              const easeOut = 1 - Math.pow(1 - progress, 3);
              
              // Interpolate position
              this.characterPosition = {
                x: fromPos.x + (toPos.x - fromPos.x) * easeOut,
                y: fromPos.y + (toPos.y - fromPos.y) * easeOut,
                scale: (fromPos.scale || 1.0) + ((toPos.scale || 1.0) - (fromPos.scale || 1.0)) * easeOut,
              };
              
              this.render();
              
              if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animate);
              } else {
                this.characterPosition = toPos; // Ensure final position is exact
                this.render();
                this.animationFrame = null;
              }
            };
            
            // Cancel any existing animation
            if (this.animationFrame) {
              cancelAnimationFrame(this.animationFrame);
            }
            
            this.animationFrame = requestAnimationFrame(animate);
          }
          
          fadeCharacter(targetOpacity, duration = 300) {
            const startOpacity = this.characterOpacity;
            const startTime = performance.now();
            
            const animate = (currentTime) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Linear interpolation for opacity
              this.characterOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
              
              this.render();
              
              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };
            
            requestAnimationFrame(animate);
          }
          
          clearCanvas() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          }
          
          render() {
            const rect = this.canvas.getBoundingClientRect();
            this.clearCanvas();
            
            // Render background with proper scaling
            if (this.backgroundImage) {
              this.renderBackground(rect);
            }
            
            // Render character
            if (this.characterImage && this.characterPosition) {
              this.renderCharacter(rect);
            }
          }
          
          renderBackground(rect) {
            const bg = this.backgroundImage;
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
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            
            this.ctx.drawImage(bg, drawX, drawY, drawWidth, drawHeight);
          }
          
          renderCharacter(rect) {
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
            this.ctx.save();
            
            // Apply opacity for fade effects
            this.ctx.globalAlpha = this.characterOpacity || 1.0;
            
            // Apply smooth scaling for character
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            
            // Handle character positioning with bounds checking
            const clampedX = Math.max(-charWidth * 0.5, Math.min(rect.width - charWidth * 0.5, x));
            const clampedY = Math.max(-charHeight * 0.5, Math.min(rect.height, y));
            
            // Draw character with proper transparency handling
            this.ctx.drawImage(char, clampedX, clampedY, charWidth, charHeight);
            
            // Restore context state
            this.ctx.restore();
          }
          
          resize(dimensions) {
            // Canvas will auto-resize via CSS, just need to re-render
            setTimeout(() => {
              this.setupCanvas();
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
                renderer.loadBackground(message.data.imagePath);
                break;
              case 'loadCharacter':
                renderer.loadCharacter(message.data.imagePath, message.data.position);
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
    <View style={[styles.container, { height: dimensions.height }]}>
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
