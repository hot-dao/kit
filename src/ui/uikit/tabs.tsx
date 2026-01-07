import styled from "styled-components";

interface SegmentedControlProps {
  options: { label: string; value: string; color?: string; background?: string }[];
  value: string;
  onChange: (value: string) => void;
}

const SegmentedControl = ({ options, value, onChange }: SegmentedControlProps) => {
  return (
    <Tabs>
      {options.map((option) => (
        <Tab
          key={option.value}
          onClick={() => onChange(option.value)}
          $active={option.value === value}
          style={{
            background: option.value === value ? option.background || "#1D1F20" : "transparent",
            color: option.value === value ? option.color : "#6b6661",
          }}
        >
          {option.label}
        </Tab>
      ))}
    </Tabs>
  );
};

const Tabs = styled.div`
  display: flex;
  border-radius: 16px;
  border: 1px solid var(--border-lowest-solid, #242627);
  padding: 0;
  flex-shrink: 0;
  height: 40px;
  padding: 2px;
  width: 100%;
`;

const Tab = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 14px;
  height: 100%;
  border: none;
  outline: none;
  cursor: pointer;
  transition: 0.2s background-color;
  flex: 1;
  font-size: 14px;
  font-weight: 500;
`;

export default SegmentedControl;
