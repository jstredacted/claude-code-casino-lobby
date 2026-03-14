import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type GameChoice = "blackjack" | "baccarat";

interface LobbyProps {
  balance: number;
  onSelect: (game: GameChoice) => void;
  onQuit: () => void;
}

const GAMES: { id: GameChoice; label: string }[] = [
  { id: "blackjack", label: "Free Double Blackjack" },
  { id: "baccarat", label: "Baccarat" },
];

export function Lobby({ balance, onSelect, onQuit }: LobbyProps) {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (input === "q") {
      onQuit();
      return;
    }
    if (key.upArrow) {
      setSelected((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelected((prev) => Math.min(GAMES.length - 1, prev + 1));
    }
    if (key.return) {
      onSelect(GAMES[selected].id);
    }
  });

  return (
    <Box flexDirection="column" alignItems="center">
      <Text bold>
        {"  =========================================="}
      </Text>
      <Text bold>
        {"        C A S I N O   L O B B Y             "}
      </Text>
      <Text bold>
        {"  =========================================="}
      </Text>

      <Box marginTop={1}>
        <Text>Balance: <Text color="green" bold>${balance.toLocaleString()}</Text></Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {GAMES.map((game, i) => (
          <Text key={game.id}>
            <Text color={i === selected ? "yellow" : "white"}>
              {i === selected ? " > " : "   "}
              {game.label}
            </Text>
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Up/Down: Navigate  Enter: Select  q: Quit</Text>
      </Box>
    </Box>
  );
}
