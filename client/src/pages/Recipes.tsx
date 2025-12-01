import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  setRecipes,
  setSelectedRecipe,
  addRecipe,
  updateRecipe,
  deleteRecipe,
  setLoading,
} from '../store/recipesSlice';
import { setMaterials } from '../store/materialsSlice';
import { recipesApi } from '../api/recipes.api';
import { materialsApi } from '../api/materials.api';
import { Recipe } from '../types/models';

interface StepForm {
  materialId: number;
  equipmentId?: number;
  stepOrder: number;
  setpoint: number;
  tolerancePercent: number;
}

const Recipes: React.FC = () => {
  const dispatch = useDispatch();
  const {
    recipes,
    selectedRecipe,
    loading: _loading,
  } = useSelector((state: RootState) => state.recipes);
  const { ingredients, equipment } = useSelector((state: RootState) => state.materials);
  const { user } = useSelector((state: RootState) => state.auth);

  const isAdmin = user?.role === 'ADMIN';

  const [showModal, setShowModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [recipeName, setRecipeName] = useState('');
  const [steps, setSteps] = useState<StepForm[]>([]);

  useEffect(() => {
    loadData();

    // Auto-refresh every 30 seconds for operators
    if (!isAdmin) {
      const interval = setInterval(() => {
        loadData(true);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) {
        dispatch(setLoading(true));
      }
      setIsRefreshing(true);
      const [recipesRes, materialsRes] = await Promise.all([
        recipesApi.getAll(),
        materialsApi.getAll(),
      ]);
      dispatch(setRecipes(recipesRes.data.data || []));
      dispatch(setMaterials(materialsRes.data.data || []));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleOpenModal = (recipe?: Recipe) => {
    if (recipe) {
      setEditingRecipe(recipe);
      setRecipeName(recipe.name);
      setSteps(
        recipe.steps?.map(step => ({
          materialId: step.materialId,
          equipmentId: step.equipmentId || undefined,
          stepOrder: step.stepOrder,
          setpoint: step.setpoint,
          tolerancePercent: step.tolerancePercent,
        })) || [],
      );
    } else {
      setEditingRecipe(null);
      setRecipeName('');
      setSteps([
        {
          materialId: 0,
          equipmentId: undefined,
          stepOrder: 1,
          setpoint: 0,
          tolerancePercent: 5,
        },
      ]);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRecipe(null);
    setRecipeName('');
    setSteps([]);
  };

  const handleAddStep = () => {
    setSteps([
      ...steps,
      {
        materialId: 0,
        equipmentId: undefined,
        stepOrder: steps.length + 1,
        setpoint: 0,
        tolerancePercent: 5,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    // Reorder steps
    newSteps.forEach((step, i) => {
      step.stepOrder = i + 1;
    });
    setSteps(newSteps);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    // Swap steps
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];

    // Update stepOrder
    newSteps.forEach((step, i) => {
      step.stepOrder = i + 1;
    });

    setSteps(newSteps);
  };

  const handleUpdateStep = (index: number, field: keyof StepForm, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!recipeName.trim()) {
      alert('Please enter a recipe name');
      return;
    }

    if (steps.length === 0) {
      alert('Please add at least one step');
      return;
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.materialId || step.materialId === 0) {
        alert(`Please select a material for step ${i + 1}`);
        return;
      }
      if (step.setpoint <= 0) {
        alert(`Please enter a valid setpoint for step ${i + 1}`);
        return;
      }
      if (step.tolerancePercent < 0 || step.tolerancePercent > 100) {
        alert(`Tolerance must be between 0 and 100 for step ${i + 1}`);
        return;
      }
    }

    try {
      const recipeData = {
        name: recipeName,
        steps: steps.map(step => ({
          materialId: step.materialId,
          equipmentId: step.equipmentId || undefined,
          stepOrder: step.stepOrder,
          setpoint: step.setpoint,
          tolerancePercent: step.tolerancePercent,
        })),
      };

      if (editingRecipe) {
        const response = await recipesApi.update(editingRecipe.id, recipeData);
        dispatch(updateRecipe(response.data.data!));
      } else {
        const response = await recipesApi.create(recipeData);
        dispatch(addRecipe(response.data.data!));
      }
      handleCloseModal();
    } catch (error: any) {
      alert(error.message || 'Failed to save recipe');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete recipe "${name}"?`)) return;

    try {
      await recipesApi.delete(id);
      dispatch(deleteRecipe(id));
    } catch (error: any) {
      alert(error.message || 'Failed to delete recipe');
    }
  };

  const handleView = async (recipe: Recipe) => {
    try {
      const response = await recipesApi.getById(recipe.id);
      dispatch(setSelectedRecipe(response.data.data!));
    } catch (error) {
      console.error('Error loading recipe details:', error);
    }
  };

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recipes</h2>
          <p className="text-gray-500">Manage mixing recipes and formulas</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            title="Refresh recipes"
          >
            {isRefreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
          {isAdmin && (
            <button onClick={() => handleOpenModal()} className="btn-primary">
              + Create Recipe
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <input
          type="text"
          placeholder="Search recipes..."
          className="input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Recipes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map(recipe => (
          <div key={recipe.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold">{recipe.name}</h3>
              <span className="badge-info">{recipe.steps?.length || 0} steps</span>
            </div>

            <div className="space-y-2 mb-4">
              {recipe.steps?.slice(0, 3).map(step => (
                <div key={step.id} className="text-sm text-gray-600 flex items-center">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mr-2">
                    {step.stepOrder}
                  </span>
                  <span className="truncate">{step.material?.name}</span>
                </div>
              ))}
              {(recipe.steps?.length || 0) > 3 && (
                <p className="text-xs text-gray-400">+ {(recipe.steps?.length || 0) - 3} more...</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleView(recipe)}
                className="flex-1 px-3 py-2 text-sm bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
              >
                View
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => handleOpenModal(recipe)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(recipe.id, recipe.name)}
                    className="px-3 py-2 text-sm bg-danger-100 text-danger-700 rounded hover:bg-danger-200"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredRecipes.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No recipes found</p>
          {isAdmin && (
            <button onClick={() => handleOpenModal()} className="btn-primary">
              Create First Recipe
            </button>
          )}
        </div>
      )}

      {/* Recipe Details Modal */}
      {selectedRecipe && !showModal && (
        <div className="modal-overlay" onClick={() => dispatch(setSelectedRecipe(null))}>
          <div className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-2xl font-bold mb-4">{selectedRecipe.name}</h3>

              <div className="space-y-4">
                {selectedRecipe.steps?.map(step => (
                  <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                            {step.stepOrder}
                          </span>
                          <h4 className="text-lg font-semibold">{step.material?.name}</h4>
                          <span className="text-sm text-gray-500">({step.material?.code})</span>
                        </div>

                        <div className="ml-11 space-y-1">
                          <p className="text-sm">
                            <span className="text-gray-500">Setpoint:</span>{' '}
                            <span className="font-semibold">{step.setpoint}g</span>
                          </p>
                          <p className="text-sm">
                            <span className="text-gray-500">Tolerance:</span>{' '}
                            <span className="font-semibold">±{step.tolerancePercent}%</span>
                            <span className="text-gray-400 ml-2">
                              (
                              {(
                                Number(step.setpoint) -
                                (Number(step.setpoint) * Number(step.tolerancePercent)) / 100
                              ).toFixed(2)}
                              g -{' '}
                              {(
                                Number(step.setpoint) +
                                (Number(step.setpoint) * Number(step.tolerancePercent)) / 100
                              ).toFixed(2)}
                              g)
                            </span>
                          </p>
                          {step.equipment && (
                            <p className="text-sm">
                              <span className="text-gray-500">Equipment:</span>{' '}
                              <span className="font-semibold">{step.equipment.name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => dispatch(setSelectedRecipe(null))} className="btn-secondary">
                  Close
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      handleOpenModal(selectedRecipe);
                      dispatch(setSelectedRecipe(null));
                    }}
                    className="btn-primary"
                  >
                    Edit Recipe
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Recipe Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingRecipe ? 'Edit Recipe' : 'Create New Recipe'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipe Name *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={recipeName}
                    onChange={e => setRecipeName(e.target.value)}
                    required
                    placeholder="e.g., Standard Blend Formula"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Recipe Steps *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      + Add Step
                    </button>
                  </div>

                  <div className="space-y-4">
                    {steps.map((step, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold">Step {step.stepOrder}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveStep(index, 'up')}
                              disabled={index === 0}
                              className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(index, 'down')}
                              disabled={index === steps.length - 1}
                              className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(index)}
                              className="px-2 py-1 text-sm bg-danger-100 text-danger-700 rounded hover:bg-danger-200"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Material *</label>
                            <select
                              className="input"
                              value={step.materialId}
                              onChange={e =>
                                handleUpdateStep(index, 'materialId', parseInt(e.target.value))
                              }
                              required
                            >
                              <option value={0}>Select material...</option>
                              {ingredients.map(mat => (
                                <option key={mat.id} value={mat.id}>
                                  {mat.name} ({mat.code})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Equipment</label>
                            <select
                              className="input"
                              value={step.equipmentId || ''}
                              onChange={e =>
                                handleUpdateStep(
                                  index,
                                  'equipmentId',
                                  e.target.value ? parseInt(e.target.value) : undefined,
                                )
                              }
                            >
                              <option value="">None</option>
                              {equipment.map(eq => (
                                <option key={eq.id} value={eq.id}>
                                  {eq.name} ({eq.code})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 mb-1">
                              Setpoint (g) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={step.setpoint}
                              onChange={e =>
                                handleUpdateStep(index, 'setpoint', parseFloat(e.target.value))
                              }
                              required
                              min="0.01"
                            />
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 mb-1">
                              Tolerance (%)*
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              className="input"
                              value={step.tolerancePercent}
                              onChange={e =>
                                handleUpdateStep(
                                  index,
                                  'tolerancePercent',
                                  parseFloat(e.target.value),
                                )
                              }
                              required
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={handleCloseModal} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingRecipe ? 'Update Recipe' : 'Create Recipe'}
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

export default Recipes;
