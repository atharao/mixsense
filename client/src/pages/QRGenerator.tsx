import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { qrApi } from '../api/qr.api';
import { recipesApi } from '../api/recipes.api';
import { materialsApi } from '../api/materials.api';
import { Material, Recipe } from '../types/models';

const QRGenerator: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Single QR form
  const [singleForm, setSingleForm] = useState({
    materialCode: '',
    materialName: '',
    setpoint: '',
    actualValue: '',
    equipment: '',
  });
  const [generatedQR, setGeneratedQR] = useState<{ data: string; image: string } | null>(null);

  // Bulk QR form
  const [selectedRecipeId, setSelectedRecipeId] = useState<number>(0);
  const [bulkQRCodes, setBulkQRCodes] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [materialsRes, recipesRes] = await Promise.all([
        materialsApi.getAll(),
        recipesApi.getAll(),
      ]);
      setMaterials(materialsRes.data.data || []);
      setRecipes(recipesRes.data.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleGenerateSingle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!singleForm.materialCode || !singleForm.materialName || !singleForm.setpoint || !singleForm.actualValue || !singleForm.equipment) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await qrApi.generate({
        materialCode: singleForm.materialCode,
        materialName: singleForm.materialName,
        setpoint: parseFloat(singleForm.setpoint),
        actualValue: parseFloat(singleForm.actualValue),
        equipment: singleForm.equipment,
      });

      setGeneratedQR({
        data: response.data.data.qrCodeData,
        image: response.data.data.qrCodeImage,
      });
    } catch (error: any) {
      alert(error.message || 'Failed to generate QR code');
    }
  };

  const handleGenerateBulk = async () => {
    if (!selectedRecipeId) {
      alert('Please select a recipe');
      return;
    }

    try {
      const response = await qrApi.getRecipeQRCodes(selectedRecipeId);
      setBulkQRCodes(response.data.data);
    } catch (error: any) {
      alert(error.message || 'Failed to generate QR codes');
    }
  };

  const handleDownloadQR = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const handlePrintQR = () => {
    window.print();
  };

  const handleMaterialSelect = (materialId: number) => {
    const material = materials.find((m) => m.id === materialId);
    if (material) {
      setSingleForm({
        ...singleForm,
        materialCode: material.code,
        materialName: material.name,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">QR Code Generator</h2>
        <p className="text-gray-500">Generate QR codes for materials and recipes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('single')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'single'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          Single QR Code
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'bulk'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          Bulk Generation (Recipe)
        </button>
      </div>

      {/* Single QR Tab */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold mb-4">Generate QR Code</h3>

            <form onSubmit={handleGenerateSingle} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Quick Select Material</label>
                <select
                  className="input"
                  onChange={(e) => handleMaterialSelect(parseInt(e.target.value))}
                  defaultValue=""
                >
                  <option value="">Select a material...</option>
                  {materials.filter((m) => m.type === 'INGREDIENT').map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name} ({material.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-3">Or enter details manually:</p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Material Code *</label>
                    <input
                      type="text"
                      className="input"
                      value={singleForm.materialCode}
                      onChange={(e) => setSingleForm({ ...singleForm, materialCode: e.target.value })}
                      required
                      placeholder="e.g., MAT-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Material Name *</label>
                    <input
                      type="text"
                      className="input"
                      value={singleForm.materialName}
                      onChange={(e) => setSingleForm({ ...singleForm, materialName: e.target.value })}
                      required
                      placeholder="e.g., Flour"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Setpoint (g) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={singleForm.setpoint}
                      onChange={(e) => setSingleForm({ ...singleForm, setpoint: e.target.value })}
                      required
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Actual Value (g) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={singleForm.actualValue}
                      onChange={(e) => setSingleForm({ ...singleForm, actualValue: e.target.value })}
                      required
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Equipment *</label>
                    <select
                      className="input"
                      value={singleForm.equipment}
                      onChange={(e) => setSingleForm({ ...singleForm, equipment: e.target.value })}
                      required
                    >
                      <option value="">Select equipment...</option>
                      {materials.filter((m) => m.type === 'EQUIPMENT').map((eq) => (
                        <option key={eq.id} value={eq.name}>
                          {eq.name} ({eq.code})
                        </option>
                      ))}
                      <option value="Any">Any Equipment</option>
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full">
                Generate QR Code
              </button>
            </form>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Generated QR Code</h3>

            {generatedQR ? (
              <div className="space-y-4">
                <div className="flex justify-center p-6 bg-white border-2 border-gray-200 rounded-lg">
                  <img src={generatedQR.image} alt="Generated QR Code" className="w-64 h-64" />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">QR Code Data:</p>
                  <p className="text-xs font-mono break-all bg-white p-2 rounded border">
                    {generatedQR.data}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      handleDownloadQR(
                        generatedQR.image,
                        `qr-${singleForm.materialCode}-${Date.now()}.png`
                      )
                    }
                    className="btn-primary flex-1"
                  >
                    📥 Download
                  </button>
                  <button onClick={handlePrintQR} className="btn-secondary flex-1">
                    🖨️ Print
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">📱</p>
                <p>QR code will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk QR Tab */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold mb-4">Generate QR Codes for Recipe</h3>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-2">Select Recipe</label>
                <select
                  className="input"
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(parseInt(e.target.value))}
                >
                  <option value={0}>Choose a recipe...</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name} ({recipe.steps?.length || 0} steps)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleGenerateBulk}
                  disabled={!selectedRecipeId}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate All QR Codes
                </button>
              </div>
            </div>
          </div>

          {bulkQRCodes.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={handlePrintQR} className="btn-primary">
                  🖨️ Print All
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
                {bulkQRCodes.map((qr, index) => (
                  <div key={index} className="card">
                    <div className="mb-3">
                      <span className="inline-block bg-primary-600 text-white text-xs font-bold px-2 py-1 rounded">
                        Step {qr.stepOrder}
                      </span>
                    </div>

                    <h4 className="font-semibold mb-1">{qr.materialName}</h4>
                    <p className="text-sm text-gray-500 mb-4">{qr.materialCode}</p>

                    <div className="flex justify-center p-4 bg-white border border-gray-200 rounded">
                      <img src={qr.qrCodeImage} alt={qr.materialName} className="w-48 h-48" />
                    </div>

                    <button
                      onClick={() =>
                        handleDownloadQR(qr.qrCodeImage, `qr-step${qr.stepOrder}-${qr.materialCode}.png`)
                      }
                      className="btn-secondary w-full mt-4 text-sm"
                    >
                      📥 Download
                    </button>
                  </div>
                ))}
              </div>

              {/* Print-friendly grid */}
              <div className="print-only">
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    .print-only, .print-only * {
                      visibility: visible;
                    }
                    .print-only {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                    }
                    .no-print {
                      display: none !important;
                    }
                  }
                `}</style>
                <h2 className="text-2xl font-bold mb-6">
                  QR Codes - {recipes.find((r) => r.id === selectedRecipeId)?.name}
                </h2>
                <div className="grid grid-cols-3 gap-8">
                  {bulkQRCodes.map((qr, index) => (
                    <div key={index} className="border border-gray-300 rounded p-4 page-break-inside-avoid">
                      <div className="text-center mb-3">
                        <span className="inline-block bg-black text-white text-sm font-bold px-3 py-1 rounded">
                          Step {qr.stepOrder}
                        </span>
                      </div>
                      <h4 className="font-bold text-center mb-1">{qr.materialName}</h4>
                      <p className="text-sm text-center text-gray-600 mb-3">{qr.materialCode}</p>
                      <div className="flex justify-center">
                        <img src={qr.qrCodeImage} alt={qr.materialName} className="w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QRGenerator;
