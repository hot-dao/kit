import React from "react";

interface Step {
  label: string;
  completed?: boolean;
  active?: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  style?: React.CSSProperties;
}

export const HorizontalStepper: React.FC<StepperProps> = ({ steps, currentStep, style }) => {
  return (
    <div style={{ padding: "0 32px 32px", display: "flex", alignItems: "center", width: "100%", margin: "16px 0", ...style }}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <React.Fragment key={idx}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  position: "relative",
                  borderRadius: "50%",
                  border: isActive || isCompleted ? "2px solid #ffffff" : "2px solid #a0a0a0",
                  background: isCompleted ? "#ffffff" : "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                  zIndex: 1,
                }}
              >
                <p style={{ fontSize: 16, color: "#fff", opacity: isActive ? 1 : 0.5, position: "absolute", top: 24, width: 100 }}>{step.label}</p>
              </div>
            </div>

            {idx < steps.length - 1 && <div style={{ transition: "background 0.2s", flex: 1, height: 2, background: idx < currentStep ? "#ffffff" : "#333", margin: "0 6px", borderRadius: 24, minWidth: 24 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};
