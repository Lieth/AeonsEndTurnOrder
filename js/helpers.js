export function shuffle(cards) {
  const nextCards = [...cards];

  for (let index = nextCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextCards[index], nextCards[swapIndex]] = [nextCards[swapIndex], nextCards[index]];
  }

  return nextCards;
}

export function getCardImagePath(card) {
  if (card === "Player Wild") {
    return "resources/Player%20X.png";
  }

  return `resources/${encodeURIComponent(card)}.png`;
}

export function isPlayerCard(card) {
  return typeof card === "string" && card.startsWith("Player");
}

export function isNemesisCard(card) {
  return card === "Nemesis 1" || card === "Nemesis 2";
}

export function getDefaultPlayerName(index) {
  return `Player ${index + 1}`;
}

export function getPlayerPreviewPath(index) {
  const clamped = Math.min(4, Math.max(1, index + 1));
  return `resources/Player%20${clamped}.png`;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getSanitizedPlayerNames(names) {
  const limited = names.slice(0, 4);

  return limited.map((name, index) => {
    const trimmed = String(name ?? "").trim();
    return trimmed.length > 0 ? trimmed : getDefaultPlayerName(index);
  });
}

export function getSanitizedNemesisName(name) {
  const trimmed = String(name ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Nemesis";
}
