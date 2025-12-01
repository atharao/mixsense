import React, { useState } from 'react';

interface ZplBarcodePopupProps {
  qrCodeImage: string;
  materialName: string;
  weight: number;
  qrData: string;
  onPrint: (qrData: string) => Promise<void>;
  onProceed: () => void;
}

const ZplBarcodePopup: React.FC<ZplBarcodePopupProps> = ({
  qrCodeImage,
  materialName,
  weight,
  qrData,
  onPrint,
  onProceed,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintError(null);

    try {
      await onPrint(qrData);
      setHasPrinted(true);
      console.log('✓ Label printed successfully');
    } catch (error: any) {
      console.error('❌ Print error:', error);
      setPrintError(error.message || 'Failed to print label');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block p-2 bg-blue-100 rounded-full mb-2">
              <svg
                className="w-12 h-12 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Print Label</h2>
          </div>

          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <img src={qrCodeImage} alt="QR Code" className="mx-auto mb-4" />
              <div className="grid grid-cols-2 gap-4">
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

            {printError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{printError}</p>
                <p className="text-xs text-red-500 mt-1">You can try printing again</p>
              </div>
            )}

            {hasPrinted && !printError && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600 font-medium">✓ Label printed successfully</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-1 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 font-semibold transition-colors"
            >
              {isPrinting ? (
                <span className="flex items-center justify-center">
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
                  Printing...
                </span>
              ) : hasPrinted ? (
                '🖨️ Print Again'
              ) : (
                '🖨️ Print'
              )}
            </button>

            <button
              onClick={onProceed}
              disabled={!hasPrinted || isPrinting}
              className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-semibold transition-colors"
            >
              Proceed ➔
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            {!hasPrinted
              ? 'Click Print to send label to printer, then click Proceed'
              : 'Click Proceed to continue to next step'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ZplBarcodePopup;
