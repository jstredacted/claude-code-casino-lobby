import React, { useState, useCallback } from "react";
import { Box } from "ink";
import { Lobby, type GameChoice } from "./components/Lobby.js";
import { Blackjack } from "./components/Blackjack.js";
import { Baccarat } from "./components/Baccarat.js";
import { loadBankroll, saveBankroll, type Bankroll } from "./bankroll.js";

type Screen = "lobby" | "blackjack" | "baccarat";

export function App() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [bankroll, setBankroll] = useState<Bankroll>(() => loadBankroll());

  const updateBalance = useCallback((delta: number) => {
    setBankroll((prev) => {
      const updated = {
        balance: Math.round((prev.balance + delta) * 100) / 100,
        hands_played: prev.hands_played + 1,
      };
      saveBankroll(updated);
      return updated;
    });
  }, []);

  const handleQuit = useCallback(() => {
    if (screen === "lobby") {
      process.exit(0);
    }
    setScreen("lobby");
  }, [screen]);

  return (
    <Box flexDirection="column" padding={1}>
      {screen === "lobby" && (
        <Lobby
          balance={bankroll.balance}
          onSelect={(game: GameChoice) => setScreen(game)}
          onQuit={() => process.exit(0)}
        />
      )}
      {screen === "blackjack" && (
        <Blackjack
          balance={bankroll.balance}
          onUpdateBalance={updateBalance}
          onQuit={handleQuit}
        />
      )}
      {screen === "baccarat" && (
        <Baccarat
          balance={bankroll.balance}
          onUpdateBalance={updateBalance}
          onQuit={handleQuit}
        />
      )}
    </Box>
  );
}
