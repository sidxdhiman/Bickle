import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Search, LayoutList, LayoutGrid, MoreVertical,
  CheckCircle2, Circle, Calendar, Tag, AlertCircle, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const TaskModal = ({ isOpen, onClose, onSubmit, lists }) => {
  const [formData, setFormData] = useState({
    title: '',
    list: lists.length > 0 ? lists[0]._id : '',
    priority: 'medium',
    status: 'todo',
    dueDate: ''
  });

  useEffect(() => {
    if (lists.length > 0 && !formData.list) {
      setFormData(prev => ({ ...prev, list: lists[0]._id }));
    }
  }, [lists]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ title: '', list: lists[0]?._id || '', priority: 'medium', status: 'todo', dueDate: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold mb-6">Create New Task</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Title</label>
            <input 
              autoFocus
              required 
              type="text" 
              className="w-full bg-secondary border border-border p-2 text-foreground focus:outline-none focus:border-primary" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">List</label>
            <select 
              required 
              className="w-full bg-secondary border border-border p-2 text-foreground focus:outline-none focus:border-primary"
              value={formData.list}
              onChange={e => setFormData({...formData, list: e.target.value})}
            >
              {lists.map(list => (
                <option key={list._id} value={list._id}>{list.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Priority</label>
              <select 
                className="w-full bg-secondary border border-border p-2 text-foreground focus:outline-none focus:border-primary"
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value})}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Status</label>
              <select 
                className="w-full bg-secondary border border-border p-2 text-foreground focus:outline-none focus:border-primary"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Due Date</label>
            <input 
              type="date" 
              className="w-full bg-secondary border border-border p-2 text-foreground focus:outline-none focus:border-primary" 
              value={formData.dueDate} 
              onChange={e => setFormData({...formData, dueDate: e.target.value})} 
            />
          </div>
          <button type="submit" className="mt-4 w-full bg-primary text-primary-foreground py-2 font-medium hover:opacity-90 transition-opacity">
            Save Task
          </button>
        </form>
      </div>
    </div>
  );
};

const TaskPage = () => {
  const [view, setView] = useState('list');
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleCreateTask = async (taskData) => {
    try {
      const res = await axios.post('/tasks', taskData);
      setTasks(prev => [res.data, ...prev]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error creating task', error);
    }
  };

  const getListName = (id) => lists.find(l => l._id === id)?.name || 'Unknown';
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : 'No date';

  const statusColumns = [
    { id: 'todo', label: 'To Do', color: 'bg-slate-500' },
    { id: 'in-progress', label: 'In Progress', color: 'bg-blue-500' },
    { id: 'completed', label: 'Completed', color: 'bg-green-500' },
  ];

  if (loading) return <div className="h-full flex items-center justify-center text-muted-foreground">Loading tasks...</div>;

  return (
    <div className="h-full flex flex-col gap-6">
      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateTask}
        lists={lists}
      />
      
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-muted-foreground">Manage your daily productivity</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-secondary p-1 border border-border">
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
          <button onClick={() => setIsModalOpen(true)} className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-2 font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div >
      </header>

      <div className="flex-1 overflow-hidden">
        {view === 'list' ? (
          <div className="bg-secondary/50 border border-border overflow-hidden h-full flex flex-col">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-secondary">
              <div className="col-span-6">Task</div>
              <div className="col-span-2 text-center">Priority</div>
              <div className="col-span-2 text-center">Due Date</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            <div className="divide-y divide-border overflow-y-auto flex-1">
              {tasks.map(task => (
                <div key={task._id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-accent/50 transition-colors group">
                  <div className="col-span-6 flex items-center gap-3">
                    <button className="text-muted-foreground hover:text-primary transition-colors">
                      {task.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <span className={cn("font-medium transition-all", task.status === 'completed' && "line-through text-muted-foreground")}>
                      {task.title}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-bold uppercase border border-border bg-background",
                      task.priority === 'high' ? "text-red-500" :
                      task.priority === 'medium' ? "text-orange-500" : "text-blue-500"
                    )}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-center text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.dueDate)}
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && <div className="p-8 text-center text-muted-foreground">No tasks found. Add one!</div>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            {statusColumns.map(col => (
              <div key={col.id} className="flex flex-col gap-4 bg-secondary/20 p-4 border border-border">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2", col.color)} />
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{col.label}</h3>
                  <span className="ml-auto px-2 py-0.5 bg-secondary border border-border text-xs">
                    {tasks.filter(t => t.status === col.id).length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {tasks.filter(t => t.status === col.id).map(task => (
                    <div key={task._id} className="p-4 bg-background border border-border hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing group">
                      <div className="flex justify-between items-start mb-3">
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-bold uppercase border border-border",
                          task.priority === 'high' ? "bg-red-500/10 text-red-500" :
                          task.priority === 'medium' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                        )}>
                          {task.priority}
                        </span>
                        <button className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-all">
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="font-medium mb-4 leading-relaxed">{task.title}</p>
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
                  <button onClick={() => setIsModalOpen(true)} className="w-full py-3 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-sm bg-secondary/50">
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskPage;
