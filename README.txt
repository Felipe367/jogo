YU-GI DUEL ARENA — VERSÃO CORRIGIDA

Correções desta versão:
- Cartas do monte são compradas para a mão no início de cada turno.
- O monte de cada jogador é independente, embaralhado e usa cartas aleatórias.
- O BOT voltou a executar turno, invocar monstros, usar magias e atacar.
- Batalhas do BOT e do jogador usam a arena virtual 3D.
- Monstros aparecem no centro da arena durante o ataque com perspectiva, avanço, impacto e recuo.
- Ataque do jogador: selecione seu monstro e depois toque no monstro inimigo.
- Ataque direto disponível quando o adversário não possui monstros.
- Mantidas as 453 cartas e os packs de imagens enviados.

Para executar no Windows:
1. Abra o PowerShell na pasta do projeto.
2. Rode: npx serve .
3. Abra o endereço mostrado pelo servidor, normalmente http://localhost:3000

Importante: mantenha o PowerShell aberto enquanto jogar.

Para publicar no GitHub Pages:
1. Envie estes arquivos para um repositório no GitHub na branch main.
2. No repositório, abra Settings > Pages e selecione GitHub Actions em Source.
3. Faça um push na branch main ou execute o workflow "Publicar no GitHub Pages" pela aba Actions.
4. Acesse a URL exibida em Settings > Pages ou no resumo da execução do workflow.

O workflow está em .github/workflows/pages.yml e publica este projeto estático sem necessidade de build.
