import styled from "styled-components";

export const ActionButton = styled.button`
  display: flex;
  padding: 0 24px;
  border-radius: 12px;
  background: #e7e7e7;
  border: none;
  outline: none;
  cursor: pointer;
  transition: background 0.2s ease-in-out;
  height: 48px;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 8px;
  flex: 1;
  width: 100%;

  color: #121212;
  text-align: center;
  font-family: "Golos Text";
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 22px;
  letter-spacing: -0.16px;

  &:hover {
    background: #d2d2d2;
  }

  &:disabled {
    background: #3e3e3e;
    color: #828282;
    cursor: not-allowed;
  }
`;

export const Button = styled.button`
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  outline: none;
  transition: 0.2s opacity;

  &:hover {
    opacity: 0.8;
  }
`;
