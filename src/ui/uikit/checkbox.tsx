import styled from "styled-components";

export const Checkbox = ({ value, onChange, children }: { value: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) => {
  return (
    <CheckboxWrap checked={value}>
      <div>
        {value && <CheckboxIcon />}
        <input type="checkbox" checked={value} onChange={() => onChange(!value)} />
      </div>
      {children}
    </CheckboxWrap>
  );
};

export const CheckboxWrap = styled.label<{ checked: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;

  div {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: ${({ checked }) => (checked ? "transparent" : "1px solid rgba(255, 255, 255, 0.17)")};
    background: ${({ checked }) => (checked ? "#fff" : "transparent")};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  input {
    opacity: 0;
    width: 16px;
    height: 16px;
    cursor: pointer;
    position: absolute;
    top: 0;
    left: 0;
  }
`;

const CheckboxIcon = () => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="16" height="16" rx="4" fill="#FDBF1E" />
      <path
        d="M11.4917 5.40918C11.642 5.26695 11.8796 5.27368 12.022 5.42383C12.1643 5.57419 12.1576 5.81172 12.0073 5.9541L7.25732 10.4541L7.00439 10.6934L6.74756 10.459L3.99756 7.95898C3.84459 7.81976 3.83325 7.58289 3.97217 7.42969C4.1114 7.27653 4.34821 7.26524 4.50146 7.4043L6.99365 9.66992L11.4917 5.40918Z"
        fill="black"
        stroke="black"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
