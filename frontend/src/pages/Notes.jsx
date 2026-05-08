import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Pin,
  Folder,
  Save,
  Bold,
  Italic,
  List,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const NotesPage = () => {
  const [notes, setNotes] = useState([
    { _id: '1', title: 'Project Bickle Vision', content: 'Build the most intuitive AI-native productivity OS ever.', category: 'Project', isPinned: true },
    { _id: '2', title: 'Weekly Grocery List', content: 'Milk, Eggs, Bread, Coffee beans.', category: 'Personal', isPinned: false },
    { _id: '3', title: 'Meeting Notes: Q2 Roadmap', content: 'Focus on the Tasks and Calendar sync first. ThenNotes.', category: 'Work', isPinned: false },
  ]);
  const [activeNote, setActiveNote] = useState(notes[0]);
  const [categories, setCategories] = useState(['General', 'Work', 'Personal', 'Project']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = notes.filter(note => {
    const matchesCategory = selectedCategory === 'All' || note.category === selectedCategory;
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="h-full flex flex-col gap-6">
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

        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden h-[calc(100vh-160px)]">
        {/* Folders Sidebar */}
        <div className="w-64 flex flex-col gap-4 shrink-0">
          <div className="p-4 rounded-2xl bg-secondary border border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Folder className="w-3 h-3" /> Categories
            </h3>
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
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                    selectedCategory === cat ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
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
                <h4 className="font-semibold text-sm truncate pr-4">{note.title}</h4>
                {note.isPinned && <Pin className="w-3 h-3 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {note.content}
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                <span>{note.category}</span>
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
                  <button className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                    <Bold className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                    <Italic className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                    <Pin className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-md hover:bg-accent text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 hover:opacity-90 transition-all">
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                </div>
              </div>
              <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => setActiveNote({...activeNote, title: e.target.value})}
                  className="bg-transparent text-4xl font-bold outline-none mb-6 placeholder:text-muted-foreground"
                  placeholder="Note Title"
                />
                <textarea
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
