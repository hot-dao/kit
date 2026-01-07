import styled, { keyframes } from "styled-components";

export const Loader = styled.div`
  border: 4px solid #2a2a2a;
  border-top: 4px solid #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 0.9s linear infinite;
  margin: 0 auto;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const shine = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

export const Skeleton = styled.div`
  display: inline-block;
  width: 100px;
  height: 40px;
  border-radius: 8px;
  background: #2e2e2e;
  position: relative;
  overflow: hidden;

  &:after {
    content: "";
    display: block;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    background: linear-gradient(90deg, rgba(34, 34, 34, 0) 0%, rgba(255, 255, 255, 0.06) 40%, rgba(255, 255, 255, 0.12) 50%, rgba(255, 255, 255, 0.06) 60%, rgba(34, 34, 34, 0) 100%);
    background-size: 200px 100%;
    animation: ${shine} 1.4s infinite linear;
  }
`;
