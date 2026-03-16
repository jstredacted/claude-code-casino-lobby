import React from "react";
import { Box, Text } from "ink";
import type { Card } from "../engine/deck.js";

function suitColor(suit: string): string {
  return suit === "\u2665" || suit === "\u2666" ? "red" : "white";
}

export function AsciiCard({ card, faceDown }: { card?: Card; faceDown?: boolean }) {
  if (faceDown || !card) {
    return (
      <Box flexDirection="column">
        <Text>{"\u250C\u2500\u2500\u2500\u2500\u2500\u2510"}</Text>
        <Text>{"\u2502"}<Text color="blue">{"\u2591\u2591\u2591\u2591\u2591"}</Text>{"\u2502"}</Text>
        <Text>{"\u2502"}<Text color="blue">{"\u2591\u2591\u2591\u2591\u2591"}</Text>{"\u2502"}</Text>
        <Text>{"\u2502"}<Text color="blue">{"\u2591\u2591\u2591\u2591\u2591"}</Text>{"\u2502"}</Text>
        <Text>{"\u2514\u2500\u2500\u2500\u2500\u2500\u2518"}</Text>
      </Box>
    );
  }

  const v = card.value;
  const s = card.suit;
  const c = suitColor(s);

  const top = v === "10" ? "10   " : `${v}    `;
  const mid = `  ${s}  `;
  const bot = v === "10" ? "   10" : `    ${v}`;

  return (
    <Box flexDirection="column">
      <Text>{"\u250C\u2500\u2500\u2500\u2500\u2500\u2510"}</Text>
      <Text>{"\u2502"}<Text color={c}>{top}</Text>{"\u2502"}</Text>
      <Text>{"\u2502"}<Text color={c}>{mid}</Text>{"\u2502"}</Text>
      <Text>{"\u2502"}<Text color={c}>{bot}</Text>{"\u2502"}</Text>
      <Text>{"\u2514\u2500\u2500\u2500\u2500\u2500\u2518"}</Text>
    </Box>
  );
}

export function HandDisplay({
  cards,
  visibleSet,
}: {
  cards: Card[];
  visibleSet?: Set<number>;
}) {
  const visible = visibleSet ?? new Set(cards.map((_, i) => i));

  return (
    <Box flexDirection="row">
      {cards.map((card, i) => (
        <Box key={i} marginRight={1}>
          <AsciiCard card={card} faceDown={!visible.has(i)} />
        </Box>
      ))}
    </Box>
  );
}
