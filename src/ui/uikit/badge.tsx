import styled from "styled-components";
import { WarningIcon } from "../icons/warning";
import { PSmall } from "./text";

export const WarningBox = ({ style, children, type = "warning" }: { style?: React.CSSProperties; children: React.ReactNode; type?: "warning" | "error" }) => {
  return (
    <WarningBadge $type={type} style={style}>
      <WarningIcon color={type === "warning" ? "#F3AE47" : "#FF453A"} style={{ flexShrink: 0 }} />
      <PSmall style={{ color: type === "warning" ? "#F3AE47" : "#FF453A", fontWeight: "bold" }}>{children}</PSmall>
    </WarningBadge>
  );
};

const WarningBadge = styled.div<{ $type: "warning" | "error" }>`
  border-radius: 8px;
  width: 100%;
  border: 1px solid ${(p) => (p.$type === "warning" ? "#f3ae47" : "#FF453A")};
  background: ${(p) => (p.$type === "warning" ? "#3f311d" : "#1c1c1c")};
  align-items: center;
  padding: 8px;
  display: flex;
  gap: 8px;
  text-align: left;
`;
