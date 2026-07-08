# Highway Rush

Jogo de corrida 2D no estilo endless runner, feito com **HTML5, CSS3 e JavaScript puro** (sem frameworks nem bibliotecas externas).

## Como executar

### Opção 1 — Abrir direto no navegador
1. Baixe/clone esta pasta `game/`
2. Abra `index.html` no navegador (Chrome, Firefox, Edge)

### Opção 2 — VS Code + Live Server
1. Abra a pasta `game/` no VS Code
2. Instale a extensão **Live Server**
3. Clique com o direito em `index.html` → "Open with Live Server"

### Opção 3 — Servidor local rápido
```bash
cd game
python3 -m http.server 8000
# abra http://localhost:8000
```

## Controles

**Desktop:**
- `←` `→` ou `A` `D` — mover para esquerda/direita
- `Shift` — ativar nitro
- `Esc` — pausar

**Mobile:** botões na tela.

## Recursos
- Menu inicial, seleção de carros, loja de upgrades, configurações, ranking
- 6 carros desbloqueáveis, 5 categorias de upgrades (10 níveis cada)
- Sistema de níveis progressivos, moedas, combos, nitro, vidas
- Tráfego dinâmico (carros, SUVs, caminhões, ônibus, táxis)
- Obstáculos (cones, óleo, buracos, carros parados)
- Persistência local via `localStorage`
- Sons sintetizados via Web Audio API
- Efeitos: partículas, motion blur, shake, vignette, glow
- Responsivo (desktop, tablet, celular)

## Estrutura
```
game/
├── index.html
├── style.css
├── script.js
├── README.md
└── assets/
    ├── images/
    ├── sounds/
    ├── fonts/
    └── icons/
```

Feito com ❤️ — divirta-se e personalize!
