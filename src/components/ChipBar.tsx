import React from "react";
import { Box, Text } from "ink";

interface ChipBarProps {
  balance: number;
  bet?: number;
}

export function ChipBar({ balance, bet }: ChipBarProps) {
  return (
    <Box justifyContent="space-between" width="100%">
      <Text>
        <Text color="green" bold>$</Text>
        <Text bold>{balance.toLocaleString()}</Text>
      </Text>
      {bet !== undefined && (
        <Text>
          <Text dimColor>Bet: </Text>
          <Text color="yellow" bold>${bet}</Text>
        </Text>
      )}
    </Box>
  );
}
