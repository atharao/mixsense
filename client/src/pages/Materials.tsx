import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  setMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  setLoading,
} from '../store/materialsSlice';
import { materialsApi } from '../api/materials.api';
import { Material } from '../types/models';

const Materials: React.FC = () => {
  const dispatch = useDispatch();
  const { materials, loading } = useSelector((state: RootState) => state.materials);

  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
  });

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      dispatch(setLoading(true));
      const response = await materialsApi.getAll();
      dispatch(setMaterials(response.data.data || []));
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const handleOpenModal = (material?: Material) => {
    if (material) {
      setEditingMaterial(material);
      setFormData({
        name: material.name,
        code: material.code,
      });
    } else {
      setEditingMaterial(null);
      setFormData({
        name: '',
        code: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMaterial(null);
    setFormData({ name: '', code: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingMaterial) {
        // Update existing material
        const response = await materialsApi.update(editingMaterial.id, formData);
        dispatch(updateMaterial(response.data.data!));
      } else {
        // Create new material
        const response = await materialsApi.create(formData);
        dispatch(addMaterial(response.data.data!));
      }
      handleCloseModal();
    } catch (error: any) {
      alert(error.message || 'Failed to save material');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await materialsApi.delete(id);
      dispatch(deleteMaterial(id));
    } catch (error: any) {
      alert(error.message || 'Failed to delete material');
    }
  };

  const filteredMaterials = materials.filter(
    m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Materials</h2>
          <p className="text-gray-500">Manage materials for recipes</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          + Add Material
        </button>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="card">
          <p className="text-sm text-gray-500">Total Materials</p>
          <p className="text-3xl font-bold text-primary-600">{materials.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or code..."
              className="input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Materials Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner"></div>
            <span className="ml-3 text-gray-600">Loading materials...</span>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No materials found</p>
            <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
              Create First Material
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map(material => (
                  <tr key={material.id}>
                    <td className="font-mono font-semibold">{material.code}</td>
                    <td>{material.name}</td>
                    <td className="text-sm text-gray-500">
                      {new Date(material.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(material)}
                          className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(material.id, material.name)}
                          className="px-3 py-1 text-sm bg-danger-100 text-danger-700 rounded hover:bg-danger-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingMaterial ? 'Edit Material' : 'Add New Material'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Code *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    required
                    placeholder="e.g., MAT-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Name *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Flour"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={handleCloseModal} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingMaterial ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Materials;
