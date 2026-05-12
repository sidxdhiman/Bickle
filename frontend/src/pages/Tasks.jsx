import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Search, LayoutList, LayoutGrid, MoreVertical,
  CheckCircle2, Circle, Calendar, Tag, AlertCircle, X,
  Edit, Trash2, Star, Filter, Settings, Grip
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const defaultStatusOptions = [
  { id: 'todo', label: 'To Do', color: '#64748b' },
  { id: 'in-progress', label: 'In Progress', color: '#3b82f6' },
  { id: 'completed', label: 'Completed', color: '#10b981' },
];

const getStatusLabel = (statusId, statuses = defaultStatusOptions) => {
  const status = statuses.find(item => item.id === statusId);
  return status ? status.label : '-';
};

const getStatusOptionsForTask = (task, lists) => {
  const taskList = lists.find(list => list._id === task.list);
  const statuses = taskList?.statuses || defaultStatusOptions;
  if (statuses.some(status => status.id === task.status)) {
    return statuses;
  }
  return [{ id: 'unassigned', label: '-' }, ...statuses];
};

const TaskModal = ({ isOpen, onClose, onSubmit, lists, task = null }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    list: lists.length > 0 ? lists[0]._id : '',
    priority: 'medium',
    status: 'todo',
    dueDate: '',
    tags: []
  });

  const selectedListObj = lists.find(l => l._id === formData.list);
  let statusOptions = selectedListObj?.statuses || defaultStatusOptions;
  if (!statusOptions.some(status => status.id === formData.status)) {
    statusOptions = [{ id: 'unassigned', label: '-' }, ...statusOptions];
  }

  const getDefaultStatusForList = (listId) => {
    const list = lists.find(l => l._id === listId);
    return list?.statuses?.[0]?.id || 'todo';
  };

  const handleListChange = (e) => {
    const selectedListId = e.target.value;
    const defaultStatus = getDefaultStatusForList(selectedListId);
    setFormData(prev => ({
      ...prev,
      list: selectedListId,
      status: defaultStatus,
    }));
  };

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        list: task.list || (lists.length > 0 ? lists[0]._id : ''),
        priority: task.priority || 'medium',
        status: task.status || 'todo',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        tags: task.tags || []
      });
    } else if (lists.length > 0) {
      const defaultListId = formData.list || lists[0]._id;
      setFormData(prev => ({
        ...prev,
        list: defaultListId,
        status: prev.status && statusOptions.some(status => status.id === prev.status)
          ? prev.status
          : getDefaultStatusForList(defaultListId),
      }));
    }
  }, [task, lists]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    if (!task) {
      const defaultListId = lists[0]?._id || '';
      setFormData({
        title: '',
        description: '',
        list: defaultListId,
        priority: 'medium',
        status: getDefaultStatusForList(defaultListId),
        dueDate: '',
        tags: []
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-md max-h-[90vh] overflow-y-auto relative rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <h2 className="text-lg sm:text-xl font-bold">{task ? 'Edit Task' : 'Create New Task'}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Title</label>
            <input
              autoFocus
              required
              type="text"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
              placeholder="Enter task title..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm resize-none transition-colors"
              rows={3}
              placeholder="Enter task description..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">List</label>
            <select
              required
              value={formData.list}
              onChange={handleListChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
            >
              {lists.map(list => (
                <option key={list._id} value={list._id}>{list.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
              >
                {statusOptions.map(status => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Due Date</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={e => setFormData({...formData, dueDate: e.target.value})}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-md hover:bg-secondary/80 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              {task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TaskDetailModal = ({ isOpen, onClose, task, lists, onUpdate, onDelete, onEdit }) => {
  if (!isOpen || !task) return null;

  const getListName = (id) => lists.find(l => l._id === id)?.name || 'Unknown';
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : 'No date';
  const baseTaskStatusOptions = lists.find(l => l._id === task.list)?.statuses || defaultStatusOptions;
  const currentTaskStatus = baseTaskStatusOptions.some(status => status.id === task.status) ? task.status : 'unassigned';
  const taskStatusOptions = currentTaskStatus === 'unassigned'
    ? [{ id: 'unassigned', label: '-' }, ...baseTaskStatusOptions]
    : baseTaskStatusOptions;

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'unassigned') return;
    try {
      const res = await axios.put(`/tasks/${task._id}`, { status: newStatus });
      onUpdate(res.data);
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    try {
      const res = await axios.put(`/tasks/${task._id}`, { status: newStatus });
      onUpdate(res.data);
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleEdit = () => {
    onClose();
    onEdit(task);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await axios.delete(`/tasks/${task._id}`);
        onDelete(task._id);
        onClose();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto relative rounded-lg shadow-xl">
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <h2 className="text-lg sm:text-xl font-bold">{task.title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Status toggle and actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleStatusToggle}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  task.status === 'completed'
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : "bg-slate-500/10 text-slate-500 border border-slate-500/20 hover:bg-slate-500/20"
                )}
              >
                {task.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                {task.status === 'completed' ? 'Completed' : 'Mark Complete'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEdit}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
                title="Edit task"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                title="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Description section */}
          {task.description && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">Description</h3>
              <div className="bg-secondary/30 border border-border rounded-md p-3">
                <p className="text-sm leading-relaxed text-foreground">{task.description}</p>
              </div>
            </div>
          )}

          {/* Task details grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Priority</h3>
              <span className={cn(
                "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full",
                task.priority === 'high' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                task.priority === 'medium' ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" :
                "bg-blue-500/10 text-blue-500 border border-blue-500/20"
              )}>
                {task.priority}
              </span>
            </div>
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Status</h3>
              <select
                value={currentTaskStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {taskStatusOptions.some(status => status.id === 'unassigned') && (
                  <option value="unassigned">-</option>
                )}
                {taskStatusOptions.filter(status => status.id !== 'unassigned').map(status => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">List</h3>
              <p className="text-sm text-foreground">{getListName(task.list)}</p>
            </div>
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Due Date</h3>
              <p className="text-sm text-foreground">{formatDate(task.dueDate)}</p>
            </div>
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Added</h3>
              <p className="text-sm text-foreground">{formatDate(task.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CreateListModal = ({ isOpen, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', description: '' });
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onCreate(formData);
      onClose();
    } catch (error) {
      console.error('Error creating list:', error);
      setError('Failed to create list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-md max-h-[90vh] overflow-y-auto relative rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <h2 className="text-lg sm:text-xl font-bold">Create New List</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">List Name</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
              placeholder="Enter list name..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm resize-none transition-colors"
              rows={3}
              placeholder="Add a short description..."
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-md hover:bg-secondary/80 transition-colors text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ListManagementModal = ({ isOpen, onClose, list, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    statuses: [],
  });
  const [newStatus, setNewStatus] = useState({ label: '', color: '#6366f1' });
  const [editingStatusIndex, setEditingStatusIndex] = useState(null);
  const [editingStatusColor, setEditingStatusColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (list) {
      setFormData({
        name: list.name || '',
        description: list.description || '',
        statuses: list.statuses || [],
      });
      setError('');
    }
  }, [list]);

  if (!isOpen || !list) return null;

  const handleAddStatus = () => {
    if (newStatus.label.trim()) {
      const statusId = newStatus.label.toLowerCase().replace(/\s+/g, '-');
      setFormData(prev => ({
        ...prev,
        statuses: [...prev.statuses, { ...newStatus, id: statusId }]
      }));
      setNewStatus({ label: '', color: '#6366f1' });
    }
  };

  const handleRemoveStatus = (index) => {
    setFormData(prev => ({
      ...prev,
      statuses: prev.statuses.filter((_, i) => i !== index)
    }));
    if (editingStatusIndex === index) {
      setEditingStatusIndex(null);
    }
  };

  const handleEditStatusColor = (index, newColor) => {
    setFormData(prev => ({
      ...prev,
      statuses: prev.statuses.map((status, i) => i === index ? { ...status, color: newColor } : status)
    }));
  };

  const handleUpdateList = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.put(`/lists/${list._id}`, {
        name: formData.name,
        description: formData.description
      });
      await axios.put(`/lists/${list._id}/statuses`, {
        statuses: formData.statuses
      });
      await onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating list:', error);
      setError('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const colorOptions = ['#64748b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-md max-h-[90vh] overflow-y-auto relative rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <h2 className="text-lg sm:text-xl font-bold">Manage List</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleUpdateList} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">List Name</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
              placeholder="Enter list name..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm resize-none transition-colors"
              rows={2}
              placeholder="Enter description..."
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Statuses
            </h3>
            
            {/* Existing statuses */}
            <div className="space-y-2 mb-4">
              {formData.statuses.map((status, index) => (
                <div key={index}>
                  <div className="flex items-center gap-3 p-3 bg-secondary/30 border border-border rounded-md">
                    <button
                      type="button"
                      onClick={() => setEditingStatusIndex(editingStatusIndex === index ? null : index)}
                      className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity"
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 border-border cursor-pointer hover:scale-110 transition-transform"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="flex-1 text-sm font-medium text-left">{status.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveStatus(index)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {editingStatusIndex === index && (
                    <div className="mt-2 p-3 bg-secondary/20 border border-border rounded-md">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Choose Color</p>
                      <div className="flex gap-2 flex-wrap">
                        {['#64748b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => handleEditStatusColor(index, color)}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 transition-all cursor-pointer",
                              status.color === color ? "border-foreground scale-110" : "border-border hover:scale-105"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new status */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Add New Status</p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newStatus.label}
                  onChange={e => setNewStatus({...newStatus, label: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
                  placeholder="Status name (e.g., Parked, Blocked)..."
                />
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewStatus({...newStatus, color})}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all",
                        newStatus.color === color ? "border-foreground scale-110" : "border-border"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddStatus}
                  disabled={!newStatus.label.trim()}
                  className="w-full py-2 border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all bg-secondary/50 rounded-md disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Add Status
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-md hover:bg-secondary/80 transition-colors text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TaskPage = () => {
  const [view, setView] = useState('list');
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isListManagementOpen, setIsListManagementOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingList, setEditingList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let currentLists = (await axios.get('/lists')).data;
        if (currentLists.length === 0) {
          const newList = await axios.post('/lists', { name: 'Inbox', isFavorite: true, icon: 'inbox', color: '#6366f1' });
          currentLists = [newList.data];
        }
        setLists(currentLists);

        const currentTasks = (await axios.get('/tasks')).data;
        setTasks(currentTasks);
      } catch (error) {
        console.error('Error fetching tasks data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredTasks = selectedList === 'all' ? tasks : tasks.filter(task => task.list === selectedList);

  const handleCreateTask = async (taskData) => {
    try {
      const res = await axios.post('/tasks', taskData);
      setTasks(prev => [res.data, ...prev]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error creating task', error);
    }
  };

  const handleUpdateTask = async (taskData) => {
    try {
      const res = await axios.put(`/tasks/${editingTask._id}`, taskData);
      setTasks(prev => prev.map(task => task._id === editingTask._id ? res.data : task));
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating task', error);
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const handleTaskUpdate = (updatedTask) => {
    setTasks(prev => prev.map(task => task._id === updatedTask._id ? updatedTask : task));
    setSelectedTask(updatedTask);
  };

  const handleTaskDelete = (taskId) => {
    setTasks(prev => prev.filter(task => task._id !== taskId));
  };

  const handleToggleComplete = async (task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    try {
      await axios.put(`/tasks/${task._id}`, { status: newStatus });
      setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    if (newStatus === 'unassigned') return;
    try {
      const res = await axios.put(`/tasks/${task._id}`, { status: newStatus });
      setTasks(prev => prev.map(t => t._id === task._id ? res.data : t));
      if (selectedTask?._id === task._id) {
        setSelectedTask(res.data);
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const getListName = (id) => lists.find(l => l._id === id)?.name || 'Unknown';
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : 'No date';

  // Get current list object
  const currentList = selectedList === 'all' ? null : lists.find(l => l._id === selectedList);

  const customStatusColumns = currentList?.statuses || [];
  const hasStatuses = currentList ? customStatusColumns.length > 0 : true;

  // Get status columns - use custom statuses from selected list or defaults
  const statusColumns = currentList ? customStatusColumns : [
    { id: 'todo', label: 'To Do', color: '#64748b' },
    { id: 'in-progress', label: 'In Progress', color: '#3b82f6' },
    { id: 'completed', label: 'Completed', color: '#10b981' },
  ];

  // Drag and drop handlers
  const handleDragStart = (task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (statusId) => {
    if (!draggedTask) return;
    try {
      await axios.put(`/tasks/${draggedTask._id}`, { status: statusId });
      setTasks(prev => prev.map(t => t._id === draggedTask._id ? { ...t, status: statusId } : t));
      setDraggedTask(null);
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // List management handlers
  const handleDeleteList = async (listId) => {
    if (window.confirm('Are you sure you want to delete this list and all its tasks?')) {
      try {
        await axios.delete(`/lists/${listId}`);
        setLists(prev => prev.filter(l => l._id !== listId));
        if (selectedList === listId) {
          setSelectedList('all');
        }
      } catch (error) {
        console.error('Error deleting list:', error);
      }
    }
  };

  const handleOpenListManagement = (list) => {
    setEditingList(list);
    setIsListManagementOpen(true);
  };

  const handleCreateList = () => {
    setIsCreateListOpen(true);
  };

  const handleCreateListSubmit = async (listData) => {
    try {
      const res = await axios.post('/lists', {
        ...listData,
        isFavorite: false,
        statuses: defaultStatusOptions,
      });
      setLists(prev => [...prev, res.data]);
      setSelectedList(res.data._id);
    } catch (error) {
      console.error('Error creating list:', error);
    }
  };

  const handleListManagementUpdate = async () => {
    setEditingList(null);
    const updatedLists = await axios.get('/lists');
    setLists(updatedLists.data);
  };

  if (loading) return <div className="h-full flex items-center justify-center text-muted-foreground">Loading tasks...</div>;

  return (
    <div className="h-full flex flex-col gap-4 sm:gap-6">
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        lists={lists}
        task={editingTask}
      />

      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        task={selectedTask}
        lists={lists}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        onEdit={(task) => {
          setEditingTask(task);
          setIsModalOpen(true);
        }}
      />

      <CreateListModal
        isOpen={isCreateListOpen}
        onClose={() => setIsCreateListOpen(false)}
        onCreate={handleCreateListSubmit}
      />

      <ListManagementModal
        isOpen={isListManagementOpen}
        onClose={() => setIsListManagementOpen(false)}
        list={editingList}
        onUpdate={handleListManagementUpdate}
      />

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-muted-foreground">Manage your daily productivity</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-2 bg-background border border-border rounded-md px-1">
              <select
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                className="min-w-[180px] px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm flex-1"
              >
                <option value="all">All Lists</option>
                {lists.map(list => (
                  <option key={list._id} value={list._id}>{list.name}</option>
                ))}
              </select>
              {selectedList !== 'all' && (
                <div className="flex items-center gap-2 pr-2">
                  <button
                    onClick={() => handleOpenListManagement(currentList)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-all rounded"
                    title="Edit list"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteList(selectedList)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded"
                    title="Delete list"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleCreateList}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-all rounded-md"
              title="Add new list"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-secondary p-1 border border-border rounded-md">
              <button
                onClick={() => setView('list')}
                className={cn("p-2 transition-all", view === 'list' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('kanban')}
                className={cn("p-2 transition-all", view === 'kanban' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 flex items-center gap-2 font-medium hover:opacity-90 transition-opacity text-sm sm:text-base"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {view === 'list' ? (
          <div className="bg-secondary/50 border border-border overflow-hidden h-full flex flex-col rounded-lg">
            <div className="grid grid-cols-12 gap-4 px-4 sm:px-6 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-secondary">
              <div className="col-span-4 sm:col-span-5">Task</div>
              <div className="col-span-2 text-center hidden sm:block">Priority</div>
              <div className="col-span-2 text-center hidden sm:block">Status</div>
              <div className="col-span-2 text-center hidden md:block">Due Date</div>
              <div className="col-span-2 sm:col-span-1 text-right">Action</div>
            </div>
            <div className="divide-y divide-border overflow-y-auto flex-1">
              {filteredTasks.map(task => (
                <div key={task._id} className="grid grid-cols-12 gap-4 px-4 sm:px-6 py-4 items-center hover:bg-accent/50 transition-colors group cursor-pointer" onClick={() => handleTaskClick(task)}>
                  <div className="col-span-4 sm:col-span-5 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleComplete(task);
                        }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {task.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <span className={cn("font-medium transition-all", task.status === 'completed' && "line-through text-muted-foreground")}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {getListName(task.list)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Added {formatDate(task.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-center hidden sm:flex">
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-bold uppercase border border-border bg-background",
                      task.priority === 'high' ? "text-red-500" :
                      task.priority === 'medium' ? "text-orange-500" : "text-blue-500"
                    )}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-center text-sm text-muted-foreground hidden sm:flex">
                    {(() => {
                      const options = getStatusOptionsForTask(task, lists);
                      const selectedValue = options.some(status => status.id === task.status) ? task.status : 'unassigned';
                      return (
                        <select
                          value={selectedValue}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(task, e.target.value);
                          }}
                          className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {options.map(status => (
                            <option key={status.id} value={status.id}>{status.label}</option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                  <div className="col-span-2 flex justify-center text-sm text-muted-foreground hidden md:flex">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.dueDate)}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTask(task);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all mr-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this task?')) {
                            handleTaskDelete(task._id);
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredTasks.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No tasks found. {selectedList === 'all' ? 'Add one!' : 'Try selecting a different list.'}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 h-full">
            {currentList && !hasStatuses ? (
              <div className="col-span-1 md:col-span-3 flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/10 p-8 text-center">
                <button
                  onClick={() => handleOpenListManagement(currentList)}
                  className="mb-4 inline-flex items-center justify-center rounded-full border border-dashed border-border bg-background p-5 text-muted-foreground hover:border-primary hover:text-primary transition-all"
                  title="Add status"
                >
                  <Plus className="w-6 h-6" />
                </button>
                <p className="text-sm text-muted-foreground">No statuses yet. Add a status to start organizing this list.</p>
              </div>
            ) : (
              statusColumns.map(col => (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(col.id)}
                  className="flex flex-col gap-4 bg-secondary/20 p-4 border border-border rounded-lg transition-all hover:border-primary/50 hover:bg-secondary/30"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{col.label}</h3>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-secondary border border-border text-xs rounded-full">
                        {filteredTasks.filter(t => t.status === col.id).length}
                      </span>
                      {currentList && col.id === statusColumns[statusColumns.length - 1]?.id && (
                        <button
                          onClick={() => handleOpenListManagement(currentList)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary transition-all"
                          title="Add status"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {filteredTasks.filter(t => t.status === col.id).map(task => (
                      <div
                      key={task._id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className="p-4 bg-background border border-border hover:border-primary/50 transition-all cursor-move group rounded-lg opacity-100 hover:opacity-95 active:opacity-75"
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-bold uppercase border border-border rounded",
                          task.priority === 'high' ? "bg-red-500/10 text-red-500" :
                          task.priority === 'medium' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                        )}>
                          {task.priority}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleComplete(task);
                            }}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          >
                            {task.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTask(task);
                              setIsModalOpen(true);
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Are you sure you want to delete this task?')) {
                                handleTaskDelete(task._id);
                              }
                            }}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className={cn(
                        "font-medium mb-4 leading-relaxed",
                        task.status === 'completed' && "line-through text-muted-foreground"
                      )}>
                        {task.title}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.dueDate)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {getListName(task.list)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-3 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-sm bg-secondary/50 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                </div>
              </div>
            ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskPage;
