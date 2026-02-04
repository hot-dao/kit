import styled, { css } from "styled-components";

export const ActionButton = styled.button<{ $stroke?: boolean }>`
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
  max-height: 48px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 8px;
  flex: 1;
  width: 100%;

  color: #121212 !important;
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
    color: #828282 !important;
    cursor: not-allowed;
  }

  ${(p) =>
    p.$stroke &&
    css`
      background: transparent;
      border: 1px solid #d2d2d2;
      color: #fff !important;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid #fff;
      }

      &:disabled {
        background: transparent;
        border: 1px solid #3e3e3e;
        color: #828282;
      }
    `}
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
