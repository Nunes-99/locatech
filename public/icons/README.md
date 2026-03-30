# PWA Icons

## Como gerar os icones

Os icones PWA podem ser gerados a partir do arquivo `icon.svg` usando uma das seguintes opcoes:

### Opcao 1: Online (Recomendado)
1. Acesse https://realfavicongenerator.net/
2. Faca upload do arquivo `icon.svg`
3. Baixe e extraia os arquivos gerados nesta pasta

### Opcao 2: CLI com Sharp
```bash
npm install sharp -D
node scripts/generate-icons.js
```

### Opcao 3: Figma/Canva
1. Abra o SVG no Figma ou Canva
2. Exporte em cada tamanho necessario

## Tamanhos necessarios

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

## Icones de atalho (opcional)

- shortcut-rental.png (96x96)
- shortcut-equipment.png (96x96)
- badge-72x72.png (para notificacoes)
