# iOS Setup Documentation

## 概述
iOS项目已成功eject，配置与Android保持一致，包括相同的app ID和app名称。

## 配置详情

### App ID 和名称
- **Dev Client**: `com.foxsoft.chatbot.devclient` (显示名称: ChatDev)
- **Production**: `com.foxsoft.chatbot.prod` (显示名称: ChatProd)

### 架构支持
- **iOS**: 仅支持 `arm64` 架构
- **Android**: 支持 `arm64-v8a` 和 `x86` 架构

### 构建配置
- **Debug配置**: 使用devclient ID和名称
- **Release配置**: 使用prod ID和名称

## 构建脚本

### iOS构建命令
```bash
# Dev Client (Debug)
npm run ios:devclient
# 或
npm run id

# Production (Release)  
npm run ios:prod
# 或
npm run ip
```

### Android构建命令（对比）
```bash
# Dev Client
npm run android:devclient  # 或 npm run ad
npm run android:devclient:win  # 或 npm run adw (Windows)

# Production
npm run android:prod  # 或 npm run ap
npm run android:prod:win  # 或 npm run apw (Windows)
```

## 插件配置

### iOS插件
1. **with-ios-product-flavors**: 配置不同的bundle ID和app名称
2. **with-ios-architectures**: 限制架构为arm64

### Android插件（对比）
1. **with-android-product-flavors**: 配置product flavors
2. **with-android-abi-splits**: 配置ABI支持

## 文件结构
```
mobile/
├── ios/                          # iOS原生代码
│   ├── SillyTavern.xcworkspace  # Xcode workspace
│   ├── SillyTavern.xcodeproj/   # Xcode项目
│   └── SillyTavern/             # 应用代码
├── android/                      # Android原生代码
├── plugins/                      # 自定义插件
│   ├── with-ios-product-flavors.js
│   ├── with-ios-architectures.js
│   ├── with-android-product-flavors.js
│   └── with-android-abi-splits.js
└── app.json                      # Expo配置
```

## 开发流程

1. **开发环境**: 使用Debug配置构建devclient版本
2. **生产环境**: 使用Release配置构建prod版本
3. **架构**: iOS仅支持arm64，Android支持arm64-v8a和x86

## 注意事项

- iOS项目需要使用Xcode workspace文件 (`SillyTavern.xcworkspace`)
- 确保已安装CocoaPods依赖 (`pod install`)
- iOS构建需要macOS环境和Xcode
- 两个平台的app ID和名称完全一致，便于统一管理