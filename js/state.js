export function getBaseCardsForPlayers(playerCount) {
  const playerCardsByCount = {
    1: [
      "Player 1",
      "Player 1",
      "Player 1"
    ],
    2: [
      "Player 1",
      "Player 1",
      "Player 2",
      "Player 2"
    ],
    3: [
      "Player 1",
      "Player 2",
      "Player 3",
      "Player Wild"
    ],
    4: [
      "Player 1",
      "Player 2",
      "Player 3",
      "Player 4"
    ]
  };

  const playerCards = playerCardsByCount[playerCount] ?? playerCardsByCount[4];
  return [...playerCards, "Nemesis 1", "Nemesis 2"];
}

export const state = {
  playerCount: 4,
  playerNames: ["Player 1", "Player 2", "Player 3", "Player 4"],
  nemesisName: "Nemesis",
  drawPile: [],
  currentCard: null,
  pendingAction: null,
  discardPile: [],
  discardViewOpen: false,
  helpViewOpen: false,
  playerSetupViewOpen: false,
  playerSetupDraftNames: [],
  playerSetupDraftNemesisName: "Nemesis",
  healthEditViewOpen: false,
  healthEditTarget: null,
  healthEditDraftValue: "0",
  round: 1,
  soundMuted: false,
  cityHealth: 30,
  nemesisHealth: 70
};
