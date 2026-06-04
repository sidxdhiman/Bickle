import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Plus, Search, LayoutList, LayoutGrid, MoreVertical,
  CheckCircle2, Circle, Calendar, Tag, AlertCircle, X,
  Edit, Trash2, Star, Filter, Settings, Grip
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TasksSkeleton } from '../components/Skeletons';

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

const isTaskOverdue = (task) => {
  if (!task?.dueDate || task.status === 'completed') return false;
  const due = new Date(task.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
};

const TaskModal = ({ isOpen, onClose, onSubmit, lists, task = null, defaultListId = '' }) => {
  const getDefaultStatusForList = (listId) => {
    const list = lists.find(l => l._id === listId);
    return list?.statuses?.[0]?.id || 'todo';
  };

  const getInitialListId = () => {
    return task?.list || defaultListId || lists[0]?._id || '';
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    list: getInitialListId(),
    priority: 'medium',
    status: getDefaultStatusForList(getInitialListId()),
    dueDate: '',
    tags: []
  });

  const selectedListObj = lists.find(l => l._id === formData.list);
  let statusOptions = selectedListObj?.statuses || defaultStatusOptions;
  if (!statusOptions.some(status => status.id === formData.status)) {
    statusOptions = [{ id: 'unassigned', label: '-' }, ...statusOptions];
  }


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
    if (!isOpen) return;

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
    } else {
      const initialList = defaultListId || lists[0]?._id || '';
      setFormData({
        title: '',
        description: '',
        list: initialList,
        priority: 'medium',
        status: getDefaultStatusForList(initialList),
        dueDate: '',
        tags: []
      });
    }
  }, [isOpen, task, lists, defaultListId]);


  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    if (!task) {
      const resetListId = defaultListId || lists[0]?._id || '';
      setFormData({
        title: '',
        description: '',
        list: resetListId,
        priority: 'medium',
        status: getDefaultStatusForList(resetListId),
        dueDate: '',
        tags: []
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3 sm:gap-0">
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
              <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">Description</h3>
              <div className="bg-secondary/30 border border-border rounded-md p-3">
                <p className="text-sm leading-relaxed text-foreground">{task.description}</p>
              </div>
            </div>
          )}

          {/* Task details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">List</h3>
              <p className="text-sm text-foreground">{getListName(task.list)}</p>
            </div>
            <div className="bg-secondary/30 border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Due Date</h3>
              <p className={cn("text-sm", isTaskOverdue(task) ? "text-red-600 font-semibold" : "text-foreground")}>{formatDate(task.dueDate)}</p>
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [contextMenuTask, setContextMenuTask] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // For mobile sidebar

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

        // If a taskId is present in the URL, open that task in the detail modal
        const taskId = searchParams.get('taskId');
        if (taskId) {
          const found = currentTasks.find(t => t._id === taskId);
          if (found) {
            setSelectedTask(found);
            setIsDetailModalOpen(true);
            setSearchParams({});
          }
        }
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

  const getDefaultStatusForList = (listId) => {
    const list = lists.find(l => l._id === listId);
    return list?.statuses?.[0]?.id || 'todo';
  };

  const openNewTaskModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleTaskContextMenu = (e, task) => {
    e.preventDefault();
    setContextMenuTask(task);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenuTask(null);
  };

  useEffect(() => {
    if (!contextMenuTask) return;
    const handleClick = () => closeContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenuTask]);

  const handleMoveTask = async (task, listId) => {
    if (!task || task.list === listId) {
      closeContextMenu();
      return;
    }
    const status = getDefaultStatusForList(listId);
    try {
      const res = await axios.put(`/tasks/${task._id}`, { list: listId, status });
      setTasks(prev => prev.map(t => t._id === task._id ? res.data : t));
      if (selectedTask?._id === task._id) {
        setSelectedTask(res.data);
      }
    } catch (error) {
      console.error('Error moving task:', error);
    } finally {
      closeContextMenu();
    }
  };

  if (loading) return <TasksSkeleton />;

  return (
    <div className="flex flex-col lg:flex-row h-full max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 gap-6">
      {/* Mobile Sidebar Toggle */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-40 p-3 rounded-full bg-primary text-primary-foreground shadow-lg"
        onClick={() => setIsSidebarOpen(true)}
      >
        <Grip className="w-6 h-6" />
      </button>

      {/* Task List Sidebar - Mobile Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden",
          isSidebarOpen ? "block" : "hidden"
        )}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 h-full bg-secondary border-r border-border flex flex-col p-4 gap-8 transition-transform duration-300 lg:relative lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <h2 className="text-lg font-bold flex items-center justify-between">
          My Task Lists
          <button
            onClick={() => setIsCreateListOpen(true)}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            title="Create new list"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            className="lg:hidden p-2 rounded-full hover:bg-accent transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </h2>
        <nav className="flex-1 space-y-2 overflow-y-auto">
          {lists.length > 0 ? (
            lists.map(list => (
              <div
                key={list._id}
                onClick={() => {
                  setSelectedList(list._id);
                  setIsSidebarOpen(false); // Close sidebar on selection
                }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors",
                  selectedList === list._id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="font-medium text-sm">{list.name}</span>
                <div className="flex items-center gap-1">
                  {selectedList === list._id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingList(list);
                        setIsListManagementOpen(true);
                      }}
                      className="p-1.5 rounded-full hover:bg-primary/80"
                      title="Edit list"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground">
                    {tasks.filter(task => task.list === list._id).length}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No lists yet. Create one!</p>
          )}
        </nav>
      </div>

      {/* Main Task Content */}
      <div className="flex-1 bg-background border border-border rounded-lg p-4 sm:p-6 space-y-6 overflow-hidden">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {selectedList === 'all' ? 'All Tasks' : lists.find(l => l._id === selectedList)?.name}
              <span className="text-base font-medium text-muted-foreground">({filteredTasks.length} tasks)</span>
            </h1>
            {selectedList !== 'all' && lists.find(l => l._id === selectedList)?.description && (
              <p className="text-sm text-muted-foreground">{lists.find(l => l._id === selectedList).description}</p>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </header>

        {/* Filters and View Mode */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 border-b border-border">
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tasks..."
                // value={searchQuery}
                // onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              // onClick={() => setIsFilterOpen(prev => !prev)}
              className="flex items-center gap-2 px-3 py-2 bg-secondary text-muted-foreground rounded-md hover:bg-accent transition-colors text-sm font-medium"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <div className="flex rounded-md overflow-hidden bg-secondary border border-border">
              <button
                onClick={() => setView('list')}
                className={cn(
                  "p-2 transition-colors",
                  view === 'list' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
                title="List View"
              >
                <LayoutList className="w-5 h-5" />
              </button>
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  "p-2 transition-colors",
                  view === 'kanban' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
                title="Kanban View"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Task Display */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {filteredTasks.length > 0 ? (
            view === 'list' ? (
              <div className="space-y-3">
                {filteredTasks.map(task => (
                  <div
                    key={task._id}
                    className="flex items-center justify-between bg-secondary border border-border rounded-md p-3 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => {
                      setSelectedTask(task);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          // handleUpdateTask({ ...task, status: task.status === 'completed' ? 'todo' : 'completed' });
                        }}
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          task.status === 'completed' ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:bg-accent"
                        )}
                      >
                        {task.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className={cn("font-medium", task.status === 'completed' && "line-through text-muted-foreground")}>{task.title}</p>
                        <p className="text-sm text-muted-foreground">{getStatusLabel(task.status)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isTaskOverdue(task) && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <span className={cn(
                        "px-2 py-0.5 text-xs font-medium rounded-full",
                        task.priority === 'high' ? "bg-red-500/10 text-red-500" :
                        task.priority === 'medium' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                      )}>{task.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lists.filter(list => list._id === selectedList || selectedList === 'all').map(list => (
                  <div key={list._id} className="bg-secondary border border-border rounded-md p-4 space-y-3">
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2" style={{ color: list.color }}>
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: list.color }}></span>
                      {list.name}
                    </h3>
                    {filteredTasks
                      .filter(task => task.list === list._id)
                      .map(task => (
                        <div
                          key={task._id}
                          className="bg-background border border-border rounded-md p-3 cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => {
                            setSelectedTask(task);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          <p className="font-medium mb-1 text-sm">{task.title}</p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                              <Calendar className="w-3 h-3" /> {new Date(task.dueDate).toLocaleDateString()}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "px-2 py-0.5 text-xs font-medium rounded-full",
                              task.priority === 'high' ? "bg-red-500/10 text-red-500" :
                              task.priority === 'medium' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                            )}>{task.priority}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // handleUpdateTask({ ...task, status: task.status === 'completed' ? 'todo' : 'completed' });
                              }}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                task.status === 'completed' ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:bg-accent"
                              )}
                            >
                              {task.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    {filteredTasks.filter(task => task.list === list._id).length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No tasks in this list.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : ( selectedList !== 'all' && filteredTasks.length === 0 ) ? (
            <div className="text-center py-12 text-muted-foreground">
              <LayoutList className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No tasks found for this list.</p>
              <p className="text-sm">Try creating a new task!</p>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <LayoutList className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No tasks found.</p>
              <p className="text-sm">Create your first task to get started!</p>
            </div>
          )}
        </div>
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
        lists={lists}
        defaultListId={selectedList !== 'all' ? selectedList : (lists.length > 0 ? lists[0]._id : '')}
      />

      {editingTask && (
        <TaskModal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={handleUpdateTask}
          lists={lists}
          task={editingTask}
        />
      )}

      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        task={selectedTask}
        lists={lists}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        onEdit={(task) => {
          setEditingTask(task);
          setIsModalOpen(true);
        }}
      />

      <CreateListModal
        isOpen={isCreateListOpen}
        onClose={() => setIsCreateListOpen(false)}
        onCreate={handleCreateList}
      />

      <ListManagementModal
        isOpen={isListManagementOpen}
        onClose={() => setIsListManagementOpen(false)}
        list={editingList}
        onUpdate={() => {
          // Re-fetch lists and tasks to ensure data consistency after list update
          // This is a simplified approach, a more robust solution would update local state intelligently
          axios.get('/lists').then(res => setLists(res.data));
          axios.get('/tasks').then(res => setTasks(res.data));
        }}
      />
    </div>
  );
};

export default TaskPage;
