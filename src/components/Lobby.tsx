import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type GameChoice = "blackjack" | "baccarat";

interface LobbyProps {
  balance: number;
  startingBalance: number;
  onStartingBalanceChange: (amount: number) => void;
  onSelect: (game: GameChoice) => void;
  onQuit: () => void;
}

const GAMES: { id: GameChoice; label: string; desc: string }[] = [
  { id: "blackjack", label: "Free Double Blackjack", desc: "Free double on 9-11" },
  { id: "baccarat", label: "Baccarat", desc: "Player, Banker, or Tie" },
];

type Mode = "menu" | "settings";

export function Lobby({ balance, startingBalance, onStartingBalanceChange, onSelect, onQuit }: LobbyProps) {
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>("menu");
  const [settingsInput, setSettingsInput] = useState("");

  useInput((input, key) => {
    if (mode === "menu") {
      if (input === "q") { onQuit(); return; }
      if (key.upArrow) setSelected((p) => Math.max(0, p - 1));
      if (key.downArrow) setSelected((p) => Math.min(GAMES.length - 1, p + 1));
      if (key.return) onSelect(GAMES[selected].id);
      if (input === "s") {
        setSettingsInput(String(startingBalance));
        setMode("settings");
      }
    } else if (mode === "settings") {
      if (key.escape) { setMode("menu"); return; }
      if (key.return) {
        const val = parseInt(settingsInput);
        if (val >= 100 && val <= 1_000_000) {
          onStartingBalanceChange(val);
        }
        setMode("menu");
        return;
      }
      if (key.backspace || key.delete) {
        setSettingsInput((p) => p.slice(0, -1));
        return;
      }
      if (/^[0-9]$/.test(input) && settingsInput.length < 7) {
        setSettingsInput((p) => p + input);
      }
    }
  });

  const settingsAmount = parseInt(settingsInput) || 0;
  const settingsValid = settingsAmount >= 100 && settingsAmount <= 1_000_000;

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color="yellow">{"\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"}</Text>
      <Text color="yellow">{"\u2551"}    <Text bold color="white">{"\u2660"} C A S I N O  L O B B Y {"\u2660"}</Text>    {"\u2551"}</Text>
      <Text color="yellow">{"\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"}</Text>

      <Box marginTop={1}>
        <Text>
          Balance: <Text color="green" bold>${balance.toLocaleString()}</Text>
          <Text dimColor>  (refill: ${startingBalance.toLocaleString()})</Text>
        </Text>
      </Box>

      {mode === "menu" && (
        <>
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
            <Text dimColor>{"\u2191\u2193"} Navigate  Enter: Play  [S] Settings  q: Quit</Text>
          </Box>
        </>
      )}

      {mode === "settings" && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text bold>Starting Balance / Refill Amount</Text>
          <Box marginTop={1}>
            <Text dimColor>Amount: $</Text>
            <Text bold color={settingsValid ? "green" : settingsInput.length > 0 ? "red" : "white"}>
              {settingsInput || "_"}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>$100–$1,000,000  Current: ${startingBalance.toLocaleString()}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Type amount   Enter: Save   Esc: Cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
