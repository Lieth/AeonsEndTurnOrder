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

      resetPendingAction();
      render();
    }

    function cancelPeekTwoAction() {
      if (state.pendingAction && state.pendingAction.type === "peekTwo") {
        for (let index = state.pendingAction.cards.length - 1; index >= 0; index -= 1) {
          state.drawPile.unshift(state.pendingAction.cards[index]);
        }
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
          resetPendingAction();
          render();
        });

        cardRow.querySelector('[data-action="bottomdeck"]').addEventListener("click", () => {
          state.drawPile.push(state.pendingAction.card);
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
            resetPendingAction();
            render();
          });

          singleRow.querySelector('[data-order="single-bottom"]').addEventListener("click", () => {
            state.drawPile.push(firstCard);
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
          resetPendingAction();
          render();
        });

        actionsRow.querySelector('[data-action="cancel-reorder"]').addEventListener("click", () => {
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
      return !(state.pendingAction || state.discardViewOpen || state.helpViewOpen || state.playerSetupViewOpen || state.healthEditViewOpen);
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
      const isLocked = Boolean(state.pendingAction) || state.discardViewOpen || state.helpViewOpen || state.playerSetupViewOpen || state.healthEditViewOpen;

      drawPileButton.disabled = isLocked;
      drawPilePeekButton.disabled = isLocked;
      drawPileRevealButton.disabled = isLocked;
      drawPileRevealTwoButton.disabled = isLocked;
      drawPileReorderButton.disabled = isLocked;
      discardPileButton.disabled = isLocked;
      discardPileNemesisButton.disabled = isLocked || returnableNemesisCount === 0;
      discardPileReturnButton.disabled = isLocked || !hasReturnablePlayers;
      playerSetupButton.disabled = Boolean(state.pendingAction) || state.discardViewOpen || state.helpViewOpen || state.playerSetupViewOpen;
      helpButton.disabled = Boolean(state.pendingAction) || state.discardViewOpen || state.playerSetupViewOpen;
      wakeLockButton.disabled = isLocked;
      wakeLockButton.textContent = wakeLockRequested ? '☀️' : '🌙';
      roundCounterEl.textContent = `Round ${state.round}`;
      nemesisHealthLabelEl.textContent = state.nemesisName;
      cityHealthMainEl.setAttribute("aria-label", "Set city health");
      nemesisHealthMainEl.setAttribute("aria-label", `Set ${state.nemesisName} health`);
      playerSetupButton.textContent = `${state.playerCount} Player${state.playerCount === 1 ? "" : "s"}`;
      updateSoundToggleButton();

      renderActionModal();
      renderDiscardModal();
      renderHelpModal();
      renderPlayerSetupModal();
      renderHealthEditModal();
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
      closePlayerSetupModal();
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

      if (state.pendingAction || state.discardViewOpen || state.helpViewOpen) {
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

      if (state.pendingAction || state.discardViewOpen) {
        return;
      }

      state.helpViewOpen = true;
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

    preloadCardImages();
    reshuffleFreshPile();
    render();
