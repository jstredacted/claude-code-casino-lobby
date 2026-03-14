import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type GameChoice = "blackjack" | "baccarat";

interface LobbyProps {
  balance: number;
  onSelect: (game: GameChoice) => void;
  onQuit: () => void;
}

const GAMES: { id: GameChoice; label: string; desc: string }[] = [
  { id: "blackjack", label: "Free Double Blackjack", desc: "Free double on 9-11" },
  { id: "baccarat", label: "Baccarat", desc: "Player, Banker, or Tie" },
];

export function Lobby({ balance, onSelect, onQuit }: LobbyProps) {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (input === "q") {
      onQuit();
      return;
    }
    if (key.upArrow) setSelected((p) => Math.max(0, p - 1));
    if (key.downArrow) setSelected((p) => Math.min(GAMES.length - 1, p + 1));
    if (key.return) onSelect(GAMES[selected].id);
  });

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color="yellow">{"\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"}</Text>
      <Text color="yellow">{"\u2551"}    <Text bold color="white">{"\u2660"} C A S I N O  L O B B Y {"\u2660"}</Text>    {"\u2551"}</Text>
      <Text color="yellow">{"\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"}</Text>

      <Box marginTop={1}>
        <Text>
          Balance: <Text color="green" bold>${balance.toLocaleString()}</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {GAMES.map((game, i) => (
          <Box key={game.id}>
            <Text color={i === selected ? "yellow" : "white"} bold={i === selected}>
              {i === selected ? " \u25B6 " : "   "}
              {game.label}
            </Text>
            <Text dimColor>  {game.desc}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{"\u2191\u2193"} Navigate  Enter: Play  q: Quit</Text>
      </Box>
    </Box>
  );
}
