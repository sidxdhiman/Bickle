import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Pin,
  Folder,
  Cloud,
  Loader2,
  Bold,
  Italic,
  List,
  ChevronRight,
  ChevronDown,
  Edit2,
  X,
  Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';
import { NotesSkeleton } from '../components/Skeletons';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Add/Edit Category Modal
const CategoryModal = ({ isOpen, onClose, onSave, initialName = '', isEdit = false }) => {
  const [categoryName, setCategoryName] = useState(initialName);

  useEffect(() => {
    setCategoryName(initialName);
  }, [initialName, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (categoryName.trim()) {
      onSave(categoryName.trim());
      setCategoryName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-lg p-6 shadow-2xl max-w-sm w-full mx-4">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          {isEdit ? 'Edit Category' : 'Add Category'}
        </h2>
        <input
          type="text"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Category name"
          className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!categoryName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            {isEdit ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

const NotesPage = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const textAreaRef = useRef(null);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deleteOrMoveSelection, setDeleteOrMoveSelection] = useState('delete');
  const notesInCategory = categoryToDelete ? notes.filter(n => n.category === categoryToDelete) : [];
  const [lastAction, setLastAction] = useState(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimerRef = useRef(null);

  const getSelection = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return null;
    return {
      textarea,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      value: textarea.value,
    };
  };

  const updateNoteContent = (newContent, cursorPosition) => {
    setActiveNote(prev => ({ ...prev, content: newContent }));
    requestAnimationFrame(() => {
      if (!textAreaRef.current) return;
      textAreaRef.current.focus();
      if (cursorPosition !== undefined) {
        textAreaRef.current.selectionStart = cursorPosition;
        textAreaRef.current.selectionEnd = cursorPosition;
      }
    });
  };

  const wrapSelection = (wrapper, suffix = wrapper) => {
    const selection = getSelection();
    if (!selection) return;
    const { textarea, selectionStart, selectionEnd, value } = selection;
    const selectedText = value.slice(selectionStart, selectionEnd) || 'text';
    const wrappedText = `${wrapper}${selectedText}${suffix}`;
    const updatedContent = `${value.slice(0, selectionStart)}${wrappedText}${value.slice(selectionEnd)}`;
    updateNoteContent(updatedContent, selectionStart + wrappedText.length);
  };

  const applyListFormatting = () => {
    const selection = getSelection();
    if (!selection) return;
    const { selectionStart, selectionEnd, value } = selection;
    const selectedText = value.slice(selectionStart, selectionEnd) || 'List item';
    const lines = selectedText.split('\n').map(line => line.trim().startsWith('- ') ? line : `- ${line}`);
    const formattedText = lines.join('\n');
    const updatedContent = `${value.slice(0, selectionStart)}${formattedText}${value.slice(selectionEnd)}`;
    updateNoteContent(updatedContent, selectionStart + formattedText.length);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const notesRes = await axios.get('/notes');
        setNotes(notesRes.data);
        if (notesRes.data.length > 0) {
          setActiveNote(notesRes.data[0]);
        }

        try {
          const categoriesRes = await axios.get('/notes/categories');
          const loadedCategories = categoriesRes.data || [];
          setCategories(loadedCategories.length > 0 ? loadedCategories : ['General']);
        } catch (categoryError) {
          console.warn('Failed to load categories from backend, using note categories fallback:', categoryError);
          const noteCategories = [...new Set(notesRes.data.map(note => note.category).filter(Boolean))];
          setCategories(noteCategories.length > 0 ? noteCategories : ['General']);
        }
      } catch (error) {
        console.error('Failed to fetch notes data:', error);
        setCategories(['General']);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredNotes = notes.filter(note => {
    const matchesCategory = selectedCategory === 'All' || note.category === selectedCategory;
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddCategory = async (categoryName) => {
    try {
      const response = await axios.post('/notes/categories', { name: categoryName });
      const newCategory = response.data || categoryName;
      setCategories(prev => [...new Set([...prev, newCategory])]);
      setShowCategoryModal(false);
    } catch (error) {
      console.error('Failed to add category:', error);
      if (error.response?.status === 404) {
        setCategories(prev => [...new Set([...prev, categoryName])]);
        setShowCategoryModal(false);
        return;
      }
      alert('Failed to add category');
    }
  };

  const handleEditCategory = async (oldName, newName) => {
    try {
      await axios.put(`/notes/categories/${oldName}`, { name: newName });
      setCategories(categories.map(cat => cat === oldName ? newName : cat));
      setEditingCategory(null);
      setShowCategoryModal(false);
    } catch (error) {
      console.error('Failed to edit category:', error);
      alert('Failed to edit category');
    }
  };

  const handleDeleteCategory = async (categoryName) => {
    // open a modal to choose how to handle notes in the category
    setCategoryToDelete(categoryName);
    setShowDeleteCategoryModal(true);
  };

  const handleCreateNote = async () => {
    try {
      const newNote = {
        title: 'Untitled Note',
        content: '',
        category: selectedCategory !== 'All' ? selectedCategory : (categories[0] || 'General'),
        isPinned: false
      };
      const response = await axios.post('/notes', newNote);
      setNotes([response.data, ...notes]);
      setActiveNote(response.data);
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('Failed to create note');
    }
  };

  const handleSaveNote = async () => {
    if (!activeNote) return;
    try {
      await axios.put(`/notes/${activeNote._id}`, activeNote);
      setNotes(notes.map(n => n._id === activeNote._id ? activeNote : n));
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    }
  };

  // Autosave logic
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const saveTimer = useRef(null);

  const saveActiveNote = async (note) => {
    if (!note || !note._id) return;
    setSaveStatus('saving');
    try {
      const res = await axios.put(`/notes/${note._id}`, note);
      setNotes(prev => prev.map(n => n._id === note._id ? res.data : n));
      setActiveNote(res.data);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1200);
    } catch (err) {
      console.error('Autosave failed:', err);
      setSaveStatus('idle');
    }
  };

  useEffect(() => {
    if (!activeNote) return;
    // debounce saves: wait 1000ms after last change
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveActiveNote(activeNote), 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [activeNote?.title, activeNote?.content, activeNote?.category, activeNote?._id]);

  const handleDeleteNote = async () => {
    if (!activeNote) return;
    if (window.confirm('Delete this note?')) {
      try {
        await axios.delete(`/notes/${activeNote._id}`);
        const newNotes = notes.filter(n => n._id !== activeNote._id);
        setNotes(newNotes);
        setActiveNote(newNotes.length > 0 ? newNotes[0] : null);
      } catch (error) {
        console.error('Failed to delete note:', error);
        alert('Failed to delete note');
      }
    }
  };

  const handlePinNote = async () => {
    if (!activeNote) return;
    try {
      const updated = { ...activeNote, isPinned: !activeNote.isPinned };
      await axios.put(`/notes/${activeNote._id}`, updated);
      setActiveNote(updated);
      setNotes(notes.map(n => n._id === activeNote._id ? updated : n));
    } catch (error) {
      console.error('Failed to pin note:', error);
    }
  }

  if (loading) {
    return <NotesSkeleton />;
  }

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Undo toast */}
      {showUndoToast && lastAction && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 shadow-lg">
          <div className="text-sm">{lastAction.type === 'delete' ? `Deleted ${lastAction.notes.length} notes` : `Moved ${lastAction.notes.length} notes`}</div>
          <button
            onClick={async () => {
              if (!lastAction) return;
              if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); }
              // Try server undo first, but if it fails, fall back to local-only undo
              if (lastAction.type === 'delete') {
                try {
                  const recreated = await Promise.all(lastAction.notes.map(n => axios.post('/notes', { title: n.title, content: n.content || '', category: n.category || lastAction.category || 'General', isPinned: n.isPinned || false })));
                  const createdNotes = recreated.map(r => r.data);
                  setNotes(prev => [...createdNotes, ...prev]);
                } catch (err) {
                  console.warn('Server undo failed, restoring locally:', err);
                  // local restore only
                  setNotes(prev => [...lastAction.notes, ...prev]);
                }
              } else if (lastAction.type === 'move') {
                try {
                  await Promise.all(lastAction.notes.map(n => axios.put(`/notes/${n._id}`, { category: n.oldCategory })));
                  setNotes(prev => prev.map(n => {
                    const found = lastAction.notes.find(x => x._id === n._id);
                    return found ? { ...n, category: found.oldCategory } : n;
                  }));
                } catch (err) {
                  console.warn('Server undo move failed, restoring locally:', err);
                  setNotes(prev => prev.map(n => {
                    const found = lastAction.notes.find(x => x._id === n._id);
                    return found ? { ...n, category: found.oldCategory } : n;
                  }));
                }
              }
              setShowUndoToast(false);
              setLastAction(null);
            }}
            className="px-3 py-1 rounded bg-primary text-primary-foreground"
          >
            Undo
          </button>
        </div>
      )}
      {/* Delete Category Modal */}
      {showDeleteCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border border-border rounded-lg p-6 shadow-2xl max-w-lg w-full mx-4">
            <h2 className="text-lg font-semibold mb-3">Delete category "{categoryToDelete}"</h2>
            <p className="text-sm text-muted-foreground mb-4">This category contains notes. Choose how to handle those notes:</p>
            <label className="text-sm mb-2 block">Action</label>
            <div className="flex items-center gap-3 mb-4">
              <select
                id="delete-or-move"
                value={deleteOrMoveSelection}
                onChange={(e) => setDeleteOrMoveSelection(e.target.value)}
                className="flex-1 h-10 px-3 border border-border rounded-lg bg-secondary text-foreground"
              >
                <option value="delete">Delete notes ({notesInCategory.length})</option>
                {categories.filter(c => c !== categoryToDelete).map(c => (
                  <option key={c} value={`move::${c}`}>{`Move to: ${c}`}</option>
                ))}
              </select>

              <button
                onClick={async () => {
                  const sel = document.getElementById('delete-or-move');
                  const val = sel?.value;
                  const notesInCat = notesInCategory.map(n => ({ ...n }));
                  try {
                    if (val === 'delete') {
                      // capture for undo
                      setLastAction({ type: 'delete', notes: notesInCat, category: categoryToDelete });
                      await Promise.all(notesInCat.map(n => axios.delete(`/notes/${n._id}`)));
                    } else if (val?.startsWith('move::')) {
                      const target = val.split('::')[1];
                      setLastAction({ type: 'move', notes: notesInCat.map(n => ({ _id: n._id, oldCategory: n.category })), from: categoryToDelete, to: target });
                      await Promise.all(notesInCat.map(n => axios.put(`/notes/${n._id}`, { ...n, category: target })));
                    }
                    await axios.delete(`/notes/categories/${categoryToDelete}`);

                    // update local state
                    if (val === 'delete') {
                      setNotes(prev => prev.filter(n => n.category !== categoryToDelete));
                    } else if (val?.startsWith('move::')) {
                      const target = val.split('::')[1];
                      setNotes(prev => prev.map(n => n.category === categoryToDelete ? { ...n, category: target } : n));
                    }
                    setCategories(prev => prev.filter(c => c !== categoryToDelete));
                    setSelectedCategory('All');
                    setShowDeleteCategoryModal(false);
                    setCategoryToDelete(null);
                    if (activeNote && activeNote.category === categoryToDelete) {
                      if (val === 'delete') setActiveNote(null);
                      else setActiveNote({ ...activeNote, category: val.split('::')[1] });
                    }

                    // show undo toast for 5s
                    setShowUndoToast(true);
                    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                    undoTimerRef.current = setTimeout(() => {
                      setShowUndoToast(false);
                      setLastAction(null);
                    }, 5000);
                  } catch (err) {
                    console.error('Failed to process category deletion:', err);
                    alert('Operation failed');
                  }
                }}
                className={cn(
                  "h-10 px-4 rounded-lg",
                  deleteOrMoveSelection === 'delete' ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                )}
              >
                {deleteOrMoveSelection === 'delete' ? 'Delete notes' : `Move to: ${deleteOrMoveSelection.split('::')[1]}`}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowDeleteCategoryModal(false); setCategoryToDelete(null); }} className="px-4 py-2 bg-secondary rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
        }}
        onSave={(name) => {
          if (editingCategory) {
            handleEditCategory(editingCategory, name);
          } else {
            handleAddCategory(name);
          }
        }}
        initialName={editingCategory || ''}
        isEdit={!!editingCategory}
      />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-secondary border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary w-64 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleCreateNote}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden h-[calc(100vh-160px)]">
        {/* Folders Sidebar */}
        <div className="w-64 flex flex-col gap-4 shrink-0">
          <div className="p-4 rounded-2xl bg-secondary border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Folder className="w-3 h-3" /> Categories
              </h3>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryModal(true);
                }}
                className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
                title="Add category"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory('All')}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                  selectedCategory === 'All' ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                All Notes
              </button>
              {categories.length === 0 ? (
                <div className="text-xs text-muted-foreground italic p-3 text-center">
                  No categories yet. Add one to get started.
                </div>
              ) : (
                categories.map(cat => (
                  <div
                    key={cat}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                      selectedCategory === cat ? "bg-primary text-white" : "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <button
                      onClick={() => setSelectedCategory(cat)}
                      className="flex-1 text-left"
                    >
                      {cat}
                    </button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setShowCategoryModal(true);
                        }}
                        className="p-1 hover:bg-accent/50 rounded transition-colors"
                        title="Edit category"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors hover:text-red-500"
                        title="Delete category"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Notes List */}
        <div className="w-80 flex flex-col gap-3 overflow-y-auto pr-2 scrollbar-hide">
          {filteredNotes.map(note => (
            <div
              key={note._id}
              onClick={() => setActiveNote(note)}
              className={cn(
                "p-4 rounded-2xl border cursor-pointer transition-all group relative",
                activeNote?._id === note._id
                  ? "bg-secondary border-primary ring-1 ring-primary"
                  : "bg-secondary/50 border-border hover:border-primary/50"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] text-muted-foreground font-medium mr-2">{note.category}</span>
                {note.isPinned && <Pin className="w-3 h-3 text-primary" />}
              </div>
              <div className="mb-1">
                <h4 className="font-semibold text-sm truncate pr-4">{note.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {note.content}
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                <span>{/* placeholder for spacing */}</span>
                <span>2h ago</span>
              </div>
            </div>
          ))}
        </div>

        {/* Editor Area */}
        <div className="flex-1 bg-secondary/50 border border-border rounded-2xl flex flex-col overflow-hidden">
          {activeNote ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between bg-background/20 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => wrapSelection('**')} className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                    <Bold className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => wrapSelection('_')} className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                    <Italic className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={applyListFormatting} className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePinNote}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      activeNote?.isPinned
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDeleteNote}
                    className="p-2 rounded-md hover:bg-accent text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {/* autosave indicator */}
                  {saveStatus === 'saving' ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : saveStatus === 'saved' ? (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Cloud className="w-4 h-4" />
                      <span>Saved</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Autosave idle</div>
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                <select
                  value={activeNote.category || ''}
                  onChange={(e) => setActiveNote({...activeNote, category: e.target.value})}
                  className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm mb-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => setActiveNote({...activeNote, title: e.target.value})}
                  className="bg-transparent text-4xl font-bold outline-none mb-2 placeholder:text-muted-foreground"
                  placeholder="Note Title"
                />
                <textarea
                  ref={textAreaRef}
                  value={activeNote.content}
                  onChange={(e) => setActiveNote({...activeNote, content: e.target.value})}
                  className="bg-transparent flex-1 resize-none outline-none text-lg leading-relaxed text-foreground/80 placeholder:text-muted-foreground"
                  placeholder="Start writing your thoughts..."
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 italic">
              <FileText className="w-12 h-12 opacity-20" />
              <p>Select a note to view or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesPage;
