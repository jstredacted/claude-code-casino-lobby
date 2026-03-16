import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

const MIN_BET = 1;
const MAX_BET = 999999;

interface BetPickerProps {
  balance: number;
  lastBet?: number;
  chips: number[];
  onChipsChange: (chips: number[]) => void;
  onConfirm: (amount: number) => void;
  onQuit: () => void;
}

type Mode = "chips" | "manual" | "editing";

function ChipToken({ value, selected, disabled, editValue }: {
  value: number;
  selected: boolean;
  disabled: boolean;
  editValue?: string;
}) {
  const isEditing = editValue !== undefined;
  const color = isEditing && selected ? "cyan" : disabled ? "gray" : selected ? "yellow" : "white";
  const display = isEditing && selected
    ? (editValue || "_").padEnd(6)
    : ` $${value} ${value < 100 ? " " : ""}`;

  return (
    <Box flexDirection="column" alignItems="center" marginRight={2}>
      <Text color={color} bold={selected}>
        {selected ? "\u250C\u2500\u2500\u2500\u2500\u2510" : "      "}
      </Text>
      <Text color={color} bold={selected} inverse={selected}>
        {display}
      </Text>
      <Text color={color} bold={selected}>
        {selected ? "\u2514\u2500\u2500\u2500\u2500\u2518" : "      "}
      </Text>
    </Box>
  );
}

export function BetPicker({ balance, lastBet, chips, onChipsChange, onConfirm, onQuit }: BetPickerProps) {
  const [mode, setMode] = useState<Mode>("chips");
  const [selectedChip, setSelectedChip] = useState(() => {
    if (lastBet) {
      const idx = chips.indexOf(lastBet);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [manualInput, setManualInput] = useState("");
  const [draftChips, setDraftChips] = useState<string[]>([]);

  useInput((input, key) => {
    if (mode === "chips") {
      if (input === "q") { onQuit(); return; }
      if (key.leftArrow) setSelectedChip((p) => Math.max(0, p - 1));
      if (key.rightArrow) setSelectedChip((p) => Math.min(chips.length - 1, p + 1));
      if (key.return) {
        const bet = chips[selectedChip];
        if (bet <= balance) onConfirm(bet);
      }
      if (input === "m") {
        setManualInput("");
        setMode("manual");
      }
      if (input === "a") {
        if (balance >= MIN_BET) onConfirm(balance);
      }
      if (input === "e") {
        setDraftChips(chips.map(String));
        setMode("editing");
      }
    } else if (mode === "manual") {
      if (input === "q") { onQuit(); return; }
      if (key.return) {
        const amount = parseInt(manualInput);
        if (amount >= MIN_BET && amount <= MAX_BET && amount <= balance) {
          onConfirm(amount);
        }
        return;
      }
      if (key.escape) {
        setMode("chips");
        return;
      }
      if (key.backspace || key.delete) {
        setManualInput((p) => p.slice(0, -1));
        return;
      }
      if (/^[0-9]$/.test(input) && manualInput.length < 7) {
        setManualInput((p) => p + input);
      }
    } else if (mode === "editing") {
      if (key.escape) {
        setMode("chips");
        return;
      }
      if (key.return) {
        // Parse all drafts, fall back to original for invalid values
        const parsed = draftChips.map((d, i) => {
          const v = parseInt(d);
          return Number.isInteger(v) && v >= 1 ? v : chips[i];
        });
        parsed.sort((a, b) => a - b);
        onChipsChange(parsed);
        setMode("chips");
        return;
      }
      if (key.leftArrow) {
        setSelectedChip((p) => Math.max(0, p - 1));
        return;
      }
      if (key.rightArrow) {
        setSelectedChip((p) => Math.min(chips.length - 1, p + 1));
        return;
      }
      if (key.backspace || key.delete) {
        setDraftChips((prev) => {
          const next = [...prev];
          next[selectedChip] = next[selectedChip].slice(0, -1);
          return next;
        });
        return;
      }
      if (/^[0-9]$/.test(input) && draftChips[selectedChip].length < 6) {
        setDraftChips((prev) => {
          const next = [...prev];
          next[selectedChip] = next[selectedChip] + input;
          return next;
        });
      }
    }
  });

  const manualAmount = parseInt(manualInput) || 0;
  const manualValid = manualAmount >= MIN_BET && manualAmount <= MAX_BET && manualAmount <= balance;

  return (
    <Box flexDirection="column" alignItems="center">
      <Text bold>{mode === "editing" ? "Edit Chips" : "Place Your Bet"}</Text>
      {mode === "chips" && (
        <>
          <Box marginTop={1}>
            {chips.map((chip, i) => (
              <ChipToken key={i} value={chip} selected={i === selectedChip} disabled={chip > balance} />
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{"\u2190\u2192"} Select   Enter: Confirm   [M] Manual   [A] All In (${balance.toLocaleString()})   [E] Edit chips   q: Back</Text>
          </Box>
        </>
      )}
      {mode === "editing" && (
        <>
          <Box marginTop={1}>
            {chips.map((chip, i) => (
              <ChipToken
                key={i}
                value={chip}
                selected={i === selectedChip}
                disabled={false}
                editValue={draftChips[i]}
              />
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Type value   {"\u2190\u2192"} Switch chip   Enter: Save   Esc: Cancel</Text>
          </Box>
        </>
      )}
      {mode === "manual" && (
        <>
          <Box marginTop={1} flexDirection="column" alignItems="center">
            <Box>
              <Text dimColor>Amount: $</Text>
              <Text bold color={manualValid ? "green" : manualInput.length > 0 ? "red" : "white"}>
                {manualInput || "_"}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                ${MIN_BET}–${balance.toLocaleString()} (balance: ${balance.toLocaleString()})
              </Text>
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Type amount   Enter: Confirm   Esc: Back to chips   q: Quit</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
