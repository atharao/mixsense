import axios from 'axios';

const ZPL_PRINTER_URL = '/zpl';
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

  // ZPL template for label printing with logo and improved layout
  const zpl = `^XA
~TA000
~JSN
^LT0
^MNW
^MTT
^PON
^PMN
^LH0,0
^JMA
^PR2,2
~SD27
^JUS
^LRN
^CI27
^PA0,1,1,0
^XZ
^XA
^MMT
^PW886
^LL591
^LS0
^FT275,463^BXN,14,200,0,0,1,_,1
^FH\\^FD${qrData}^FS
^FPH,8^FT155,73^AUN,59,18^FH\\^FDMaterial name: ${materialName}^FS
^FPH,8^FT0,559^AUN,59,18^FB886,1,12,C^FH\\^FDWeight : ${weight} KG\\5C&^FS
^FO19,26^GB846,549,4^FS
^FO35,460^GFA,821,1442,14,:Z64:eJx9ksGKo0AQhsseheBCSEDvMqfgwpyXyaUDO3cD9vuIc2ly2GcQT9IB5zqYlwk5iYfOCyzOVlercZjZlMSm8/H3/1fZAMDg/3WP3as7ukXlHxabSn4r8yFibPH4HZMZyELmuNhy6c3pXT7G+JRl8VW2QaVZq5kInJSWGFhkXC1bD2xFiyrYTCeSuU4p6s/qnPVqxphSGSb0R90L57cssSrRz88j67f+lEWVMsvyXNEuFBz4bz6xfKEwkGXrPcA+TCzz0a9SsrLMEwL4zuUTY1G5iCxz1qFpzjZimDmzssMJBQqEGM6MTX/l6Lfeo2S3ujHISvSrJ93O/aQ7jH5hgGeOOXEuDP1a1tm5GF0wZMF5xlDKaNjt04D8ViOTk58jkL0EiTf6xTDNJQyDwJw5ZYkXF9kyPeQMTE5vnItv/Ib+hHBvWZAdKlVXUko7Ty8VptKBqVKZMiwUntjNWN5duratKKhAstvxBG3tt1V4Od9/PdswqJqYX1e1ys/tZmNZYnUrq6ti9Dsei8KykPy4yaq6bnnpuk6fO/JLvRejo+4xIFPo9/xwygwTDvl5eKmgrutCG7+lbs2ZghuW0JfEoVX4U8X21BBLHBLjrcKcWmdad3nff2TgIsTpcI8Ydt8UrITt6WQM8c+EMhFbaq0l+Pqq/9iJIjRDc0l3xEJVY5sfir7Sk6bq+/4r85vmRNXYWzEW3bSOdNcr6YDPdVD8JLvjO8DtVIfb3ROaffSv5xlLneFSbic3GFobTjS69k2/9ePOS0Kc9LhjxY/mYdLhqenoZmr5l2W3nZfCvCK7/APNFC/7:AA8E
^FO744,464^GFA,1085,1339,13,:Z64:eJw9VE3KrDoQrYQEJKM06FwcSVYRwZ6nQfcjjkJWETIKtarLG330Kt4p7/eedLT1JPVz6lS5nge6iKjTtdrkvY1E/lBp1z2sgUhzu3klPyWPXYeiI1LlvlYirnXtKtrD48wZ43jo6qqbiVpd+mqPFxkiRWlLaeCl3/BTe+WMz+oNazEmu+tVa66CzC4bT0pFUiklS47zUCoiyK0MdJK4gfsNkXAGgAiocVXbaxRkVOokfXX+B34KF76M+qTPcwiLFp6rHJrl5WP+mpP4iMswSD6FXaZkrHx+29PS0F0Qcm6YAwfm8WPNRN71nB8/uH4MRXo/kHrvmuoQYO3SXIpYgh+kdNJIHEqQfK6OyPeX3+H9xDp0W1oVZAAX9KIPuFbeT0D44gF+8vD9+ZoRLp6oUzp0makAcbWFoHyK2wNE44feuyTaO7tB9saH63EjPfQgVXA6lAuFsfYJ2k6kcy9ShdIcd9QH5SS1RyQ2kG4VnNXlIQunxJryFN2t3YqX4vJ14ynhkYl+22mZB0GorgsQZfyjg/ElcirrHwBf5mz2t1AHdixF3ZvT4AC/vJq4G9HBR/gD18VJfTqF2X6MEQ4+G26O79shn0U35+zk1VM63EdXShN2ylIutsY/qtr9rg5XlvkSrvuqszUvj4TUPnpFLq9Z/OQQ6mARNfwoQ1CQXusNRDu6UCZsnSRTKCdSL3fJqDY4+IF2JAIbrYHROi+uUGjauQ4RTCB7UmSmRJmDQ1gtA0FDGdqi8D0lfRea58Z60a4q+PZqg030A4QWQmk/5Xtdf9Q7HdOh4vttcaz1UPpSWyt9pgQO0kabkgj7QKWXXCkgQpQNkkZDblirrpp1aHdjEGyEtOlUFn0yZDROg94LENohgY8oXrbkZb7n6q7QpaTqZSE2Ov2jgFIy84BBgc5WKKdNMigwCZjCpSvLvKD0EKcwRCQ4eCjX9ZX6gQN7gO0kbijwwoEv3eQF04WmT1SP7F1fiRuLUOUakard/rYxBTRCEXFLMjB2WvUXcF+WdH6R8zDjNNLvmRqkOPQ7CE76PSKjhcHef9d5nP//p9DD8/wX5FgQng==:0D65
^PQ1,0,1,Y
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
 * Format QR data with essential information (optimized for shorter QR codes)
 * Format: recipeId|stepId|materialCode|actualWeight|userId|timestamp
 */
export const formatQRData = (data: {
  recipeId: number;
  stepId: number;
  materialCode: string;
  actualWeight: number;
  userId: number;
}): string => {
  const timestamp = new Date().toISOString();
  return `${data.recipeId}|${data.stepId}|${data.materialCode}|${data.actualWeight}|${data.userId}|${timestamp}`;
};

/**
 * Parse QR data back into structured format
 * Format: recipeId|stepId|materialCode|actualWeight|userId|timestamp
 */
export const parseQRData = (qrData: string) => {
  const parts = qrData.split('|');

  if (parts.length < 6) {
    throw new Error('Invalid QR code format');
  }

  return {
    recipeId: parseInt(parts[0]),
    stepId: parseInt(parts[1]),
    materialCode: parts[2],
    actualWeight: parseFloat(parts[3]),
    userId: parseInt(parts[4]),
    timestamp: parts[5],
  };
};
