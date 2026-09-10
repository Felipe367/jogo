const phases=["DRAW PHASE","STANDBY PHASE","MAIN PHASE 1","BATTLE PHASE","MAIN PHASE 2","END PHASE"];

function cardImage(card){
  return card && card.image ? card.image : "";
}

function cardVisual(card, extraClass=""){
  const isMonster = (card?.type || "monster") === "monster";
  const img = card?.image || "";
  const level = Math.max(0, Number(card?.level || 0));
  const stars = isMonster && level ? "★".repeat(Math.min(level, 12)) : "";
  const atk = card?.atk ?? "—";
  const def = card?.def ?? "—";
  const attribute = card?.attribute || "";
  const race = card?.race || "";
  const typeLabel = card?.type === "spell" ? "MAGIC CARD" :
                    card?.type === "trap" ? "TRAP CARD" : "MONSTER CARD";
  const effect = card?.description || "Sem efeito cadastrado.";

  return `<div class="duel-card ${extraClass} ${isMonster ? "monster-card" : "effect-card"}">
    <div class="duel-card-name">${escapeHTML(card?.name || "CARTA")}</div>
    ${isMonster && attribute ? `<div class="duel-card-attribute">${escapeHTML(attribute)}</div>` : ""}
    ${isMonster ? `<div class="duel-card-level">${stars}</div>` : ""}
    <div class="duel-card-art">
      ${img ? `<img src="${img}" alt="${escapeHTML(card?.name || "Carta")}" loading="lazy">` : `<div class="card-art-missing">SEM IMAGEM</div>`}
    </div>
    <div class="duel-card-info">
      <div class="duel-card-type">[${escapeHTML(race || typeLabel)}]</div>
      <div class="duel-card-effect">${escapeHTML(effect)}</div>
      ${isMonster ? `<div class="duel-card-stats"><span>ATK ${atk}</span><span>DEF ${def}</span></div>` : ""}
    </div>
  </div>`;
}
let cards=[];
let state=null;
let selectedDiff="easy";

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".difficulty button").forEach(button=>{
    button.addEventListener("click",()=>{
      document.querySelectorAll(".difficulty button").forEach(b=>b.classList.remove("selected"));
      button.classList.add("selected");
      selectedDiff=button.dataset.diff || "easy";
    });
  });

  fetch("data/cards.json")
    .then(response=>{
      if(!response.ok) throw new Error("Não foi possível carregar data/cards.json");
      return response.json();
    })
    .then(data=>{
      cards=data;
      const count=document.getElementById("cardCount");
      if(count) count.textContent=`${cards.length} CARTAS`;
    })
    .catch(error=>{
      console.error(error);
      alert("Erro ao carregar as cartas. Verifique se você abriu pelo http://localhost:3000 e não diretamente pelo arquivo.");
    });
});

function screen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const target=document.getElementById(id);
  if(target) target.classList.add("active");
}

function showDeck(){
  screen("deckScreen");
  renderDeck();
}

function backMenu(){
  if(state && !confirm("Voltar ao menu? O duelo atual será encerrado.")) return;
  state=null;
  screen("menu");
}

function renderDeck(){
  const grid=document.getElementById("deckGrid");
  if(!grid) return;
  const search=document.getElementById("search");
  const q=(search?.value || "").toLowerCase().trim();
  const filtered=cards.filter(c=>c.name.toLowerCase().includes(q));

  grid.innerHTML=filtered.map(c=>`
    <div class="card-preview full-card-preview">
      ${cardVisual(c)}
    </div>
  `).join("");
}

function escapeHTML(text){
  return String(text ?? "").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function shuffle(array){
  const a=[...array];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function makeDeck(){
  if(cards.length===0){
    alert("As cartas ainda estão carregando. Tente novamente em um segundo.");
    return [];
  }

  // Cada jogador recebe um monte independente e embaralhado.
  // As cartas são sorteadas aleatoriamente do catálogo.
  const pool=shuffle(cards);
  const deck=[];
  for(let i=0;i<30;i++){
    deck.push(pool[i % pool.length]);
  }
  return shuffle(deck);
}

function startBot(){
  startGame(false);
}

function startTwoPlayers(){
  startGame(true);
}

function startGame(twoPlayers){
  const deck1=makeDeck();
  const deck2=makeDeck();

  if(!deck1.length || !deck2.length) return;

  state={
    twoPlayers,
    turn:1,
    activePlayer:0,
    phase:0,
    lp:[4000,4000],
    decks:[deck1,deck2],
    hands:[[],[]],
    fields:[Array(5).fill(null),Array(5).fill(null)],
    preparedTraps:[[],[]],
    selectedAttacker:null,
    animatingBattle:false,
    gameOver:false
  };

  state.hands[0]=state.decks[0].splice(0,5);
  state.hands[1]=state.decks[1].splice(0,5);

  document.getElementById("oppName").textContent=twoPlayers
    ?"JOGADOR 2"
    :"BOT • "+selectedDiff.toUpperCase();

  document.getElementById("myName").textContent=twoPlayers
    ?"JOGADOR 1"
    :"JOGADOR 1";

  screen("duel");
  log(twoPlayers
    ?"Duelo para 2 jogadores iniciado."
    :"Duelo contra BOT iniciado.");

  render();
  beginPlayerTurn(0);
}

function drawFromDeck(player){
  if(!state || state.gameOver || state.animatingBattle) return;
  if(state.activePlayer!==player){
    log("Esse monte não pode ser usado agora.");
    return;
  }
  if(state.phase!==0){
    log("A compra deste turno já foi feita.");
    return;
  }
  if(state.decks[player].length===0){
    log(`${playerName(player)} ficou sem cartas no deck.`);
    return;
  }
  const card=state.decks[player].shift();
  state.hands[player].push(card);
  state.phase=2;
  log(`${playerName(player)} comprou ${card.name}.`);
  render();
}

function beginPlayerTurn(player){
  if(!state || state.gameOver) return;

  state.activePlayer=player;
  state.phase=2;
  state.selectedAttacker=null;

  if(state.decks[player].length>0){
    const card=state.decks[player].shift();
    state.hands[player].push(card);
    log(`${playerName(player)} comprou uma carta.`);
  }else{
    log(`${playerName(player)} não tem cartas no deck.`);
  }

  render();

  if(state.twoPlayers){
    showWaitScreen(player);
  }else if(player===1){
    setTimeout(botTurn,700);
  }else{
    // Após a compra, o jogador pode avançar pelas fases normalmente.
    log("MAIN PHASE 1: toque em uma carta da sua mão para colocá-la na arena.");
  }
}

function playerName(player){
  if(!state) return "";
  if(state.twoPlayers) return player===0?"JOGADOR 1":"JOGADOR 2";
  return player===0?"VOCÊ":"BOT";
}

function showWaitScreen(player){
  const modal=document.getElementById("waitModal");
  if(!modal) return;

  modal.querySelector("h2").textContent=`VEZ DO ${playerName(player)}`;
  modal.querySelector("p").textContent=
    player===0
      ?"Passe o aparelho para o Jogador 1."
      :"Passe o aparelho para o Jogador 2.";

  const button=modal.querySelector("button");
  button.textContent="COMEÇAR TURNO";
  button.onclick=()=>{
    modal.classList.add("hidden");
    render();
  };

  modal.classList.remove("hidden");
}

function render(){
  if(!state) return;

  document.getElementById("turnLabel").textContent=`TURNO ${state.turn}`;
  document.getElementById("phaseLabel").textContent=phases[state.phase];

  document.getElementById("oppLP").textContent=state.lp[1];
  const oppDeckCount=document.getElementById("oppDeckCount");
  const myDeckCount=document.getElementById("myDeckCount");
  if(oppDeckCount) oppDeckCount.textContent=state.decks[1].length;
  if(myDeckCount) myDeckCount.textContent=state.decks[0].length;
  document.getElementById("oppBar").style.width=`${Math.max(0,state.lp[1]/40)}%`;
  document.getElementById("myBar").style.width=`${Math.max(0,state.lp[0]/40)}%`;

  drawZones(0,"myZones");
  drawZones(1,"oppZones");
  drawHand(0,"myHand");
  drawHand(1,"oppHand");
}

function drawZones(player,id){
  const element=document.getElementById(id);
  if(!element) return;

  element.innerHTML=state.fields[player].map((card,index)=>{
    if(!card){
      return `<div class="zone">ZONA ${index+1}</div>`;
    }

    return `
      <div class="zone occupied card-zone">
        <button class="field-card ${card.type}" onclick="selectFieldCard(${player},${index})" title="${escapeHTML(card.name)}">
          ${cardVisual(card)}
        </button>
      </div>
    `;
  }).join("");
}

function selectFieldCard(player,index){
  if(!state || state.gameOver || state.animatingBattle) return;
  const card=state.fields[player]?.[index];
  if(!card) return;

  // Durante o turno do jogador: toque no seu monstro para escolher o atacante
  // e depois toque no monstro adversário para iniciar a batalha.
  if(player===state.activePlayer && player===0){
    if(state.selectedAttacker===index){
      state.selectedAttacker=null;
      log(`Ataque de ${card.name} cancelado.`);
    }else{
      state.selectedAttacker=index;
      log(`${card.name} selecionado. Toque em um monstro inimigo para atacar.`);
    }
    render();
    return;
  }

  if(player===1 && state.activePlayer===0){
    if(state.selectedAttacker===null){
      log("Primeiro selecione um dos seus monstros.");
      return;
    }
    const attacker=state.fields[0][state.selectedAttacker];
    if(!attacker){
      state.selectedAttacker=null;
      render();
      return;
    }
    resolveBattle(0,state.selectedAttacker,1,index);
  }
}

function directAttack(){
  if(!state || state.gameOver || state.animatingBattle) return;
  if(state.activePlayer!==0){
    log("Agora não é a sua vez.");
    return;
  }
  if(state.phase!==3 && state.phase!==4){
    log("Entre na BATTLE PHASE para atacar.");
    return;
  }

  const index=state.selectedAttacker!==null
    ? state.selectedAttacker
    : state.fields[0].findIndex(Boolean);
  const attacker=state.fields[0][index];
  if(!attacker){
    log("Você não tem monstro para atacar.");
    return;
  }
  if(state.fields[1].some(Boolean)){
    log("O adversário ainda tem um monstro. Selecione seu atacante e toque no alvo.");
    return;
  }

  state.selectedAttacker=null;
  const damage=Math.max(100,Number(attacker.atk||0));
  state.lp[1]=Math.max(0,state.lp[1]-damage);
  animateBattle(attacker,null,damage,true,()=>{
    log(`${playerName(0)} fez um ataque direto: -${damage} LP.`);
    render();
    checkWin();
  });
}

function resolveBattle(attackerPlayer,attackerIndex,targetPlayer,targetIndex,onDone){
  if(!state || state.gameOver || state.animatingBattle) return;

  const attacker=state.fields[attackerPlayer]?.[attackerIndex];
  const target=state.fields[targetPlayer]?.[targetIndex];
  if(!attacker || !target) return;

  state.selectedAttacker=null;
  const atkA=Number(attacker.atk||0);
  const atkT=Number(target.atk||0);
  let damage=0;
  let resultText="";

  if(atkA>atkT){
    damage=atkA-atkT;
    state.fields[targetPlayer][targetIndex]=null;
    state.lp[targetPlayer]=Math.max(0,state.lp[targetPlayer]-damage);
    resultText=`${attacker.name} venceu ${target.name}: ${damage} LP de dano.`;
  }else if(atkA<atkT){
    damage=atkT-atkA;
    state.fields[attackerPlayer][attackerIndex]=null;
    state.lp[attackerPlayer]=Math.max(0,state.lp[attackerPlayer]-damage);
    resultText=`${target.name} venceu ${attacker.name}: ${damage} LP de dano.`;
  }else{
    state.fields[attackerPlayer][attackerIndex]=null;
    state.fields[targetPlayer][targetIndex]=null;
    resultText=`${attacker.name} e ${target.name} foram destruídos no empate.`;
  }

  animateBattle(attacker,target,damage,false,()=>{
    log(resultText);
    render();
    if(checkWin()) return;
    if(typeof onDone === "function") onDone();
  });
}

function animateBattle(attacker,target,damage,isDirect=false,onDone){
  const battle=document.getElementById("virtualBattle");
  const attackerBox=document.getElementById("battleAttacker");
  const targetBox=document.getElementById("battleTarget");
  const impact=document.getElementById("battleImpact");
  const caption=document.getElementById("battleCaption");
  if(!battle || !attackerBox || !targetBox || !impact || !caption){
    if(typeof onDone === "function") onDone();
    return;
  }

  state.animatingBattle=true;
  battle.classList.remove("hidden","battle-run");
  void battle.offsetWidth;
  attackerBox.innerHTML=cardVisual(attacker,"battle-card");
  targetBox.innerHTML=target ? cardVisual(target,"battle-card") : `<div class="battle-direct-target">DIRECT ATTACK</div>`;
  targetBox.style.display=target ? "block" : "none";
  caption.textContent=isDirect ? "ATAQUE DIRETO!" : "ATAQUE!";
  impact.textContent=damage>0 ? "⚡" : "💥";
  impact.classList.remove("show-impact");
  void impact.offsetWidth;
  battle.classList.add("battle-run");
  impact.classList.add("show-impact");

  setTimeout(()=>{
    battle.classList.add("hidden");
    battle.classList.remove("battle-run");
    impact.classList.remove("show-impact");
    attackerBox.innerHTML="";
    targetBox.innerHTML="";
    targetBox.style.display="block";
    state.animatingBattle=false;
    if(typeof onDone === "function") onDone();
  },1400);
}


function drawHand(player,id){
  // O HTML usa myHand/oppHand. A versão anterior procurava playerHand,
  // por isso a mão do jogador ficava vazia mesmo com cartas no estado.
  const element=document.getElementById(id || (player===0 ? "myHand" : "oppHand"));
  if(!element) return;

  if(player!==0){
    element.innerHTML=state.hands[player].map(()=>`
      <button class="hand-card-back" disabled aria-label="Carta virada para baixo"></button>
    `).join("");
    return;
  }

  element.innerHTML=state.hands[player].map((card,index)=>`
    <button type="button" class="hand-card full-hand-card"
      onclick="playCard(${player},${index})"
      ${state.activePlayer!==player || state.phase<2 || state.phase>4 ? "disabled":""}
      title="${escapeHTML(card.name)}">
      ${cardVisual(card)}
    </button>
  `).join("");
}
function drawOpponentHand(player,id){
  const element=document.getElementById(id);
  if(!element) return;

  element.innerHTML=state.hands[player].map(()=>`
    <div class="hand-card back-cards">🂠</div>
  `).join("");
}

function log(message){
  const element=document.getElementById("log");
  if(!element) return;

  element.innerHTML=`<div>${escapeHTML(message)}</div>`+element.innerHTML;
}

function playCard(player,index){
  if(!state || state.gameOver) return;
  if(state.activePlayer!==player) return;
  if(state.phase<2 || state.phase>4){
    log(`${playerName(player)}: avance até a MAIN PHASE para jogar uma carta.`);
    return;
  }

  const card=state.hands[player][index];
  if(!card) return;

  if(card.type==="monster"){
    const slot=state.fields[player].findIndex(x=>x===null);

    if(slot===-1){
      log(`${playerName(player)} está com as zonas de monstros cheias.`);
      return;
    }

    state.fields[player][slot]=card;
    state.hands[player].splice(index,1);
    log(`${playerName(player)} invocou ${card.name}.`);
  }
  else if(card.type==="spell"){
    state.hands[player].splice(index,1);

    const damage=150+Math.floor(Math.random()*351);
    const opponent=1-player;

    state.lp[opponent]=Math.max(0,state.lp[opponent]-damage);
    log(`${playerName(player)} ativou ${card.name} e causou ${damage} de dano.`);
  }
  else{
    state.hands[player].splice(index,1);
    state.preparedTraps[player].push(card);
    log(`${playerName(player)} preparou ${card.name}.`);
  }

  render();
  checkWin();
}

function nextPhase(){
  if(!state || state.gameOver) return;

  const p=state.activePlayer;
  if(!state.twoPlayers && p!==0) return;

  if(state.phase<5){
    state.phase++;
    log(`${playerName(p)} entrou em ${phases[state.phase]}.`);
    render();
  }
}

function endTurn(){
  if(!state || state.gameOver) return;

  const p=state.activePlayer;

  if(!state.twoPlayers && p!==0) return;

  log(`${playerName(p)} encerrou o turno.`);

  if(state.twoPlayers){
    state.turn++;
    beginPlayerTurn(1-p);
  }else{
    state.activePlayer=1;
    state.phase=0;
    render();
    setTimeout(botTurn,700);
  }
}

function botTurn(){
  if(!state || state.gameOver || state.animatingBattle) return;

  state.activePlayer=1;
  state.phase=2;
  state.selectedAttacker=null;

  // Compra sempre do próprio monte, em ordem aleatória porque o deck já foi embaralhado.
  if(state.decks[1].length>0){
    const drawn=state.decks[1].shift();
    state.hands[1].push(drawn);
    log(`BOT comprou uma carta do monte.`);
  }else{
    log(`BOT está sem cartas no monte.`);
  }

  // Primeiro mostramos a compra e a invocação na arena.
  const hand=state.hands[1];
  const monsterIndex=hand.findIndex(c=>c.type==="monster");

  if(monsterIndex!==-1){
    const slot=state.fields[1].findIndex(x=>x===null);
    if(slot!==-1){
      const card=hand.splice(monsterIndex,1)[0];
      state.fields[1][slot]=card;
      log(`BOT invocou ${card.name}.`);
    }
  }

  render();

  // O BOT não trava mais na batalha: ele espera um pouco, deixando o monstro
  // aparecer no campo antes de atacar.
  setTimeout(()=>{
    if(!state || state.gameOver) return;

    const handNow=state.hands[1];
    const spellIndex=handNow.findIndex(c=>c.type==="spell");
    const shouldUseSpell=
      spellIndex!==-1 &&
      (selectedDiff==="hard" || selectedDiff==="expert" || Math.random()<0.35);

    if(shouldUseSpell){
      const card=handNow.splice(spellIndex,1)[0];
      const damage=selectedDiff==="expert"?500:selectedDiff==="hard"?400:250;
      state.lp[0]=Math.max(0,state.lp[0]-damage);
      log(`BOT ativou ${card.name}: -${damage} LP.`);
      render();
    }

    setTimeout(()=>{
      if(!state || state.gameOver) return;

      const attackerIndex=state.fields[1].findIndex(Boolean);
      const targetIndex=state.fields[0].findIndex(Boolean);

      if(attackerIndex!==-1){
        const attacker=state.fields[1][attackerIndex];
        if(targetIndex!==-1){
          resolveBattle(1,attackerIndex,0,targetIndex,()=>{
            if(!state || state.gameOver) return;
            state.turn++;
            beginPlayerTurn(0);
          });
          return;
        }

        const damage=Math.max(100,Number(attacker.atk||0));
        state.lp[0]=Math.max(0,state.lp[0]-damage);
        animateBattle(attacker,null,damage,true,()=>{
          log(`BOT fez um ataque direto: -${damage} LP.`);
          render();
          if(checkWin()) return;
          state.turn++;
          beginPlayerTurn(0);
        });
        return;
      }

      render();
      if(checkWin()) return;
      state.turn++;
      beginPlayerTurn(0);
    },450);
  },500);
}

function checkWin(){
  if(!state) return false;

  let winner=null;

  if(state.lp[0]<=0) winner=state.twoPlayers?"JOGADOR 2":"BOT";
  if(state.lp[1]<=0) winner="JOGADOR 1";

  if(!winner) return false;

  state.gameOver=true;

  const modal=document.getElementById("waitModal");
  modal.querySelector("h2").textContent=`${winner} VENCEU!`;
  modal.querySelector("p").textContent="O duelo terminou.";
  const button=modal.querySelector("button");
  button.textContent="VOLTAR AO MENU";
  button.onclick=()=>{
    modal.classList.add("hidden");
    state=null;
    screen("menu");
  };
  modal.classList.remove("hidden");

  return true;
}

function confirmExit(){
  if(confirm("Sair do duelo?")){
    state=null;
    screen("menu");
  }
}
