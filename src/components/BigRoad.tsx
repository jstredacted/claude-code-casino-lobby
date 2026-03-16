import React from "react";
import { Box, Text } from "ink";
import { computeBigRoad, type BaccaratHistoryEntry } from "../engine/history.js";

interface BigRoadProps {
  entries: BaccaratHistoryEntry[];
}

export function BigRoad({ entries }: BigRoadProps) {
  if (entries.length === 0) return null;

  const grid = computeBigRoad(entries);
  if (grid.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{"── Big Road " + "─".repeat(32)}</Text>
      {grid.map((row, ri) => (
        <Box key={ri}>
          {row.map((cell, ci) => (
            <Box key={ci} width={3}>
              {cell.type === "player" && (
                <>
                  <Text color="blue">●</Text>
                  {cell.ties > 0 ? <Text color="green">{cell.ties > 1 ? cell.ties : "/"}</Text> : <Text> </Text>}
                </>
              )}
              {cell.type === "banker" && (
                <>
                  <Text color="red">●</Text>
                  {cell.ties > 0 ? <Text color="green">{cell.ties > 1 ? cell.ties : "/"}</Text> : <Text> </Text>}
                </>
              )}
              {cell.type === "empty" && <Text>   </Text>}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
