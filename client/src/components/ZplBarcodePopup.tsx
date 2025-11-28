import React, { useEffect } from 'react';

interface ZplBarcodePopupProps {
  qrCodeImage: string;
  materialName: string;
  weight: number;
  onClose: () => void;
  autoCloseDuration?: number; // milliseconds
}

const ZplBarcodePopup: React.FC<ZplBarcodePopupProps> = ({
  qrCodeImage,
  materialName,
  weight,
  onClose,
  autoCloseDuration = 3000,
}) => {
  useEffect(() => {
    // Auto-close after specified duration
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseDuration);

    return () => clearTimeout(timer);
  }, [onClose, autoCloseDuration]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 animate-fade-in">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block p-2 bg-green-100 rounded-full mb-2">
              <svg
                className="w-12 h-12 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Label Printing</h2>
          </div>

          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <img src={qrCodeImage} alt="QR Code" className="mx-auto mb-4" />
              <div className="text-left space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Material</p>
                  <p className="font-semibold text-gray-800">{materialName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Weight</p>
                  <p className="font-semibold text-gray-800">{weight.toFixed(2)} KG</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center text-blue-600">
              <svg
                className="animate-spin h-5 w-5 mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm font-medium">Sending to printer...</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">This popup will close automatically</p>
        </div>
      </div>
    </div>
  );
};

export default ZplBarcodePopup;
