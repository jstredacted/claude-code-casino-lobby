import React from "react";
import { Text } from "ink";

interface CardProps {
  value: string;
  suit: string;
  hidden?: boolean;
}

export function CardDisplay({ value, suit, hidden }: CardProps) {
  if (hidden) return <Text color="gray">[?]</Text>;

  const suitColor = suit === "♥" || suit === "♦" ? "red" : "white";
  return (
    <Text>
      <Text bold>{value}</Text>
      <Text color={suitColor}>{suit}</Text>
    </Text>
  );
}

export function HandDisplay({ cards, hidden = false }: { cards: Array<{ value: string; suit: string }>; hidden?: boolean }) {
  return (
    <Text>
      {cards.map((c, i) => (
        <Text key={i}>
          {i > 0 && <Text>  </Text>}
          <CardDisplay value={c.value} suit={c.suit} hidden={hidden && i === 0} />
        </Text>
      ))}
    </Text>
  );
}
