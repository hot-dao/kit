import styled, { css } from "styled-components";

const font = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;

export const ModalContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100000000;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  transition: opacity 0.2s ease-in-out;
  pointer-events: all;

  @media (max-width: 600px) {
    justify-content: flex-end;
  }
`;

export const ModalOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100000000;
  background-color: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  z-index: 1;
`;

export const ModalContent = styled.div<{ $mobileFullscreen?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 420px;
  max-height: 660px;
  width: 100%;
  border-radius: 24px;
  background: #0d0d0d;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease-in-out;
  z-index: 2;

  @media (max-width: 600px) {
    max-width: 100%;
    width: 100%;
    max-height: 90%;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border: none;
    border-top: 1.5px solid rgba(255, 255, 255, 0.1);

    ${(props: { $mobileFullscreen?: boolean }) =>
      props.$mobileFullscreen &&
      css`
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        height: 100%;
        border-radius: 0;
        max-height: 100%;
        border: none;
      `}
  }
`;

export const ModalHeader = styled.div`
  display: flex;
  padding: 16px;
  gap: 16px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  position: relative;

  button {
    position: absolute;
    right: 16px;
    top: 16px;
    width: 32px;
    height: 32px;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s ease-in-out;
    border: none;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
    }
  }

  p {
    color: #fff;
    text-align: center;
    font-size: 24px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    margin: 0;
  }
`;

export const ModalBody = styled.div`
  display: flex;
  padding: 16px;
  flex-direction: column;
  align-items: flex-start;
  text-align: center;
  gap: 4px;
  overflow: auto;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
  width: 100%;
  flex: 1;

  textarea {
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    background: #0d0d0d;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.1);
    outline: none;
    font-size: 12px;
    transition: background 0.2s ease-in-out;
    font-family: monospace;
  }

  p {
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    font-size: 16px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
    letter-spacing: -0.8px;
  }
`;

export const Footer = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 24px;
  color: #fff;
  gap: 12px;

  img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  * {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export const GetWalletLink = styled.a`
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  margin-left: auto;
  text-decoration: none;
  transition: color 0.2s ease-in-out;

  &:hover {
    color: rgba(255, 255, 255, 1);
  }
`;

export const PopupOption = styled.button`
  display: flex;
  padding: 8px;
  align-items: center;
  align-self: stretch;
  cursor: pointer;
  transition: background 0.2s ease-in-out;
  border-radius: 24px;
  outline: none;
  border: none;
  background: transparent;
  gap: 12px;

  img {
    width: 44px;
    height: 44px;
    border-radius: 16px;
    object-fit: cover;
    flex-shrink: 0;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  p {
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    font-size: 18px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    letter-spacing: -0.36px;
    margin: 0;
  }
`;

export const PopupOptionInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  flex: 1;
  margin-top: -2px;

  .wallet-address {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
  }
`;

export const PopupButton = styled.button`
  width: 100%;
  padding: 12px;
  border-radius: 24px;
  background: rgb(221, 221, 221);
  color: rgb(20, 20, 20) !important;
  font-weight: bold;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease-in-out;
  margin-top: 16px;
  height: 56px;

  &:hover {
    background: rgb(160, 160, 160);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const PopupRoot = styled.div`
  height: 100%;
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p {
    font-family: ${font};
    margin: 0;
  }

  /* Hide scrollbar for all scrollable elements inside PopupRoot */
  &::-webkit-scrollbar {
    display: none;
  }
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* Internet Explorer 10+ */

  /* Also hide scrollbars for all inner elements */
  * {
    font-family: ${font};
    scrollbar-width: none;
    -ms-overflow-style: none;
    box-sizing: border-box;
  }

  *::-webkit-scrollbar {
    display: none;
  }
`;
