import axios from 'axios';

const ZPL_PRINTER_URL = 'http://localhost:9100/';
const PRINTER_NAME = 'ZDesigner ZD421-300dpi ZPL';

interface PrintLabelParams {
  materialName: string;
  weight: number;
  qrData: string;
}

/**
 * Generate ZPL code for printing label with material info and QR code
 */
export const generateZPL = (params: PrintLabelParams): string => {
  const { materialName, weight, qrData } = params;

  // ZPL template for label printing
  const zpl = `^XA
^MMT
^PW886
^LL591
^LS0
^FT50,50^A0N,40,40^FDMaterial name: ${materialName}^FS
^FT50,120^A0N,35,35^FDWeight: ${weight} KG^FS
^FT50,200^BQN,2,8
^FDQA,${qrData}^FS
^XZ`;

  return zpl;
};

/**
 * Print label to ZPL printer
 */
export const printLabel = async (params: PrintLabelParams): Promise<void> => {
  try {
    const zplCode = generateZPL(params);

    const response = await axios.post(
      ZPL_PRINTER_URL,
      {
        printer: PRINTER_NAME,
        data: zplCode,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5 second timeout
      },
    );

    if (response.status !== 200) {
      throw new Error(`Printer returned status: ${response.status}`);
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Could not connect to ZPL printer service. Please ensure it is running.');
    }
    throw new Error(`Failed to print label: ${error.message}`);
  }
};

/**
 * Format QR data according to specification: Saumya|step|material|weight
 */
export const formatQRData = (
  stepNumber: number,
  materialCode: string,
  materialName: string,
  weight: number,
): string => {
  return `Saumya|${stepNumber}|${materialCode}|${materialName}|${weight}`;
};
