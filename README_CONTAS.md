# Sistema de contas, créditos e coleção

Esta versão do jogo usa **SQLite** (`data/game.db`) para dados persistentes. O arquivo `data/cards.json` continua sendo somente o catálogo das cartas; emails, senhas, sessões, créditos, coleção e histórico não são gravados nele.

## Rodar no VS Code

1. Instale Node.js 18+.
2. Abra o terminal na pasta do projeto.
3. Rode:

```bash
npm install
npm start
```

4. Acesse `http://localhost:3000`.

## Regras implementadas

- Conta com nome de jogador, email e senha.
- Senhas são armazenadas com `scrypt` + salt, nunca em texto puro.
- Login com email/senha incorretos retorna exatamente `email ou senha inválidos`.
- Conta começa com 200 créditos.
- A conta recebe as cartas 1 a 30 automaticamente.
- Vitória: Fácil +20, Normal +30, Difícil +40, Mestre +50.
- Derrota: +0 créditos.
- Histórico das partidas fica no SQLite.
- Preços por ATK: 2000–2999 = 200; 3000–3999 = 300; 4000–4999 = 400; 5000–5999 = 500; 6000+ = 600.
- Carta comprada entra na coleção e passa a poder aparecer no deck do jogador.
- Se não houver créditos suficientes, a carta mostra `créditos insuficientes`.
- Se houver créditos, aparece o botão verde `COMPRAR`.
