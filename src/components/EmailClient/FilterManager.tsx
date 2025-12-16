'use client';

import { useEffect, useState } from 'react';
import { mailService, type IMailFilter } from '@/services/MailService';
import DialogWindow from '../DialogWindow';

interface FilterManagerProps {
  onClose: () => void;
}

export default function FilterManager({ onClose }: FilterManagerProps) {
  const [filters, setFilters] = useState<IMailFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFilter, setEditingFilter] = useState<IMailFilter | null>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      const fetchedFilters = await mailService.getFilters();
      setFilters(fetchedFilters);
    } catch (error) {
      console.error('Failed to load filters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this filter?')) return;
    try {
      await mailService.deleteFilter(id);
      await loadFilters();
    } catch (error) {
      console.error('Failed to delete filter:', error);
      alert('Failed to delete filter');
    }
  };

  const handleToggleEnabled = async (filter: IMailFilter) => {
    try {
      await mailService.updateFilter(filter.id, { enabled: !filter.enabled });
      await loadFilters();
    } catch (error) {
      console.error('Failed to update filter:', error);
      alert('Failed to update filter');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">Loading filters...</div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col" style={{ backgroundColor: '#e6f2ff' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">Mail Filters</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
          >
            New Filter
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto retro-scrollbar">
        {filters.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No filters yet. Create one to automatically organize your mail!
          </div>
        ) : (
          <div className="space-y-2">
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="p-3 bg-white border-2 border-gray-300 rounded"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-800">{filter.name}</h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          filter.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {filter.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <div className="mb-1">
                        <strong>If:</strong>{' '}
                        {filter.conditions.map((cond, idx) => (
                          <span key={idx}>
                            {idx > 0 && ' AND '}
                            {cond.field} {cond.operator} &quot;{cond.value}&quot;
                          </span>
                        ))}
                      </div>
                      <div>
                        <strong>Then:</strong>{' '}
                        {filter.actions.delete && 'Delete'}
                        {filter.actions.moveToFolder && `Move to ${filter.actions.moveToFolder}`}
                        {filter.actions.markAsRead !== undefined &&
                          `Mark as ${filter.actions.markAsRead ? 'read' : 'unread'}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleEnabled(filter)}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                      title={filter.enabled ? 'Disable' : 'Enable'}
                    >
                      {filter.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => setEditingFilter(filter)}
                      className="px-2 py-1 text-xs bg-blue-200 text-blue-800 rounded hover:bg-blue-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(filter.id)}
                      className="px-2 py-1 text-xs bg-red-200 text-red-800 rounded hover:bg-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(showCreateDialog || editingFilter) && (
        <FilterEditor
          filter={editingFilter}
          onSave={async () => {
            await loadFilters();
            setShowCreateDialog(false);
            setEditingFilter(null);
          }}
          onCancel={() => {
            setShowCreateDialog(false);
            setEditingFilter(null);
          }}
        />
      )}
    </div>
  );
}

interface FilterEditorProps {
  filter?: IMailFilter | null;
  onSave: () => void;
  onCancel: () => void;
}

function FilterEditor({ filter, onSave, onCancel }: FilterEditorProps) {
  const [name, setName] = useState(filter?.name || '');
  const [enabled, setEnabled] = useState(filter?.enabled !== false);
  const [conditions, setConditions] = useState(
    filter?.conditions || [{ field: 'subject', operator: 'contains', value: '' }]
  );
  const [actions, setActions] = useState(
    filter?.actions || { moveToFolder: undefined, markAsRead: undefined, delete: false }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Filter name is required');
      return;
    }
    if (conditions.some((c) => !c.value.trim())) {
      alert('All condition values are required');
      return;
    }
    if (!actions.moveToFolder && actions.markAsRead === undefined && !actions.delete) {
      alert('At least one action is required');
      return;
    }

    setSaving(true);
    try {
      if (filter) {
        await mailService.updateFilter(filter.id, {
          name,
          enabled,
          conditions: conditions as any, // Type assertion needed due to interface mismatch
          actions,
        });
      } else {
        await mailService.createFilter({
          name,
          enabled,
          conditions: conditions as any, // Type assertion needed due to interface mismatch
          actions,
          order: 0,
        });
      }
      onSave();
    } catch (error) {
      console.error('Failed to save filter:', error);
      alert('Failed to save filter');
    } finally {
      setSaving(false);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'subject', operator: 'contains', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: string, value: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  return (
    <DialogWindow
      title={filter ? 'Edit Filter' : 'Create Filter'}
      message=""
      onConfirm={handleSave}
      onCancel={onCancel}
      confirmText={saving ? 'Saving...' : 'Save'}
      cancelText="Cancel"
      showInput={false}
      customContent={
        <div className="p-4 space-y-4" style={{ minWidth: '500px' }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border-2 border-gray-300 rounded text-sm"
              placeholder="e.g., Move newsletters to Trash"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">Enabled</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conditions (ALL must match)</label>
            {conditions.map((condition, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <select
                  value={condition.field}
                  onChange={(e) => updateCondition(index, 'field', e.target.value)}
                  className="p-1 border-2 border-gray-300 rounded text-sm"
                >
                  <option value="from">From</option>
                  <option value="to">To</option>
                  <option value="subject">Subject</option>
                  <option value="body">Body</option>
                </select>
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                  className="p-1 border-2 border-gray-300 rounded text-sm"
                >
                  <option value="contains">contains</option>
                  <option value="equals">equals</option>
                  <option value="startsWith">starts with</option>
                  <option value="endsWith">ends with</option>
                </select>
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  className="flex-1 p-1 border-2 border-gray-300 rounded text-sm"
                  placeholder="value"
                />
                {conditions.length > 1 && (
                  <button
                    onClick={() => removeCondition(index)}
                    className="px-2 py-1 bg-red-200 text-red-800 rounded hover:bg-red-300 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addCondition}
              className="mt-2 px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
            >
              + Add Condition
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Move to folder:</label>
                <select
                  value={actions.moveToFolder || ''}
                  onChange={(e) =>
                    setActions({ ...actions, moveToFolder: e.target.value || undefined })
                  }
                  className="w-full p-1 border-2 border-gray-300 rounded text-sm"
                >
                  <option value="">No action</option>
                  <option value="Inbox">Inbox</option>
                  <option value="Sent">Sent</option>
                  <option value="Drafts">Drafts</option>
                  <option value="Trash">Trash</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={actions.delete || false}
                    onChange={(e) => setActions({ ...actions, delete: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700">Delete immediately (move to Trash)</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={actions.markAsRead === true}
                    onChange={(e) =>
                      setActions({ ...actions, markAsRead: e.target.checked ? true : undefined })
                    }
                  />
                  <span className="text-sm text-gray-700">Mark as read</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}


