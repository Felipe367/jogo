JOGO — VERSÃO ATUALIZADA 2

Alterações desta versão:
- Arena redesenhada para lembrar a interface clássica de duelo da imagem de referência.
- Estrutura original de pastas preservada.
- Painel lateral de CARTA SELECIONADA, inspirado no painel de informações da referência.
- Ao clicar em uma carta da mão, ela é mostrada no painel lateral com nome, ATK/DEF e descrição.
- Monstros selecionados na mão podem ser colocados pelo painel lateral como FACE PARA CIMA ou FACE PARA BAIXO.
- O painel lateral tem opção de CANCELAR a seleção.
- Cartas face para baixo usam assets/card-back.jpg e não exibem as informações da carta no campo.
- Ao clicar em uma carta própria face para baixo durante o seu turno, o painel lateral oferece VIRAR PARA CIMA.
- Uma carta face para baixo não pode atacar nem ser usada como atacante até ser revelada.
- Se um monstro face para baixo for escolhido como alvo de um ataque, ele é revelado antes da resolução da batalha.
- Ataque direto considera somente monstros face para cima.
- O BOT só utiliza monstros face para cima como atacantes.
- A arena agora possui 10 zonas de campo por jogador, organizadas em duas fileiras de 5.
- Magias e armadilhas também aparecem no painel lateral antes da ação, mantendo a lógica original de ativar/preparar.
- A lógica existente de batalha, turnos, LP, deck e cartas foi preservada.

COMO EXECUTAR:
1. Abra esta pasta no VS Code.
2. Abra o terminal nela.
3. Execute: python -m http.server 8000
4. Abra: http://localhost:8000

OU use a extensão Live Server do VS Code e abra o index.html.
