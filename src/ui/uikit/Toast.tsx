import styled from "styled-components";
import { Loader } from "./loader";

const Toast = ({ message }: { message: string }) => {
  return (
    <ToastRoot>
      <div style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "rgba(255, 255, 255, 0.07)" }}>
        <Loader />
      </div>

      <div>
        <p style={{ color: "#ADA5A4" }}>Executing transaction</p>
        <p style={{ marginTop: 2 }}>{message}</p>
      </div>
    </ToastRoot>
  );
};

export default Toast;

const ToastRoot = styled.div`
  position: fixed;
  bottom: 48px;
  left: 12px;
  right: 12px;
  background: var(--surface-common-container--low, #262729);
  border: 1px solid var(--border-lowest, rgba(255, 255, 255, 0.07));
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 1000000000;
  width: fit-content;
  padding-right: 24px;
  gap: 12px;

  p {
    color: var(--text-primary, #fff);
    font-size: 16px;
    font-weight: 500;
    margin: 0;
  }
`;
