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
let pendingPlacement=null;
let pendingReveal=null;

const CARD_BACK_IMAGE="assets/card-back.jpg";

function fieldEntry(player,index){
  return state?.fields?.[player]?.[index] || null;
}

function fieldCard(player,index){
  const entry=fieldEntry(player,index);
  return entry?.card || null;
}

function isFaceDown(player,index){
  return !!fieldEntry(player,index)?.faceDown;
}

function canUseFieldCard(player,index){
  return !!fieldCard(player,index) && !isFaceDown(player,index);
}

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
  if(typeof showShop === "function") showShop();
  else { screen("deckScreen"); renderDeck(); }
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

function makeDeck(cardPool=cards){
  if(cards.length===0){
    alert("As cartas ainda estão carregando. Tente novamente em um segundo.");
    return [];
  }

  // Cada jogador recebe um monte independente e embaralhado.
  // As cartas são sorteadas aleatoriamente do catálogo.
  const pool=shuffle(cardPool.length ? cardPool : cards);
  const deck=[];
  for(let i=0;i<30;i++){
    deck.push(pool[i % pool.length]);
  }
  return shuffle(deck);
}

function startBot(){
  startGame();
}

function startGame(){
  if(typeof currentUser === "undefined" || !currentUser){
    if(typeof showAuth === "function") showAuth("login");
    return;
  }
  const ownedPool=cards.filter(card => ownedCardIds && ownedCardIds.has(Number(card.id)));
  if(ownedPool.length < 30){
    alert("Você precisa ter pelo menos 30 cartas para montar o deck.");
    return;
  }
  const deck1=makeDeck(ownedPool);
  const deck2=makeDeck(cards);

  if(!deck1.length || !deck2.length) return;

  state={
    turn:1,
    activePlayer:0,
    phase:0,
    lp:[4000,4000],
    decks:[deck1,deck2],
    hands:[[],[]],
    // 10 zonas por jogador: duas fileiras de 5, mantendo a arena expansível.
    fields:[Array(10).fill(null),Array(10).fill(null)],
    preparedTraps:[[],[]],
    selectedAttacker:null,
    animatingBattle:false,
    gameOver:false,
    matchSaved:false
  };

  state.hands[0]=state.decks[0].splice(0,5);
  state.hands[1]=state.decks[1].splice(0,5);

  document.getElementById("oppName").textContent="BOT • "+selectedDiff.toUpperCase();
  document.getElementById("myName").textContent=currentUser.username.toUpperCase();

  screen("duel");
  log("Duelo contra BOT iniciado.");

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

  if(player===1){
    setTimeout(botTurn,700);
  }else{
    // Após a compra, o jogador pode avançar pelas fases normalmente.
    log("MAIN PHASE 1: toque em uma carta da sua mão para colocá-la na arena.");
  }
}

function playerName(player){
  if(!state) return "";
  return player===0?"VOCÊ":"BOT";
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

  element.innerHTML=state.fields[player].map((entry,index)=>{
    if(!entry){
      return `<div class="zone empty-zone"><span>ZONA ${index+1}</span></div>`;
    }

    const card=entry.card || entry;
    const faceDown=!!entry.faceDown;
    const selected=player===0 && state.selectedAttacker===index && !faceDown;

    return `
      <div class="zone occupied card-zone ${faceDown ? "face-down-zone" : ""}">
        <button type="button"
          class="field-card ${card.type} ${faceDown ? "face-down" : "face-up"} ${selected ? "selected" : ""}"
          onclick="selectFieldCard(${player},${index})"
          title="${faceDown ? "Carta face para baixo" : escapeHTML(card.name)}"
          aria-label="${faceDown ? "Carta face para baixo" : escapeHTML(card.name)}">
          ${faceDown
            ? `<img class="card-back-image" src="${CARD_BACK_IMAGE}" alt="Verso da carta">`
            : cardVisual(card)}
          ${faceDown ? `<span class="face-down-badge">FACE PARA BAIXO</span>` : ""}
        </button>
      </div>
    `;
  }).join("");
}

function selectFieldCard(player,index){
  if(!state || state.gameOver || state.animatingBattle) return;
  const entry=fieldEntry(player,index);
  const card=entry?.card;
  if(!entry || !card) return;

  if(player===0 && player===state.activePlayer && entry.faceDown){
    pendingReveal={player,index};
    openRevealModal();
    return;
  }

  if(entry.faceDown){
    log(player===0
      ? "Essa carta está face para baixo. Vire-a para cima antes de usá-la."
      : "Essa carta está face para baixo.");
    return;
  }

  if(player===state.activePlayer && player===0){
    if(state.phase!==3 && state.phase!==4){
      log("Entre na BATTLE PHASE para atacar.");
      return;
    }

    if(card.type!=="monster"){
      log("Somente monstros podem ser escolhidos como atacantes.");
      return;
    }

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
    const attacker=fieldCard(0,state.selectedAttacker);
    if(!attacker || isFaceDown(0,state.selectedAttacker)){
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

  const index=state.selectedAttacker!==null && canUseFieldCard(0,state.selectedAttacker)
    ? state.selectedAttacker
    : state.fields[0].findIndex(entry=>entry && !entry.faceDown && entry.card?.type==="monster");
  const attacker=fieldCard(0,index);

  if(!attacker){
    log("Você não tem monstro face para cima para atacar.");
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

  const attackerEntry=fieldEntry(attackerPlayer,attackerIndex);
  const targetEntry=fieldEntry(targetPlayer,targetIndex);
  const attacker=attackerEntry?.card;
  const target=targetEntry?.card;
  if(!attacker || !target) return;

  // Regra absoluta: carta face para baixo não pode ser usada em batalha.
  // Ela só volta a ser utilizável depois de revealSelectedCard().
  if(!canUseFieldCard(attackerPlayer,attackerIndex)){
    state.selectedAttacker=null;
    log("Uma carta face para baixo não pode atacar. Vire-a para cima primeiro.");
    render();
    return;
  }

  if(targetEntry.faceDown){
    targetEntry.faceDown=false;
    log(`${target.name} foi revelada durante a batalha.`);
  }

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

    pendingPlacement={player,index,slot};
    openCardInspector(card,{mode:"placement"});
    return;
  }

  // Magias e armadilhas também passam pela lateral para que a carta
  // selecionada fique sempre visível antes de uma ação.
  pendingPlacement={player,index,slot:null};
  openCardInspector(card,{mode:card.type==="spell"?"spell":"trap"});
}

function openCardInspector(card, options={}){
  const panel=document.getElementById("cardInspector");
  const preview=document.getElementById("inspectorCard");
  const name=document.getElementById("inspectorName");
  const stats=document.getElementById("inspectorStats");
  const description=document.getElementById("inspectorDescription");
  const actions=document.getElementById("inspectorActions");
  if(!panel || !preview) return;

  const mode=options.mode || "placement";
  preview.innerHTML=cardVisual(card,"inspector-card-visual");
  name.textContent=card.name || "CARTA";
  stats.textContent=card.type==="monster"
    ? `ATK ${card.atk ?? "—"}   •   DEF ${card.def ?? "—"}`
    : (card.type==="spell" ? "MAGIA" : "ARMADILHA");
  description.textContent=card.description || "Sem efeito cadastrado.";

  if(mode==="placement"){
    actions.innerHTML=`
      <button type="button" class="inspector-btn face-up" onclick="confirmInspectorPlacement(false)">▲ FACE PARA CIMA</button>
      <button type="button" class="inspector-btn face-down" onclick="confirmInspectorPlacement(true)">🂠 FACE PARA BAIXO</button>
      <button type="button" class="inspector-btn cancel" onclick="cancelInspectorSelection()">CANCELAR</button>`;
  }else if(mode==="spell"){
    actions.innerHTML=`
      <button type="button" class="inspector-btn face-up" onclick="confirmInspectorAction()">⚡ ATIVAR MAGIA</button>
      <button type="button" class="inspector-btn cancel" onclick="cancelInspectorSelection()">CANCELAR</button>`;
  }else{
    actions.innerHTML=`
      <button type="button" class="inspector-btn face-down" onclick="confirmInspectorAction()">🂠 PREPARAR ARMADILHA</button>
      <button type="button" class="inspector-btn cancel" onclick="cancelInspectorSelection()">CANCELAR</button>`;
  }

  panel.classList.add("open");
  panel.setAttribute("aria-hidden","false");
}

function closeCardInspector(){
  const panel=document.getElementById("cardInspector");
  if(panel){
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden","true");
  }
}

function cancelInspectorSelection(){
  pendingPlacement=null;
  pendingReveal=null;
  closeCardInspector();
}

function confirmInspectorPlacement(faceDown){
  if(!state || !pendingPlacement) return;
  const {player,index,slot}=pendingPlacement;
  const card=state.hands[player]?.[index];
  if(!card || slot===null || slot===undefined){
    cancelInspectorSelection();
    return;
  }

  state.fields[player][slot]={card,faceDown:!!faceDown};
  state.hands[player].splice(index,1);
  pendingPlacement=null;
  closeCardInspector();

  log(faceDown
    ? `${playerName(player)} colocou ${card.name} face para baixo.`
    : `${playerName(player)} invocou ${card.name} face para cima.`);
  render();
  checkWin();
}

function confirmInspectorAction(){
  if(!state || !pendingPlacement) return;
  const {player,index}=pendingPlacement;
  const card=state.hands[player]?.[index];
  if(!card){ cancelInspectorSelection(); return; }

  state.hands[player].splice(index,1);
  const opponent=1-player;

  if(card.type==="spell"){
    const damage=150+Math.floor(Math.random()*351);
    state.lp[opponent]=Math.max(0,state.lp[opponent]-damage);
    log(`${playerName(player)} ativou ${card.name} e causou ${damage} de dano.`);
  }else{
    state.preparedTraps[player].push(card);
    log(`${playerName(player)} preparou ${card.name}.`);
  }

  pendingPlacement=null;
  closeCardInspector();
  render();
  checkWin();
}

function openRevealModal(){
  if(!state || !pendingReveal) return;
  const entry=fieldEntry(pendingReveal.player,pendingReveal.index);
  if(!entry) return;

  const panel=document.getElementById("cardInspector");
  const preview=document.getElementById("inspectorCard");
  const name=document.getElementById("inspectorName");
  const stats=document.getElementById("inspectorStats");
  const description=document.getElementById("inspectorDescription");
  const actions=document.getElementById("inspectorActions");
  if(!panel || !preview) return;

  preview.innerHTML=`<div class="inspector-back"><img src="${CARD_BACK_IMAGE}" alt="Verso da carta"></div>`;
  name.textContent="CARTA FACE PARA BAIXO";
  stats.textContent="ATK —   •   DEF —";
  description.textContent="Os dados desta carta estão escondidos enquanto ela estiver face para baixo.";
  actions.innerHTML=`
    <button type="button" class="inspector-btn face-up" onclick="revealSelectedCard()">👁️ VIRAR PARA CIMA</button>
    <button type="button" class="inspector-btn cancel" onclick="cancelReveal()">CANCELAR</button>`;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden","false");
}

function revealSelectedCard(){
  if(!state || !pendingReveal) return;
  const {player,index}=pendingReveal;
  const entry=fieldEntry(player,index);
  if(!entry){ cancelReveal(); return; }

  entry.faceDown=false;
  const name=entry.card?.name || "Carta";
  pendingReveal=null;
  closeCardInspector();
  log(`${name} foi virada para cima e agora pode ser usada.`);
  render();
}

function cancelReveal(){
  pendingReveal=null;
  closeCardInspector();
}

function nextPhase(){
  if(!state || state.gameOver) return;

  const p=state.activePlayer;

  if(state.phase<5){
    state.phase++;
    log(`${playerName(p)} entrou em ${phases[state.phase]}.`);
    render();
  }
}

function endTurn(){
  if(!state || state.gameOver) return;

  const p=state.activePlayer;


  log(`${playerName(p)} encerrou o turno.`);

  state.activePlayer=1;
  state.phase=0;
  render();
  setTimeout(botTurn,700);
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
      state.fields[1][slot]={card,faceDown:false};
      log(`BOT invocou ${card.name} face para cima.`);
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

      const attackerIndex=state.fields[1].findIndex(entry=>entry && !entry.faceDown && entry.card?.type==="monster");
      const targetIndex=state.fields[0].findIndex(Boolean);

      if(attackerIndex!==-1){
        const attacker=fieldCard(1,attackerIndex);
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

  if(state.lp[0]<=0) winner="BOT";
  if(state.lp[1]<=0) winner=currentUser?.username?.toUpperCase() || "JOGADOR";

  if(!winner) return false;

  state.gameOver=true;
  const playerWon = winner !== "BOT";
  if(typeof recordMatch === "function") recordMatch(playerWon ? "win" : "loss");

  const modal=document.getElementById("waitModal");
  modal.querySelector("h2").textContent=`${winner} VENCEU!`;
  modal.querySelector("p").textContent=playerWon
    ? `Vitória no modo ${({easy:"fácil",normal:"normal",hard:"difícil",expert:"mestre"}[selectedDiff] || selectedDiff)}. Recompensa: +${({easy:20,normal:30,hard:40,expert:50}[selectedDiff] || 0)} créditos.`
    : "A partida foi registrada no seu histórico.";
  const button=modal.querySelector("button");
  button.textContent="VOLTAR AO MENU";
  button.onclick=()=>{
    modal.classList.add("hidden");
    state=null;
    if(typeof refreshAccount === "function") refreshAccount().catch(()=>{});
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
