# AI Launcher

AI Launcher is a lightweight, system-wide desktop launcher for Windows that opens a floating chat window from a global keyboard shortcut. It supports local/offline AI via Ollama and can optionally use the OpenAI API when an API key is provided in Settings.

## Features

- Global keyboard shortcut to show/hide the window
- Floating, movable, resizable, frameless UI
- Runs in the background with a tray icon fallback
- Pluggable AI providers:
  - Ollama (local models)
  - OpenAI (API key via in-app settings)
- Simple build and packaging with electron-builder (Windows installer)

## Requirements

- Windows 10/11
- Node.js (LTS recommended)
- (Optional) Ollama for local models

## Install

```bash
npm install
