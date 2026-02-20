import styled from "styled-components";
import { PSmall, PTiny } from "./text";
import { Button } from "./button";

interface SegmentedControlProps {
  options: { label: string; value: string; color?: string; background?: string; badge?: string }[];
  onChange: (value: string) => void;
  value: string;
}

const SegmentedControl = ({ options, value, onChange }: SegmentedControlProps) => {
  return (
    <Tabs>
      <div
        style={{
          position: "absolute",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          left: `${(100 / options.length) * options.findIndex((option) => option.value === value)}%`,
          background: options.find((option) => option.value === value)?.background || "#1f1f1f",
          width: `calc(${100 / options.length}% - 4px)`,
          height: "calc(100% - 4px)",
          borderRadius: 10,
          margin: "2px",
          zIndex: 0,
          top: 0,
        }}
      />

      {options.map((option) => (
        <Tab key={option.value} onClick={() => onChange(option.value)} $active={option.value === value}>
          <PSmall style={{ transition: "color 0.2s", color: option.value === value ? option.color : "var(--text-text-secondary, #BFBFBF)" }}>{option.label}</PSmall>
          {option.badge && <PTiny style={{ minWidth: 16, textAlign: "center", fontSize: 9, color: "#b2b2b2", fontWeight: "bold", background: "#262729", padding: "0 4px", borderRadius: "8px" }}>{option.badge}</PTiny>}
        </Tab>
      ))}
    </Tabs>
  );
};

const Tabs = styled.div`
  display: flex;
  flex-shrink: 0;
  height: 40px;
  width: 100%;
  padding: 0;

  border-radius: var(--border-radius-12, 12px);
  border: 1px solid var(--border-border-default, #323232);
  position: relative;
`;

const Tab = styled(Button)<{ $active?: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 4px;

  outline: none;
  cursor: pointer;
  transition: 0.2s background-color, 0.2s opacity;
  z-index: 1;
  flex: 1;
  white-space: nowrap;

  p {
    color: ${(p) => (p.$active ? "var(--text-text-primary, #fff)" : "var(--text-text-secondary, #BFBFBF)")};
  }
`;

export default SegmentedControl;
