import React from 'react';

interface StepProgressIndicatorProps {
  totalSteps: number;
  currentStepIndex: number;
  completedSteps: number[];
}

const StepProgressIndicator: React.FC<StepProgressIndicatorProps> = ({
  totalSteps,
  currentStepIndex,
  completedSteps,
}) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center py-8">
      {steps.map((stepNumber, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = index === currentStepIndex;
        const isActive = isCompleted || isCurrent;

        return (
          <React.Fragment key={stepNumber}>
            {/* Step Box */}
            <div
              className={`
                flex items-center justify-center
                w-20 h-20
                rounded-lg
                text-white text-3xl font-bold
                transition-all duration-300
                ${isActive ? 'bg-green-500' : 'bg-gray-400'}
                ${isCurrent ? 'ring-4 ring-green-300 scale-110' : ''}
              `}
            >
              {stepNumber}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`
                  h-2 w-16
                  transition-all duration-300
                  ${isActive ? 'bg-green-500' : 'bg-gray-300'}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepProgressIndicator;
