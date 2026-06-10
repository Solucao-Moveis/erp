# App de PC (Tauri) — build do instalador .exe

Empacota o **Hub** num app de Windows nativo. A janela carrega o Hub **hospedado**
(`HUB_URL`), então o conteúdo **atualiza sozinho** a cada deploy (igual ao PWA) — o
instalador só precisa ser refeito quando muda a "casca" (ícone, bandeja, etc.).

Diferencial: ao **fechar a janela**, o app **vai pra bandeja** (system tray) e continua
vivo — o "vigia" do Hub segue rodando e os **avisos do Windows** continuam chegando.
Clicar no ícone da bandeja traz a janela de volta; "Sair" no menu da bandeja encerra.

## Pré-requisitos (uma vez, na máquina que faz o build)
- **Node** (já tem) + `npm install` na raiz (traz o `@tauri-apps/cli`).
- **Rust** (rustup) — `winget install Rustlang.Rustup`.
- **MSVC C++ Build Tools** — `winget install Microsoft.VisualStudio.2022.BuildTools`
  com a workload **VCTools** (`--override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`).
- **WebView2** — já vem no Windows 11.

## Estrutura
```
erp/
├── package.json            # scripts do build do app (desktop:*)
├── dist/index.html         # fallback exigido pelo empacotador (a janela carrega a URL remota)
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json      # janela aponta pra HUB_URL; bundle NSIS
    ├── src/main.rs          # bandeja + fechar-pra-bandeja + plugin de notificação
    └── capabilities/        # default (base) + remote-hub (notificação na origem do Hub)
```

## Gerar os ícones (uma vez, ou quando trocar a logo)
```powershell
npm run desktop:icons    # = tauri icon assets/icon-512.png  -> gera src-tauri/icons/*
```

## Build do instalador
```powershell
npm run desktop:build    # = tauri build
```
Saída: `src-tauri/target/release/bundle/nsis/SMERP_0.1.0_x64-setup.exe`

## Rodar em modo dev (sem instalar)
```powershell
npm run desktop:dev
```

## Notas
- **URL do Hub:** aparece em `src-tauri/tauri.conf.json` (window.url), em
  `src-tauri/capabilities/remote-hub.json` (origem permitida p/ notificação) e em
  `dist/index.html`. Se o domínio do Hub mudar, ajuste nos três.
- **Notificações no app:** o `notify.js` usa o plugin nativo do Tauri quando a API
  está disponível (`window.__TAURI__`); senão cai na notificação Web do WebView2.
  A capability `remote-hub` libera só a permissão de **notificação** pra origem do Hub.
- **Atualização automática da casca (opcional, depois):** dá pra ligar o `tauri-plugin-updater`
  com um `latest.json` hospedado; só necessário quando muda o app nativo, não o conteúdo web.
- O build do app **não afeta** o deploy do Hub (nginx): `src-tauri/`, `dist/`,
  `push-service/` e `package.json` estão no `.dockerignore`.
