# AVG Assets Directory

This directory contains assets for the AVG (Adventure Game) story mode.

## Directory Structure

```
assets/avg/
├── backgrounds/          # Background images for scenes
│   └── default.png      # Default background (placeholder)
├── characters/          # Character sprites/portraits
│   └── default/         # Default character folder
│       └── neutral.png  # Default neutral expression (placeholder)
└── config/             # Configuration files
    └── default-scene.json # Default scene configuration
```

## Asset Requirements

### Background Images
- Format: PNG, JPG, or WebP
- Recommended size: 1920x1080 or 16:9 aspect ratio
- Should work well with character overlays

### Character Images
- Format: PNG with transparency
- Recommended size: 512x1024 or similar portrait ratio
- Should have transparent backgrounds for proper layering
- Organize by character name in subfolders
- Use descriptive names for expressions (neutral, happy, sad, etc.)

## Adding New Assets

1. Place background images in `backgrounds/` folder
2. Create character folders under `characters/` with character name
3. Add character expressions as PNG files in character folders
4. Update scene configurations in `config/` as needed

## Placeholder Assets

Currently using placeholder assets. Replace with actual game assets when available.