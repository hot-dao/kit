import styled from "styled-components";

export const ActionButton = styled.button`
  display: flex;
  padding: 16px 24px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  border-radius: 24px;
  background: var(--controls-primary-dark, #ebdedc);
  color: #000;
  font-feature-settings: "liga" off;
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
  line-height: normal;
  cursor: pointer;
  outline: none;
  border: none;
`;
