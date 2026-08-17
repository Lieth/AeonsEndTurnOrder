import { getBaseCardsForPlayers, state } from "./state.js";
import {
  cityDecreaseButton,
  cityHealthEl,
  cityHealthLabelEl,
  cityHealthMainEl,
  cityIncreaseButton,
  currentCardEl,
  currentCardImageEl,
  discardModalCardsEl,
  discardModalCloseButton,
  discardModalEl,
  discardPileButton,
  discardPileCountEl,
  discardPileNemesisButton,
  discardPileReturnButton,
  drawPileButton,
  drawPileCountEl,
  drawPilePeekButton,
  drawPileReorderButton,
  drawPileRevealButton,
  drawPileRevealTwoButton,
  healthEditApplyButton,
  healthEditCancelButton,
  healthEditCopyEl,
  healthEditInputEl,
  healthEditModalEl,
  healthEditTitleEl,
  historyButton,
  historyClearButton,
  historyModalCloseButton,
  historyModalContentEl,
  historyModalEl,
  helpButton,
  helpModalCloseButton,
  helpModalEl,
  modalCardsEl,
  modalCopyEl,
  modalEl,
  nemesisDecreaseButton,
  nemesisHealthEl,
  nemesisHealthLabelEl,
  nemesisHealthMainEl,
  nemesisIncreaseButton,
  playerSetupAddButton,
  playerSetupApplyButton,
  playerSetupButton,
  playerSetupCancelButton,
  playerSetupListEl,
  playerSetupModalEl,
  playerSetupNemesisInput,
  playerCountLabelEl,
  roundCounterEl,
  soundToggleButton,
  wakeLockButton
} from "./dom.js";
import {
  escapeHtml,
  getCardImagePath,
  getDefaultPlayerName,
  getPlayerPreviewPath,
  getSanitizedNemesisName,
  getSanitizedPlayerNames,
  isNemesisCard,
  isPlayerCard,
  shuffle
} from "./helpers.js";

let shuffleAnimationTimeoutId = null;
    let wakeLock = null;
    let wakeLockRequested = false;
    const nemesisSoundByCard = {
      "Nemesis 1": new Audio("resources/Nemesis%201.mp3"),
      "Nemesis 2": new Audio("resources/Nemesis%202.mp3")
    };
    const preloadedCardImages = [];
    const HISTORY_STORAGE_KEY = "drawphaser.gameHistory.v1";
    const GAME_STATE_STORAGE_KEY = "drawphaser.currentGame.v1";
    const MAX_HISTORY_GAMES = 24;
    let historyStore = {
      games: [],
      activeGameId: null
    };

    function loadHistoryStore() {
      try {
        const rawValue = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (!rawValue) {
          return;
        }

        const parsed = JSON.parse(rawValue);
        if (!parsed || !Array.isArray(parsed.games)) {
          return;
        }

        historyStore = {
          games: parsed.games,
          activeGameId: typeof parsed.activeGameId === "string" ? parsed.activeGameId : null
        };
      } catch (error) {
        console.warn("History load failed:", error);
      }
    }

    function saveHistoryStore() {
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyStore));
      } catch (error) {
        console.warn("History save failed:", error);
      }
    }

    function buildGameStateSnapshot() {
      return {
        playerCount: state.playerCount,
        playerNames: [...state.playerNames],
        nemesisName: state.nemesisName,
        drawPile: [...state.drawPile],
        currentCard: state.currentCard,
        discardPile: [...state.discardPile],
        round: state.round,
        soundMuted: state.soundMuted,
        cityHealth: state.cityHealth,
        nemesisHealth: state.nemesisHealth
      };
    }

    function saveGameStateSnapshot() {
      try {
        localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(buildGameStateSnapshot()));
      } catch (error) {
        console.warn("Game snapshot save failed:", error);
      }
    }

    function restoreGameStateSnapshot() {
      try {
        const rawValue = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        if (!rawValue) {
          return false;
        }

        const parsed = JSON.parse(rawValue);
        if (!parsed || !Array.isArray(parsed.drawPile) || !Array.isArray(parsed.discardPile) || !Array.isArray(parsed.playerNames)) {
          return false;
        }

        state.playerCount = Number.isInteger(parsed.playerCount) ? parsed.playerCount : parsed.playerNames.length;
        state.playerNames = parsed.playerNames.slice(0, 4);
        state.nemesisName = typeof parsed.nemesisName === "string" && parsed.nemesisName.length > 0 ? parsed.nemesisName : "Nemesis";
        state.drawPile = [...parsed.drawPile];
        state.currentCard = parsed.currentCard ?? null;
        state.discardPile = [...parsed.discardPile];
        state.round = Number.isInteger(parsed.round) && parsed.round > 0 ? parsed.round : 1;
        state.soundMuted = Boolean(parsed.soundMuted);
        state.cityHealth = Number.isInteger(parsed.cityHealth) && parsed.cityHealth >= 0 ? parsed.cityHealth : 30;
        state.nemesisHealth = Number.isInteger(parsed.nemesisHealth) && parsed.nemesisHealth >= 0 ? parsed.nemesisHealth : 70;

        state.pendingAction = null;
        state.discardViewOpen = false;
        state.helpViewOpen = false;
        state.historyViewOpen = false;
        state.playerSetupViewOpen = false;
        state.playerSetupDraftNames = [];
        state.playerSetupDraftNemesisName = state.nemesisName;
        state.healthEditViewOpen = false;
        state.healthEditTarget = null;
        state.healthEditDraftValue = "0";

        return true;
      } catch (error) {
        console.warn("Game snapshot restore failed:", error);
        return false;
      }
    }

    function getActiveHistoryGame() {
      if (!historyStore.activeGameId) {
        return null;
      }

      return historyStore.games.find((game) => game.id === historyStore.activeGameId) ?? null;
    }

    function getOrCreateRound(game, roundNumber) {
      let round = game.rounds.find((entry) => entry.number === roundNumber);
      if (!round) {
        round = {
          number: roundNumber,
          entries: []
        };
        game.rounds.push(round);
        game.rounds.sort((a, b) => a.number - b.number);
      }

      return round;
    }

    function ensureHistoryRound(roundNumber) {
      const game = getActiveHistoryGame();
      if (!game) {
        return;
      }

      getOrCreateRound(game, roundNumber);
      saveHistoryStore();
    }

    function endActiveHistoryGame(reason = "new-game") {
      const game = getActiveHistoryGame();
      if (!game || game.endedAt) {
        return;
      }

      game.endedAt = new Date().toISOString();
      game.endReason = reason;
      saveHistoryStore();
    }

    function beginHistoryGame() {
      endActiveHistoryGame("new-game");

      const id = `game-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const startedAt = new Date().toISOString();
      const game = {
        id,
        startedAt,
        endedAt: null,
        endReason: null,
        nemesisName: state.nemesisName,
        playerNames: [...state.playerNames],
        rounds: [{
          number: 1,
          entries: []
        }]
      };

      historyStore.games.unshift(game);
      historyStore.games = historyStore.games.slice(0, MAX_HISTORY_GAMES);
      historyStore.activeGameId = id;
      saveHistoryStore();
    }

    function deleteHistoryGame(gameId) {
      if (!gameId || gameId === historyStore.activeGameId) {
        return;
      }

      historyStore.games = historyStore.games.filter((game) => game.id !== gameId);
      saveHistoryStore();
    }

    function addHistoryEntry(text, roundNumber = state.round) {
      const game = getActiveHistoryGame();
      if (!game) {
        return;
      }

      const round = getOrCreateRound(game, roundNumber);
      round.entries.push({
        at: new Date().toISOString(),
        text
      });
      saveHistoryStore();
    }

    function logHistoryDraw(card) {
      addHistoryEntry(`- ${getCardDisplayName(card)}`);
    }

    function logHistoryAction(text) {
      addHistoryEntry(`- Action: ${text}`);
    }

    function formatHistoryDate(isoValue) {
      const date = new Date(isoValue);
      if (Number.isNaN(date.getTime())) {
        return "Unknown";
      }

      return date.toLocaleString();
    }

    function escapeHistory(value) {
      return escapeHtml(value);
    }

    function renderHistoryModal() {
      historyModalContentEl.innerHTML = "";

      if (!state.historyViewOpen) {
        historyModalEl.classList.remove("active");
        return;
      }

      historyModalEl.classList.add("active");

      if (historyStore.games.length === 0) {
        historyModalContentEl.innerHTML = '<div class="empty-state">No games recorded yet.</div>';
        return;
      }

      historyStore.games.forEach((game, gameIndex) => {
        const card = document.createElement("section");
        card.className = "history-game";

        const gameTitle = `Game ${historyStore.games.length - gameIndex}`;
        const started = formatHistoryDate(game.startedAt);
        const players = (game.playerNames ?? []).join(", ");
        const isCurrent = game.id === historyStore.activeGameId;
        const deleteButtonMarkup = isCurrent
          ? '<button class="history-delete" type="button" disabled title="Current game cannot be deleted">Current</button>'
          : `<button class="history-delete" type="button" data-game-id="${escapeHistory(game.id)}" title="Delete this game from history">Delete</button>`;

        card.innerHTML = `
          <div class="history-game-head">
            <h3 class="history-game-title">${escapeHistory(gameTitle)}${isCurrent ? " (Current)" : ""}</h3>
            ${deleteButtonMarkup}
          </div>
          <p class="history-meta">Start: ${escapeHistory(started)}</p>
          <p class="history-meta">Nemesis: ${escapeHistory(game.nemesisName ?? "Nemesis")}</p>
          <p class="history-meta">Players: ${escapeHistory(players || "n/a")}</p>
        `;

        const deleteButton = card.querySelector(".history-delete[data-game-id]");
        if (deleteButton) {
          deleteButton.addEventListener("click", () => {
            deleteHistoryGame(game.id);
            render();
          });
        }

        const rounds = Array.isArray(game.rounds) ? game.rounds : [];
        rounds.sort((a, b) => a.number - b.number);

        rounds.forEach((round) => {
          const roundHost = document.createElement("div");
          roundHost.className = "history-round";

          const entries = Array.isArray(round.entries) ? round.entries : [];
          const listMarkup = entries.length === 0
            ? '<li>- No entries</li>'
            : entries.map((entry) => `<li>${escapeHistory(entry.text)}</li>`).join("");

          roundHost.innerHTML = `
            <h4 class="history-round-title">Round ${round.number}</h4>
            <ul class="history-round-entries">${listMarkup}</ul>
          `;

          card.appendChild(roundHost);
        });

        historyModalContentEl.appendChild(card);
      });
    }

    async function requestWakeLock() {
      if (!('wakeLock' in navigator)) {
        alert('Wake lock is not supported in this browser.');
        return false;
      }

      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLockRequested = true;
        wakeLock.addEventListener('release', () => {
          wakeLockRequested = false;
          render();
        });
        return true;
      } catch (error) {
        console.error('Wake lock request failed:', error);
        wakeLockRequested = false;
        return false;
      }
    }

    async function releaseWakeLock() {
      if (wakeLock) {
        try {
          await wakeLock.release();
        } catch (error) {
          console.error('Wake lock release failed:', error);
        }
      }
      wakeLock = null;
      wakeLockRequested = false;
    }

    document.addEventListener('visibilitychange', async () => {
      if (wakeLockRequested && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    });

    function preloadCardImages() {
      const imageSources = [
        "resources/Discard.png",
        "resources/Player%201.png",
        "resources/Player%202.png",
        "resources/Player%203.png",
        "resources/Player%204.png",
        "resources/Player%20X.png",
        "resources/Nemesis%201.png",
        "resources/Nemesis%202.png"
      ];

      imageSources.forEach((source) => {
        const image = new Image();
        image.decoding = "async";
        image.src = source;
        preloadedCardImages.push(image);

        if (typeof image.decode === "function") {
          image.decode().catch(() => {
            // Best-effort preload; the app still works if a decode is skipped.
          });
        }
      });
    }

    function getCardDisplayName(card) {
      if (isNemesisCard(card)) {
        return "Nemesis";
      }

      const playerCardMatch = /^Player ([1-4])$/.exec(card);
      if (playerCardMatch) {
        const playerIndex = Number.parseInt(playerCardMatch[1], 10) - 1;
        if (playerIndex >= 0 && playerIndex < state.playerNames.length) {
          return state.playerNames[playerIndex];
        }
      }

      return card;
    }

    function getCardMediaMarkup(card, mediaClass) {
      return `
        <div class="card-media-wrap">
          <img class="${mediaClass}" src="${getCardImagePath(card)}" alt="${card}">
          <span class="card-media-title">${getCardDisplayName(card)}</span>
        </div>
      `;
    }

    function reshuffleFreshPile(advanceRound = false) {
      if (advanceRound) {
        state.round += 1;
        ensureHistoryRound(state.round);
      }

      state.drawPile = shuffle(getBaseCardsForPlayers(state.playerCount));
      state.discardPile = [];
      state.currentCard = null;
    }

    function triggerShuffleAnimation() {
      drawPileButton.classList.remove("is-shuffling");
      void drawPileButton.offsetWidth;
      drawPileButton.classList.add("is-shuffling");

      if (shuffleAnimationTimeoutId !== null) {
        clearTimeout(shuffleAnimationTimeoutId);
      }

      shuffleAnimationTimeoutId = setTimeout(() => {
        drawPileButton.classList.remove("is-shuffling");
        shuffleAnimationTimeoutId = null;
      }, 700);
    }

    function refillIfNeeded() {
      if (state.drawPile.length === 0) {
        reshuffleFreshPile(true);
        return true;
      }

      return false;
    }

    function ensureCardsAvailable(count) {
      if (state.drawPile.length === 0 && count > 0) {
        reshuffleFreshPile(true);
        return true;
      }

      return false;
    }

    function resetPendingAction() {
      state.pendingAction = null;
    }

    function closeDiscardModal() {
      state.discardViewOpen = false;
    }

    function closeHelpModal() {
      state.helpViewOpen = false;
    }

    function closeHistoryModal() {
      state.historyViewOpen = false;
    }

    function closePlayerSetupModal() {
      state.playerSetupViewOpen = false;
      state.playerSetupDraftNames = [];
      state.playerSetupDraftNemesisName = state.nemesisName;
    }

    function openHealthEditModal(target) {
      state.healthEditTarget = target;
      state.healthEditDraftValue = target === "city" ? String(state.cityHealth) : String(state.nemesisHealth);
      state.healthEditViewOpen = true;
      render();

      setTimeout(() => {
        healthEditInputEl.focus();
        healthEditInputEl.select();
      }, 0);
    }

    function closeHealthEditModal() {
      state.healthEditViewOpen = false;
      state.healthEditTarget = null;
      state.healthEditDraftValue = "0";
    }

    function canClosePendingActionWithEscape() {
      if (!state.pendingAction) {
        return false;
      }

      if (state.pendingAction.type === "peekTop") {
        return true;
      }

      if (state.pendingAction.type === "returnPlayer") {
        return true;
      }

      if (state.pendingAction.type === "drawpileReorder") {
        return true;
      }

      if (state.pendingAction.type === "peekTwo") {
        return true;
      }

      if (state.pendingAction.type === "returnNemesisAll") {
        return true;
      }

      return false;
    }

    function openPlayerSetupModal() {
      state.playerSetupDraftNames = [...state.playerNames];
      state.playerSetupDraftNemesisName = state.nemesisName;
      state.playerSetupViewOpen = true;
      render();
    }

    function renderPlayerSetupModal() {
      playerSetupListEl.innerHTML = "";

      if (!state.playerSetupViewOpen) {
        playerSetupModalEl.classList.remove("active");
        return;
      }

      playerSetupModalEl.classList.add("active");
      playerSetupNemesisInput.value = state.playerSetupDraftNemesisName;
      playerSetupNemesisInput.oninput = (event) => {
        state.playerSetupDraftNemesisName = event.target.value;
      };

      state.playerSetupDraftNames.forEach((name, index) => {
        const row = document.createElement("div");
        row.className = "player-setup-row";
        row.innerHTML = `
          <img class="player-setup-preview" src="${getPlayerPreviewPath(index)}" alt="Player ${index + 1} card color preview">
          <input class="player-setup-input" data-index="${index}" type="text" maxlength="40" value="${escapeHtml(name)}" placeholder="${escapeHtml(getDefaultPlayerName(index))}" aria-label="Player ${index + 1} name">
          <button class="player-remove" data-index="${index}" aria-label="Remove player ${index + 1}" ${state.playerSetupDraftNames.length <= 1 ? "disabled" : ""}>x</button>
        `;

        const input = row.querySelector(".player-setup-input");
        input.addEventListener("input", (event) => {
          state.playerSetupDraftNames[index] = event.target.value;
        });

        const removeButton = row.querySelector(".player-remove");
        removeButton.addEventListener("click", () => {
          if (state.playerSetupDraftNames.length <= 1) {
            return;
          }

          state.playerSetupDraftNames.splice(index, 1);
          render();
        });

        playerSetupListEl.appendChild(row);
      });

      playerSetupAddButton.disabled = state.playerSetupDraftNames.length >= 4;
      playerSetupApplyButton.disabled = state.playerSetupDraftNames.length < 1;
    }

    function updateSoundToggleButton() {
      soundToggleButton.classList.toggle("is-muted", state.soundMuted);
      soundToggleButton.innerHTML = state.soundMuted ? "&#128263;" : "&#128266;";
      soundToggleButton.setAttribute("aria-label", state.soundMuted ? "Unmute sounds" : "Mute sounds");
      soundToggleButton.setAttribute("title", state.soundMuted ? "Unmute sounds" : "Mute sounds");
    }

    function playNemesisSound(card, delayMs = 0) {
      if (state.soundMuted) {
        return;
      }

      if (!isNemesisCard(card)) {
        return;
      }

      const sourceAudio = nemesisSoundByCard[card];
      if (!sourceAudio) {
        return;
      }

      const playNow = () => {
        const sound = sourceAudio.cloneNode();
        sound.currentTime = 0;

        const playPromise = sound.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Ignore autoplay/interrupt errors so gameplay is unaffected.
          });
        }
      };

      if (delayMs > 0) {
        setTimeout(playNow, delayMs);
        return;
      }

      playNow();
    }

    function getReturnableNemesisCount() {
      return state.discardPile.filter((card) => isNemesisCard(card)).length;
    }

    function getReturnablePlayerCards() {
      const options = state.discardPile.reduce((cards, card, index) => {
        if (isPlayerCard(card)) {
          cards.push({
            key: `discard-${index}`,
            source: "discard",
            index,
            card
          });
        }

        return cards;
      }, []);

      return options;
    }

    function returnSelectedCardToDrawPile(option) {
      state.discardPile.splice(option.index, 1);

      state.drawPile.push(option.card);
      state.drawPile = shuffle(state.drawPile);
      triggerShuffleAnimation();

      if (option.index === 0) {
        state.currentCard = state.discardPile[0] ?? null;
      }

      logHistoryAction(`Return Player -> ${getCardDisplayName(option.card)}`);

      resetPendingAction();
      render();
    }

    function cancelPeekTwoAction() {
      if (state.pendingAction && state.pendingAction.type === "peekTwo") {
        for (let index = state.pendingAction.cards.length - 1; index >= 0; index -= 1) {
          state.drawPile.unshift(state.pendingAction.cards[index]);
        }

        logHistoryAction("Reveal Two -> Cancel");
      }

      resetPendingAction();
      render();
    }

    function returnAllNemesisCardsToDrawPile() {
      const nemesisCards = state.discardPile.filter((card) => isNemesisCard(card));

      if (nemesisCards.length === 0) {
        resetPendingAction();
        render();
        return;
      }

      state.discardPile = state.discardPile.filter((card) => !isNemesisCard(card));
      state.drawPile.push(...nemesisCards);
      state.drawPile = shuffle(state.drawPile);
      triggerShuffleAnimation();
      state.currentCard = state.discardPile[0] ?? null;
      logHistoryAction("Return Nemesis -> Yes");

      resetPendingAction();
      render();
    }

    function renderActionModal() {
      modalCardsEl.innerHTML = "";

      if (!state.pendingAction) {
        modalEl.classList.remove("active");
        return;
      }

      modalEl.classList.add("active");

      if (state.pendingAction.type === "peekOne") {
        modalCopyEl.textContent = "Choose whether the shown card should stay on top or be placed at the bottom of the draw pile.";

        const cardRow = document.createElement("div");
        cardRow.className = "decision-card";
        cardRow.innerHTML = `
          ${getCardMediaMarkup(state.pendingAction.card, "decision-card-media")}
          <div class="inline-actions">
            <button class="primary" data-action="topdeck">Topdeck</button>
            <button class="secondary" data-action="bottomdeck">Place At Bottom</button>
          </div>
        `;

        cardRow.querySelector('[data-action="topdeck"]').addEventListener("click", () => {
          state.drawPile.unshift(state.pendingAction.card);
          logHistoryAction(`Reveal -> Keep On Top (${getCardDisplayName(state.pendingAction.card)})`);
          resetPendingAction();
          render();
        });

        cardRow.querySelector('[data-action="bottomdeck"]').addEventListener("click", () => {
          state.drawPile.push(state.pendingAction.card);
          logHistoryAction(`Reveal -> Place At Bottom (${getCardDisplayName(state.pendingAction.card)})`);
          resetPendingAction();
          render();
        });

        modalCardsEl.appendChild(cardRow);
        return;
      }

      if (state.pendingAction.type === "peekTop") {
        modalCopyEl.textContent = "This is the current top card. Close the peek to leave it on top of the draw pile.";

        const cardRow = document.createElement("div");
        cardRow.className = "decision-card";
        cardRow.innerHTML = `
          ${getCardMediaMarkup(state.pendingAction.card, "decision-card-media")}
          <div class="inline-actions">
            <button class="primary" data-action="close-peek">Keep On Top</button>
          </div>
        `;

        cardRow.querySelector('[data-action="close-peek"]').addEventListener("click", () => {
          resetPendingAction();
          render();
        });

        modalCardsEl.appendChild(cardRow);
        return;
      }

      if (state.pendingAction.type === "peekTwo") {
        const [firstCard, secondCard] = state.pendingAction.cards;

        if (!secondCard) {
          modalCopyEl.textContent = "Only one card was available. Choose whether it returns to the top or bottom of the draw pile.";

          const singleRow = document.createElement("div");
          singleRow.className = "decision-card";
          singleRow.innerHTML = `
            ${getCardMediaMarkup(firstCard, "decision-card-media")}
            <div class="inline-actions">
              <button class="primary" data-order="single-top">Return On Top</button>
              <button class="secondary" data-order="single-bottom">Return At Bottom</button>
            </div>
          `;

          singleRow.querySelector('[data-order="single-top"]').addEventListener("click", () => {
            state.drawPile.unshift(firstCard);
            logHistoryAction(`Reveal Two -> Return On Top (${getCardDisplayName(firstCard)})`);
            resetPendingAction();
            render();
          });

          singleRow.querySelector('[data-order="single-bottom"]').addEventListener("click", () => {
            state.drawPile.push(firstCard);
            logHistoryAction(`Reveal Two -> Return At Bottom (${getCardDisplayName(firstCard)})`);
            resetPendingAction();
            render();
          });

          modalCardsEl.appendChild(singleRow);
          return;
        }

        modalCopyEl.textContent = "Touch and drag to reorder left to right. Leftmost card will be drawn first, rightmost card becomes the bottom of these two.";

        const orderedCards = [firstCard, secondCard];
        const listHost = document.createElement("div");
        listHost.className = "reorder-list";
        const actionsRow = document.createElement("div");
        let draggedIndex = null;

        actionsRow.className = "decision-card";
        actionsRow.innerHTML = `
          <div>
            <strong>Two Card Order</strong>
            <div class="modal-copy" style="margin: 6px 0 0;">Left to right: next draw to bottom.</div>
          </div>
          <div class="inline-actions">
            <button class="primary" data-action="apply-two-reorder">Return In This Order</button>
            <button class="secondary" data-action="cancel-two-reorder">Cancel</button>
          </div>
        `;

        function renderPeekTwoReorderCards() {
          listHost.innerHTML = "";

          orderedCards.forEach((card, index) => {
            const cardRow = document.createElement("div");
            cardRow.className = "decision-card reorder-card";
            cardRow.draggable = true;
            cardRow.dataset.index = String(index);
            cardRow.innerHTML = `
              ${getCardMediaMarkup(card, "decision-card-media")}
              <div class="reorder-actions">
                <button class="reorder-move" type="button" data-direction="left" aria-label="Move card left">←</button>
                <button class="reorder-move" type="button" data-direction="right" aria-label="Move card right">→</button>
              </div>
              <div class="reorder-meta">
                <strong>${index + 1}. ${getCardDisplayName(card)}</strong>
                <p class="reorder-hint">Drag to swap or use the arrows.</p>
              </div>
            `;

            const moveButtons = cardRow.querySelectorAll(".reorder-move");
            moveButtons.forEach((button) => {
              button.addEventListener("click", (event) => {
                event.stopPropagation();
                const direction = button.dataset.direction;
                const targetIndex = direction === "left" ? index - 1 : index + 1;
                if (targetIndex < 0 || targetIndex >= orderedCards.length) {
                  return;
                }

                const targetCard = orderedCards[targetIndex];
                orderedCards[targetIndex] = orderedCards[index];
                orderedCards[index] = targetCard;
                renderPeekTwoReorderCards();
              });
            });

            cardRow.addEventListener("dragstart", (event) => {
              draggedIndex = index;
              cardRow.classList.add("is-dragging");
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }
            });

            cardRow.addEventListener("dragend", () => {
              draggedIndex = null;
              cardRow.classList.remove("is-dragging");
              listHost.querySelectorAll(".reorder-card").forEach((entry) => entry.classList.remove("is-drop-target"));
            });

            cardRow.addEventListener("dragover", (event) => {
              event.preventDefault();
              if (draggedIndex === null || draggedIndex === index) {
                return;
              }
              cardRow.classList.add("is-drop-target");
            });

            cardRow.addEventListener("dragleave", () => {
              cardRow.classList.remove("is-drop-target");
            });

            cardRow.addEventListener("drop", (event) => {
              event.preventDefault();
              cardRow.classList.remove("is-drop-target");
              if (draggedIndex === null || draggedIndex === index) {
                return;
              }
              const targetCard = orderedCards[index];
              orderedCards[index] = orderedCards[draggedIndex];
              orderedCards[draggedIndex] = targetCard;
              renderPeekTwoReorderCards();
            });

            listHost.appendChild(cardRow);
          });
        }

        actionsRow.querySelector('[data-action="apply-two-reorder"]').addEventListener("click", () => {
          for (let index = orderedCards.length - 1; index >= 0; index -= 1) {
            state.drawPile.unshift(orderedCards[index]);
          }
          logHistoryAction(`Reveal Two -> Return Order (${orderedCards.map((card) => getCardDisplayName(card)).join(" > ")})`);
          resetPendingAction();
          render();
        });

        actionsRow.querySelector('[data-action="cancel-two-reorder"]').addEventListener("click", () => {
          cancelPeekTwoAction();
        });

        renderPeekTwoReorderCards();
        modalCardsEl.appendChild(actionsRow);
        modalCardsEl.appendChild(listHost);
        return;
      }

      if (state.pendingAction.type === "returnPlayer") {
        modalCopyEl.textContent = "Choose a player card from discard to move back into the draw pile and reshuffle.";

        const actionsRow = document.createElement("div");
        actionsRow.className = "decision-card";
        actionsRow.innerHTML = `
          <div>
            <strong>Return Player Card</strong>
            <div class="modal-copy" style="margin: 6px 0 0;">Pick a player card to return, or cancel to keep discard unchanged.</div>
          </div>
          <div class="inline-actions">
            <button class="secondary" data-action="cancel-return-player">Cancel</button>
          </div>
        `;

        actionsRow.querySelector('[data-action="cancel-return-player"]').addEventListener("click", () => {
          logHistoryAction("Return Player -> Cancel");
          resetPendingAction();
          render();
        });

        modalCardsEl.appendChild(actionsRow);

        state.pendingAction.options.forEach((option) => {
          const row = document.createElement("div");
          row.className = "decision-card";
          row.innerHTML = `
            ${getCardMediaMarkup(option.card, "decision-card-media")}
            <div class="inline-actions">
              <button class="primary" data-action="return-player">Return From Discard</button>
            </div>
          `;

          row.querySelector('[data-action="return-player"]').addEventListener("click", () => {
            returnSelectedCardToDrawPile(option);
          });

          modalCardsEl.appendChild(row);
        });

        return;
      }

      if (state.pendingAction.type === "returnNemesisAll") {
        const count = state.pendingAction.count;
        const cardLabel = count === 1 ? "card" : "cards";
        modalCopyEl.textContent = `Return ${count} Nemesis ${cardLabel} from discard to draw pile and shuffle the draw pile?`;

        const confirmationRow = document.createElement("div");
        confirmationRow.className = "decision-card";
        confirmationRow.innerHTML = `
          <div>
            <strong>${count} Nemesis ${cardLabel}</strong>
            <div class="modal-copy" style="margin: 6px 0 0;">This action moves all Nemesis cards from discard into draw pile, then shuffles draw pile.</div>
          </div>
          <div class="inline-actions">
            <button class="primary" data-action="confirm-return-nemesis">OK</button>
            <button class="secondary" data-action="cancel-return-nemesis">Cancel</button>
          </div>
        `;

        confirmationRow.querySelector('[data-action="confirm-return-nemesis"]').addEventListener("click", () => {
          returnAllNemesisCardsToDrawPile();
        });

        confirmationRow.querySelector('[data-action="cancel-return-nemesis"]').addEventListener("click", () => {
          logHistoryAction("Return Nemesis -> No");
          resetPendingAction();
          render();
        });

        modalCardsEl.appendChild(confirmationRow);
        return;
      }

      if (state.pendingAction.type === "drawpileReorder") {
        modalCopyEl.textContent = "Inspect all cards currently in the draw pile and choose the return order. Touch and drag cards left to right. Leftmost card is drawn first, rightmost card is at the bottom.";

        const cards = state.pendingAction.cards;

        if (cards.length === 0) {
          const emptyRow = document.createElement("div");
          emptyRow.className = "decision-card";
          emptyRow.innerHTML = `
            <div class="empty-state">Draw pile is empty.</div>
            <div class="inline-actions">
              <button class="primary" data-action="close-reorder">Close</button>
            </div>
          `;

          emptyRow.querySelector('[data-action="close-reorder"]').addEventListener("click", () => {
            resetPendingAction();
            render();
          });

          modalCardsEl.appendChild(emptyRow);
          return;
        }

        const listHost = document.createElement("div");
        listHost.className = "reorder-list";
        const actionsRow = document.createElement("div");
        let draggedIndex = null;

        actionsRow.className = "decision-card";
        actionsRow.innerHTML = `
          <div>
            <strong>Return Order</strong>
            <div class="modal-copy" style="margin: 6px 0 0;">Left to right: next draw to bottom.</div>
          </div>
          <div class="inline-actions">
            <button class="primary" data-action="apply-reorder">Return In This Order</button>
            <button class="secondary" data-action="cancel-reorder">Cancel</button>
          </div>
        `;

        function renderReorderCards() {
          listHost.innerHTML = "";

          state.pendingAction.cards.forEach((card, index) => {
            const cardRow = document.createElement("div");
            cardRow.className = "decision-card reorder-card";
            cardRow.draggable = true;
            cardRow.dataset.index = String(index);
            cardRow.innerHTML = `
              ${getCardMediaMarkup(card, "decision-card-media")}
              <div class="reorder-actions">
                <button class="reorder-move" type="button" data-direction="left" aria-label="Move card left">←</button>
                <button class="reorder-move" type="button" data-direction="right" aria-label="Move card right">→</button>
              </div>
              <div class="reorder-meta">
                <strong>${index + 1}. ${getCardDisplayName(card)}</strong>
                <p class="reorder-hint">Drag to swap or use the arrows.</p>
              </div>
            `;

            const moveButtons = cardRow.querySelectorAll(".reorder-move");
            moveButtons.forEach((button) => {
              button.addEventListener("click", (event) => {
                event.stopPropagation();
                const direction = button.dataset.direction;
                const targetIndex = direction === "left" ? index - 1 : index + 1;
                if (targetIndex < 0 || targetIndex >= state.pendingAction.cards.length) {
                  return;
                }

                const targetCard = state.pendingAction.cards[targetIndex];
                state.pendingAction.cards[targetIndex] = state.pendingAction.cards[index];
                state.pendingAction.cards[index] = targetCard;
                renderReorderCards();
              });
            });

            cardRow.addEventListener("dragstart", (event) => {
              draggedIndex = index;
              cardRow.classList.add("is-dragging");
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }
            });

            cardRow.addEventListener("dragend", () => {
              draggedIndex = null;
              cardRow.classList.remove("is-dragging");
              listHost.querySelectorAll(".reorder-card").forEach((entry) => entry.classList.remove("is-drop-target"));
            });

            cardRow.addEventListener("dragover", (event) => {
              event.preventDefault();
              if (draggedIndex === null || draggedIndex === index) {
                return;
              }
              cardRow.classList.add("is-drop-target");
            });

            cardRow.addEventListener("dragleave", () => {
              cardRow.classList.remove("is-drop-target");
            });

            cardRow.addEventListener("drop", (event) => {
              event.preventDefault();
              cardRow.classList.remove("is-drop-target");
              if (draggedIndex === null || draggedIndex === index) {
                return;
              }
              const targetCard = state.pendingAction.cards[index];
              state.pendingAction.cards[index] = state.pendingAction.cards[draggedIndex];
              state.pendingAction.cards[draggedIndex] = targetCard;
              renderReorderCards();
            });

            listHost.appendChild(cardRow);
          });
        }

        actionsRow.querySelector('[data-action="apply-reorder"]').addEventListener("click", () => {
          state.drawPile = [...state.pendingAction.cards];
          logHistoryAction(`Reorder Draw Pile -> ${state.pendingAction.cards.map((card) => getCardDisplayName(card)).join(" > ")}`);
          resetPendingAction();
          render();
        });

        actionsRow.querySelector('[data-action="cancel-reorder"]').addEventListener("click", () => {
          logHistoryAction("Reorder Draw Pile -> Cancel");
          resetPendingAction();
          render();
        });

        renderReorderCards();
        modalCardsEl.appendChild(actionsRow);
        modalCardsEl.appendChild(listHost);
      }
    }

    function renderDiscardModal() {
      discardModalCardsEl.innerHTML = "";

      if (!state.discardViewOpen) {
        discardModalEl.classList.remove("active");
        return;
      }

      discardModalEl.classList.add("active");

      if (state.discardPile.length === 0) {
        discardModalCardsEl.innerHTML = '<div class="empty-state">Discard pile is empty.</div>';
        return;
      }

      state.discardPile.forEach((card) => {
        const row = document.createElement("div");
        row.className = "decision-card";
        row.innerHTML = getCardMediaMarkup(card, "discard-modal-card");
        discardModalCardsEl.appendChild(row);
      });
    }

    function renderHelpModal() {
      if (state.helpViewOpen) {
        helpModalEl.classList.add("active");
        return;
      }

      helpModalEl.classList.remove("active");
    }

    function renderHealthEditModal() {
      if (!state.healthEditViewOpen || !state.healthEditTarget) {
        healthEditModalEl.classList.remove("active");
        return;
      }

      healthEditModalEl.classList.add("active");
      const label = state.healthEditTarget === "city" ? "City" : state.nemesisName;
      healthEditTitleEl.textContent = `${label} Health`;
      healthEditCopyEl.textContent = `Enter current ${label.toLowerCase()} health.`;
      healthEditInputEl.value = state.healthEditDraftValue;
    }

    function applyHealthEdit() {
      if (!state.healthEditTarget) {
        closeHealthEditModal();
        render();
        return;
      }

      const parsed = Number.parseInt(healthEditInputEl.value, 10);
      if (Number.isNaN(parsed)) {
        return;
      }

      const nextValue = Math.max(0, parsed);
      if (state.healthEditTarget === "city") {
        state.cityHealth = nextValue;
      } else {
        state.nemesisHealth = nextValue;
      }

      closeHealthEditModal();
      render();
    }

    function canOpenHealthEditor() {
      return !(state.pendingAction || state.discardViewOpen || state.helpViewOpen || state.historyViewOpen || state.playerSetupViewOpen || state.healthEditViewOpen);
    }

    function bindHealthEditTrigger(element, target) {
      element.addEventListener("click", () => {
        if (!canOpenHealthEditor()) {
          return;
        }

        openHealthEditModal(target);
      });
    }

    function render() {
      if (state.currentCard) {
        currentCardImageEl.src = getCardImagePath(state.currentCard);
        currentCardImageEl.alt = getCardDisplayName(state.currentCard);
        currentCardImageEl.hidden = false;
        currentCardEl.hidden = false;
        currentCardEl.textContent = getCardDisplayName(state.currentCard);
      } else {
        currentCardImageEl.src = getCardImagePath("Discard");
        currentCardImageEl.alt = "Discard pile empty";
        currentCardImageEl.hidden = false;
        currentCardEl.hidden = true;
        currentCardEl.textContent = "";
      }
      drawPileCountEl.textContent = String(state.drawPile.length);
      discardPileCountEl.textContent = `${state.discardPile.length} card${state.discardPile.length === 1 ? "" : "s"}`;
      cityHealthEl.textContent = String(state.cityHealth);
      nemesisHealthEl.textContent = String(state.nemesisHealth);
      discardPileButton.classList.toggle("is-empty", state.discardPile.length === 0);
      const hasReturnablePlayers = getReturnablePlayerCards().length > 0;
      const returnableNemesisCount = getReturnableNemesisCount();
      const isLocked = Boolean(state.pendingAction) || state.discardViewOpen || state.helpViewOpen || state.historyViewOpen || state.playerSetupViewOpen || state.healthEditViewOpen;

      drawPileButton.disabled = isLocked;
      drawPilePeekButton.disabled = isLocked;
      drawPileRevealButton.disabled = isLocked;
      drawPileRevealTwoButton.disabled = isLocked;
      drawPileReorderButton.disabled = isLocked;
      discardPileButton.disabled = isLocked;
      discardPileNemesisButton.disabled = isLocked || returnableNemesisCount === 0;
      discardPileReturnButton.disabled = isLocked || !hasReturnablePlayers;
      playerSetupButton.disabled = Boolean(state.pendingAction) || state.discardViewOpen || state.helpViewOpen || state.historyViewOpen || state.playerSetupViewOpen;
      helpButton.disabled = Boolean(state.pendingAction) || state.discardViewOpen || state.historyViewOpen || state.playerSetupViewOpen;
      historyButton.disabled = Boolean(state.pendingAction) || state.discardViewOpen || state.helpViewOpen || state.playerSetupViewOpen;
      wakeLockButton.disabled = isLocked;
      wakeLockButton.textContent = wakeLockRequested ? '☀️' : '🌙';
      playerCountLabelEl.textContent = `Players ${state.playerCount}`;
      roundCounterEl.textContent = `Round ${state.round}`;
      nemesisHealthLabelEl.textContent = state.nemesisName;
      cityHealthMainEl.setAttribute("aria-label", "Set city health");
      nemesisHealthMainEl.setAttribute("aria-label", `Set ${state.nemesisName} health`);
      playerSetupButton.textContent = "New";
      playerSetupButton.setAttribute("aria-label", "Start new game");
      updateSoundToggleButton();

      renderActionModal();
      renderDiscardModal();
      renderHelpModal();
      renderHistoryModal();
      renderPlayerSetupModal();
      renderHealthEditModal();
      saveGameStateSnapshot();
    }

    function drawNextCard() {
      const didRefill = refillIfNeeded();
      if (didRefill) {
        triggerShuffleAnimation();
      }

      const nextCard = state.drawPile.shift();

      if (isNemesisCard(nextCard)) {
        playNemesisSound(nextCard);
      }

      state.discardPile.unshift(nextCard);

      state.currentCard = nextCard;
      logHistoryDraw(nextCard);
      render();
    }

    function peekTopCard() {
      const didRefill = ensureCardsAvailable(1);
      if (didRefill) {
        triggerShuffleAnimation();
      }

      if (isNemesisCard(state.drawPile[0])) {
        playNemesisSound(state.drawPile[0]);
      }

      state.pendingAction = {
        type: "peekTop",
        card: state.drawPile[0]
      };
      logHistoryAction(`Peek -> ${getCardDisplayName(state.drawPile[0])}`);
      render();
    }

    function revealNextCard() {
      const didRefill = ensureCardsAvailable(1);
      if (didRefill) {
        triggerShuffleAnimation();
      }

      const nextCard = state.drawPile.shift();
      if (isNemesisCard(nextCard)) {
        playNemesisSound(nextCard);
      }

      state.pendingAction = {
        type: "peekOne",
        card: nextCard
      };
      logHistoryAction(`Reveal -> ${getCardDisplayName(nextCard)}`);
      render();
    }

    function revealNextTwoCards() {
      const didRefill = ensureCardsAvailable(2);
      if (didRefill) {
        triggerShuffleAnimation();
      }

      const firstCard = state.drawPile.shift();
      const secondCard = state.drawPile.length > 0 ? state.drawPile.shift() : null;

      if (isNemesisCard(firstCard)) {
        playNemesisSound(firstCard);
      }
      if (isNemesisCard(secondCard)) {
        playNemesisSound(secondCard, isNemesisCard(firstCard) ? 140 : 0);
      }

      const revealed = secondCard ? [firstCard, secondCard] : [firstCard];

      state.pendingAction = {
        type: "peekTwo",
        cards: revealed
      };
      logHistoryAction(`Reveal Two -> ${revealed.map((card) => getCardDisplayName(card)).join(" + ")}`);
      render();
    }

    function reorderDrawPile() {
      state.pendingAction = {
        type: "drawpileReorder",
        cards: [...state.drawPile]
      };
      render();
    }

    function startNewGameWithSetup(playerNames, nemesisName) {
      const sanitizedNames = getSanitizedPlayerNames(playerNames);
      state.playerNames = sanitizedNames;
      state.playerCount = sanitizedNames.length;
      state.nemesisName = getSanitizedNemesisName(nemesisName);
      state.round = 1;
      resetPendingAction();
      closeDiscardModal();
      closeHelpModal();
      closeHistoryModal();
      closePlayerSetupModal();
      beginHistoryGame();
      reshuffleFreshPile();
      render();
    }

    drawPileButton.addEventListener("click", drawNextCard);
    drawPilePeekButton.addEventListener("click", (event) => {
      event.stopPropagation();
      peekTopCard();
    });
    drawPileRevealButton.addEventListener("click", (event) => {
      event.stopPropagation();
      revealNextCard();
    });
    drawPileRevealTwoButton.addEventListener("click", (event) => {
      event.stopPropagation();
      revealNextTwoCards();
    });
    drawPileReorderButton.addEventListener("click", (event) => {
      event.stopPropagation();
      reorderDrawPile();
    });
    playerSetupButton.addEventListener("click", (event) => {
      event.stopPropagation();

      if (state.pendingAction || state.discardViewOpen || state.helpViewOpen || state.historyViewOpen) {
        return;
      }

      openPlayerSetupModal();
    });
    playerSetupAddButton.addEventListener("click", () => {
      if (state.playerSetupDraftNames.length >= 4) {
        return;
      }

      const nextIndex = state.playerSetupDraftNames.length;
      state.playerSetupDraftNames.push(getDefaultPlayerName(nextIndex));
      render();
    });
    playerSetupApplyButton.addEventListener("click", () => {
      startNewGameWithSetup(state.playerSetupDraftNames, state.playerSetupDraftNemesisName);
    });
    playerSetupCancelButton.addEventListener("click", () => {
      closePlayerSetupModal();
      render();
    });
    playerSetupModalEl.addEventListener("click", (event) => {
      if (event.target === playerSetupModalEl) {
        closePlayerSetupModal();
        render();
      }
    });
    soundToggleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.soundMuted = !state.soundMuted;
      render();
    });
    wakeLockButton.addEventListener("click", async (event) => {
      event.stopPropagation();

      if (wakeLockRequested) {
        await releaseWakeLock();
      } else {
        await requestWakeLock();
      }

      render();
    });
    helpButton.addEventListener("click", (event) => {
      event.stopPropagation();

      if (state.pendingAction || state.discardViewOpen || state.historyViewOpen) {
        return;
      }

      state.helpViewOpen = true;
      render();
    });
    historyButton.addEventListener("click", (event) => {
      event.stopPropagation();

      if (state.pendingAction || state.discardViewOpen || state.helpViewOpen) {
        return;
      }

      state.historyViewOpen = true;
      render();
    });
    discardPileReturnButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.pendingAction = {
        type: "returnPlayer",
        options: getReturnablePlayerCards()
      };

      if (state.pendingAction.options.length === 0) {
        resetPendingAction();
      }

      render();
    });
    discardPileNemesisButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.pendingAction = {
        type: "returnNemesisAll",
        count: getReturnableNemesisCount()
      };

      if (state.pendingAction.count === 0) {
        resetPendingAction();
      }

      render();
    });
    discardPileButton.addEventListener("click", () => {
      if (state.pendingAction) {
        return;
      }

      state.discardViewOpen = true;
      render();
    });
    discardModalCloseButton.addEventListener("click", () => {
      closeDiscardModal();
      render();
    });
    discardModalEl.addEventListener("click", (event) => {
      if (event.target === discardModalEl) {
        closeDiscardModal();
        render();
      }
    });
    helpModalCloseButton.addEventListener("click", () => {
      closeHelpModal();
      render();
    });
    helpModalEl.addEventListener("click", (event) => {
      if (event.target === helpModalEl) {
        closeHelpModal();
        render();
      }
    });
    historyModalCloseButton.addEventListener("click", () => {
      closeHistoryModal();
      render();
    });
    historyClearButton.addEventListener("click", () => {
      historyStore = {
        games: [],
        activeGameId: null
      };
      saveHistoryStore();
      beginHistoryGame();
      render();
    });
    historyModalEl.addEventListener("click", (event) => {
      if (event.target === historyModalEl) {
        closeHistoryModal();
        render();
      }
    });
    bindHealthEditTrigger(cityHealthMainEl, "city");
    bindHealthEditTrigger(nemesisHealthMainEl, "nemesis");
    cityHealthMainEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        cityHealthMainEl.click();
      }
    });
    nemesisHealthMainEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        nemesisHealthMainEl.click();
      }
    });
    healthEditApplyButton.addEventListener("click", () => {
      applyHealthEdit();
    });
    healthEditCancelButton.addEventListener("click", () => {
      closeHealthEditModal();
      render();
    });
    healthEditInputEl.addEventListener("input", (event) => {
      state.healthEditDraftValue = event.target.value;
    });
    healthEditInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyHealthEdit();
      }
    });
    healthEditModalEl.addEventListener("click", (event) => {
      if (event.target === healthEditModalEl) {
        closeHealthEditModal();
        render();
      }
    });
    cityDecreaseButton.addEventListener("click", () => {
      state.cityHealth = Math.max(0, state.cityHealth - 1);
      render();
    });
    cityIncreaseButton.addEventListener("click", () => {
      state.cityHealth += 1;
      render();
    });
    nemesisDecreaseButton.addEventListener("click", () => {
      state.nemesisHealth = Math.max(0, state.nemesisHealth - 1);
      render();
    });
    nemesisIncreaseButton.addEventListener("click", () => {
      state.nemesisHealth += 1;
      render();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (state.pendingAction && canClosePendingActionWithEscape()) {
        if (state.pendingAction.type === "peekTwo") {
          cancelPeekTwoAction();
          return;
        }

        resetPendingAction();
        render();
        return;
      }

      if (state.discardViewOpen) {
        closeDiscardModal();
        render();
        return;
      }

      if (state.helpViewOpen) {
        closeHelpModal();
        render();
        return;
      }

      if (state.historyViewOpen) {
        closeHistoryModal();
        render();
        return;
      }

      if (state.playerSetupViewOpen) {
        closePlayerSetupModal();
        render();
        return;
      }

      if (state.healthEditViewOpen) {
        closeHealthEditModal();
        render();
      }
    });

    loadHistoryStore();
    const didRestoreGame = restoreGameStateSnapshot();
    if (didRestoreGame) {
      if (!getActiveHistoryGame()) {
        beginHistoryGame();
      }
      ensureHistoryRound(state.round);
      logHistoryAction("Session restored after reload");
    } else {
      beginHistoryGame();
      reshuffleFreshPile();
    }
    preloadCardImages();
    render();
