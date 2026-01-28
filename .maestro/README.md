# Maestro E2E Tests

This directory contains end-to-end tests for Bible Strong using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

### Install Maestro CLI

**macOS/Linux:**
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

**iOS Simulator Support (macOS only):**
```bash
brew tap facebook/fb
brew install facebook/fb/idb-companion
```

### Build the App

Before running tests, you need a development build:

**Android (APK):**
```bash
yarn build:android:e2e
```

**iOS Simulator:**
```bash
yarn build:ios:e2e
```

## Running Tests

### Run All Tests
```bash
yarn test:e2e
```

### Run Specific Test
```bash
maestro test .maestro/flows/01_app_launch.yaml
```

### Run Tests by Tag
```bash
# Run smoke tests only
maestro test .maestro/flows --include-tags smoke

# Run navigation tests
maestro test .maestro/flows --include-tags navigation
```

### Interactive Studio
```bash
maestro studio
```

## Directory Structure

```
.maestro/
├── config.yaml          # Maestro configuration
├── README.md            # This file
├── flows/               # Test flows
│   ├── 01_app_launch.yaml
│   ├── 02_home_drawer.yaml
│   ├── 03_settings_drawer.yaml
│   ├── 04_tab_management.yaml
│   └── 05_faq_navigation.yaml
└── subflows/            # Reusable subflows
    ├── launchApp.yaml
    └── launchAppKeepState.yaml
```

## Test Tags

| Tag | Description |
|-----|-------------|
| `smoke` | Basic functionality tests, run on every PR |
| `critical` | Tests for critical features |
| `navigation` | Navigation-related tests |
| `regression` | Full regression suite |
| `tabs` | Tab management tests |

## Writing New Tests

1. Create a new `.yaml` file in `.maestro/flows/`
2. Use numbered prefix for ordering (e.g., `06_my_test.yaml`)
3. Include appropriate tags
4. Use subflows for common operations

### Example Test Structure

```yaml
# Test: Description
# Brief explanation of what the test verifies
# Tags: tag1, tag2

appId: com.smontlouis.biblestrong
tags:
  - tag1
  - tag2
---
- runFlow: ../subflows/launchApp.yaml

# Your test steps here
- tapOn: "Button Text"
- assertVisible: "Expected Text"
- takeScreenshot: screenshot_name
```

## App IDs

| Environment | Android | iOS |
|-------------|---------|-----|
| Development | `com.smontlouis.biblestrong` | `com.smontlouis.biblestrong.dev` |
| Production | `com.smontlouis.biblestrong` | `com.smontlouis.biblestrong` |

## Tips

- Use `waitForAnimationToEnd` after navigation actions
- Use `optional: true` for elements that may not always be present
- Take screenshots at key points for debugging
- Keep tests focused on single features
- Use subflows for repeated sequences
